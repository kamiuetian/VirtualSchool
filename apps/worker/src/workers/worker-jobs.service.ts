import { Inject, Injectable } from "@nestjs/common";
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
import {
  WorkerMdmConnector,
  type WorkerMdmDispatchResult,
} from "./worker-mdm.connector";
import { NotificationEmailService } from "./notification-email.service";
import { ClassroomSyncService } from "./classroom-sync.service";
import { WebhookDeliveryService } from "./webhook-delivery.service";
import { AutomationEngineService } from "./automation-engine.service";

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
  constructor(
    @Inject(WorkerPrismaService)
    private readonly prisma: WorkerPrismaService,
    @Inject(WorkerMdmConnector)
    private readonly mdmConnector: WorkerMdmConnector,
    @Inject(NotificationEmailService)
    private readonly emailService: NotificationEmailService = new NotificationEmailService(),
    @Inject(ClassroomSyncService)
    private readonly classroomSyncService: ClassroomSyncService = new ClassroomSyncService(
      prisma,
    ),
    @Inject(WebhookDeliveryService)
    private readonly webhookDeliveryService: WebhookDeliveryService = new WebhookDeliveryService(
      prisma,
    ),
    @Inject(AutomationEngineService)
    private readonly automationEngineService: AutomationEngineService = new AutomationEngineService(
      prisma,
    ),
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
      } else if (name === "notifications.dispatch") {
        details.push(await this.dispatchNotificationsForTenant(tenantId));
      } else if (name === "engagement.scan") {
        details.push(await this.scanEngagementRiskForTenant(tenantId));
      } else if (name === "automation.evaluate") {
        details.push(
          await this.automationEngineService.processTenant(tenantId),
        );
      } else if (name === "classroom.sync") {
        details.push(await this.classroomSyncService.processTenant(tenantId));
      } else if (name === "webhooks.dispatch") {
        details.push(await this.webhookDeliveryService.processTenant(tenantId));
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

  private async dispatchNotificationsForTenant(
    tenantId: string,
  ): Promise<Record<string, unknown>> {
    const preferences = await this.prisma.notificationPreference.findUnique({
      where: { tenantId },
    });
    if (!preferences || preferences.recipients.length === 0) {
      return {
        delivered: 0,
        failed: 0,
        job: "notifications.dispatch",
        skipped: true,
        tenantId,
      };
    }
    const enabledTypes = [
      ...(preferences.offlineEnabled ? ["DEVICE_OFFLINE"] : []),
      ...(preferences.policyFailureEnabled ? ["POLICY_DEPLOYMENT_FAILED"] : []),
      ...(preferences.appFailureEnabled ? ["APP_DEPLOYMENT_FAILED"] : []),
      ...(preferences.lostDeviceEnabled ? ["DEVICE_LOST"] : []),
      ...(preferences.repeatedEnrollmentEnabled
        ? ["REPEATED_ENROLLMENT_FAILED"]
        : []),
      ...(preferences.engagementRiskEnabled
        ? ["ENGAGEMENT_RISK", "ENGAGEMENT_WEEKLY_SUMMARY"]
        : []),
    ];
    const alerts = await this.prisma.deviceAlert.findMany({
      include: { device: { select: { serialNumber: true } } },
      orderBy: { firstSeenAt: "asc" },
      take: this.envInt("WORKER_NOTIFICATION_BATCH_SIZE", 100),
      where: {
        status: { in: ["OPEN", "ACKNOWLEDGED"] },
        tenantId,
        type: { in: enabledTypes },
      },
    });
    let delivered = 0;
    let failed = 0;
    for (const alert of alerts) {
      const metadata = (alert.metadata ?? {}) as Record<string, unknown>;
      const scopedRecipients = Array.isArray(metadata.notificationRecipients)
        ? metadata.notificationRecipients.filter(
            (value): value is string => typeof value === "string",
          )
        : preferences.recipients;
      for (const recipient of scopedRecipients) {
        const existing = await this.prisma.notificationDelivery.findUnique({
          where: {
            alertId_recipient_channel: {
              alertId: alert.id,
              channel: "EMAIL",
              recipient,
            },
          },
        });
        if (
          existing?.status === "DELIVERED" ||
          (existing && existing.attemptCount >= 3)
        )
          continue;
        const result = await this.emailService.send({
          alertId: alert.id,
          recipient,
          subject: `[Virtual School] ${alert.title}`,
          tenantId,
          text: `${alert.message}\n\nDevice: ${alert.device?.serialNumber ?? "tenant-wide"}\nSeverity: ${alert.severity}`,
        });
        await this.prisma.$transaction(async (tx) => {
          const saved = await tx.notificationDelivery.upsert({
            create: {
              alertId: alert.id,
              attemptCount: 1,
              channel: "EMAIL",
              deliveredAt: result.delivered ? new Date() : null,
              failureReason: result.failureReason,
              lastAttemptAt: new Date(),
              provider: result.provider,
              providerId: result.providerId,
              recipient,
              status: result.delivered ? "DELIVERED" : "FAILED",
              tenantId,
            },
            update: {
              attemptCount: { increment: 1 },
              deliveredAt: result.delivered ? new Date() : null,
              failureReason: result.failureReason,
              lastAttemptAt: new Date(),
              provider: result.provider,
              providerId: result.providerId,
              status: result.delivered ? "DELIVERED" : "FAILED",
            },
            where: {
              alertId_recipient_channel: {
                alertId: alert.id,
                channel: "EMAIL",
                recipient,
              },
            },
          });
          await tx.auditEvent.create({
            data: {
              action: "notification.email_delivery",
              newValue: {
                alertId: alert.id,
                provider: result.provider,
                recipient,
                status: saved.status,
              },
              object: "NotificationDelivery",
              objectId: saved.id,
              outcome: saved.status,
              tenantId,
            },
          });
        });
        if (result.delivered) delivered += 1;
        else failed += 1;
      }
    }
    return {
      delivered,
      evaluatedAlerts: alerts.length,
      failed,
      job: "notifications.dispatch",
      tenantId,
    };
  }

  private async scanEngagementRiskForTenant(
    tenantId: string,
  ): Promise<Record<string, unknown>> {
    const preference = await this.prisma.notificationPreference.findUnique({
      where: { tenantId },
    });
    if (!preference?.engagementRiskEnabled) {
      return {
        alertsCreated: 0,
        job: "engagement.scan",
        skipped: true,
        tenantId,
      };
    }
    const since = new Date(Date.now() - 7 * 86_400_000);
    const dateSince = since.toISOString().slice(0, 10);
    const [students, attendance, devices, failures, existing] =
      await Promise.all([
        this.prisma.student.findMany({
          select: { id: true, name: true },
          where: { status: "ACTIVE", tenantId },
        }),
        this.prisma.attendanceRecord.findMany({
          select: { status: true, studentId: true },
          where: {
            attendanceDate: { gte: dateSince },
            status: "ABSENT",
            tenantId,
          },
        }),
        this.prisma.device.findMany({
          select: {
            id: true,
            lastCheckInAt: true,
            status: true,
            studentId: true,
          },
          where: { studentId: { not: null }, tenantId },
        }),
        this.prisma.deviceAlert.findMany({
          select: { deviceId: true },
          where: {
            firstSeenAt: { gte: since },
            tenantId,
            type: "POLICY_DEPLOYMENT_FAILED",
          },
        }),
        this.prisma.deviceAlert.findMany({
          select: { metadata: true },
          where: {
            firstSeenAt: { gte: since },
            source: "ENGAGEMENT_RISK",
            tenantId,
          },
        }),
      ]);
    const existingKeys = new Set(
      existing.map((row) =>
        String(
          (row.metadata as Record<string, unknown> | null)?.deduplicationKey ??
            "",
        ),
      ),
    );
    const absenceCounts = new Map<string, number>();
    for (const row of attendance)
      absenceCounts.set(
        row.studentId,
        (absenceCounts.get(row.studentId) ?? 0) + 1,
      );
    const deviceStudent = new Map(
      devices.map((row) => [row.id, row.studentId!]),
    );
    const failureCounts = new Map<string, number>();
    for (const row of failures) {
      const studentId = row.deviceId
        ? deviceStudent.get(row.deviceId)
        : undefined;
      if (studentId)
        failureCounts.set(studentId, (failureCounts.get(studentId) ?? 0) + 1);
    }
    const offlineStudentIds = new Set(
      devices
        .filter(
          (row) =>
            row.status === "OFFLINE" ||
            !row.lastCheckInAt ||
            row.lastCheckInAt < since,
        )
        .map((row) => row.studentId!),
    );
    const risks: Array<{
      studentId: string;
      studentName: string;
      reasons: string[];
    }> = [];
    for (const student of students) {
      const reasons: string[] = [];
      const missed = absenceCounts.get(student.id) ?? 0;
      const failed = failureCounts.get(student.id) ?? 0;
      if (missed >= preference.missedSessionThreshold)
        reasons.push(`${missed} missed sessions in 7 days`);
      if (offlineStudentIds.has(student.id))
        reasons.push("assigned device offline or without a recent check-in");
      if (failed >= preference.complianceFailureThreshold)
        reasons.push(`${failed} policy delivery failures in 7 days`);
      if (reasons.length)
        risks.push({
          reasons,
          studentId: student.id,
          studentName: student.name,
        });
    }
    let alertsCreated = 0;
    for (const risk of risks) {
      const deduplicationKey = `risk:${risk.studentId}:${dateSince}`;
      if (existingKeys.has(deduplicationKey)) continue;
      await this.createEngagementAlert({
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        message: risk.reasons.join("; "),
        metadata: {
          deduplicationKey,
          reasons: risk.reasons,
          studentId: risk.studentId,
        },
        severity: risk.reasons.length > 1 ? "CRITICAL" : "WARNING",
        source: "ENGAGEMENT_RISK",
        tenantId,
        title: `Engagement risk: ${risk.studentName}`,
        type: "ENGAGEMENT_RISK",
      });
      alertsCreated += 1;
    }
    const weekStart = new Date();
    weekStart.setUTCHours(0, 0, 0, 0);
    weekStart.setUTCDate(
      weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7),
    );
    const weekKey = weekStart.toISOString().slice(0, 10);
    if (
      preference.weeklyAdminSummaryEnabled &&
      risks.length &&
      !existingKeys.has(`admin-summary:${weekKey}`)
    ) {
      await this.createEngagementAlert({
        message: `${risks.length} learner(s) met an explainable engagement-risk rule this week. Review the individual alerts for reasons.`,
        metadata: {
          deduplicationKey: `admin-summary:${weekKey}`,
          privacyScope: "ADMIN",
          riskCount: risks.length,
        },
        severity: "INFO",
        source: "ENGAGEMENT_RISK",
        tenantId,
        title: "Weekly engagement summary",
        type: "ENGAGEMENT_WEEKLY_SUMMARY",
      });
      alertsCreated += 1;
    }
    if (preference.weeklyGuardianSummaryEnabled && risks.length) {
      const riskByStudent = new Map(
        risks.map((risk) => [risk.studentId, risk]),
      );
      const guardians = await this.prisma.guardian.findMany({
        include: {
          notificationPreference: true,
          students: { select: { studentId: true } },
        },
        where: { email: { not: null }, tenantId },
      });
      for (const guardian of guardians) {
        if (
          !guardian.email ||
          !guardian.notificationPreference?.channels.includes("EMAIL")
        )
          continue;
        const linked = guardian.students
          .map((link) => riskByStudent.get(link.studentId))
          .filter((risk): risk is NonNullable<typeof risk> => Boolean(risk));
        const deduplicationKey = `guardian-summary:${guardian.id}:${weekKey}`;
        if (!linked.length || existingKeys.has(deduplicationKey)) continue;
        await this.createEngagementAlert({
          message: linked
            .map((risk) => `${risk.studentName}: ${risk.reasons.join("; ")}`)
            .join("\n"),
          metadata: {
            deduplicationKey,
            notificationRecipients: [guardian.email],
            privacyScope: "LINKED_GUARDIAN",
            studentIds: linked.map((risk) => risk.studentId),
          },
          severity: "INFO",
          source: "ENGAGEMENT_RISK",
          tenantId,
          title: "Weekly learning engagement summary",
          type: "ENGAGEMENT_WEEKLY_SUMMARY",
        });
        alertsCreated += 1;
      }
    }
    return {
      alertsCreated,
      evaluatedStudents: students.length,
      job: "engagement.scan",
      risks: risks.length,
      tenantId,
    };
  }

  private async createEngagementAlert(
    data: Prisma.DeviceAlertUncheckedCreateInput,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const alert = await tx.deviceAlert.create({ data });
      await tx.auditEvent.create({
        data: {
          action: "engagement_risk.detected",
          newValue: { severity: data.severity, type: data.type },
          object: "DeviceAlert",
          objectId: alert.id,
          outcome: "CREATED",
          tenantId: data.tenantId,
        },
      });
    });
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
      const delivered = await this.markDeliveryAttempt(command);
      const result = await this.mdmConnector.dispatchCommand(
        delivered,
        command.device,
      );
      const status = result.accepted
        ? await this.markAccepted(delivered, result)
        : await this.markRejected(delivered, result);

      if (status === "DELIVERED") accepted += 1;
      else if (status === "QUEUED") skipped += 1;
      else failed += 1;
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

  private async markAccepted(
    command: RemoteCommand,
    result: WorkerMdmDispatchResult,
  ): Promise<string> {
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.remoteCommand.update({
        data: {
          connectorCommandId: result.connectorCommandId,
          failureReason: null,
          result: this.dispatchResultJson(result),
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
            connector: result.connector,
            connectorCommandId: result.connectorCommandId,
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

      return updated.status;
    });
  }

  private async markRejected(
    command: RemoteCommand,
    result: WorkerMdmDispatchResult,
  ): Promise<string> {
    const expired =
      command.expiresAt !== null && command.expiresAt.getTime() <= Date.now();
    const canRetry =
      result.retryable === true &&
      !expired &&
      command.attempts < command.maxAttempts;
    const status = canRetry ? "QUEUED" : "FAILED";

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.remoteCommand.update({
        data: {
          completedAt: canRetry ? null : new Date(),
          failureReason:
            result.failureReason ?? "Connector did not accept command",
          result: this.dispatchResultJson(result),
          status,
        },
        where: { id: command.id },
      });
      await tx.auditEvent.create({
        data: {
          action: canRetry
            ? "remote_command.dispatch_retry"
            : "remote_command.dispatch_fail",
          newValue: {
            failureReason: updated.failureReason,
            status: updated.status,
            worker: true,
          },
          object: "RemoteCommand",
          objectId: command.id,
          oldValue: { status: command.status },
          outcome: canRetry ? "RETRY_QUEUED" : "FAILED",
          tenantId: command.tenantId,
        },
      });
      return updated.status;
    });
  }

  private dispatchResultJson(
    result: WorkerMdmDispatchResult,
  ): Prisma.InputJsonObject {
    return Object.fromEntries(
      Object.entries(result).filter(([, value]) => value !== undefined),
    ) as Prisma.InputJsonObject;
  }

  private async scanOfflineAlertsForTenant(
    tenantId: string,
  ): Promise<Record<string, unknown>> {
    const preferences = await this.prisma.notificationPreference?.findUnique({
      select: { offlineAfterMinutes: true },
      where: { tenantId },
    });
    const offlineAfterMinutes =
      preferences?.offlineAfterMinutes ??
      this.envInt("WORKER_OFFLINE_AFTER_MINUTES", 60);
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
