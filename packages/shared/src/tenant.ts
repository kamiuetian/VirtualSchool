export type TenantStatus = "ACTIVE" | "SUSPENDED" | "PILOT" | "ARCHIVED";

export type TenantSummary = {
  id: string;
  name: string;
  country: string;
  timezone: string;
  status: TenantStatus;
  planKey: string;
};

export type BranchSummary = {
  id: string;
  tenantId: string;
  name: string;
  timezone?: string | null;
  status: string;
};

export type OnboardingChecklistItem = {
  key:
    | "school_profile"
    | "branch_created"
    | "roster_started"
    | "policy_template_created"
    | "app_catalog_configured"
    | "enrollment_batch_generated"
    | "first_device_enrolled";
  label: string;
  completed: boolean;
};

export type OnboardingChecklist = {
  tenantId: string;
  completedCount: number;
  totalCount: number;
  items: OnboardingChecklistItem[];
};
