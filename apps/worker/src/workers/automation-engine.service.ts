import { Inject, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import type { AutomationRule, Prisma } from "../../../api/src/generated/prisma";
import { WorkerPrismaService } from "../prisma/worker-prisma.service";

@Injectable()
export class AutomationEngineService {
  constructor(
    @Inject(WorkerPrismaService) private readonly prisma: WorkerPrismaService,
  ) {}
  async processTenant(tenantId: string): Promise<Record<string, unknown>> {
    const rules = await this.prisma.automationRule.findMany({
      where: { tenantId, enabled: true },
    });
    let executed = 0;
    for (const rule of rules)
      for (const match of await this.matches(rule))
        if (await this.execute(rule, match)) executed += 1;
    return {
      job: "automation.evaluate",
      tenantId,
      rulesEvaluated: rules.length,
      executed,
    };
  }
  private async matches(
    rule: AutomationRule,
  ): Promise<Array<{ deviceId: string; count: number; bucket: string }>> {
    const c = rule.conditions as { threshold: number; windowMinutes: number };
    const since = new Date(Date.now() - c.windowMinutes * 60_000);
    const bucket = new Date(
      Math.floor(Date.now() / (c.windowMinutes * 60_000)) *
        c.windowMinutes *
        60_000,
    ).toISOString();
    if (rule.trigger === "DEVICE_OFFLINE") {
      const devices = await this.prisma.device.findMany({
        where: {
          tenantId: rule.tenantId,
          status: "OFFLINE",
          lastCheckInAt: { lte: since },
        },
        select: { id: true },
      });
      return devices.map((d) => ({ deviceId: d.id, count: 1, bucket }));
    }
    const rows = await this.prisma.remoteCommand.groupBy({
      by: ["deviceId"],
      where: {
        tenantId: rule.tenantId,
        status: "FAILED",
        type: "POLICY_REFRESH",
        updatedAt: { gte: since },
      },
      _count: { _all: true },
      having: { deviceId: { _count: { gte: c.threshold } } },
    });
    return rows.map((row) => ({
      deviceId: row.deviceId,
      count: row._count._all,
      bucket,
    }));
  }
  private async execute(
    rule: AutomationRule,
    match: { deviceId: string; count: number; bucket: string },
  ): Promise<boolean> {
    const config = rule.actionConfig as { title: string; severity: string };
    const fingerprint = createHash("sha256")
      .update(`${rule.id}:${match.deviceId}:${match.bucket}`)
      .digest("hex");
    try {
      await this.prisma.$transaction(async (tx) => {
        const execution = await tx.automationExecution.create({
          data: {
            tenantId: rule.tenantId,
            ruleId: rule.id,
            fingerprint,
            targetType: "DEVICE",
            targetId: match.deviceId,
            outcome: "EXECUTED",
            evidence: {
              trigger: rule.trigger,
              count: match.count,
              bucket: match.bucket,
            },
          },
        });
        let result: Prisma.InputJsonValue;
        if (rule.action === "NOTIFY") {
          const alert = await tx.deviceAlert.create({
            data: {
              tenantId: rule.tenantId,
              deviceId: match.deviceId,
              type: "AUTOMATION_NOTIFICATION",
              severity: config.severity,
              title: config.title,
              message: `${rule.name} matched ${rule.trigger} with ${match.count} evidence item(s).`,
              source: "AUTOMATION",
              metadata: {
                automationExecutionId: execution.id,
                ruleId: rule.id,
              },
            },
          });
          result = { alertId: alert.id };
        } else {
          const ticket = await tx.supportTicket.create({
            data: {
              tenantId: rule.tenantId,
              deviceId: match.deviceId,
              subject: config.title,
              description: `${rule.name} matched ${rule.trigger} with ${match.count} evidence item(s).`,
              category: "AUTOMATION",
              source: "AUTOMATION",
              priority: config.severity === "CRITICAL" ? "URGENT" : "HIGH",
              routingQueue: "DEVICE_OPERATIONS",
              slaDueAt: new Date(
                Date.now() +
                  (config.severity === "CRITICAL" ? 4 : 8) * 3_600_000,
              ),
              createdBy: "automation",
            },
          });
          result = { supportTicketId: ticket.id };
        }
        await tx.automationExecution.update({
          where: { id: execution.id },
          data: { result },
        });
        await tx.auditEvent.create({
          data: {
            tenantId: rule.tenantId,
            actorId: "automation",
            action: "automation_rule.execute",
            object: "AutomationExecution",
            objectId: execution.id,
            outcome: "EXECUTED",
            newValue: {
              ruleId: rule.id,
              targetId: match.deviceId,
              action: rule.action,
            },
          },
        });
      });
      return true;
    } catch (error) {
      if (
        typeof error === "object" &&
        error &&
        "code" in error &&
        error.code === "P2002"
      )
        return false;
      throw error;
    }
  }
}
