import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  ActiveTimetableResolution,
  LearningMode,
  PolicyRuleSet,
  PolicyStatus,
  PolicySummary,
  TimetableBlockScope,
  TimetableBlockSummary,
} from "@virtual-school/shared";
import {
  type Policy,
  Prisma,
  type TimetableBlock,
} from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateTimetableBlockDto } from "./dto/create-timetable-block.dto";
import type { TimetableLifecycleDto } from "./dto/timetable-lifecycle.dto";
import type { UpdateTimetableBlockDto } from "./dto/update-timetable-block.dto";

type TimetableBlockWithPolicy = TimetableBlock & {
  policy: Policy;
};

const scopeSpecificity: Record<TimetableBlockScope, number> = {
  CLASS: 30,
  GRADE: 20,
  TENANT: 10,
};

const weekdayMap: Record<string, number> = {
  Fri: 5,
  Mon: 1,
  Sat: 6,
  Sun: 7,
  Thu: 4,
  Tue: 2,
  Wed: 3,
};

@Injectable()
export class TimetableService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listBlocks(tenantId: string): Promise<TimetableBlockSummary[]> {
    await this.ensureTenantExists(tenantId);

    const blocks = await this.prisma.timetableBlock.findMany({
      include: {
        policy: true,
      },
      orderBy: [
        {
          dayOfWeek: "asc",
        },
        {
          startMinute: "asc",
        },
        {
          name: "asc",
        },
      ],
      where: {
        tenantId,
      },
    });

    return blocks.map((block) => this.toTimetableBlockSummary(block));
  }

  async createBlock(
    tenantId: string,
    input: CreateTimetableBlockDto,
  ): Promise<TimetableBlockSummary> {
    await this.ensureTenantExists(tenantId);
    this.validateTimeRange(input.startMinute, input.endMinute);
    this.validateEffectiveRange(input.effectiveFrom, input.effectiveUntil);
    this.validateScope(input.scope, input.scopeId);
    await this.ensureBranchBelongsToTenant(tenantId, input.branchId);
    const policy = await this.getTimetablePolicy(tenantId, input.policyId);
    await this.ensureTargetExists(tenantId, input.scope, input.scopeId);
    await this.ensureNoOverlap(tenantId, {
      dayOfWeek: input.dayOfWeek,
      endMinute: input.endMinute,
      scope: input.scope,
      scopeId: input.scope === "TENANT" ? null : input.scopeId,
      startMinute: input.startMinute,
    });

    const block = await this.prisma.$transaction(async (tx) => {
      const created = await tx.timetableBlock.create({
        data: {
          active: true,
          actorId: input.actorId,
          branchId: input.branchId,
          classId: input.scope === "CLASS" ? input.scopeId : undefined,
          dayOfWeek: input.dayOfWeek,
          effectiveFrom: input.effectiveFrom
            ? new Date(input.effectiveFrom)
            : undefined,
          effectiveUntil: input.effectiveUntil
            ? new Date(input.effectiveUntil)
            : undefined,
          endMinute: input.endMinute,
          grade: input.scope === "GRADE" ? input.scopeId : undefined,
          name: input.name,
          policyId: input.policyId,
          reason: input.reason,
          scope: input.scope,
          scopeId: input.scope === "TENANT" ? null : input.scopeId,
          startMinute: input.startMinute,
          subject: input.subject,
          tenantId,
          timezone: input.timezone,
        },
        include: {
          policy: true,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "timetable_block.create",
          actorId: input.actorId,
          newValue: {
            dayOfWeek: created.dayOfWeek,
            endMinute: created.endMinute,
            policyId: created.policyId,
            policyVersion: policy.version,
            scope: created.scope,
            scopeId: created.scopeId,
            startMinute: created.startMinute,
          },
          object: "TimetableBlock",
          objectId: created.id,
          outcome: "SUCCESS",
          reason: input.reason,
          tenantId,
        },
      });

      return created;
    });

    return this.toTimetableBlockSummary(block);
  }

  async updateBlock(
    tenantId: string,
    blockId: string,
    input: UpdateTimetableBlockDto,
  ): Promise<TimetableBlockSummary> {
    const existing = await this.getBlock(tenantId, blockId);
    const scope = input.scope ?? (existing.scope as TimetableBlockScope);
    const scopeId =
      input.scopeId === undefined
        ? (existing.scopeId ?? undefined)
        : input.scopeId;
    const policyId = input.policyId ?? existing.policyId;
    const startMinute = input.startMinute ?? existing.startMinute;
    const endMinute = input.endMinute ?? existing.endMinute;
    const dayOfWeek = input.dayOfWeek ?? existing.dayOfWeek;
    const effectiveFrom =
      input.effectiveFrom === undefined
        ? existing.effectiveFrom?.toISOString()
        : input.effectiveFrom;
    const effectiveUntil =
      input.effectiveUntil === undefined
        ? existing.effectiveUntil?.toISOString()
        : input.effectiveUntil;

    this.validateTimeRange(startMinute, endMinute);
    this.validateEffectiveRange(effectiveFrom, effectiveUntil);
    this.validateScope(scope, scopeId);
    await this.ensureBranchBelongsToTenant(tenantId, input.branchId);
    const policy = await this.getTimetablePolicy(tenantId, policyId);
    await this.ensureTargetExists(tenantId, scope, scopeId);
    await this.ensureNoOverlap(tenantId, {
      dayOfWeek,
      endMinute,
      excludeBlockId: blockId,
      scope,
      scopeId: scope === "TENANT" ? null : scopeId,
      startMinute,
    });

    const block = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.timetableBlock.update({
        data: {
          active: input.active,
          actorId: input.actorId,
          branchId: input.branchId,
          classId: scope === "CLASS" ? scopeId : null,
          dayOfWeek,
          effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : null,
          effectiveUntil: effectiveUntil ? new Date(effectiveUntil) : null,
          endMinute,
          grade: scope === "GRADE" ? scopeId : null,
          name: input.name,
          policyId,
          reason: input.reason,
          scope,
          scopeId: scope === "TENANT" ? null : scopeId,
          startMinute,
          subject: input.subject,
          timezone: input.timezone,
        },
        include: {
          policy: true,
        },
        where: {
          id: existing.id,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "timetable_block.update",
          actorId: input.actorId,
          newValue: {
            active: saved.active,
            dayOfWeek: saved.dayOfWeek,
            endMinute: saved.endMinute,
            policyId: saved.policyId,
            policyVersion: policy.version,
            scope: saved.scope,
            scopeId: saved.scopeId,
            startMinute: saved.startMinute,
          },
          object: "TimetableBlock",
          objectId: saved.id,
          oldValue: {
            active: existing.active,
            dayOfWeek: existing.dayOfWeek,
            endMinute: existing.endMinute,
            policyId: existing.policyId,
            scope: existing.scope,
            scopeId: existing.scopeId,
            startMinute: existing.startMinute,
          },
          outcome: "SUCCESS",
          reason: input.reason,
          tenantId,
        },
      });

      return saved;
    });

    return this.toTimetableBlockSummary(block);
  }

  async deactivateBlock(
    tenantId: string,
    blockId: string,
    input: TimetableLifecycleDto,
  ): Promise<TimetableBlockSummary> {
    const existing = await this.getBlock(tenantId, blockId);

    const block = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.timetableBlock.update({
        data: {
          active: false,
          actorId: input.actorId,
          reason: input.reason,
        },
        include: {
          policy: true,
        },
        where: {
          id: existing.id,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "timetable_block.deactivate",
          actorId: input.actorId,
          newValue: {
            active: false,
          },
          object: "TimetableBlock",
          objectId: saved.id,
          oldValue: {
            active: existing.active,
          },
          outcome: "SUCCESS",
          reason: input.reason,
          tenantId,
        },
      });

      return saved;
    });

    return this.toTimetableBlockSummary(block);
  }

  async resolveActiveBlockForDevice(
    tenantId: string,
    deviceId: string,
    at: Date = new Date(),
  ): Promise<ActiveTimetableResolution> {
    const device = await this.prisma.device.findFirst({
      include: {
        student: {
          select: {
            grade: true,
            id: true,
          },
        },
        tenant: {
          select: {
            timezone: true,
          },
        },
      },
      where: {
        id: deviceId,
        tenantId,
      },
    });

    if (!device) {
      throw new NotFoundException(
        `Device ${deviceId} was not found for tenant ${tenantId}`,
      );
    }

    const scopeMatches: Array<{ scope: string; scopeId?: string | null }> = [
      {
        scope: "TENANT",
        scopeId: null,
      },
    ];

    if (device.student?.grade) {
      scopeMatches.push({
        scope: "GRADE",
        scopeId: device.student.grade,
      });
    }

    if (device.classId) {
      scopeMatches.push({
        scope: "CLASS",
        scopeId: device.classId,
      });
    }

    const candidates = await this.prisma.timetableBlock.findMany({
      include: {
        policy: true,
      },
      where: {
        active: true,
        tenantId,
        OR: scopeMatches,
        policy: {
          status: "PUBLISHED",
        },
        AND: [
          {
            OR: [
              {
                effectiveFrom: null,
              },
              {
                effectiveFrom: {
                  lte: at,
                },
              },
            ],
          },
          {
            OR: [
              {
                effectiveUntil: null,
              },
              {
                effectiveUntil: {
                  gt: at,
                },
              },
            ],
          },
        ],
      },
    });

    const evaluated = candidates.filter((block) =>
      this.blockMatchesLocalTime(block, at, device.tenant.timezone),
    );
    const sorted = [...evaluated].sort((left, right) => {
      const specificityDiff =
        scopeSpecificity[right.scope as TimetableBlockScope] -
        scopeSpecificity[left.scope as TimetableBlockScope];
      if (specificityDiff !== 0) {
        return specificityDiff;
      }

      const versionDiff = right.policy.version - left.policy.version;
      if (versionDiff !== 0) {
        return versionDiff;
      }

      return right.createdAt.getTime() - left.createdAt.getTime();
    });
    const active = sorted[0] ?? null;
    const summaries = sorted.map((block) =>
      this.toTimetableBlockSummary(block),
    );

    return {
      activeBlock: active ? this.toTimetableBlockSummary(active) : null,
      activePolicy: active ? this.toPolicySummary(active.policy) : null,
      deviceId,
      evaluated: summaries,
      explanation: active
        ? `${active.name} matched ${active.scope}:${active.scopeId ?? "baseline"} at ${this.formatMinutes(active.startMinute)}-${this.formatMinutes(active.endMinute)}.`
        : "No active timetable block matched this device and time.",
      resolvedAt: at.toISOString(),
      tenantId,
      timezone: device.tenant.timezone,
    };
  }

  private async getBlock(
    tenantId: string,
    blockId: string,
  ): Promise<TimetableBlock> {
    const block = await this.prisma.timetableBlock.findFirst({
      where: {
        id: blockId,
        tenantId,
      },
    });

    if (!block) {
      throw new NotFoundException(
        `Timetable block ${blockId} was not found for tenant ${tenantId}`,
      );
    }

    return block;
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

  private async ensureBranchBelongsToTenant(
    tenantId: string,
    branchId: string | undefined,
  ): Promise<void> {
    if (!branchId) {
      return;
    }

    const branch = await this.prisma.branch.findFirst({
      select: {
        id: true,
      },
      where: {
        id: branchId,
        tenantId,
      },
    });

    if (!branch) {
      throw new NotFoundException(
        `Branch ${branchId} was not found for tenant ${tenantId}`,
      );
    }
  }

  private async getTimetablePolicy(
    tenantId: string,
    policyId: string,
  ): Promise<Policy> {
    const policy = await this.prisma.policy.findFirst({
      where: {
        id: policyId,
        tenantId,
      },
    });

    if (!policy) {
      throw new NotFoundException(
        `Policy ${policyId} was not found for tenant ${tenantId}`,
      );
    }

    if (policy.status !== "PUBLISHED") {
      throw new BadRequestException(
        "Timetable blocks can only use published policies",
      );
    }

    const rules = policy.rules as PolicyRuleSet;
    if (rules.mode !== "TIMETABLE_CLASS") {
      throw new BadRequestException(
        "Timetable blocks require a TIMETABLE_CLASS policy",
      );
    }

    return policy;
  }

  private validateScope(
    scope: TimetableBlockScope,
    scopeId: string | undefined,
  ): void {
    if (scope === "TENANT" && scopeId) {
      throw new BadRequestException(
        "Tenant timetable blocks must not include scopeId",
      );
    }

    if (scope !== "TENANT" && !scopeId) {
      throw new BadRequestException(
        `${scope} timetable blocks require scopeId`,
      );
    }
  }

  private async ensureTargetExists(
    tenantId: string,
    scope: TimetableBlockScope,
    scopeId: string | undefined,
  ): Promise<void> {
    if (scope === "TENANT") {
      return;
    }

    if (scope === "GRADE") {
      return;
    }

    const classSection = await this.prisma.classSection.findFirst({
      select: {
        id: true,
      },
      where: {
        id: scopeId,
        tenantId,
      },
    });

    if (!classSection) {
      throw new NotFoundException(
        `Class ${scopeId} was not found for tenant ${tenantId}`,
      );
    }
  }

  private validateTimeRange(startMinute: number, endMinute: number): void {
    if (endMinute <= startMinute) {
      throw new BadRequestException("endMinute must be after startMinute");
    }
  }

  private validateEffectiveRange(
    effectiveFrom: string | undefined,
    effectiveUntil: string | undefined,
  ): void {
    if (
      effectiveFrom &&
      effectiveUntil &&
      new Date(effectiveUntil) <= new Date(effectiveFrom)
    ) {
      throw new BadRequestException(
        "effectiveUntil must be after effectiveFrom",
      );
    }
  }

  private async ensureNoOverlap(
    tenantId: string,
    input: {
      dayOfWeek: number;
      endMinute: number;
      excludeBlockId?: string;
      scope: TimetableBlockScope;
      scopeId?: string | null;
      startMinute: number;
    },
  ): Promise<void> {
    const overlapping = await this.prisma.timetableBlock.findFirst({
      select: {
        id: true,
      },
      where: {
        active: true,
        dayOfWeek: input.dayOfWeek,
        endMinute: {
          gt: input.startMinute,
        },
        id: input.excludeBlockId
          ? {
              not: input.excludeBlockId,
            }
          : undefined,
        scope: input.scope,
        scopeId: input.scopeId,
        startMinute: {
          lt: input.endMinute,
        },
        tenantId,
      },
    });

    if (overlapping) {
      throw new BadRequestException(
        "Timetable block overlaps an existing active block for this scope",
      );
    }
  }

  private blockMatchesLocalTime(
    block: TimetableBlock,
    at: Date,
    tenantTimezone: string,
  ): boolean {
    const local = this.getLocalTime(at, block.timezone ?? tenantTimezone);

    return (
      block.dayOfWeek === local.dayOfWeek &&
      block.startMinute <= local.minuteOfDay &&
      block.endMinute > local.minuteOfDay
    );
  }

  private getLocalTime(
    at: Date,
    timezone: string,
  ): { dayOfWeek: number; minuteOfDay: number } {
    const parts = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      timeZone: timezone,
      weekday: "short",
    }).formatToParts(at);
    const weekday = parts.find((part) => part.type === "weekday")?.value;
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const minute = Number(parts.find((part) => part.type === "minute")?.value);

    if (!weekday || Number.isNaN(hour) || Number.isNaN(minute)) {
      throw new BadRequestException(`Invalid timezone ${timezone}`);
    }

    const dayOfWeek = weekdayMap[weekday];
    if (!dayOfWeek) {
      throw new BadRequestException(
        `Could not resolve weekday for ${timezone}`,
      );
    }

    return {
      dayOfWeek,
      minuteOfDay: hour * 60 + minute,
    };
  }

  private formatMinutes(minutes: number): string {
    const hour = Math.floor(minutes / 60)
      .toString()
      .padStart(2, "0");
    const minute = (minutes % 60).toString().padStart(2, "0");

    return `${hour}:${minute}`;
  }

  private toTimetableBlockSummary(
    block: TimetableBlockWithPolicy,
  ): TimetableBlockSummary {
    return {
      active: block.active,
      actorId: block.actorId,
      branchId: block.branchId,
      classId: block.classId,
      createdAt: block.createdAt.toISOString(),
      dayOfWeek: block.dayOfWeek,
      effectiveFrom: block.effectiveFrom?.toISOString() ?? null,
      effectiveUntil: block.effectiveUntil?.toISOString() ?? null,
      endMinute: block.endMinute,
      grade: block.grade,
      id: block.id,
      name: block.name,
      policyId: block.policyId,
      policyName: block.policy.name,
      policyVersion: block.policy.version,
      reason: block.reason,
      scope: block.scope as TimetableBlockScope,
      scopeId: block.scopeId,
      startMinute: block.startMinute,
      subject: block.subject,
      tenantId: block.tenantId,
      timezone: block.timezone,
      updatedAt: block.updatedAt.toISOString(),
    };
  }

  private toPolicySummary(policy: Policy): PolicySummary {
    return {
      createdAt: policy.createdAt.toISOString(),
      id: policy.id,
      name: policy.name,
      rules: policy.rules as PolicyRuleSet,
      status: policy.status as PolicyStatus,
      tenantId: policy.tenantId,
      updatedAt: policy.updatedAt.toISOString(),
      version: policy.version,
    };
  }
}
