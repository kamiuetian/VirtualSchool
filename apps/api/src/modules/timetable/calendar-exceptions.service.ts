import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  AcademicCalendarExceptionSummary,
  TimetableBlockScope,
} from "@virtual-school/shared";
import type { AcademicCalendarException, Policy } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateCalendarExceptionDto } from "./dto/create-calendar-exception.dto";
import type { TimetableLifecycleDto } from "./dto/timetable-lifecycle.dto";

type ExceptionWithPolicy = AcademicCalendarException & {
  policy: Policy | null;
};

@Injectable()
export class AcademicCalendarService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(tenantId: string): Promise<AcademicCalendarExceptionSummary[]> {
    await this.ensureTenant(tenantId);
    const records = await this.prisma.academicCalendarException.findMany({
      include: { policy: true },
      orderBy: [{ localDate: "asc" }, { name: "asc" }],
      where: { tenantId },
    });
    return records.map((record) => this.toSummary(record));
  }

  async create(
    tenantId: string,
    input: CreateCalendarExceptionDto,
  ): Promise<AcademicCalendarExceptionSummary> {
    await this.ensureTenant(tenantId);
    const scope = input.scope ?? "TENANT";
    this.validate(scope, input);
    await this.ensureTarget(tenantId, scope, input.scopeId);
    const policy = input.policyId
      ? await this.prisma.policy.findFirst({
          where: { id: input.policyId, status: "PUBLISHED", tenantId },
        })
      : null;
    if (input.kind === "OVERRIDE" && !policy)
      throw new BadRequestException(
        "Override exceptions require a published tenant policy",
      );

    const record = await this.prisma.$transaction(async (tx) => {
      const created = await tx.academicCalendarException.create({
        data: {
          ...input,
          scope,
          scopeId: scope === "TENANT" ? null : input.scopeId,
          tenantId,
        },
        include: { policy: true },
      });
      await tx.auditEvent.create({
        data: {
          action: "academic_calendar_exception.create",
          actorId: input.actorId,
          newValue: {
            kind: created.kind,
            localDate: created.localDate,
            policyId: created.policyId,
            scope: created.scope,
            scopeId: created.scopeId,
          },
          object: "AcademicCalendarException",
          objectId: created.id,
          outcome: "SUCCESS",
          reason: input.reason,
          tenantId,
        },
      });
      return created;
    });
    return this.toSummary(record);
  }

  async deactivate(
    tenantId: string,
    id: string,
    input: TimetableLifecycleDto,
  ): Promise<AcademicCalendarExceptionSummary> {
    const existing = await this.prisma.academicCalendarException.findFirst({
      where: { id, tenantId },
    });
    if (!existing)
      throw new NotFoundException(
        `Calendar exception ${id} was not found for tenant ${tenantId}`,
      );
    const record = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.academicCalendarException.update({
        data: { active: false, actorId: input.actorId, reason: input.reason },
        include: { policy: true },
        where: { id },
      });
      await tx.auditEvent.create({
        data: {
          action: "academic_calendar_exception.deactivate",
          actorId: input.actorId,
          newValue: { active: false },
          oldValue: { active: existing.active },
          object: "AcademicCalendarException",
          objectId: id,
          outcome: "SUCCESS",
          reason: input.reason,
          tenantId,
        },
      });
      return saved;
    });
    return this.toSummary(record);
  }

  private validate(
    scope: TimetableBlockScope,
    input: CreateCalendarExceptionDto,
  ): void {
    if (scope === "TENANT" && input.scopeId)
      throw new BadRequestException(
        "Tenant exceptions must not include scopeId",
      );
    if (scope !== "TENANT" && !input.scopeId)
      throw new BadRequestException(`${scope} exceptions require scopeId`);
    if ((input.startMinute === undefined) !== (input.endMinute === undefined))
      throw new BadRequestException(
        "startMinute and endMinute must be provided together",
      );
    if (
      input.startMinute !== undefined &&
      input.endMinute! <= input.startMinute
    )
      throw new BadRequestException("endMinute must be after startMinute");
    const parsed = new Date(`${input.localDate}T00:00:00.000Z`);
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== input.localDate
    )
      throw new BadRequestException("localDate must be a real calendar date");
    if (input.timezone) {
      try {
        new Intl.DateTimeFormat("en-US", { timeZone: input.timezone }).format(
          parsed,
        );
      } catch {
        throw new BadRequestException(`Invalid timezone ${input.timezone}`);
      }
    }
  }

  private async ensureTenant(tenantId: string): Promise<void> {
    if (
      !(await this.prisma.tenant.findUnique({
        select: { id: true },
        where: { id: tenantId },
      }))
    )
      throw new NotFoundException(`Tenant ${tenantId} was not found`);
  }

  private async ensureTarget(
    tenantId: string,
    scope: TimetableBlockScope,
    scopeId?: string,
  ): Promise<void> {
    if (scope !== "CLASS") return;
    if (
      !(await this.prisma.classSection.findFirst({
        select: { id: true },
        where: { id: scopeId, tenantId },
      }))
    )
      throw new NotFoundException(
        `Class ${scopeId} was not found for tenant ${tenantId}`,
      );
  }

  private toSummary(
    record: ExceptionWithPolicy,
  ): AcademicCalendarExceptionSummary {
    return {
      active: record.active,
      actorId: record.actorId,
      createdAt: record.createdAt.toISOString(),
      endMinute: record.endMinute,
      id: record.id,
      kind: record.kind as "CLOSED" | "OVERRIDE",
      localDate: record.localDate,
      name: record.name,
      policyId: record.policyId,
      policyName: record.policy?.name ?? null,
      reason: record.reason,
      scope: record.scope as TimetableBlockScope,
      scopeId: record.scopeId,
      startMinute: record.startMinute,
      tenantId: record.tenantId,
      timezone: record.timezone,
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
