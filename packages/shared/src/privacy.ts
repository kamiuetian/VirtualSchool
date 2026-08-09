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
