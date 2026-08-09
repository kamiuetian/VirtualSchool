export type TenantStatus = "ACTIVE" | "SUSPENDED" | "PILOT" | "ARCHIVED";

export type TenantSummary = {
  id: string;
  name: string;
  country: string;
  timezone: string;
  language?: "en" | "ur";
  status: TenantStatus;
  planKey: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  websiteUrl?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  studentLabel?: string | null;
  deviceLabel?: string | null;
  dataRegion: DataResidencyRegion;
  allowedRegionCodes: string[];
};

export type DataResidencyRegion = "PK" | "EU" | "US" | "APAC";

export type DataResidencyOption = {
  code: DataResidencyRegion;
  label: string;
};

export type RegionalGovernanceSummary = {
  tenantId: string;
  dataRegion: DataResidencyRegion;
  allowedRegionCodes: string[];
  regions: Array<{
    regionCode: string;
    dataRegion: DataResidencyRegion;
    branches: number;
    students: number;
    classes: number;
    devices: number;
  }>;
};

export type TenantBranding = Pick<
  TenantSummary,
  | "name"
  | "logoUrl"
  | "primaryColor"
  | "accentColor"
  | "websiteUrl"
  | "supportEmail"
  | "supportPhone"
  | "studentLabel"
  | "deviceLabel"
  | "timezone"
  | "language"
>;

export type BranchSummary = {
  id: string;
  tenantId: string;
  name: string;
  timezone?: string | null;
  status: string;
  regionCode?: string | null;
  dataRegion?: DataResidencyRegion | null;
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
  description: string;
  href: "/apps" | "/enrollment" | "/policies" | "/roster" | "/tenants";
};

export type OnboardingChecklist = {
  tenantId: string;
  completedCount: number;
  completedAt: string | null;
  readyForFirstEnrollment: boolean;
  readinessIssues: string[];
  totalCount: number;
  items: OnboardingChecklistItem[];
};
