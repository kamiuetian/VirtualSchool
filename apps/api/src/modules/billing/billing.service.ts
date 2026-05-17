import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  BillingPlanLimits,
  BillingSubscriptionSummary,
  BillingUsageMetric,
  BillingUsageSummary,
} from "@virtual-school/shared";
import type { BillingSubscription, Tenant } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { planForKey } from "./billing-plans";
import type { UpdateBillingSubscriptionDto } from "./dto/update-billing-subscription.dto";

type TenantWithSubscription = Tenant & {
  billingSubscription: BillingSubscription | null;
};

type UsageCounts = Record<keyof BillingPlanLimits, number>;

const metricLabels: Record<keyof BillingPlanLimits, string> = {
  appCatalogItems: "App catalog items",
  branches: "Branches",
  classes: "Classes",
  commandsPerBillingPeriod: "Commands this billing period",
  devices: "Billable devices",
  policies: "Policies",
  staffUsers: "Staff users",
  students: "Active students",
};

@Injectable()
export class BillingService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getSubscription(
    tenantId: string,
  ): Promise<BillingSubscriptionSummary> {
    const tenant = await this.getTenantWithSubscription(tenantId);
    return this.toSubscriptionSummary(tenant);
  }

  async getUsage(tenantId: string): Promise<BillingUsageSummary> {
    const tenant = await this.getTenantWithSubscription(tenantId);
    const subscription = this.toSubscriptionSummary(tenant);
    const plan = planForKey(subscription.planKey);
    const effectiveLimits = this.effectiveLimits(plan.limits, subscription);
    const counts = await this.getUsageCounts(
      tenantId,
      subscription.billingPeriodStart,
      subscription.billingPeriodEnd,
    );
    const metrics = this.toMetrics(counts, effectiveLimits);

    return {
      generatedAt: new Date().toISOString(),
      metrics,
      plan: {
        ...plan,
        limits: effectiveLimits,
      },
      subscription,
      tenantId,
      totals: {
        overLimitCount: metrics.filter((metric) => metric.overLimit).length,
        warningCount: metrics.filter(
          (metric) =>
            !metric.overLimit &&
            metric.percentUsed !== null &&
            metric.percentUsed >= 80,
        ).length,
      },
    };
  }

  async updateSubscription(
    tenantId: string,
    input: UpdateBillingSubscriptionDto,
    actorId: string | undefined,
  ): Promise<BillingSubscriptionSummary> {
    const tenant = await this.getTenantWithSubscription(tenantId);
    const previous = this.toSubscriptionSummary(tenant);
    const planKey = input.planKey ?? previous.planKey;

    const saved = await this.prisma.$transaction(async (tx) => {
      const subscription = await tx.billingSubscription.upsert({
        create: {
          billingEmail: input.billingEmail,
          billingPeriodEnd: input.billingPeriodEnd
            ? new Date(input.billingPeriodEnd)
            : undefined,
          billingPeriodStart: input.billingPeriodStart
            ? new Date(input.billingPeriodStart)
            : undefined,
          branchLimit: input.branchLimit,
          deviceLimit: input.deviceLimit,
          notes: input.notes,
          planKey,
          staffLimit: input.staffLimit,
          status: input.status ?? "TRIALING",
          studentLimit: input.studentLimit,
          tenantId,
          trialEndsAt: input.trialEndsAt
            ? new Date(input.trialEndsAt)
            : undefined,
          updatedBy: actorId,
        },
        update: {
          billingEmail: input.billingEmail,
          billingPeriodEnd: input.billingPeriodEnd
            ? new Date(input.billingPeriodEnd)
            : undefined,
          billingPeriodStart: input.billingPeriodStart
            ? new Date(input.billingPeriodStart)
            : undefined,
          branchLimit: input.branchLimit,
          deviceLimit: input.deviceLimit,
          notes: input.notes,
          planKey,
          staffLimit: input.staffLimit,
          status: input.status,
          studentLimit: input.studentLimit,
          trialEndsAt: input.trialEndsAt
            ? new Date(input.trialEndsAt)
            : undefined,
          updatedBy: actorId,
        },
        where: {
          tenantId,
        },
      });

      if (planKey !== tenant.planKey) {
        await tx.tenant.update({
          data: {
            planKey,
          },
          where: {
            id: tenantId,
          },
        });
      }

      await tx.auditEvent.create({
        data: {
          action: "billing_subscription.update",
          actorId,
          newValue: this.toSubscriptionAuditValue(subscription),
          object: "BillingSubscription",
          objectId: subscription.id,
          oldValue: previous,
          outcome: "UPDATED",
          reason: input.notes,
          tenantId,
        },
      });

      return subscription;
    });

    return this.toSubscriptionSummary({
      ...tenant,
      billingSubscription: saved,
      planKey,
    });
  }

  private async getTenantWithSubscription(
    tenantId: string,
  ): Promise<TenantWithSubscription> {
    const tenant = await this.prisma.tenant.findUnique({
      include: {
        billingSubscription: true,
      },
      where: {
        id: tenantId,
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} was not found`);
    }

    return tenant;
  }

  private async getUsageCounts(
    tenantId: string,
    billingPeriodStart: string | null,
    billingPeriodEnd: string | null,
  ): Promise<UsageCounts> {
    const [periodStart, periodEnd] = this.billingPeriod(
      billingPeriodStart,
      billingPeriodEnd,
    );
    const [
      devices,
      students,
      staffUsers,
      branches,
      classes,
      appCatalogItems,
      policies,
      commandsPerBillingPeriod,
    ] = await Promise.all([
      this.prisma.device.count({
        where: {
          status: {
            not: "RETIRED",
          },
          tenantId,
        },
      }),
      this.prisma.student.count({
        where: {
          status: {
            in: ["ACTIVE", "PENDING"],
          },
          tenantId,
        },
      }),
      this.prisma.user.count({
        where: {
          status: {
            not: "DEACTIVATED",
          },
          tenantId,
        },
      }),
      this.prisma.branch.count({ where: { tenantId } }),
      this.prisma.classSection.count({ where: { tenantId } }),
      this.prisma.appCatalogItem.count({ where: { tenantId } }),
      this.prisma.policy.count({ where: { tenantId } }),
      this.prisma.remoteCommand.count({
        where: {
          createdAt: {
            gte: periodStart,
            lt: periodEnd,
          },
          tenantId,
        },
      }),
    ]);

    return {
      appCatalogItems,
      branches,
      classes,
      commandsPerBillingPeriod,
      devices,
      policies,
      staffUsers,
      students,
    };
  }

  private billingPeriod(
    billingPeriodStart: string | null,
    billingPeriodEnd: string | null,
  ): [Date, Date] {
    if (billingPeriodStart && billingPeriodEnd) {
      return [new Date(billingPeriodStart), new Date(billingPeriodEnd)];
    }

    const now = new Date();
    return [
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)),
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)),
    ];
  }

  private effectiveLimits(
    planLimits: BillingPlanLimits,
    subscription: BillingSubscriptionSummary,
  ): BillingPlanLimits {
    return {
      appCatalogItems: planLimits.appCatalogItems,
      branches: subscription.overrides.branches ?? planLimits.branches,
      classes: planLimits.classes,
      commandsPerBillingPeriod: planLimits.commandsPerBillingPeriod,
      devices: subscription.overrides.devices ?? planLimits.devices,
      policies: planLimits.policies,
      staffUsers: subscription.overrides.staffUsers ?? planLimits.staffUsers,
      students: subscription.overrides.students ?? planLimits.students,
    };
  }

  private toMetrics(
    counts: UsageCounts,
    limits: BillingPlanLimits,
  ): BillingUsageMetric[] {
    return Object.entries(counts).map(([key, used]) => {
      const metricKey = key as keyof BillingPlanLimits;
      const limit = limits[metricKey];
      const percentUsed =
        limit && limit > 0 ? Math.round((used / limit) * 100) : null;

      return {
        key: metricKey,
        label: metricLabels[metricKey],
        limit,
        overLimit: limit !== null && used > limit,
        percentUsed,
        remaining: limit === null ? null : Math.max(limit - used, 0),
        used,
      };
    });
  }

  private toSubscriptionSummary(
    tenant: TenantWithSubscription,
  ): BillingSubscriptionSummary {
    const subscription = tenant.billingSubscription;

    return {
      billingEmail: subscription?.billingEmail ?? null,
      billingPeriodEnd:
        subscription?.billingPeriodEnd?.toISOString() ?? null,
      billingPeriodStart:
        subscription?.billingPeriodStart?.toISOString() ?? null,
      id: subscription?.id ?? null,
      notes: subscription?.notes ?? null,
      overrides: {
        branches: subscription?.branchLimit ?? undefined,
        devices: subscription?.deviceLimit ?? undefined,
        staffUsers: subscription?.staffLimit ?? undefined,
        students: subscription?.studentLimit ?? undefined,
      },
      planKey: subscription?.planKey ?? tenant.planKey,
      status: subscription?.status ?? "TRIALING",
      tenantId: tenant.id,
      trialEndsAt: subscription?.trialEndsAt?.toISOString() ?? null,
      updatedAt: subscription?.updatedAt?.toISOString() ?? null,
      updatedBy: subscription?.updatedBy ?? null,
    };
  }

  private toSubscriptionAuditValue(subscription: BillingSubscription) {
    return {
      billingEmail: subscription.billingEmail,
      billingPeriodEnd: subscription.billingPeriodEnd?.toISOString() ?? null,
      billingPeriodStart:
        subscription.billingPeriodStart?.toISOString() ?? null,
      branchLimit: subscription.branchLimit,
      deviceLimit: subscription.deviceLimit,
      planKey: subscription.planKey,
      staffLimit: subscription.staffLimit,
      status: subscription.status,
      studentLimit: subscription.studentLimit,
      trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
    };
  }
}
