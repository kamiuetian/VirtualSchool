import { Inject, Injectable, Logger } from "@nestjs/common";
import type { RemoteCommandType } from "@virtual-school/shared";
import type {
  Prisma,
  RemoteCommand,
  RetentionSettings,
} from "../../../api/src/generated/prisma";
import { WorkerPrismaService } from "../prisma/worker-prisma.service";
import type {
  WorkerJobData,
  WorkerJobName,
  WorkerJobResult,
} from "./worker-job.types";

const mdmConnectorCommandTypes: RemoteCommandType[] = ["LOCK", "WIPE"];
const deploymentCommandAlertTypes: Partial<
  Record<
    RemoteCommandType,
    "APP_DEPLOYMENT_FAILED" | "POLICY_DEPLOYMENT_FAILED"
  >
> = {
  APP_INSTALL: "APP_DEPLOYMENT_FAILED",
  APP_REMOVE: "APP_DEPLOYMENT_FAILED",
  POLICY_REFRESH: "POLICY_DEPLOYMENT_FAILED",
};

type RetentionCutoffs = {
  auditEvents: Date | null;
  diagnostics: Date;
  exportArtifacts: Date;
  remoteCommands: Date;
  resolvedAlerts: Date;
  supportNotes: Date;
};

@Injectable()
export class WorkerJobsService {
  private readonly logger = new Logger(WorkerJobsService.name);

  constructor(
    @Inject(WorkerPrismaService)
    private readonly prisma: WorkerPrismaService,
  ) {}

  async processJob(
    name: WorkerJobName,
    data: WorkerJobData,
  ): Promise<WorkerJobResult> {
    const tenantIds = await this.resolveTenantIds(data.tenantId);
    const details: Record<string, unknown>[] = [];

    for (const tenantId of tenantIds) {
      if (name === "commands.dispatch") {
        details.push(await this.processCommandsForTenant(tenantId));
      } else if (name === "alerts.offline-scan") {
        details.push(await this.scanOfflineAlertsForTenant(tenantId));
      } else if (name === "retention.dry-run") {
        details.push(await this.runRetentionForTenant(tenantId, "DRY_RUN"));
      } else if (name === "retention.apply") {
        details.push(await this.runRetentionForTenant(tenantId, "APPLY"));
      }
    }

    return {
      details,
      processed: details.length,
      tenants: tenantIds.length,
    };
  }

  private async resolveTenantIds(
    tenantId: string | undefined,
  ): Promise<string[]> {
    if (tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        select: {
          id: true,
        },
        where: {
          id: tenantId,
        },
      });

      return tenant ? [tenant.id] : [];
    }

    const tenants = await this.prisma.tenant.findMany({
      select: {
        id: true,
      },
      where: {
        status: {
          in: ["ACTIVE", "PILOT"],
        },
      },
    });

    return tenants.map((tenant) => tenant.id);
  }

  private async processCommandsForTenant(
    tenantId: string,
  ): Promise<Record<string, unknown>> {
    const expired = await this.expireOverdueCommands(tenantId);
    const dispatchEnabled =
      process.env.WORKER_MDM_DISPATCH_ENABLED?.toLowerCase() === "true";
    const dispatched = dispatchEnabled
      ? await this.dispatchQueuedConnectorCommands(tenantId)
      : {
          accepted: 0,
          failed: 0,
          skipped: 0,
        };

    return {
      accepted: dispatched.accepted,
      expired,
      failed: dispatched.failed,
      job: "commands.dispatch",
      skipped: dispatched.skipped,
      tenantId,
    };
  }

  private async expireOverdueCommands(tenantId: string): Promise<number> {
    const now = new Date();
    const overdueCommands = await this.prisma.remoteCommand.findMany({
      where: {
        expiresAt: {
          lte: now,
        },
        status: {
          in: ["QUEUED", "DELIVERED"],
        },
        tenantId,
      },
    });

    for (const command of overdueCommands) {
      await this.prisma.$transaction(async (tx) => {
        const saved = await tx.remoteCommand.update({
          data: {
            completedAt: now,
            failureReason: "Command expired before worker completion",
            status: "EXPIRED",
          },
          where: {
            id: command.id,
          },
        });

        await tx.auditEvent.create({
          data: {
            action: "remote_command.expire",
            newValue: {
              status: "EXPIRED",
              worker: true,
            },
            object: "RemoteCommand",
            objectId: command.id,
            oldValue: {
              status: command.status,
            },
            outcome: "EXPIRED",
            tenantId,
          },
        });

        await this.createOrRefreshDeploymentFailureAlert(tx, saved);
      });
    }

    return overdueCommands.length;
  }

  private async dispatchQueuedConnectorCommands(
    tenantId: string,
  ): Promise<{ accepted: number; failed: number; skipped: number }> {
    const limit = this.envInt("WORKER_COMMAND_DISPATCH_LIMIT", 25);
    const now = new Date();
    const commands = await this.prisma.remoteCommand.findMany({
      include: {
        device: {
          select: {
            connectorDeviceName: true,
            enrollmentId: true,
            id: true,
            tenantId: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
      take: limit * 3,
      where: {
        OR: [
          {
            expiresAt: null,
          },
          {
            expiresAt: {
              gt: now,
            },
          },
        ],
        status: "QUEUED",
        tenantId,
        type: {
          in: mdmConnectorCommandTypes,
        },
      },
    });
    const retryable = commands
      .filter((command) => command.attempts < command.maxAttempts)
      .slice(0, limit);

    let accepted = 0;
    let failed = 0;
    let skipped = 0;

    for (const command of retryable) {
      if (process.env.MDM_CONNECTOR_MODE === "android-management") {
        skipped += 1;
        this.logger.warn(
          `Skipping Android Management dispatch for ${command.id}; API connector remains the source of truth until worker adapter credentials are configured.`,
        );
        continue;
      }

      const delivered = await this.markDeliveryAttempt(command);
      await this.markStubAccepted(delivered);
      accepted += 1;
    }

    return {
      accepted,
      failed,
      skipped,
    };
  }

  private async markDeliveryAttempt(
    command: RemoteCommand,
  ): Promise<RemoteCommand> {
    return this.prisma.remoteCommand.update({
      data: {
        attempts: {
          increment: 1,
        },
        deliveredAt: new Date(),
        lastAttemptAt: new Date(),
        status: "DELIVERED",
      },
      where: {
        id: command.id,
      },
    });
  }

  private async markStubAccepted(command: RemoteCommand): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.remoteCommand.update({
        data: {
          connectorCommandId: `stub:${command.id}`,
          failureReason: null,
          result: {
            accepted: true,
            connector: "STUB",
            mode: "worker",
          },
          status: "DELIVERED",
        },
        where: {
          id: command.id,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "remote_command.dispatch",
          newValue: {
            connector: "STUB",
            connectorCommandId: `stub:${command.id}`,
            status: "DELIVERED",
            worker: true,
          },
          object: "RemoteCommand",
          objectId: command.id,
          oldValue: {
            status: command.status,
          },
          outcome: "DELIVERED",
          tenantId: command.tenantId,
        },
      });
    });
  }

  private async scanOfflineAlertsForTenant(
    tenantId: string,
  ): Promise<Record<string, unknown>> {
    const offlineAfterMinutes = this.envInt("WORKER_OFFLINE_AFTER_MINUTES", 60);
    const cutoff = new Date(Date.now() - offlineAfterMinutes * 60_000);
    const devices = await this.prisma.device.findMany({
      where: {
        OR: [
          {
            lastCheckInAt: null,
          },
          {
            lastCheckInAt: {
              lt: cutoff,
            },
          },
        ],
        status: {
          notIn: ["RETIRED", "ENROLLMENT_FAILED"],
        },
        tenantId,
      },
    });

    let alertsCreatedOrUpdated = 0;

    await this.prisma.$transaction(async (tx) => {
      for (const device of devices) {
        await this.openOrRefreshAlert(tx, tenantId, device.id, {
          message: `Device ${device.serialNumber} has not checked in since ${
            device.lastCheckInAt?.toISOString() ?? "enrollment"
          }.`,
          metadata: {
            lastCheckInAt: device.lastCheckInAt?.toISOString() ?? null,
            offlineAfterMinutes,
            serialNumber: device.serialNumber,
            worker: true,
          },
          severity: "WARNING",
          source: "WORKER_OFFLINE_SCAN",
          title: "Device offline",
          type: "DEVICE_OFFLINE",
        });
        alertsCreatedOrUpdated += 1;
      }

      await tx.auditEvent.create({
        data: {
          action: "device_alert.offline_scan",
          newValue: {
            alertsCreatedOrUpdated,
            evaluatedDevices: devices.length,
            offlineAfterMinutes,
            worker: true,
          },
          object: "DeviceAlert",
          outcome: "SUCCESS",
          tenantId,
        },
      });
    });

    return {
      alertsCreatedOrUpdated,
      evaluatedDevices: devices.length,
      job: "alerts.offline-scan",
      offlineAfterMinutes,
      tenantId,
    };
  }

  private async runRetentionForTenant(
    tenantId: string,
    mode: "DRY_RUN" | "APPLY",
  ): Promise<Record<string, unknown>> {
    if (
      mode === "APPLY" &&
      process.env.WORKER_RETENTION_APPLY_ENABLED !== "true"
    ) {
      return {
        job: "retention.apply",
        skipped: true,
        tenantId,
      };
    }

    const settings = await this.getOrCreateRetentionSettings(tenantId);
    const cutoffs = this.retentionCutoffs(settings);
    const result =
      mode === "APPLY"
        ? await this.applyRetentionDeletes(tenantId, cutoffs, settings)
        : await this.countRetentionTargets(tenantId, cutoffs, settings);

    const run = await this.prisma.$transaction(async (tx) => {
      const created = await tx.dataRetentionRun.create({
        data: {
          actorId: "worker",
          completedAt: new Date(),
          cutoffs: this.cutoffsJson(cutoffs) as Prisma.InputJsonValue,
          mode,
          reason: "Scheduled worker retention job",
          result: result as Prisma.InputJsonValue,
          status: "COMPLETED",
          tenantId,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: mode === "APPLY" ? "retention.apply" : "retention.dry_run",
          actorId: "worker",
          newValue: {
            result,
            worker: true,
          },
          object: "DataRetentionRun",
          objectId: created.id,
          outcome: "COMPLETED",
          reason: "Scheduled worker retention job",
          tenantId,
        },
      });

      return created;
    });

    return {
      job: mode === "APPLY" ? "retention.apply" : "retention.dry-run",
      result,
      runId: run.id,
      tenantId,
    };
  }

  private async countRetentionTargets(
    tenantId: string,
    cutoffs: RetentionCutoffs,
    settings: RetentionSettings,
  ): Promise<Record<string, number>> {
    const [
      diagnostics,
      resolvedAlerts,
      remoteCommands,
      supportNotes,
      auditEvents,
    ] = await Promise.all([
      this.prisma.deviceDiagnostic.count({
        where: {
          reportedAt: {
            lt: cutoffs.diagnostics,
          },
          tenantId,
        },
      }),
      this.prisma.deviceAlert.count({
        where: {
          resolvedAt: {
            lt: cutoffs.resolvedAlerts,
          },
          status: "RESOLVED",
          tenantId,
        },
      }),
      this.prisma.remoteCommand.count({
        where: {
          completedAt: {
            lt: cutoffs.remoteCommands,
          },
          status: {
            in: ["EXECUTED", "FAILED", "EXPIRED"],
          },
          tenantId,
        },
      }),
      this.prisma.supportNote.count({
        where: {
          status: "RESOLVED",
          tenantId,
          updatedAt: {
            lt: cutoffs.supportNotes,
          },
        },
      }),
      settings.auditRetentionDays
        ? this.prisma.auditEvent.count({
            where: {
              createdAt: {
                lt: cutoffs.auditEvents ?? undefined,
              },
              tenantId,
            },
          })
        : Promise.resolve(0),
    ]);

    return {
      auditEvents,
      diagnostics,
      exportArtifacts: 0,
      remoteCommands,
      resolvedAlerts,
      supportNotes,
    };
  }

  private async applyRetentionDeletes(
    tenantId: string,
    cutoffs: RetentionCutoffs,
    settings: RetentionSettings,
  ): Promise<Record<string, number>> {
    const [
      diagnostics,
      resolvedAlerts,
      remoteCommands,
      supportNotes,
      auditEvents,
    ] = await Promise.all([
      this.prisma.deviceDiagnostic.deleteMany({
        where: {
          reportedAt: {
            lt: cutoffs.diagnostics,
          },
          tenantId,
        },
      }),
      this.prisma.deviceAlert.deleteMany({
        where: {
          resolvedAt: {
            lt: cutoffs.resolvedAlerts,
          },
          status: "RESOLVED",
          tenantId,
        },
      }),
      this.prisma.remoteCommand.deleteMany({
        where: {
          completedAt: {
            lt: cutoffs.remoteCommands,
          },
          status: {
            in: ["EXECUTED", "FAILED", "EXPIRED"],
          },
          tenantId,
        },
      }),
      this.prisma.supportNote.deleteMany({
        where: {
          status: "RESOLVED",
          tenantId,
          updatedAt: {
            lt: cutoffs.supportNotes,
          },
        },
      }),
      settings.auditRetentionDays
        ? this.prisma.auditEvent.deleteMany({
            where: {
              action: {
                notIn: ["retention.apply", "retention.dry_run"],
              },
              createdAt: {
                lt: cutoffs.auditEvents ?? undefined,
              },
              tenantId,
            },
          })
        : Promise.resolve({ count: 0 }),
    ]);

    return {
      auditEvents: auditEvents.count,
      diagnostics: diagnostics.count,
      exportArtifacts: 0,
      remoteCommands: remoteCommands.count,
      resolvedAlerts: resolvedAlerts.count,
      supportNotes: supportNotes.count,
    };
  }

  private async getOrCreateRetentionSettings(
    tenantId: string,
  ): Promise<RetentionSettings> {
    const current = await this.prisma.retentionSettings.findUnique({
      where: {
        tenantId,
      },
    });

    if (current) {
      return current;
    }

    return this.prisma.retentionSettings.create({
      data: {
        tenantId,
      },
    });
  }

  private async createOrRefreshDeploymentFailureAlert(
    tx: Prisma.TransactionClient,
    command: RemoteCommand,
  ): Promise<void> {
    const alertType =
      deploymentCommandAlertTypes[command.type as RemoteCommandType];

    if (!alertType) {
      return;
    }

    const payload = this.jsonRecord(command.payload) ?? {};
    const now = new Date();
    await this.openOrRefreshAlert(tx, command.tenantId, command.deviceId, {
      message: `${command.type} command expired for ${String(
        payload.appName ?? payload.packageId ?? payload.policyId ?? command.id,
      )}: ${command.failureReason ?? "Command expired"}`,
      metadata: {
        appId: payload.appId ?? null,
        commandId: command.id,
        commandStatus: command.status,
        commandType: command.type,
        packageId: payload.packageId ?? null,
        policyId: payload.policyId ?? null,
        worker: true,
      },
      severity: "WARNING",
      source: "WORKER_COMMAND_RECONCILIATION",
      title:
        alertType === "APP_DEPLOYMENT_FAILED"
          ? "App deployment failed"
          : "Policy deployment failed",
      type: alertType,
    });
    await tx.deviceAlert.updateMany({
      data: {
        lastSeenAt: now,
      },
      where: {
        deviceId: command.deviceId,
        status: "OPEN",
        tenantId: command.tenantId,
        type: alertType,
      },
    });
  }

  private async openOrRefreshAlert(
    tx: Prisma.TransactionClient,
    tenantId: string,
    deviceId: string,
    input: {
      message: string;
      metadata: Record<string, unknown>;
      severity: string;
      source: string;
      title: string;
      type: string;
    },
  ): Promise<void> {
    const now = new Date();
    const existing = await tx.deviceAlert.findFirst({
      orderBy: {
        lastSeenAt: "desc",
      },
      where: {
        deviceId,
        status: {
          in: ["OPEN", "ACKNOWLEDGED"],
        },
        tenantId,
        type: input.type,
      },
    });

    if (existing) {
      await tx.deviceAlert.update({
        data: {
          acknowledgedAt: null,
          acknowledgedBy: null,
          lastSeenAt: now,
          message: input.message,
          metadata: input.metadata as Prisma.InputJsonValue,
          severity: input.severity,
          source: input.source,
          status: "OPEN",
          title: input.title,
        },
        where: {
          id: existing.id,
        },
      });
      return;
    }

    await tx.deviceAlert.create({
      data: {
        deviceId,
        firstSeenAt: now,
        lastSeenAt: now,
        message: input.message,
        metadata: input.metadata as Prisma.InputJsonValue,
        severity: input.severity,
        source: input.source,
        status: "OPEN",
        tenantId,
        title: input.title,
        type: input.type,
      },
    });
  }

  private retentionCutoffs(settings: RetentionSettings): RetentionCutoffs {
    return {
      auditEvents: settings.auditRetentionDays
        ? this.daysAgo(settings.auditRetentionDays)
        : null,
      diagnostics: this.daysAgo(settings.diagnosticRetentionDays),
      exportArtifacts: this.daysAgo(settings.exportArtifactRetentionDays),
      remoteCommands: this.daysAgo(settings.commandHistoryRetentionDays),
      resolvedAlerts: this.daysAgo(settings.resolvedAlertRetentionDays),
      supportNotes: this.daysAgo(settings.supportNoteRetentionDays),
    };
  }

  private cutoffsJson(
    cutoffs: RetentionCutoffs,
  ): Record<string, string | null> {
    return {
      auditEvents: cutoffs.auditEvents?.toISOString() ?? null,
      diagnostics: cutoffs.diagnostics.toISOString(),
      exportArtifacts: cutoffs.exportArtifacts.toISOString(),
      remoteCommands: cutoffs.remoteCommands.toISOString(),
      resolvedAlerts: cutoffs.resolvedAlerts.toISOString(),
      supportNotes: cutoffs.supportNotes.toISOString(),
    };
  }

  private daysAgo(days: number): Date {
    return new Date(Date.now() - days * 86_400_000);
  }

  private envInt(name: string, fallback: number): number {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? value : fallback;
  }

  private jsonRecord(value: Prisma.JsonValue): Record<string, unknown> | null {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return null;
  }
}
