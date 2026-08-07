export type ClassroomConnectionSummary = {
  id: string;
  status: string;
  delegatedAdminEmail: string;
  credentialReference: string;
  lastValidatedAt: string | null;
  courseMappings: ClassroomCourseMappingSummary[];
  identityMappings: ClassroomIdentityMappingSummary[];
  syncRuns: ClassroomSyncRunSummary[];
};
export type ClassroomCourseMappingSummary = {
  id: string;
  classId: string;
  externalCourseId: string;
  externalCourseName: string | null;
  syncRoster: boolean;
  syncMaterials: boolean;
  enabled: boolean;
};
export type ClassroomIdentityMappingSummary = {
  id: string;
  localType: string;
  localId: string;
  externalUserId: string;
  externalEmail: string | null;
};
export type ClassroomSyncRunSummary = {
  id: string;
  requestedCourseIds: string[];
  syncRoster: boolean;
  syncMaterials: boolean;
  status: string;
  attempt: number;
  retryOfId: string | null;
  outcome: unknown;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
};
