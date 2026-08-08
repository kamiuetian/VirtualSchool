export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";

export type AttendanceSettingsSummary = {
  tenantId: string;
  sessionSignalEnabled: boolean;
  deviceSignalEnabled: boolean;
  lmsSignalEnabled: boolean;
  teacherSignalEnabled: boolean;
  presentThreshold: number;
  updatedAt: string | null;
};

export type AttendanceRecordSummary = {
  id: string;
  classId: string;
  studentId: string;
  studentName: string;
  attendanceDate: string;
  status: AttendanceStatus;
  derivedStatus: AttendanceStatus;
  signals: Record<string, boolean>;
  correctedAt: string | null;
  correctionReason: string | null;
};

export type AttendanceReport = {
  tenantId: string;
  classId: string;
  attendanceDate: string;
  records: AttendanceRecordSummary[];
  totals: Record<AttendanceStatus, number>;
};
