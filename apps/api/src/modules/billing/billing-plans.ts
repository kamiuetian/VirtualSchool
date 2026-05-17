import type { BillingPlan, BillingPlanKey } from "@virtual-school/shared";

export const billingPlans: Record<BillingPlanKey, BillingPlan> = {
  enterprise: {
    description: "Custom enterprise plan with negotiated usage limits.",
    key: "enterprise",
    limits: {
      appCatalogItems: null,
      branches: null,
      classes: null,
      commandsPerBillingPeriod: null,
      devices: null,
      policies: null,
      staffUsers: null,
      students: null,
    },
    name: "Enterprise",
  },
  growth: {
    description: "Multi-campus rollout plan for larger schools.",
    key: "growth",
    limits: {
      appCatalogItems: 500,
      branches: 25,
      classes: 500,
      commandsPerBillingPeriod: 100_000,
      devices: 2_500,
      policies: 250,
      staffUsers: 250,
      students: 7_500,
    },
    name: "Growth",
  },
  pilot: {
    description: "Pilot plan for the first controlled tablet rollout.",
    key: "pilot",
    limits: {
      appCatalogItems: 100,
      branches: 5,
      classes: 50,
      commandsPerBillingPeriod: 10_000,
      devices: 300,
      policies: 50,
      staffUsers: 50,
      students: 1_000,
    },
    name: "Pilot",
  },
  starter: {
    description: "Single-school launch plan for the first production cohort.",
    key: "starter",
    limits: {
      appCatalogItems: 200,
      branches: 10,
      classes: 150,
      commandsPerBillingPeriod: 25_000,
      devices: 750,
      policies: 100,
      staffUsers: 100,
      students: 2_500,
    },
    name: "Starter",
  },
};

export function planForKey(planKey: string): BillingPlan {
  return (
    billingPlans[planKey as BillingPlanKey] ?? {
      description: "Custom plan pending catalog configuration.",
      key: "enterprise",
      limits: billingPlans.enterprise.limits,
      name: planKey,
    }
  );
}
