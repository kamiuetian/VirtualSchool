export type AppleCapabilityStatus =
  | "SUPPORTED"
  | "PARTIAL"
  | "UNSUPPORTED"
  | "UNKNOWN";

export interface AppleMdmIntegrationSummary {
  id: string;
  providerName: string;
  serverUrl: string;
  credentialReference: string;
  appleSchoolManagerId: string;
  status: string;
  tokenExpiresAt: string;
  certificateExpiresAt: string;
  tokenExpiryAlert: boolean;
  certificateExpiryAlert: boolean;
  lastValidatedAt: string | null;
  lastInventorySyncAt: string | null;
  devices: Array<{
    id: string;
    serialNumber: string;
    externalDeviceId: string;
    model: string | null;
    osVersion: string | null;
    status: string;
    adeStatus: AppleCapabilityStatus;
    supervisionStatus: AppleCapabilityStatus;
    restrictionStatus: AppleCapabilityStatus;
    appBookStatus: AppleCapabilityStatus;
    managedConfigurationStatus: AppleCapabilityStatus;
    lastSyncedAt: string;
  }>;
}
