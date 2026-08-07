export type ByodStudySessionSummary = {
  id: string;
  tenantId: string;
  classId: string;
  title: string;
  status: string;
  startsAt: string;
  endsAt: string;
  allowedUrls: string[];
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
