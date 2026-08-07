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
  activeException: AcademicCalendarExceptionSummary | null;
  explanation: string;
  evaluated: TimetableBlockSummary[];
};

export type AcademicCalendarExceptionKind = "CLOSED" | "OVERRIDE";

export type AcademicCalendarExceptionSummary = {
  id: string;
  tenantId: string;
  policyId?: string | null;
  policyName?: string | null;
  scope: TimetableBlockScope;
  scopeId?: string | null;
  localDate: string;
  name: string;
  kind: AcademicCalendarExceptionKind;
  startMinute?: number | null;
  endMinute?: number | null;
  timezone?: string | null;
  active: boolean;
  actorId?: string | null;
  reason?: string | null;
  createdAt: string;
  updatedAt: string;
};
