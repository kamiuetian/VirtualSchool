export type GuardianDeviceStatus = {
  availability:
    | "ONLINE"
    | "OFFLINE"
    | "NEEDS_ATTENTION"
    | "LOST"
    | "NOT_ASSIGNED";
  lastSeenAt: string | null;
};

export type GuardianSchoolHours = {
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  timezone: string;
};

export type GuardianLearningAccessSummary = {
  label: string;
  type: "APP_OR_RESOURCE" | "TEMPORARY_WEBSITE";
  approvedAt: string;
};

export type GuardianChildSummary = {
  id: string;
  name: string;
  grade: string;
  section: string | null;
  relationship: string;
  device: GuardianDeviceStatus;
  schoolHours: GuardianSchoolHours[];
  expectedMode: "SCHOOL_HOURS" | "CLASS_MODE" | "AFTER_SCHOOL";
  approvedLearningAccess: GuardianLearningAccessSummary[];
};

export type GuardianDashboard = {
  guardianName: string;
  schoolName: string;
  timezone: string;
  children: GuardianChildSummary[];
  privacyMessage: string;
};
