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

export type DeviceAssignmentHistory = {
  id: string;
  studentId?: string | null;
  classId?: string | null;
  branchId?: string | null;
  reason: string;
  actorId?: string | null;
  startedAt: string;
  endedAt?: string | null;
};

export type DeviceLifecycleHistory = {
  id: string;
  type: "RETIRED" | "UNENROLLED";
  reason: string;
  actorId?: string | null;
  createdAt: string;
};

export type DeviceHistory = {
  assignments: DeviceAssignmentHistory[];
  lifecycle: DeviceLifecycleHistory[];
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
    blockedCategories: string[];
    neverAllowedUrls: string[];
    safeSearch: {
      google: boolean;
      bing: boolean;
      youtubeRestrictedMode: "OFF" | "MODERATE" | "STRICT";
    };
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

export type DeviceAlertSeverity = "INFO" | "WARNING" | "CRITICAL";

export type DeviceAlertStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED";

export type DeviceAlertType =
  | "BATTERY_LOW"
  | "STORAGE_LOW"
  | "DEVICE_OFFLINE"
  | "DEVICE_NON_COMPLIANT"
  | "DEVICE_UNHEALTHY"
  | "POLICY_DEPLOYMENT_FAILED"
  | "APP_DEPLOYMENT_FAILED"
  | "DEVICE_LOST"
  | "REPEATED_ENROLLMENT_FAILED";

export type NotificationPreferenceSummary = {
  tenantId: string;
  recipients: string[];
  offlineEnabled: boolean;
  offlineAfterMinutes: number;
  policyFailureEnabled: boolean;
  appFailureEnabled: boolean;
  lostDeviceEnabled: boolean;
  repeatedEnrollmentEnabled: boolean;
  repeatedEnrollmentThreshold: number;
  deduplicationWindowMinutes: number;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type NotificationDeliverySummary = {
  id: string;
  alertId: string;
  recipient: string;
  channel: "EMAIL";
  status: "PENDING" | "DELIVERED" | "FAILED";
  attemptCount: number;
  provider: string | null;
  providerId: string | null;
  failureReason: string | null;
  deliveredAt: string | null;
  createdAt: string;
};

export type DeviceDiagnosticSummary = {
  id: string;
  tenantId: string;
  deviceId: string;
  batteryLevel?: number | null;
  storageFreeMb?: number | null;
  networkStatus?: string | null;
  launcherVersion?: string | null;
  browserVersion?: string | null;
  mdmPolicyName?: string | null;
  policyVersion?: number | null;
  health?: string | null;
  compliance?: string | null;
  details?: Record<string, unknown> | null;
  reportedAt: string;
  createdAt: string;
};

export type DeviceAlertSummary = {
  id: string;
  tenantId: string;
  deviceId?: string | null;
  type: DeviceAlertType;
  severity: DeviceAlertSeverity;
  status: DeviceAlertStatus;
  title: string;
  message: string;
  source: string;
  metadata?: Record<string, unknown> | null;
  firstSeenAt: string;
  lastSeenAt: string;
  acknowledgedAt?: string | null;
  acknowledgedBy?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  resolutionNote?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DeviceDiagnosticUploadResult = {
  diagnostic: DeviceDiagnosticSummary;
  device: DeviceSummary;
  alerts: DeviceAlertSummary[];
  resolvedAlertIds: string[];
};

export type OfflineAlertScanSummary = {
  tenantId: string;
  offlineAfterMinutes: number;
  evaluatedDevices: number;
  alertsCreatedOrUpdated: number;
  alerts: DeviceAlertSummary[];
};
