import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AutomationRuleSummary,
  AutomationTestResult,
} from "@virtual-school/shared";
import type { AutomationRule } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateAutomationRuleDto,
  UpdateAutomationRuleDto,
} from "./dto/automation-rule.dto";

@Injectable()
export class AutomationService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async list(tenantId: string): Promise<AutomationRuleSummary[]> {
    await this.ensureTenant(tenantId);
    return (
      await this.prisma.automationRule.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
      })
    ).map((r) => this.summary(r));
  }
  async create(
    tenantId: string,
    input: CreateAutomationRuleDto,
    actorId?: string,
  ) {
    await this.ensureTenant(tenantId);
    const rule = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.automationRule.create({
        data: {
          tenantId,
          name: input.name.trim(),
          trigger: input.trigger,
          conditions: {
            threshold: input.threshold,
            windowMinutes: input.windowMinutes,
          },
          action: input.action,
          actionConfig: { title: input.title.trim(), severity: input.severity },
          enabled: input.enabled ?? false,
          createdBy: actorId,
          updatedBy: actorId,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "automation_rule.create",
          object: "AutomationRule",
          objectId: saved.id,
          outcome: "CREATED",
          newValue: this.audit(saved),
        },
      });
      return saved;
    });
    return this.summary(rule);
  }
  async update(
    tenantId: string,
    id: string,
    input: UpdateAutomationRuleDto,
    actorId?: string,
  ) {
    const previous = await this.find(tenantId, id);
    const saved = await this.prisma.$transaction(async (tx) => {
      const rule = await tx.automationRule.update({
        where: { id },
        data: {
          name: input.name.trim(),
          trigger: input.trigger,
          conditions: {
            threshold: input.threshold,
            windowMinutes: input.windowMinutes,
          },
          action: input.action,
          actionConfig: { title: input.title.trim(), severity: input.severity },
          enabled: input.enabled ?? false,
          updatedBy: actorId,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action:
            rule.enabled === previous.enabled
              ? "automation_rule.update"
              : rule.enabled
                ? "automation_rule.enable"
                : "automation_rule.disable",
          object: "AutomationRule",
          objectId: id,
          outcome: "UPDATED",
          oldValue: this.audit(previous),
          newValue: this.audit(rule),
        },
      });
      return rule;
    });
    return this.summary(saved);
  }
  async test(tenantId: string, id: string): Promise<AutomationTestResult> {
    const rule = await this.find(tenantId, id);
    const samples = await this.matches(rule);
    await this.prisma.auditEvent.create({
      data: {
        tenantId,
        action: "automation_rule.test",
        object: "AutomationRule",
        objectId: id,
        outcome: "TESTED",
        newValue: { matchCount: samples.length, sideEffects: false },
      },
    });
    return {
      matched: samples.length > 0,
      matchCount: samples.length,
      sampledTargets: samples.slice(0, 10),
      sideEffects: false,
    };
  }
  private async matches(rule: AutomationRule) {
    const conditions = rule.conditions as {
      threshold: number;
      windowMinutes: number;
    };
    const since = new Date(Date.now() - conditions.windowMinutes * 60_000);
    if (rule.trigger === "DEVICE_OFFLINE") {
      const devices = await this.prisma.device.findMany({
        where: {
          tenantId: rule.tenantId,
          status: "OFFLINE",
          lastCheckInAt: { lte: since },
        },
        select: { id: true, serialNumber: true },
      });
      return devices.map((d) => ({
        id: d.id,
        label: d.serialNumber,
        evidenceCount: 1,
      }));
    }
    const failures = await this.prisma.remoteCommand.groupBy({
      by: ["deviceId"],
      where: {
        tenantId: rule.tenantId,
        status: "FAILED",
          type: "POLICY_REFRESH",
        updatedAt: { gte: since },
      },
      _count: { _all: true },
      having: { deviceId: { _count: { gte: conditions.threshold } } },
    });
    return failures.map((f) => ({
      id: f.deviceId,
      label: f.deviceId,
      evidenceCount: f._count._all,
    }));
  }
  private async find(tenantId: string, id: string) {
    const rule = await this.prisma.automationRule.findFirst({
      where: { id, tenantId },
    });
    if (!rule)
      throw new NotFoundException(`Automation rule ${id} was not found`);
    return rule;
  }
  private async ensureTenant(tenantId: string) {
    if (
      !(await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true },
      }))
    )
      throw new NotFoundException(`Tenant ${tenantId} was not found`);
  }
  private summary(rule: AutomationRule): AutomationRuleSummary {
    return {
      id: rule.id,
      tenantId: rule.tenantId,
      name: rule.name,
      trigger: rule.trigger as AutomationRuleSummary["trigger"],
      conditions: rule.conditions as AutomationRuleSummary["conditions"],
      action: rule.action as AutomationRuleSummary["action"],
      actionConfig: rule.actionConfig as AutomationRuleSummary["actionConfig"],
      enabled: rule.enabled,
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString(),
    };
  }
  private audit(rule: AutomationRule) {
    return {
      name: rule.name,
      trigger: rule.trigger,
      conditions: rule.conditions,
      action: rule.action,
      actionConfig: rule.actionConfig,
      enabled: rule.enabled,
    };
  }
}
