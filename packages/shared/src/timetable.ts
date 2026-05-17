import type { PolicySummary } from "./policy";

export const timetableBlockScopes = ["TENANT", "GRADE", "CLASS"] as const;

export type TimetableBlockScope = (typeof timetableBlockScopes)[number];

export type TimetableBlockSummary = {
  id: string;
  tenantId: string;
  branchId?: string | null;
  policyId: string;
  policyName: string;
  policyVersion: number;
  scope: TimetableBlockScope;
  scopeId?: string | null;
  classId?: string | null;
  grade?: string | null;
  name: string;
  subject?: string | null;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  timezone?: string | null;
  effectiveFrom?: string | null;
  effectiveUntil?: string | null;
  active: boolean;
  actorId?: string | null;
  reason?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ActiveTimetableResolution = {
  tenantId: string;
  deviceId: string;
  resolvedAt: string;
  timezone: string;
  activeBlock: TimetableBlockSummary | null;
  activePolicy: PolicySummary | null;
  explanation: string;
  evaluated: TimetableBlockSummary[];
};
