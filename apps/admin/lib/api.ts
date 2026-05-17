import type {
  AppCatalogItemSummary,
  BillingUsageSummary,
  ClassSectionSummary,
  DeviceAlertSummary,
  DeviceInventoryReport,
  DeviceSummary,
  EnrollmentBatchSummary,
  OnboardingChecklist,
  PolicyAssignmentSummary,
  PolicySummary,
  StudentSummary,
  TenantSummary,
} from "@virtual-school/shared";

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
  apps: AppCatalogItemSummary[];
  students: StudentSummary[];
  classes: ClassSectionSummary[];
  billingUsage: BillingUsageSummary | null;
  connectionIssue: boolean;
};

export async function getAdminData(): Promise<AdminData> {
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
      selectedTenant: null,
      students: [],
      tenants,
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
    apps,
    students,
    classes,
    billingUsage,
  ] = await Promise.all([
    apiGet<OnboardingChecklist>(`${tenantPath}/onboarding-checklist`),
    apiGet<DeviceSummary[]>(`${tenantPath}/devices`),
    apiGet<DeviceInventoryReport>(`${tenantPath}/reports/device-inventory`),
    apiGet<DeviceAlertSummary[]>(`${tenantPath}/alerts?limit=8`),
    apiGet<EnrollmentBatchSummary[]>(`${tenantPath}/enrollment-batches`),
    apiGet<PolicySummary[]>(`${tenantPath}/policies`),
    apiGet<PolicyAssignmentSummary[]>(`${tenantPath}/policies/assignments`),
    apiGet<AppCatalogItemSummary[]>(`${tenantPath}/apps`),
    apiGet<StudentSummary[]>(`${tenantPath}/students`),
    apiGet<ClassSectionSummary[]>(`${tenantPath}/classes`),
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
      apps,
      students,
      classes,
      billingUsage,
    ].some((result) => result.failed),
    deviceInventory: deviceInventory.data ?? null,
    devices: devices.data ?? [],
    enrollmentBatches: enrollmentBatches.data ?? [],
    onboarding: onboarding.data ?? null,
    policies: policies.data ?? [],
    policyAssignments: policyAssignments.data ?? [],
    selectedTenant,
    students: students.data ?? [],
    tenants,
  };
}

export async function adminApiMutation(
  method: "PATCH" | "POST",
  path: string,
  body: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(`${baseUrl}${path}`, {
    body: JSON.stringify(removeEmptyValues(body)),
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    method,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `API request failed with ${response.status}`);
  }
}

async function apiGet<T>(
  path: string,
): Promise<{ data: T | null; failed: boolean }> {
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      cache: "no-store",
      headers: authHeaders(),
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

function authHeaders(): HeadersInit {
  if (process.env.ADMIN_API_BEARER_TOKEN) {
    return {
      Authorization: `Bearer ${process.env.ADMIN_API_BEARER_TOKEN}`,
    };
  }

  return {
    "x-dev-email": process.env.ADMIN_API_EMAIL ?? "admin@example.edu",
    "x-dev-role": process.env.ADMIN_API_ROLE ?? "PLATFORM_SUPER_ADMIN",
    "x-dev-subject": process.env.ADMIN_API_SUBJECT ?? "admin-portal",
    "x-dev-tenant-id": process.env.ADMIN_API_TENANT_ID ?? "*",
  };
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
