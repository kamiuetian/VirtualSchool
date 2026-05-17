export type BillingPlanKey = "pilot" | "starter" | "growth" | "enterprise";

export type BillingSubscriptionStatus =
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "SUSPENDED"
  | "CANCELED";

export type BillingPlanLimits = {
  devices: number | null;
  students: number | null;
  staffUsers: number | null;
  branches: number | null;
  classes: number | null;
  appCatalogItems: number | null;
  policies: number | null;
  commandsPerBillingPeriod: number | null;
};

export type BillingPlan = {
  key: BillingPlanKey;
  name: string;
  description: string;
  limits: BillingPlanLimits;
};

export type BillingSubscriptionSummary = {
  id: string | null;
  tenantId: string;
  planKey: string;
  status: BillingSubscriptionStatus;
  billingEmail: string | null;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  trialEndsAt: string | null;
  overrides: Partial<BillingPlanLimits>;
  notes: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
};

export type BillingUsageMetric = {
  key: keyof BillingPlanLimits;
  label: string;
  used: number;
  limit: number | null;
  remaining: number | null;
  percentUsed: number | null;
  overLimit: boolean;
};

export type BillingUsageSummary = {
  tenantId: string;
  generatedAt: string;
  plan: BillingPlan;
  subscription: BillingSubscriptionSummary;
  metrics: BillingUsageMetric[];
  totals: {
    overLimitCount: number;
    warningCount: number;
  };
};
