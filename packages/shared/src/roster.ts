export type StudentStatus = "ACTIVE" | "PENDING" | "SUSPENDED" | "GRADUATED" | "WITHDRAWN";

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
};
