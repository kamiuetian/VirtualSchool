export type AppApprovalStatus =
  | "APPROVED"
  | "PENDING_REVIEW"
  | "DEPRECATED"
  | "BLOCKED";

export type AppInstallRule = {
  installType?: "AVAILABLE" | "FORCE_INSTALLED" | "BLOCKED";
  autoUpdateMode?: "DEFAULT" | "POSTPONED" | "HIGH_PRIORITY";
  minimumAndroidVersion?: string;
};

export type AppCatalogItemSummary = {
  id: string;
  tenantId: string;
  name: string;
  packageId: string;
  category?: string | null;
  iconUrl?: string | null;
  description?: string | null;
  approvedGrades: string[];
  installRules?: AppInstallRule | null;
  approvalStatus: AppApprovalStatus;
  createdAt: string;
  updatedAt: string;
};
