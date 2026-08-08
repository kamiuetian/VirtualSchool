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
  availableAfterSchoolApps: GuardianAfterSchoolApp[];
  afterSchoolControl: {
    enabled: boolean;
    dailyLimitMinutes: number;
    allowedAppIds: string[];
    effective: boolean;
    inactiveReason: string | null;
  };
};

export type GuardianAfterSchoolApp = {
  id: string;
  name: string;
  category: string | null;
};

export type GuardianDashboard = {
  tenantId: string;
  guardianName: string;
  schoolName: string;
  timezone: string;
  locale: "en" | "ur";
  supportedLocales: Array<{ code: "en" | "ur"; label: string }>;
  children: GuardianChildSummary[];
  privacyMessage: string;
  notificationChannels: string[];
  supportedNotificationChannels: string[];
  consentForms: GuardianConsentForm[];
  supportRequests: GuardianSupportRequestSummary[];
  branding: import("./tenant").TenantBranding;
};

export type GuardianConsentForm = {
  id: string;
  noticeType: string;
  version: number;
  title: string;
  content: string;
  accepted: boolean;
};

export type GuardianSupportRequestSummary = {
  id: string;
  studentId: string;
  category: string;
  priority: string;
  status: string;
  subject: string;
  routedTo: string | null;
  createdAt: string;
};
