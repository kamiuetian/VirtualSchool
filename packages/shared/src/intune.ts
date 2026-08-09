export type IntuneCapabilityStatus =
  | "SUPPORTED"
  | "PARTIAL"
  | "UNSUPPORTED"
  | "UNKNOWN";

export interface IntuneIntegrationSummary {
  id: string;
  entraTenantId: string;
  clientId: string;
  credentialReference: string;
  status: string;
  lastValidatedAt: string | null;
  lastInventorySyncAt: string | null;
  groups: Array<{
    id: string;
    groupId: string;
    groupName: string;
    branchId: string | null;
    enabled: boolean;
  }>;
  devices: Array<{
    id: string;
    serialNumber: string;
    externalDeviceId: string;
    groupId: string;
    model: string | null;
    osVersion: string | null;
    status: string;
    kioskStatus: IntuneCapabilityStatus;
    assessmentStatus: IntuneCapabilityStatus;
    autopilotStatus: IntuneCapabilityStatus;
    appDeploymentStatus: IntuneCapabilityStatus;
    managementHealthStatus: IntuneCapabilityStatus;
    lastSyncedAt: string;
  }>;
}
