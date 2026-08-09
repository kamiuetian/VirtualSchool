import type { DeviceComplianceAssessment, DeviceStatus } from "./device";
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
  complianceAssessment?: DeviceComplianceAssessment;
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

export type LearningUsageAnalyticsFilters = {
  from: string;
  to: string;
  classId?: string;
  grade?: string;
  deviceGroup?: string;
  category?: string;
};

export type LearningUsageTrendPoint = {
  date: string;
  sessions: number;
  participants: number;
  missedSessions: number;
  approvedResourceLaunches: number;
};

export type LearningUsageBreakdown = {
  key: string;
  label: string;
  sessions: number;
  participants: number;
  missedSessions: number;
  approvedResourceLaunches: number;
  offlineDevices: number;
};

export type LearningUsageAnalyticsReport = ReportGeneratedMetadata & {
  filters: LearningUsageAnalyticsFilters;
  totals: {
    sessions: number;
    participants: number;
    missedSessions: number;
    approvedResourceLaunches: number;
    offlineDevices: number;
  };
  byClass: LearningUsageBreakdown[];
  byGrade: LearningUsageBreakdown[];
  byDeviceGroup: LearningUsageBreakdown[];
  byCategory: LearningUsageBreakdown[];
  trend: LearningUsageTrendPoint[];
};

export type EnterpriseAnalyticsMetrics = {
  devices: number;
  compliantDevices: number;
  complianceRate: number;
  attendanceRecords: number;
  presentAttendance: number;
  attendanceRate: number;
  learningSessions: number;
  openSupportTickets: number;
};

export type EnterpriseAnalyticsNode = {
  level: "BRANCH" | "TENANT";
  id: string;
  name: string;
  metrics: EnterpriseAnalyticsMetrics;
  children?: EnterpriseAnalyticsNode[];
};

export type EnterpriseAnalyticsReport = {
  scope: "TENANT" | "PARTNER";
  scopeId: string;
  generatedAt: string;
  from: string;
  to: string;
  metrics: EnterpriseAnalyticsMetrics;
  tenants: EnterpriseAnalyticsNode[];
};

export type QuarterlyBusinessReviewMetric = {
  current: number;
  previous: number;
  change: number;
};

export type QuarterlyBusinessReviewPack = {
  id: string;
  tenantId: string;
  tenantName: string;
  quarter: string;
  from: string;
  to: string;
  generatedAt: string;
  generatedBy?: string | null;
  checksum: string;
  metrics: {
    enrolledStudents: QuarterlyBusinessReviewMetric;
    managedDevices: QuarterlyBusinessReviewMetric;
    activeDeviceRate: QuarterlyBusinessReviewMetric;
    complianceRate: QuarterlyBusinessReviewMetric;
    policyDeliverySuccessRate: QuarterlyBusinessReviewMetric;
    supportTicketsOpened: QuarterlyBusinessReviewMetric;
    supportResolutionRate: QuarterlyBusinessReviewMetric;
    learningSessions: QuarterlyBusinessReviewMetric;
  };
  modeUsage: Array<{ mode: string; sessions: number; share: number }>;
  recommendations: Array<{
    priority: "HIGH" | "MEDIUM" | "LOW";
    title: string;
    rationale: string;
    evidence: string[];
  }>;
};
