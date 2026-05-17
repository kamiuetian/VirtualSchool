import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  RetentionRunResult,
  RetentionRunSummary,
  RetentionSettingsSummary,
  SupportNoteCategory,
  SupportNoteSeverity,
  SupportNoteStatus,
  SupportNoteSummary,
  SupportNoteVisibility,
  SupportTimelineEvent,
} from "@virtual-school/shared";
import {
  Prisma,
  type DataRetentionRun,
  type DeviceAlert,
  type DeviceDiagnostic,
  type RemoteCommand,
  type RetentionSettings,
  type SupportNote,
} from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateSupportNoteDto } from "./dto/create-support-note.dto";
import type { RunRetentionDto } from "./dto/run-retention.dto";
import type { UpdateRetentionSettingsDto } from "./dto/update-retention-settings.dto";
import type { UpdateSupportNoteDto } from "./dto/update-support-note.dto";

const defaultRetentionSettings = {
  auditRetentionDays: null,
  commandHistoryRetentionDays: 365,
  diagnosticRetentionDays: 90,
  exportArtifactRetentionDays: 30,
  resolvedAlertRetentionDays: 180,
  supportNoteRetentionDays: 730,
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
export class SupportService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listDeviceSupportNotes(
    tenantId: string,
    deviceId: string,
  ): Promise<SupportNoteSummary[]> {
    await this.ensureDevice(tenantId, deviceId);

    const notes = await this.prisma.supportNote.findMany({
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
      where: {
        deviceId,
        tenantId,
      },
    });

    return notes.map((note) => this.toSupportNoteSummary(note));
  }

  async createDeviceSupportNote(
    tenantId: string,
    deviceId: string,
    input: CreateSupportNoteDto,
    actor: { subject?: string; email?: string },
  ): Promise<SupportNoteSummary> {
    await this.ensureDevice(tenantId, deviceId);

    const note = await this.prisma.$transaction(async (tx) => {
      const created = await tx.supportNote.create({
        data: {
          authorEmail: actor.email,
          authorId: actor.subject,
          body: input.body,
          category: input.category ?? "GENERAL",
          deviceId,
          pinned: input.pinned ?? false,
          resolution: input.resolution,
          severity: input.severity ?? "S3",
          status: input.status ?? "OPEN",
          tenantId,
          visibility: input.visibility ?? "INTERNAL",
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "support_note.create",
          actorId: actor.subject,
          newValue: {
            category: created.category,
            deviceId,
            pinned: created.pinned,
            severity: created.severity,
            status: created.status,
            visibility: created.visibility,
          },
          object: "SupportNote",
          objectId: created.id,
          outcome: "CREATED",
          tenantId,
        },
      });

      return created;
    });

    return this.toSupportNoteSummary(note);
  }

  async updateSupportNote(
    tenantId: string,
    noteId: string,
    input: UpdateSupportNoteDto,
    actorId: string | undefined,
  ): Promise<SupportNoteSummary> {
    const note = await this.prisma.supportNote.findFirst({
      where: {
        id: noteId,
        tenantId,
      },
    });

    if (!note) {
      throw new NotFoundException(`Support note ${noteId} was not found`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.supportNote.update({
        data: {
          body: input.body,
          category: input.category,
          pinned: input.pinned,
          resolution: input.resolution,
          severity: input.severity,
          status: input.status,
          visibility: input.visibility,
        },
        where: {
          id: note.id,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "support_note.update",
          actorId,
          newValue: this.supportNoteAuditValue(saved) as Prisma.InputJsonValue,
          object: "SupportNote",
          objectId: saved.id,
          oldValue: this.supportNoteAuditValue(note) as Prisma.InputJsonValue,
          outcome: "UPDATED",
          tenantId,
        },
      });

      return saved;
    });

    return this.toSupportNoteSummary(updated);
  }

  async getDeviceSupportTimeline(
    tenantId: string,
    deviceId: string,
    limit = 50,
  ): Promise<SupportTimelineEvent[]> {
    await this.ensureDevice(tenantId, deviceId);
    const take = Math.min(Math.max(limit, 1), 100);

    const [notes, commands, diagnostics, alerts] = await Promise.all([
      this.prisma.supportNote.findMany({
        orderBy: {
          updatedAt: "desc",
        },
        take,
        where: {
          deviceId,
          tenantId,
        },
      }),
      this.prisma.remoteCommand.findMany({
        orderBy: {
          createdAt: "desc",
        },
        take,
        where: {
          deviceId,
          tenantId,
        },
      }),
      this.prisma.deviceDiagnostic.findMany({
        orderBy: {
          reportedAt: "desc",
        },
        take,
        where: {
          deviceId,
          tenantId,
        },
      }),
      this.prisma.deviceAlert.findMany({
        orderBy: {
          lastSeenAt: "desc",
        },
        take,
        where: {
          deviceId,
          tenantId,
        },
      }),
    ]);

    return [
      ...notes.map((note) => this.noteTimelineEvent(note)),
      ...commands.map((command) => this.commandTimelineEvent(command)),
      ...diagnostics.map((diagnostic) =>
        this.diagnosticTimelineEvent(diagnostic),
      ),
      ...alerts.map((alert) => this.alertTimelineEvent(alert)),
    ]
      .sort(
        (left, right) =>
          Date.parse(right.occurredAt) - Date.parse(left.occurredAt),
      )
      .slice(0, take);
  }

  async getRetentionSettings(
    tenantId: string,
  ): Promise<RetentionSettingsSummary> {
    await this.ensureTenant(tenantId);
    const settings = await this.getOrCreateRetentionSettings(tenantId);

    return this.toRetentionSettingsSummary(settings);
  }

  async updateRetentionSettings(
    tenantId: string,
    input: UpdateRetentionSettingsDto,
    actorId: string | undefined,
  ): Promise<RetentionSettingsSummary> {
    await this.ensureTenant(tenantId);
    const current = await this.getOrCreateRetentionSettings(tenantId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.retentionSettings.update({
        data: {
          auditRetentionDays: input.auditRetentionDays,
          commandHistoryRetentionDays: input.commandHistoryRetentionDays,
          diagnosticRetentionDays: input.diagnosticRetentionDays,
          exportArtifactRetentionDays: input.exportArtifactRetentionDays,
          resolvedAlertRetentionDays: input.resolvedAlertRetentionDays,
          supportNoteRetentionDays: input.supportNoteRetentionDays,
          updatedBy: actorId,
        },
        where: {
          tenantId,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "retention_settings.update",
          actorId,
          newValue: this.retentionSettingsAuditValue(
            saved,
          ) as Prisma.InputJsonValue,
          object: "RetentionSettings",
          objectId: saved.id,
          oldValue: this.retentionSettingsAuditValue(
            current,
          ) as Prisma.InputJsonValue,
          outcome: "UPDATED",
          tenantId,
        },
      });

      return saved;
    });

    return this.toRetentionSettingsSummary(updated);
  }

  async dryRunRetention(
    tenantId: string,
    input: RunRetentionDto,
    actorId: string | undefined,
  ): Promise<RetentionRunSummary> {
    return this.runRetention(tenantId, "DRY_RUN", input, actorId);
  }

  async applyRetention(
    tenantId: string,
    input: RunRetentionDto,
    actorId: string | undefined,
  ): Promise<RetentionRunSummary> {
    return this.runRetention(tenantId, "APPLY", input, actorId);
  }

  private async runRetention(
    tenantId: string,
    mode: "DRY_RUN" | "APPLY",
    input: RunRetentionDto,
    actorId: string | undefined,
  ): Promise<RetentionRunSummary> {
    await this.ensureTenant(tenantId);
    const settings = await this.getOrCreateRetentionSettings(tenantId);
    const cutoffs = this.retentionCutoffs(settings);
    const result =
      mode === "APPLY"
        ? await this.applyRetentionDeletes(tenantId, cutoffs, settings)
        : await this.countRetentionTargets(tenantId, cutoffs, settings);

    const run = await this.prisma.$transaction(async (tx) => {
      const created = await tx.dataRetentionRun.create({
        data: {
          actorId,
          completedAt: new Date(),
          cutoffs: this.cutoffsJson(cutoffs) as Prisma.InputJsonValue,
          mode,
          reason: input.reason,
          result: result as Prisma.InputJsonValue,
          status: "COMPLETED",
          tenantId,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: mode === "APPLY" ? "retention.apply" : "retention.dry_run",
          actorId,
          newValue: {
            result,
          },
          object: "DataRetentionRun",
          objectId: created.id,
          outcome: "COMPLETED",
          reason: input.reason,
          tenantId,
        },
      });

      return created;
    });

    return this.toRetentionRunSummary(run);
  }

  private async countRetentionTargets(
    tenantId: string,
    cutoffs: RetentionCutoffs,
    settings: RetentionSettings,
  ): Promise<RetentionRunResult> {
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
  ): Promise<RetentionRunResult> {
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

  private async ensureTenant(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      select: {
        id: true,
      },
      where: {
        id: tenantId,
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} was not found`);
    }
  }

  private async ensureDevice(
    tenantId: string,
    deviceId: string,
  ): Promise<void> {
    const device = await this.prisma.device.findFirst({
      select: {
        id: true,
      },
      where: {
        id: deviceId,
        tenantId,
      },
    });

    if (!device) {
      throw new NotFoundException(`Device ${deviceId} was not found`);
    }
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
        ...defaultRetentionSettings,
        tenantId,
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

  private daysAgo(days: number): Date {
    return new Date(Date.now() - days * 86_400_000);
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

  private noteTimelineEvent(note: SupportNote): SupportTimelineEvent {
    return {
      deviceId: note.deviceId,
      id: note.id,
      metadata: this.supportNoteAuditValue(note),
      occurredAt: note.updatedAt.toISOString(),
      summary: note.body,
      tenantId: note.tenantId,
      title: `${note.severity} ${note.category} support note`,
      type: "SUPPORT_NOTE",
    };
  }

  private commandTimelineEvent(command: RemoteCommand): SupportTimelineEvent {
    return {
      deviceId: command.deviceId,
      id: command.id,
      metadata: {
        attempts: command.attempts,
        failureReason: command.failureReason,
        maxAttempts: command.maxAttempts,
        status: command.status,
        type: command.type,
      },
      occurredAt: command.updatedAt.toISOString(),
      summary: command.failureReason ?? command.reason ?? command.status,
      tenantId: command.tenantId,
      title: `${command.type} command ${command.status}`,
      type: "REMOTE_COMMAND",
    };
  }

  private diagnosticTimelineEvent(
    diagnostic: DeviceDiagnostic,
  ): SupportTimelineEvent {
    return {
      deviceId: diagnostic.deviceId,
      id: diagnostic.id,
      metadata: {
        batteryLevel: diagnostic.batteryLevel,
        compliance: diagnostic.compliance,
        health: diagnostic.health,
        networkStatus: diagnostic.networkStatus,
        policyVersion: diagnostic.policyVersion,
        storageFreeMb: diagnostic.storageFreeMb,
      },
      occurredAt: diagnostic.reportedAt.toISOString(),
      summary: `Health ${diagnostic.health ?? "UNKNOWN"}, compliance ${
        diagnostic.compliance ?? "UNKNOWN"
      }`,
      tenantId: diagnostic.tenantId,
      title: "Device diagnostic uploaded",
      type: "DEVICE_DIAGNOSTIC",
    };
  }

  private alertTimelineEvent(alert: DeviceAlert): SupportTimelineEvent {
    return {
      deviceId: alert.deviceId ?? "",
      id: alert.id,
      metadata: {
        severity: alert.severity,
        source: alert.source,
        status: alert.status,
        type: alert.type,
      },
      occurredAt: alert.lastSeenAt.toISOString(),
      summary: alert.message,
      tenantId: alert.tenantId,
      title: alert.title,
      type: "DEVICE_ALERT",
    };
  }

  private toSupportNoteSummary(note: SupportNote): SupportNoteSummary {
    return {
      authorEmail: note.authorEmail,
      authorId: note.authorId,
      body: note.body,
      category: note.category as SupportNoteCategory,
      createdAt: note.createdAt.toISOString(),
      deviceId: note.deviceId,
      id: note.id,
      pinned: note.pinned,
      resolution: note.resolution,
      severity: note.severity as SupportNoteSeverity,
      status: note.status as SupportNoteStatus,
      tenantId: note.tenantId,
      updatedAt: note.updatedAt.toISOString(),
      visibility: note.visibility as SupportNoteVisibility,
    };
  }

  private toRetentionSettingsSummary(
    settings: RetentionSettings,
  ): RetentionSettingsSummary {
    return {
      auditRetentionDays: settings.auditRetentionDays,
      commandHistoryRetentionDays: settings.commandHistoryRetentionDays,
      createdAt: settings.createdAt.toISOString(),
      diagnosticRetentionDays: settings.diagnosticRetentionDays,
      exportArtifactRetentionDays: settings.exportArtifactRetentionDays,
      id: settings.id,
      resolvedAlertRetentionDays: settings.resolvedAlertRetentionDays,
      supportNoteRetentionDays: settings.supportNoteRetentionDays,
      tenantId: settings.tenantId,
      updatedAt: settings.updatedAt.toISOString(),
      updatedBy: settings.updatedBy,
    };
  }

  private toRetentionRunSummary(run: DataRetentionRun): RetentionRunSummary {
    return {
      actorId: run.actorId,
      completedAt: run.completedAt?.toISOString() ?? null,
      createdAt: run.createdAt.toISOString(),
      cutoffs: this.jsonRecord(run.cutoffs) as Record<string, string | null>,
      id: run.id,
      mode: run.mode as "DRY_RUN" | "APPLY",
      reason: run.reason,
      result: this.jsonRecord(run.result) as RetentionRunResult,
      startedAt: run.startedAt.toISOString(),
      status: run.status as "COMPLETED" | "FAILED",
      tenantId: run.tenantId,
    };
  }

  private supportNoteAuditValue(note: SupportNote): Record<string, unknown> {
    return {
      category: note.category,
      deviceId: note.deviceId,
      pinned: note.pinned,
      resolution: note.resolution,
      severity: note.severity,
      status: note.status,
      visibility: note.visibility,
    };
  }

  private retentionSettingsAuditValue(
    settings: RetentionSettings,
  ): Record<string, unknown> {
    return {
      auditRetentionDays: settings.auditRetentionDays,
      commandHistoryRetentionDays: settings.commandHistoryRetentionDays,
      diagnosticRetentionDays: settings.diagnosticRetentionDays,
      exportArtifactRetentionDays: settings.exportArtifactRetentionDays,
      resolvedAlertRetentionDays: settings.resolvedAlertRetentionDays,
      supportNoteRetentionDays: settings.supportNoteRetentionDays,
    };
  }

  private jsonRecord(value: Prisma.JsonValue): Record<string, unknown> | null {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return null;
  }
}
