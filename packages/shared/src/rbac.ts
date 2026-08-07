export const roles = [
  "PLATFORM_SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "IT_ADMIN",
  "ACADEMIC_ADMIN",
  "TEACHER",
  "SUPPORT_AGENT",
  "BILLING_ADMIN",
  "AUDITOR",
  "STUDENT",
  "GUARDIAN"
] as const;

export type Role = (typeof roles)[number];

export const permissions = [
  "tenant:create",
  "tenant:read",
  "tenant:update",
  "user:invite",
  "user:suspend",
  "roster:manage",
  "class:manage",
  "session:manage",
  "device:enroll",
  "device:read",
  "device:command",
  "device:wipe",
  "policy:manage",
  "report:export",
  "audit:read",
  "billing:read",
  "billing:manage"
] as const;

export type Permission = (typeof permissions)[number];

export const rolePermissions: Record<Role, Permission[]> = {
  PLATFORM_SUPER_ADMIN: [...permissions],
  SCHOOL_ADMIN: [
    "tenant:read",
    "tenant:update",
    "user:invite",
    "user:suspend",
    "roster:manage",
    "class:manage",
    "device:read",
    "policy:manage",
    "report:export",
    "audit:read",
    "billing:read",
    "billing:manage"
  ],
  IT_ADMIN: [
    "tenant:read",
    "device:enroll",
    "device:read",
    "device:command",
    "device:wipe",
    "policy:manage",
    "report:export",
    "audit:read"
  ],
  ACADEMIC_ADMIN: ["tenant:read", "roster:manage", "class:manage", "policy:manage", "report:export"],
  TEACHER: ["tenant:read", "session:manage"],
  SUPPORT_AGENT: ["tenant:read", "device:read", "device:command"],
  BILLING_ADMIN: ["tenant:read", "billing:read", "billing:manage"],
  AUDITOR: ["tenant:read", "audit:read", "report:export"],
  STUDENT: [],
  GUARDIAN: []
};

export function roleAllows(role: Role, permission: Permission): boolean {
  return rolePermissions[role].includes(permission);
}
