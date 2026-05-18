import type {
  AppCatalogItemSummary,
  AppDeploymentReport,
  BillingUsageSummary,
  ClassSectionSummary,
  DeviceAlertSummary,
  DeviceDiagnosticSummary,
  DeviceInventoryReport,
  DeviceSummary,
  EnrollmentBatchSummary,
  OnboardingChecklist,
  PolicyDeploymentReport,
  PolicyAssignmentSummary,
  PolicySummary,
  RetentionSettingsSummary,
  RemoteCommandSummary,
  RosterImportSummary,
  SupportNoteSummary,
  SupportTimelineEvent,
  StudentSummary,
  TenantSummary,
  TimetableBlockSummary,
  UserSummary,
} from "@virtual-school/shared";
import { adminSessionHeaders, requireAdminSession } from "./auth/session";

const baseUrl =
  process.env.ADMIN_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://localhost:4000/api/v1";

export type AdminData = {
  tenants: TenantSummary[];
  selectedTenant: TenantSummary | null;
  onboarding: OnboardingChecklist | null;
  devices: DeviceSummary[];
  deviceInventory: DeviceInventoryReport | null;
  alerts: DeviceAlertSummary[];
  enrollmentBatches: EnrollmentBatchSummary[];
  policies: PolicySummary[];
  policyAssignments: PolicyAssignmentSummary[];
  policyDeploymentReport: PolicyDeploymentReport | null;
  apps: AppCatalogItemSummary[];
  appDeploymentReport: AppDeploymentReport | null;
  students: StudentSummary[];
  classes: ClassSectionSummary[];
  users: UserSummary[];
  timetableBlocks: TimetableBlockSummary[];
  retentionSettings: RetentionSettingsSummary | null;
  billingUsage: BillingUsageSummary | null;
  connectionIssue: boolean;
};

export async function getAdminData(): Promise<AdminData> {
  await requireAdminSession();

  const tenantsResult = await apiGet<TenantSummary[]>("/tenants");
  const tenants = tenantsResult.data ?? [];
  const selectedTenant = tenants[0] ?? null;

  if (!selectedTenant) {
    return {
      alerts: [],
      apps: [],
      billingUsage: null,
      classes: [],
      connectionIssue: tenantsResult.failed,
      deviceInventory: null,
      devices: [],
      enrollmentBatches: [],
      onboarding: null,
      policies: [],
      policyAssignments: [],
      policyDeploymentReport: null,
      selectedTenant: null,
      students: [],
      tenants,
      timetableBlocks: [],
      users: [],
      appDeploymentReport: null,
      retentionSettings: null,
    };
  }

  const tenantPath = `/tenants/${selectedTenant.id}`;
  const [
    onboarding,
    devices,
    deviceInventory,
    alerts,
    enrollmentBatches,
    policies,
    policyAssignments,
    policyDeploymentReport,
    apps,
    appDeploymentReport,
    students,
    classes,
    users,
    timetableBlocks,
    retentionSettings,
    billingUsage,
  ] = await Promise.all([
    apiGet<OnboardingChecklist>(`${tenantPath}/onboarding-checklist`),
    apiGet<DeviceSummary[]>(`${tenantPath}/devices`),
    apiGet<DeviceInventoryReport>(`${tenantPath}/reports/device-inventory`),
    apiGet<DeviceAlertSummary[]>(`${tenantPath}/alerts?limit=8`),
    apiGet<EnrollmentBatchSummary[]>(`${tenantPath}/enrollment-batches`),
    apiGet<PolicySummary[]>(`${tenantPath}/policies`),
    apiGet<PolicyAssignmentSummary[]>(`${tenantPath}/policies/assignments`),
    apiGet<PolicyDeploymentReport>(`${tenantPath}/reports/policy-deployments`),
    apiGet<AppCatalogItemSummary[]>(`${tenantPath}/apps`),
    apiGet<AppDeploymentReport>(`${tenantPath}/reports/app-deployments`),
    apiGet<StudentSummary[]>(`${tenantPath}/students`),
    apiGet<ClassSectionSummary[]>(`${tenantPath}/classes`),
    apiGet<UserSummary[]>(`${tenantPath}/users`),
    apiGet<TimetableBlockSummary[]>(`${tenantPath}/timetable-blocks`),
    apiGet<RetentionSettingsSummary>(`${tenantPath}/retention-settings`),
    apiGet<BillingUsageSummary>(`${tenantPath}/billing/usage`),
  ]);

  return {
    alerts: alerts.data ?? [],
    apps: apps.data ?? [],
    billingUsage: billingUsage.data ?? null,
    classes: classes.data ?? [],
    connectionIssue: [
      tenantsResult,
      onboarding,
      devices,
      deviceInventory,
      alerts,
      enrollmentBatches,
      policies,
      policyAssignments,
      policyDeploymentReport,
      apps,
      appDeploymentReport,
      students,
      classes,
      users,
      timetableBlocks,
      retentionSettings,
      billingUsage,
    ].some((result) => result.failed),
    deviceInventory: deviceInventory.data ?? null,
    devices: devices.data ?? [],
    enrollmentBatches: enrollmentBatches.data ?? [],
    onboarding: onboarding.data ?? null,
    policies: policies.data ?? [],
    policyAssignments: policyAssignments.data ?? [],
    policyDeploymentReport: policyDeploymentReport.data ?? null,
    selectedTenant,
    students: students.data ?? [],
    tenants,
    timetableBlocks: timetableBlocks.data ?? [],
    users: users.data ?? [],
    appDeploymentReport: appDeploymentReport.data ?? null,
    retentionSettings: retentionSettings.data ?? null,
  };
}

export async function adminApiMutation(
  method: "PATCH" | "POST",
  path: string,
  body: Record<string, unknown>,
): Promise<void> {
  await adminApiJsonMutation<unknown>(method, path, body);
}

export async function adminApiJsonMutation<T>(
  method: "PATCH" | "POST",
  path: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    body: JSON.stringify(removeEmptyValues(body)),
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(await authHeaders()),
    },
    method,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `API request failed with ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getDeviceSupportData(
  tenantId: string,
  deviceId: string,
): Promise<{
  notes: SupportNoteSummary[];
  timeline: SupportTimelineEvent[];
  connectionIssue: boolean;
}> {
  const [notes, timeline] = await Promise.all([
    apiGet<SupportNoteSummary[]>(`/tenants/${tenantId}/support/devices/${deviceId}/notes`),
    apiGet<SupportTimelineEvent[]>(
      `/tenants/${tenantId}/support/devices/${deviceId}/timeline?limit=12`,
    ),
  ]);

  return {
    connectionIssue: notes.failed || timeline.failed,
    notes: notes.data ?? [],
    timeline: timeline.data ?? [],
  };
}

export async function getRosterImport(
  tenantId: string,
  importId: string,
): Promise<{ importPreview: RosterImportSummary | null; connectionIssue: boolean }> {
  const result = await apiGet<RosterImportSummary>(
    `/tenants/${tenantId}/roster-imports/${importId}`,
  );

  return {
    connectionIssue: result.failed,
    importPreview: result.data,
  };
}

export async function getDeviceOperationsData(
  tenantId: string,
  deviceId: string,
): Promise<{
  commands: RemoteCommandSummary[];
  diagnostics: DeviceDiagnosticSummary[];
  connectionIssue: boolean;
}> {
  const [commands, diagnostics] = await Promise.all([
    apiGet<RemoteCommandSummary[]>(
      `/tenants/${tenantId}/devices/${deviceId}/commands`,
    ),
    apiGet<DeviceDiagnosticSummary[]>(
      `/tenants/${tenantId}/devices/${deviceId}/diagnostics?limit=8`,
    ),
  ]);

  return {
    commands: commands.data ?? [],
    connectionIssue: commands.failed || diagnostics.failed,
    diagnostics: diagnostics.data ?? [],
  };
}

export async function adminApiRawGet(path: string): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    cache: "no-store",
    headers: await authHeaders(),
  });
}

async function apiGet<T>(
  path: string,
): Promise<{ data: T | null; failed: boolean }> {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      cache: "no-store",
      headers: await authHeaders(),
      signal: AbortSignal.timeout(1800),
    });

    if (!response.ok) {
      return { data: null, failed: true };
    }

    return { data: (await response.json()) as T, failed: false };
  } catch {
    return { data: null, failed: true };
  }
}

async function authHeaders(): Promise<HeadersInit> {
  return adminSessionHeaders();
}

function removeEmptyValues(
  body: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(body).filter(([, value]) => {
      if (value === undefined || value === null) {
        return false;
      }

      if (Array.isArray(value)) {
        return value.length > 0;
      }

      return value !== "";
    }),
  );
}
