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

export const remoteCommandTypes = [
  "LOCK",
  "UNLOCK",
  "WIPE",
  "REQUEST_CHECK_IN",
  "POLICY_REFRESH",
  "SEND_MESSAGE",
  "APP_INSTALL",
  "APP_REMOVE",
  "RETIRE",
] as const;

export type RemoteCommandType = (typeof remoteCommandTypes)[number];

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
  mdmConnector: string;
  connectorDeviceName?: string | null;
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

export type RemoteCommandSummary = {
  id: string;
  tenantId: string;
  deviceId: string;
  type: RemoteCommandType;
  status: CommandStatus;
  reason?: string | null;
  requestedBy?: string | null;
  payload?: Record<string, unknown> | null;
  result?: Record<string, unknown> | null;
  connectorCommandId?: string | null;
  attempts: number;
  maxAttempts: number;
  failureReason?: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string | null;
  deliveredAt?: string | null;
  completedAt?: string | null;
  lastAttemptAt?: string | null;
};

export type QueuedRemoteCommand = {
  id: string;
  type: RemoteCommandType;
  payload?: Record<string, unknown> | null;
  expiresAt?: string | null;
  createdAt: string;
};

export type CommandDispatchRunSummary = {
  tenantId: string;
  connector: string;
  attempted: number;
  accepted: number;
  failed: number;
  requeued: number;
  commands: Array<{
    commandId: string;
    deviceId: string;
    type: RemoteCommandType;
    status: CommandStatus;
    connectorCommandId?: string | null;
    failureReason?: string | null;
  }>;
};

export type DeviceApprovedApp = {
  name: string;
  packageId: string;
  iconUrl?: string | null;
  category?: string | null;
  installType?: "AVAILABLE" | "FORCE_INSTALLED" | "BLOCKED";
};

export type DevicePolicyPayload = {
  tenantId: string;
  deviceId: string;
  generatedAt: string;
  policy: {
    id: string;
    name: string;
    version: number;
    mode: string;
    source: string;
    explanation: string;
  };
  launcher: {
    approvedApps: DeviceApprovedApp[];
    webShortcuts: Array<{
      title: string;
      url: string;
    }>;
    showMessages: boolean;
    showSupportContact: boolean;
  };
  browser: {
    defaultWebAccess: "ALLOW" | "DENY";
    urlAllowlist: string[];
    urlBlocklist: string[];
  };
  restrictions: {
    blockSettings: boolean;
    blockAppInstall: boolean;
    blockSafeMode: boolean;
  };
  cache: {
    ttlSeconds: number;
    useLastKnownPolicyWhenOffline: boolean;
  };
};
