export type LmsProvider = "MOODLE" | "CANVAS";
export type LmsConnectionSummary = {
  id: string;
  provider: LmsProvider;
  baseUrl: string;
  credentialReference: string;
  status: string;
  lastTestedAt: string | null;
  lastTestOutcome: string | null;
  courseMappings: Array<{
    id: string;
    classId: string;
    externalCourseId: string;
    displayName: string;
    launchUrl: string;
    enabled: boolean;
  }>;
};
