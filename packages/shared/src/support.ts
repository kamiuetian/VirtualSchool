export type SupportNoteCategory =
  | "GENERAL"
  | "INCIDENT"
  | "ESCALATION"
  | "DEPLOYMENT"
  | "ENROLLMENT"
  | "PRIVACY";

export type SupportNoteSeverity = "S1" | "S2" | "S3" | "S4";

export type SupportNoteStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED";

export type SupportNoteVisibility = "INTERNAL" | "SCHOOL";

export type SupportNoteSummary = {
  id: string;
  tenantId: string;
  deviceId: string;
  authorId?: string | null;
  authorEmail?: string | null;
  category: SupportNoteCategory;
  severity: SupportNoteSeverity;
  status: SupportNoteStatus;
  visibility: SupportNoteVisibility;
  pinned: boolean;
  body: string;
  resolution?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SupportTimelineEventType =
  | "SUPPORT_NOTE"
  | "REMOTE_COMMAND"
  | "DEVICE_DIAGNOSTIC"
  | "DEVICE_ALERT";

export type SupportTimelineEvent = {
  id: string;
  tenantId: string;
  deviceId: string;
  type: SupportTimelineEventType;
  title: string;
  summary: string;
  occurredAt: string;
  metadata: Record<string, unknown>;
};

export type RetentionSettingsSummary = {
  id: string;
  tenantId: string;
  diagnosticRetentionDays: number;
  resolvedAlertRetentionDays: number;
  commandHistoryRetentionDays: number;
  supportNoteRetentionDays: number;
  exportArtifactRetentionDays: number;
  auditRetentionDays?: number | null;
  updatedBy?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RetentionRunMode = "DRY_RUN" | "APPLY";

export type RetentionRunStatus = "COMPLETED" | "FAILED";

export type RetentionRunResult = {
  diagnostics: number;
  resolvedAlerts: number;
  remoteCommands: number;
  supportNotes: number;
  auditEvents: number;
  exportArtifacts: number;
};

export type RetentionRunSummary = {
  id: string;
  tenantId: string;
  mode: RetentionRunMode;
  status: RetentionRunStatus;
  actorId?: string | null;
  result: RetentionRunResult;
  cutoffs: Record<string, string | null>;
  reason?: string | null;
  startedAt: string;
  completedAt?: string | null;
  createdAt: string;
};
