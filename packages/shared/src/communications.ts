import type { Role } from "./rbac";
export type AnnouncementSummary = {
  id: string;
  tenantId: string;
  title: string;
  message: string;
  targetRoles: Role[];
  startsAt: string;
  endsAt: string | null;
  archivedAt: string | null;
  createdAt: string;
};
export type PilotFeedbackSummary = {
  id: string;
  tenantId: string;
  role: Role;
  module: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "NEW" | "TRIAGED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  summary: string;
  context?: Record<string, string | number | boolean>;
  createdAt: string;
  updatedAt: string;
};
