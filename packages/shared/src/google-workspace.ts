export type ChromeOsCapabilityStatus = "SUPPORTED" | "PARTIAL" | "UNSUPPORTED" | "UNKNOWN";

export interface GoogleWorkspaceIntegrationSummary {
  id: string;
  customerId: string;
  delegatedAdminEmail: string;
  credentialReference: string;
  status: string;
  lastValidatedAt: string | null;
  lastInventorySyncAt: string | null;
  organizationalUnits: Array<{
    id: string;
    organizationalUnitId: string;
    organizationalUnitPath: string;
    branchId: string | null;
    enabled: boolean;
  }>;
  devices: Array<{
    id: string;
    serialNumber: string;
    externalDeviceId: string;
    organizationalUnitId: string;
    model: string | null;
    osVersion: string | null;
    status: string;
    kioskStatus: ChromeOsCapabilityStatus;
    managedSessionStatus: ChromeOsCapabilityStatus;
    appExtensionStatus: ChromeOsCapabilityStatus;
    webPolicyStatus: ChromeOsCapabilityStatus;
    lastSyncedAt: string;
  }>;
}
