import type { Role } from "./rbac";

export type UserStatus = "INVITED" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED";

export type StaffRole = Exclude<
  Role,
  "PLATFORM_SUPER_ADMIN" | "STUDENT" | "GUARDIAN"
>;

export const staffRoles = [
  "SCHOOL_ADMIN",
  "IT_ADMIN",
  "ACADEMIC_ADMIN",
  "TEACHER",
  "SUPPORT_AGENT",
  "BILLING_ADMIN",
  "AUDITOR",
] as const satisfies readonly StaffRole[];

export type UserSummary = {
  id: string;
  tenantId: string;
  branchId?: string | null;
  auth0Subject?: string | null;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  mfaEnabled: boolean;
  mfaRequired: boolean;
  invitedBy?: string | null;
  invitedAt?: string | null;
  suspendedAt?: string | null;
  deactivatedAt?: string | null;
  forcedLogoutAt?: string | null;
  lastRoleChangedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};
