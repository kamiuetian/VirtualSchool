export type EducationProvider =
  | "MICROSOFT_365"
  | "TEAMS"
  | "ZOOM"
  | "GOOGLE_MEET";
export type EducationConnectionSummary = {
  id: string;
  provider: EducationProvider;
  credentialReference: string;
  status: string;
  resources: Array<{
    id: string;
    classId: string;
    provider: EducationProvider;
    externalId: string;
    displayName: string;
    launchUrl: string;
    enabled: boolean;
  }>;
};
