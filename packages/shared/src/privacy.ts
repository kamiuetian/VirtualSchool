export type PrivacySubjectType = "ADMIN" | "GUARDIAN";
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
