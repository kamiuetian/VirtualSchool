export type ByodStudySessionSummary = {
  id: string;
  tenantId: string;
  classId: string;
  title: string;
  status: string;
  startsAt: string;
  endsAt: string;
  allowedUrls: string[];
  eligibility: ByodEligibility;
};

export type ByodEligibility = {
  scope: "CLASS" | "GRADE" | "EXAM";
  examAssignmentId?: string;
  allowedPlatforms: string[];
  allowedBrowsers: string[];
  minimumBrowserMajorVersion: number;
};

export type ByodReadinessSummary = {
  checkedAt: string;
  eligible: boolean;
  ready: boolean;
  issues: string[];
};

export type ByodParticipationReport = {
  sessionId: string;
  generatedAt: string;
  participants: Array<{
    joinedAt: string;
    durationSeconds: number;
    approvedAccess: string[];
    exitStatus: string;
  }>;
};

export type ByodJoinSummary = {
  participantId: string;
  session: ByodStudySessionSummary;
  joinedAt: string;
  consent: { noticeId: string; version: number; acceptedAt: string };
  secureBrowser: {
    scope: "SESSION_ONLY";
    allowedUrls: string[];
    expiresAt: string;
    wholeDeviceControl: false;
    notice: string;
  };
};
