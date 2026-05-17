import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { AuditEventList, AuditEventSummary } from "@virtual-school/shared";
import { Prisma, type AuditEvent } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import type { ListAuditEventsDto } from "./dto/list-audit-events.dto";

@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listAuditEvents(
    tenantId: string,
    query: ListAuditEventsDto,
  ): Promise<AuditEventList> {
    await this.ensureTenantExists(tenantId);

    const limit = Number(query.limit ?? 50);
    const offset = Number(query.offset ?? 0);
    const where = this.auditWhere(tenantId, query);
    const [total, items] = await Promise.all([
      this.prisma.auditEvent.count({ where }),
      this.prisma.auditEvent.findMany({
        orderBy: {
          createdAt: "desc",
        },
        skip: offset,
        take: limit,
        where,
      }),
    ]);

    return {
      items: items.map((event) => this.toAuditEventSummary(event)),
      page: {
        limit,
        offset,
        total,
      },
    };
  }

  private auditWhere(
    tenantId: string,
    query: ListAuditEventsDto,
  ): Prisma.AuditEventWhereInput {
    const where: Prisma.AuditEventWhereInput = {
      tenantId,
    };

    if (query.action) {
      where.action = query.action;
    }

    if (query.object) {
      where.object = query.object;
    }

    if (query.objectId) {
      where.objectId = query.objectId;
    }

    if (query.actorId) {
      where.actorId = query.actorId;
    }

    if (query.outcome) {
      where.outcome = query.outcome;
    }

    if (query.from || query.to) {
      where.createdAt = {
        gte: query.from ? new Date(query.from) : undefined,
        lte: query.to ? new Date(query.to) : undefined,
      };
    }

    return where;
  }

  private async ensureTenantExists(tenantId: string): Promise<void> {
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

  private toAuditEventSummary(event: AuditEvent): AuditEventSummary {
    return {
      action: event.action,
      actorId: event.actorId,
      createdAt: event.createdAt.toISOString(),
      id: event.id,
      ipAddress: event.ipAddress,
      newValue: this.jsonRecord(event.newValue),
      object: event.object,
      objectId: event.objectId,
      oldValue: this.jsonRecord(event.oldValue),
      outcome: event.outcome,
      reason: event.reason,
      tenantId: event.tenantId,
    };
  }

  private jsonRecord(value: Prisma.JsonValue): Record<string, unknown> | null {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return null;
  }
}
