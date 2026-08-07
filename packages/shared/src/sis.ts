export type SisRecordType =
  | "STUDENT"
  | "CLASS"
  | "TEACHER"
  | "GUARDIAN"
  | "ENROLLMENT";
export type SisRecordOutcome = {
  objectType: SisRecordType;
  localId: string;
  externalId: string;
  status: "RECONCILED" | "FAILED";
  error?: string;
};
export type SisSyncRunSummary = {
  id: string;
  source: string;
  status: string;
  attempt: number;
  retryOfId: string | null;
  totalRecords: number;
  affectedRecords: number;
  failedRecords: number;
  records: SisRecordOutcome[];
  requestedBy: string | null;
  startedAt: string;
  completedAt: string | null;
};
export type SisOperationsSummary = {
  lastSuccessAt: string | null;
  runs: SisSyncRunSummary[];
};
