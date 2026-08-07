export type TeacherSessionStatus = "ACTIVE" | "ENDED";

export type TeacherSessionEventSummary = {
  id: string;
  type: string;
  deviceId?: string | null;
  details?: Record<string, unknown> | null;
  createdAt: string;
};

export type TeacherClassSummary = {
  id: string;
  name: string;
  grade: string;
  subject?: string | null;
  deviceCount: number;
};

export type TeacherDeviceSummary = {
  id: string;
  serialNumber: string;
  classId?: string | null;
  status: string;
  compliance: string;
  lastCheckInAt?: string | null;
};

export type TeacherSessionSummary = {
  id: string;
  classId: string;
  className: string;
  teacherId: string;
  status: TeacherSessionStatus;
  startedAt: string;
  endedAt?: string | null;
  reason?: string | null;
  events: TeacherSessionEventSummary[];
};

export type TeacherDashboard = {
  classes: TeacherClassSummary[];
  devices: TeacherDeviceSummary[];
  activeSession: TeacherSessionSummary | null;
  recentSessions: TeacherSessionSummary[];
  approvedResources: TeacherResourceSummary[];
  templates: TeacherSessionTemplateSummary[];
};

export type TeacherSessionTemplateSummary = {
  id: string;
  classId: string;
  className: string;
  name: string;
  resourceId?: string | null;
  focusMessage?: string | null;
  focusDurationMinutes?: number | null;
  temporaryUrl?: string | null;
  temporaryUrlMinutes?: number | null;
  createdAt: string;
  updatedAt: string;
};

export type TeacherResourceSummary = {
  id: string;
  name: string;
  packageId: string;
  category?: string | null;
};
