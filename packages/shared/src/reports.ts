import type { DeviceStatus } from "./device";
import type { PolicyStatus } from "./policy";

export type ReportGeneratedMetadata = {
  tenantId: string;
  generatedAt: string;
};

export type DeviceInventoryReportRow = {
  id: string;
  serialNumber: string;
  manufacturer?: string | null;
  model?: string | null;
  androidVersion?: string | null;
  status: DeviceStatus;
  health: string;
  compliance: string;
  policyVersion?: number | null;
  studentId?: string | null;
  classId?: string | null;
  branchId?: string | null;
  mdmConnector: string;
  connectorDeviceName?: string | null;
  lastCheckInAt?: string | null;
  tags: string[];
};

export type DeviceInventoryReport = ReportGeneratedMetadata & {
  totals: {
    devices: number;
    online: number;
    offline: number;
    nonCompliant: number;
    locked: number;
    pending: number;
  };
  byHealth: Record<string, number>;
  byCompliance: Record<string, number>;
  devices: DeviceInventoryReportRow[];
};

export type PolicyDeploymentReportRow = {
  policyId: string;
  name: string;
  status: PolicyStatus;
  version: number;
  assignmentCount: number;
  activeAssignmentCount: number;
  queuedDeploymentCount: number;
  failedDeploymentCount: number;
  latestVersionSummary?: string | null;
  updatedAt: string;
};

export type PolicyDeploymentReport = ReportGeneratedMetadata & {
  totals: {
    policies: number;
    published: number;
    draft: number;
    activeAssignments: number;
    queuedDeploymentCommands: number;
    failedDeployments: number;
  };
  policies: PolicyDeploymentReportRow[];
};

export type AppDeploymentReportRow = {
  appId: string;
  name: string;
  packageId: string;
  category?: string | null;
  approvalStatus: string;
  approvedGrades: string[];
  assignedPolicyCount: number;
  queuedCommandCount: number;
  failedDeploymentCount: number;
  policyNames: string[];
  updatedAt: string;
};

export type AppDeploymentReport = ReportGeneratedMetadata & {
  totals: {
    apps: number;
    approved: number;
    blocked: number;
    assignedApps: number;
    queuedCommands: number;
    failedDeployments: number;
  };
  apps: AppDeploymentReportRow[];
};
