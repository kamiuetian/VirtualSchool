import type { Permission } from "./rbac";

export type AccessScopeType = "TENANT" | "REGION" | "BRANCH";
export type AccessRoleTemplateSummary = {
  id: string;
  name: string;
  description: string | null;
  permissions: Permission[];
  active: boolean;
};
export type AccessAssignmentSummary = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  templateId: string;
  templateName: string;
  permissions: Permission[];
  scopeType: AccessScopeType;
  regionCodes: string[];
  branchId: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
};
export type AccessReviewSummary = {
  id: string;
  name: string;
  status: "OPEN" | "COMPLETED";
  dueAt: string;
  completedAt: string | null;
  items: Array<{
    id: string;
    assignmentId: string;
    userId: string;
    userName: string;
    templateName: string;
    scope: string;
    decision: "PENDING" | "CONFIRMED" | "REVOKED";
    reason: string | null;
    decidedBy: string | null;
    decidedAt: string | null;
  }>;
};
