export type DeviceStatus =
  | "PENDING"
  | "ONLINE"
  | "OFFLINE"
  | "NON_COMPLIANT"
  | "LOCKED"
  | "LOST"
  | "RETIRED"
  | "ENROLLMENT_FAILED";

export type CommandStatus = "SUBMITTED" | "QUEUED" | "DELIVERED" | "EXECUTED" | "FAILED" | "EXPIRED";

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
