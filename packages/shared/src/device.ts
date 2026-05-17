export type DeviceStatus =
  | "PENDING"
  | "ONLINE"
  | "OFFLINE"
  | "NON_COMPLIANT"
  | "LOCKED"
  | "LOST"
  | "RETIRED"
  | "ENROLLMENT_FAILED";

export type CommandStatus =
  | "SUBMITTED"
  | "QUEUED"
  | "DELIVERED"
  | "EXECUTED"
  | "FAILED"
  | "EXPIRED";

export type RemoteCommandType =
  | "LOCK"
  | "UNLOCK"
  | "WIPE"
  | "REQUEST_CHECK_IN"
  | "POLICY_REFRESH"
  | "SEND_MESSAGE"
  | "APP_INSTALL"
  | "APP_REMOVE"
  | "RETIRE";

export type EnrollmentBatchStatus = "ACTIVE" | "EXPIRED" | "REVOKED";

export type EnrollmentBatchSummary = {
  id: string;
  tenantId: string;
  name: string;
  token: string;
  status: EnrollmentBatchStatus;
  expiresAt?: string | null;
  maxDevices?: number | null;
  enrolledCount: number;
  qrPayload: Record<string, unknown>;
  createdAt: string;
};

export type DeviceSummary = {
  id: string;
  tenantId: string;
  branchId?: string | null;
  studentId?: string | null;
  classId?: string | null;
  enrollmentBatchId?: string | null;
  serialNumber: string;
  manufacturer?: string | null;
  model?: string | null;
  androidVersion?: string | null;
  enrollmentId?: string | null;
  ownershipType: "SCHOOL_OWNED";
  status: DeviceStatus;
  health: string;
  compliance: string;
  policyVersion?: number | null;
  tags: string[];
  lastCheckInAt?: string | null;
};

export type DeviceCheckInResult = {
  device: DeviceSummary;
  quarantined: boolean;
  wasExistingDevice: boolean;
};
