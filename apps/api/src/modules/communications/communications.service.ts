import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateAnnouncementDto,
  CreateFeedbackDto,
} from "./communications.dto";

@Injectable()
export class CommunicationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  listAnnouncements(tenantId: string, role: string, includeArchived = false) {
    const now = new Date();
    return this.prisma.announcement.findMany({
      where: {
        tenantId,
        targetRoles: { has: role },
        ...(includeArchived
          ? {}
          : {
              archivedAt: null,
              startsAt: { lte: now },
              OR: [{ endsAt: null }, { endsAt: { gt: now } }],
            }),
      },
      orderBy: { startsAt: "desc" },
    });
  }
  async createAnnouncement(
    tenantId: string,
    input: CreateAnnouncementDto,
    actorId?: string,
  ) {
    const startsAt = new Date(input.startsAt);
    const endsAt = input.endsAt ? new Date(input.endsAt) : null;
    if (endsAt && endsAt <= startsAt)
      throw new BadRequestException("Announcement end must be after its start");
    if (!input.targetRoles.length)
      throw new BadRequestException("At least one target role is required");
    return this.prisma.$transaction(async (tx) => {
      const saved = await tx.announcement.create({
        data: {
          tenantId,
          title: input.title.trim(),
          message: input.message.trim(),
          targetRoles: [...new Set(input.targetRoles)],
          startsAt,
          endsAt,
          createdBy: actorId,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "announcement.create",
          object: "Announcement",
          objectId: saved.id,
          outcome: "CREATED",
          newValue: {
            title: saved.title,
            targetRoles: saved.targetRoles,
            startsAt,
            endsAt,
          },
        },
      });
      return saved;
    });
  }
  async archiveAnnouncement(tenantId: string, id: string, actorId?: string) {
    const prior = await this.prisma.announcement.findFirst({
      where: { id, tenantId },
    });
    if (!prior) throw new NotFoundException(`Announcement ${id} was not found`);
    return this.prisma.$transaction(async (tx) => {
      const saved = await tx.announcement.update({
        where: { id },
        data: { archivedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "announcement.archive",
          object: "Announcement",
          objectId: id,
          outcome: "ARCHIVED",
          oldValue: { archivedAt: prior.archivedAt },
          newValue: { archivedAt: saved.archivedAt },
        },
      });
      return saved;
    });
  }
  listFeedback(tenantId: string) {
    return this.prisma.pilotFeedback.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
  }
  async createFeedback(
    tenantId: string,
    role: string,
    input: CreateFeedbackDto,
    actorId?: string,
  ) {
    const context = this.safeContext(input.context);
    return this.prisma.$transaction(async (tx) => {
      const saved = await tx.pilotFeedback.create({
        data: {
          tenantId,
          role,
          module: input.module.trim(),
          severity: input.severity,
          summary: input.summary.trim(),
          context,
          createdBy: actorId,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "pilot_feedback.create",
          object: "PilotFeedback",
          objectId: saved.id,
          outcome: "CREATED",
          newValue: {
            role,
            module: saved.module,
            severity: saved.severity,
            status: saved.status,
          },
        },
      });
      return saved;
    });
  }
  async updateFeedback(
    tenantId: string,
    id: string,
    status: string,
    actorId?: string,
  ) {
    const prior = await this.prisma.pilotFeedback.findFirst({
      where: { id, tenantId },
    });
    if (!prior) throw new NotFoundException(`Feedback ${id} was not found`);
    return this.prisma.$transaction(async (tx) => {
      const saved = await tx.pilotFeedback.update({
        where: { id },
        data: { status },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "pilot_feedback.status",
          object: "PilotFeedback",
          objectId: id,
          outcome: "UPDATED",
          oldValue: { status: prior.status },
          newValue: { status },
        },
      });
      return saved;
    });
  }
  private safeContext(input?: Record<string, string | number | boolean>) {
    if (!input) return undefined;
    const blocked =
      /email|name|phone|student|device|serial|token|password|secret/i;
    const entries = Object.entries(input)
      .filter(
        ([key, value]) => !blocked.test(key) && String(value).length <= 200,
      )
      .slice(0, 20);
    return Object.fromEntries(entries);
  }
}
