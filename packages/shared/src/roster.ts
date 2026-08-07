export type StudentStatus =
  | "ACTIVE"
  | "PENDING"
  | "SUSPENDED"
  | "GRADUATED"
  | "WITHDRAWN";

export type StudentSummary = {
  id: string;
  tenantId: string;
  branchId?: string | null;
  studentCode: string;
  name: string;
  grade: string;
  section?: string | null;
  status: StudentStatus;
  guardianCount: number;
};

export type GuardianInput = {
  name: string;
  email?: string;
  phone?: string;
  relationship: string;
};

export type ClassSectionSummary = {
  id: string;
  tenantId: string;
  branchId?: string | null;
  name: string;
  grade: string;
  subject?: string | null;
  studentCount: number;
  academicYear?: string | null;
  status: "ACTIVE" | "ARCHIVED";
  archivedAt?: string | null;
  sourceClassId?: string | null;
};

export type AcademicYearRolloverResult = {
  sourceAcademicYear: string;
  targetAcademicYear: string;
  archivedClassIds: string[];
  createdClasses: ClassSectionSummary[];
};

export type RosterImportStatus = "PREVIEWED" | "COMMITTED" | "FAILED";

export type RosterImportRowInput = {
  studentCode: string;
  name: string;
  grade: string;
  section?: string | null;
  status?: StudentStatus | null;
  branchId?: string | null;
  guardianName?: string | null;
  guardianEmail?: string | null;
  guardianPhone?: string | null;
  guardianRelationship?: string | null;
  className?: string | null;
  classSubject?: string | null;
};

export type RosterImportRowResult = {
  rowNumber: number;
  input: RosterImportRowInput;
  errors: string[];
  action: "CREATE_STUDENT" | "REJECT";
};

export type RosterImportSummary = {
  id: string;
  tenantId: string;
  filename?: string | null;
  status: RosterImportStatus;
  totalRows: number;
  validRows: number;
  errorRows: number;
  rows: RosterImportRowResult[];
  createdBy?: string | null;
  committedBy?: string | null;
  createdAt: string;
  committedAt?: string | null;
};

export type RosterImportCommitResult = {
  import: RosterImportSummary;
  createdStudents: number;
  createdGuardians: number;
  createdClasses: number;
  createdMemberships: number;
};
