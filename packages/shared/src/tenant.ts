export type TenantStatus = "ACTIVE" | "SUSPENDED" | "PILOT" | "ARCHIVED";

export type TenantSummary = {
  id: string;
  name: string;
  country: string;
  timezone: string;
  status: TenantStatus;
  planKey: string;
};
