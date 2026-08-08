import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
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
  SupportTicketSummary,
  RemoteAssistanceSessionSummary,
  TroubleshootingPlaybook,
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
import type { AuthenticatedUser } from "../auth/types/authenticated-request";
import type {
  CreateSupportTicketDto,
  CreateTicketNoteDto,
  UpdateSupportTicketDto,
} from "./dto/support-ticket.dto";
import type {
  EndRemoteAssistanceDto,
  StartRemoteAssistanceDto,
} from "./dto/remote-assistance.dto";

const assistanceNotice =
  "Remote assistance is active and visible to the device user. The support agent may guide troubleshooting and inspect management status, but this session does not enable camera, microphone, keystroke, private-message, screenshot, or covert monitoring.";

const troubleshootingPlaybooks: TroubleshootingPlaybook[] = [
  {
    id: "OFFLINE_DEVICE",
    title: "Offline device",
    steps: [
      "Confirm the device has power and show the user the active assistance notice.",
      "Ask the user to verify Wi-Fi or mobile connectivity without sharing passwords.",
      "Check the last device heartbeat and retry the approved policy refresh after connectivity returns.",
      "Record the network result and device time in the linked ticket.",
    ],
    escalation:
      "Escalate to device operations if the device remains offline after a known-good network test.",
  },
  {
    id: "FAILED_APP_INSTALL",
    title: "Failed app install",
    steps: [
      "Confirm the app is approved and assigned by the active policy.",
      "Check available storage, enrollment state, and the latest deployment failure reason.",
      "Retry the approved deployment once after correcting policy or storage issues.",
      "Record the package, policy version, and retry result without collecting personal app data.",
    ],
    escalation:
      "Escalate with the privacy-limited provider error when the managed store continues to reject the app.",
  },
  {
    id: "BLOCKED_WEBSITE",
    title: "Blocked website",
    steps: [
      "Confirm the exact school resource the user intended to open.",
      "Run URL policy simulation and identify the winning tenant, class, mode, or global rule.",
      "Correct an erroneous school allowlist only through the authorized policy workflow.",
      "Never bypass a global never-allowed rule; record the simulation result in the ticket.",
    ],
    escalation: "Escalate policy conflicts to an authorized policy manager.",
  },
  {
    id: "STUCK_KIOSK_MODE",
    title: "Stuck kiosk mode",
    steps: [
      "Confirm the device identity, active mode, and whether an exam or lost-device assignment is active.",
      "Check the current policy version and management heartbeat.",
      "Use only an authorized, reason-bound support unlock or policy refresh when appropriate.",
      "Verify the expected mode returns and document the outcome before ending assistance.",
    ],
    escalation:
      "Escalate if the device cannot receive policy or if platform capability is unsupported.",
  },
];

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

  getTroubleshootingPlaybooks(): TroubleshootingPlaybook[] {
    return troubleshootingPlaybooks;
  }

  async listAssistanceSessions(
    tenantId: string,
    deviceId?: string,
  ): Promise<RemoteAssistanceSessionSummary[]> {
    const sessions = await this.prisma.remoteAssistanceSession.findMany({
      where: { tenantId, deviceId },
      orderBy: { startedAt: "desc" },
    });
    return sessions.map((session) => this.toAssistanceSummary(session));
  }

  async startAssistanceSession(
    tenantId: string,
    input: StartRemoteAssistanceDto,
    actor?: AuthenticatedUser,
  ): Promise<RemoteAssistanceSessionSummary> {
    if (!input.noticeAcknowledged)
      throw new BadRequestException(
        "Visible notice and consent must be acknowledged",
      );
    await this.ensureDevice(tenantId, input.deviceId);
    if (input.ticketId) {
      const ticket = await this.prisma.supportTicket.findFirst({
        where: { id: input.ticketId, tenantId },
        select: { id: true, deviceId: true },
      });
      if (!ticket)
        throw new NotFoundException("Linked support ticket was not found");
      if (ticket.deviceId && ticket.deviceId !== input.deviceId)
        throw new BadRequestException(
          "Linked ticket belongs to another device",
        );
    }
    const active = await this.prisma.remoteAssistanceSession.findFirst({
      where: { tenantId, deviceId: input.deviceId, status: "ACTIVE" },
      select: { id: true },
    });
    if (active)
      throw new ConflictException(
        "This device already has an active assistance session",
      );
    const session = await this.prisma.$transaction(async (tx) => {
      const created = await tx.remoteAssistanceSession.create({
        data: {
          tenantId,
          deviceId: input.deviceId,
          ticketId: input.ticketId,
          purpose: input.purpose.trim(),
          visibleNotice: assistanceNotice,
          consentedBy: input.consentedBy.trim(),
          consentedAt: new Date(),
          startedBy: actor?.subject,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: actor?.subject,
          action: "remote_assistance.start",
          object: "RemoteAssistanceSession",
          objectId: created.id,
          outcome: "CONSENTED",
          newValue: {
            deviceId: input.deviceId,
            ticketId: input.ticketId,
            consentedBy: input.consentedBy,
            noticeDisplayed: true,
            prohibitedMonitoring: true,
          },
        },
      });
      return created;
    });
    return this.toAssistanceSummary(session);
  }

  async endAssistanceSession(
    tenantId: string,
    sessionId: string,
    input: EndRemoteAssistanceDto,
    actor?: AuthenticatedUser,
  ): Promise<RemoteAssistanceSessionSummary> {
    const current = await this.prisma.remoteAssistanceSession.findFirst({
      where: { id: sessionId, tenantId },
    });
    if (!current)
      throw new NotFoundException("Remote assistance session was not found");
    if (current.status !== "ACTIVE")
      throw new ConflictException(
        "Remote assistance session has already ended",
      );
    const ended = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.remoteAssistanceSession.update({
        where: { id: sessionId },
        data: {
          status: "ENDED",
          endedAt: new Date(),
          endedBy: actor?.subject,
          resolution: input.resolution.trim(),
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: actor?.subject,
          action: "remote_assistance.end",
          object: "RemoteAssistanceSession",
          objectId: sessionId,
          outcome: "ENDED",
          newValue: {
            deviceId: current.deviceId,
            resolution: input.resolution.trim(),
            endedAt: saved.endedAt,
          },
        },
      });
      return saved;
    });
    return this.toAssistanceSummary(ended);
  }

  private toAssistanceSummary(session: any): RemoteAssistanceSessionSummary {
    return {
      ...session,
      consentedAt: session.consentedAt.toISOString(),
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
    };
  }

  async listTickets(
    tenantId: string,
    actor?: AuthenticatedUser,
  ): Promise<SupportTicketSummary[]> {
    const where =
      actor?.role === "TEACHER"
        ? {
            tenantId,
            classId: {
              in: (
                await this.prisma.teacherClassAssignment.findMany({
                  where: { tenantId, teacherId: actor.subject },
                  select: { classId: true },
                })
              ).map((x) => x.classId),
            },
          }
        : { tenantId };
    const tickets = await this.prisma.supportTicket.findMany({
      where,
      include: { notes: { orderBy: { createdAt: "asc" } } },
      orderBy: [{ status: "asc" }, { slaDueAt: "asc" }],
    });
    return tickets.map((ticket) => this.toTicketSummary(ticket));
  }

  async createTicket(
    tenantId: string,
    input: CreateSupportTicketDto,
    actor?: AuthenticatedUser,
  ): Promise<SupportTicketSummary> {
    await this.validateTicketLinks(tenantId, input, actor);
    const priority = input.priority ?? "NORMAL";
    const category = input.category?.trim().toUpperCase() || "GENERAL";
    const routingQueue =
      category === "PRIVACY"
        ? "PRIVACY"
        : category === "ENROLLMENT"
          ? "DEVICE_OPERATIONS"
          : "HELPDESK";
    const hours = { LOW: 72, NORMAL: 24, HIGH: 8, URGENT: 4 }[priority] ?? 24;
    const ticket = await this.prisma.$transaction(async (tx) => {
      const created = await tx.supportTicket.create({
        data: {
          tenantId,
          deviceId: input.deviceId,
          studentId: input.studentId,
          classId: input.classId,
          sessionId: input.sessionId,
          source: actor?.role === "TEACHER" ? "TEACHER" : "STAFF",
          category,
          priority,
          subject: input.subject.trim(),
          description: input.description.trim(),
          routingQueue,
          slaDueAt: new Date(Date.now() + hours * 3_600_000),
          createdBy: actor?.subject,
        },
        include: { notes: true },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: actor?.subject,
          action: "support_ticket.create",
          object: "SupportTicket",
          objectId: created.id,
          outcome: "ROUTED",
          newValue: {
            priority,
            routingQueue,
            slaDueAt: created.slaDueAt,
            deviceId: input.deviceId,
            studentId: input.studentId,
            classId: input.classId,
            sessionId: input.sessionId,
          },
        },
      });
      return created;
    });
    return this.toTicketSummary(ticket);
  }

  async updateTicket(
    tenantId: string,
    ticketId: string,
    input: UpdateSupportTicketDto,
    actor?: AuthenticatedUser,
  ): Promise<SupportTicketSummary> {
    if (actor?.role === "TEACHER")
      throw new ForbiddenException(
        "Teachers cannot assign or transition tickets",
      );
    const current = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, tenantId },
      include: { notes: true },
    });
    if (!current)
      throw new NotFoundException(`Support ticket ${ticketId} was not found`);
    if (
      input.assigneeId &&
      !(await this.prisma.user.findFirst({
        where: { id: input.assigneeId, tenantId },
        select: { id: true },
      }))
    )
      throw new NotFoundException(
        "Ticket assignee was not found in this tenant",
      );
    const resolved = input.status === "RESOLVED" || input.status === "CLOSED";
    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.supportTicket.update({
        where: { id: ticketId },
        data: {
          status: input.status,
          assigneeId: input.assigneeId,
          priority: input.priority,
          firstResponseAt:
            !current.firstResponseAt &&
            (input.assigneeId || input.status === "IN_PROGRESS")
              ? new Date()
              : undefined,
          resolvedAt: resolved
            ? (current.resolvedAt ?? new Date())
            : input.status
              ? null
              : undefined,
        },
        include: { notes: { orderBy: { createdAt: "asc" } } },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: actor?.subject,
          action: "support_ticket.update",
          object: "SupportTicket",
          objectId: ticketId,
          outcome: "UPDATED",
          oldValue: {
            status: current.status,
            priority: current.priority,
            assigneeId: current.assigneeId,
          },
          newValue: {
            status: saved.status,
            priority: saved.priority,
            assigneeId: saved.assigneeId,
            resolvedAt: saved.resolvedAt,
          },
        },
      });
      return saved;
    });
    return this.toTicketSummary(updated);
  }

  async addTicketNote(
    tenantId: string,
    ticketId: string,
    input: CreateTicketNoteDto,
    actor?: AuthenticatedUser,
  ) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id: ticketId, tenantId },
    });
    if (!ticket)
      throw new NotFoundException(`Support ticket ${ticketId} was not found`);
    if (actor?.role === "TEACHER")
      await this.ensureTeacherClass(tenantId, ticket.classId, actor.subject);
    return this.prisma.$transaction(async (tx) => {
      const note = await tx.supportTicketNote.create({
        data: {
          tenantId,
          ticketId,
          body: input.body.trim(),
          visibility: input.visibility ?? "INTERNAL",
          authorId: actor?.subject,
          authorEmail: actor?.email,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: actor?.subject,
          action: "support_ticket.note.create",
          object: "SupportTicket",
          objectId: ticketId,
          outcome: "CREATED",
          newValue: { noteId: note.id, visibility: note.visibility },
        },
      });
      return { ...note, createdAt: note.createdAt.toISOString() };
    });
  }

  private async validateTicketLinks(
    tenantId: string,
    input: CreateSupportTicketDto,
    actor?: AuthenticatedUser,
  ) {
    const device = input.deviceId
      ? await this.prisma.device.findFirst({
          where: { id: input.deviceId, tenantId },
          select: { id: true, classId: true, studentId: true },
        })
      : null;
    if (input.deviceId && !device)
      throw new NotFoundException("Linked device was not found");
    if (device && input.classId && device.classId !== input.classId)
      throw new ForbiddenException(
        "Linked device does not belong to the selected class",
      );
    if (device && input.studentId && device.studentId !== input.studentId)
      throw new ForbiddenException(
        "Linked device is not assigned to the selected student",
      );
    if (
      input.studentId &&
      !(await this.prisma.student.findFirst({
        where: { id: input.studentId, tenantId },
        select: { id: true },
      }))
    )
      throw new NotFoundException("Linked student was not found");
    if (
      input.classId &&
      !(await this.prisma.classSection.findFirst({
        where: { id: input.classId, tenantId },
        select: { id: true },
      }))
    )
      throw new NotFoundException("Linked class was not found");
    if (
      input.sessionId &&
      !(await this.prisma.teacherSession.findFirst({
        where: { id: input.sessionId, tenantId },
        select: { id: true },
      }))
    )
      throw new NotFoundException("Linked session was not found");
    if (actor?.role === "TEACHER")
      await this.ensureTeacherClass(tenantId, input.classId, actor.subject);
  }

  private async ensureTeacherClass(
    tenantId: string,
    classId: string | null | undefined,
    teacherId: string,
  ) {
    if (
      !classId ||
      !(await this.prisma.teacherClassAssignment.findFirst({
        where: { tenantId, classId, teacherId },
        select: { classId: true },
      }))
    )
      throw new ForbiddenException(
        "Teachers may create and view tickets only for assigned classes",
      );
  }

  private toTicketSummary(ticket: any): SupportTicketSummary {
    return {
      ...ticket,
      slaDueAt: ticket.slaDueAt.toISOString(),
      firstResponseAt: ticket.firstResponseAt?.toISOString() ?? null,
      resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      notes: (ticket.notes ?? []).map((note: any) => ({
        ...note,
        createdAt: note.createdAt.toISOString(),
      })),
    };
  }

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
