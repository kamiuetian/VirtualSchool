export type PrivacySubjectType = "ADMIN" | "GUARDIAN" | "STUDENT";
export type PrivacyChannel = "WEB" | "MOBILE" | "EMAIL";

export type PrivacyNoticeSummary = {
  id: string;
  tenantId: string;
  noticeType: string;
  channel: PrivacyChannel;
  version: number;
  title: string;
  content: string;
  publishedBy: string | null;
  publishedAt: string;
};

export type PrivacyAcceptanceSummary = {
  id: string;
  noticeId: string;
  subjectType: PrivacySubjectType;
  subjectId: string;
  channel: PrivacyChannel;
  acceptedAt: string;
  revokedAt: string | null;
  revokeReason: string | null;
};

export type SecurityPrivacyPolicyDocument = {
  title: string;
  url: string;
};

export type SecurityPrivacyProfileSummary = {
  incidentContact: { name: string; email: string; phone: string | null } | null;
  policyDocuments: SecurityPrivacyPolicyDocument[];
  childSafetyGuardrails: string[];
  updatedAt: string | null;
};

export type SecurityPrivacyOverview = {
  tenantId: string;
  dataSettings: {
    dataRegion: string;
    allowedRegionCodes: string[];
    webFilteringConfigured: boolean;
  };
  accessControls: {
    activeUsers: number;
    suspendedUsers: number;
    activeDelegatedAssignments: number;
    openAccessReviews: number;
    mfaEnforcedForPrivilegedAccess: boolean;
  };
  retention: import("./support").RetentionSettingsSummary | null;
  profile: SecurityPrivacyProfileSummary;
  privacyNoticeCount: number;
  auditExportPath: string;
};

export type ComplianceEvidenceSection =
  | "AUDIT_LOGS"
  | "ACCESS_REVIEWS"
  | "RETENTION"
  | "CONTROLS"
  | "POLICIES";

export type ComplianceEvidencePackSummary = {
  id: string;
  tenantId: string;
  name: string;
  windowFrom: string;
  windowTo: string;
  sections: ComplianceEvidenceSection[];
  checksum: string;
  createdBy: string | null;
  createdAt: string;
  downloadPath: string;
};

export type DataSubjectRequestSummary = {
  id: string;
  tenantId: string;
  requestType: "EXPORT" | "DELETE";
  subjectType: "STUDENT" | "GUARDIAN" | "USER";
  subjectId: string;
  reason: string;
  status: "PENDING" | "COMPLETED" | "REJECTED" | "BLOCKED";
  retentionUntil: string | null;
  requestedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  completedAt: string | null;
  result: Record<string, unknown> | null;
  checksum: string | null;
  createdAt: string;
  downloadPath: string | null;
};

export type SecurityIncidentUpdateSummary = {
  id: string;
  updateType:
    | "INVESTIGATION"
    | "CONTAINMENT"
    | "RECOVERY"
    | "CUSTOMER_COMMUNICATION"
    | "EVIDENCE";
  summary: string;
  evidence: string[];
  createdBy: string | null;
  createdAt: string;
};

export type SecurityIncidentSummary = {
  id: string;
  tenantId: string;
  title: string;
  classification:
    | "CONFIDENTIALITY"
    | "INTEGRITY"
    | "AVAILABILITY"
    | "PRIVACY"
    | "CHILD_SAFETY"
    | "OTHER";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description: string;
  status: "OPEN" | "CLOSED";
  ownerId: string;
  evidence: string[];
  reportedBy: string | null;
  closedBy: string | null;
  closedAt: string | null;
  closureSummary: string | null;
  createdAt: string;
  updatedAt: string;
  timeline: SecurityIncidentUpdateSummary[];
  exportPath: string;
};
