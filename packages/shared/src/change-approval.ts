export const highRiskOperations = [
  "BROAD_UNLOCK",
  "WEB_BLOCK_REMOVAL",
  "EXAM_CHANGE",
] as const;
export type HighRiskOperation = (typeof highRiskOperations)[number];
export type HighRiskDecision = {
  actorId: string;
  decision: "APPROVED" | "REJECTED";
  reason: string;
  decidedAt: string;
};
export type HighRiskChangeRequestSummary = {
  id: string;
  tenantId: string;
  operation: HighRiskOperation;
  objectType: string;
  objectId: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED" | "APPLIED";
  summary: string;
  reason: string;
  oldValue: unknown;
  newValue: unknown;
  requestedBy: string;
  decisions: HighRiskDecision[];
  outcome: string | null;
  expiresAt: string;
  createdAt: string;
};
