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

export const appDeploymentActions = ["INSTALL", "REMOVE"] as const;

export type AppDeploymentAction = (typeof appDeploymentActions)[number];

export const appDeploymentScopes = [
  "TENANT",
  "GRADE",
  "CLASS",
  "STUDENT",
  "DEVICE",
] as const;

export type AppDeploymentScope = (typeof appDeploymentScopes)[number];

export type AppDeploymentSummary = {
  tenantId: string;
  appId: string;
  packageId: string;
  action: AppDeploymentAction;
  scope: AppDeploymentScope;
  scopeId?: string | null;
  targetedDevices: number;
  queuedCommands: number;
  skippedDevices: number;
  commandIds: string[];
};
