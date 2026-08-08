import type {
  AppCatalogItemSummary,
  AcademicCalendarExceptionSummary,
  AppDeploymentReport,
  BillingUsageSummary,
  BlockedDomainAggregate,
  ClassSectionSummary,
  DeviceAlertSummary,
  DeviceDiagnosticSummary,
  DeviceHistory,
  DeviceInventoryReport,
  DeviceSummary,
  EnrollmentBatchSummary,
  OnboardingChecklist,
  NotificationDeliverySummary,
  NotificationPreferenceSummary,
  PolicyDeploymentReport,
  PolicyAssignmentSummary,
  PolicySummary,
  PrivacyAcceptanceSummary,
  PrivacyNoticeSummary,
  RetentionSettingsSummary,
  RemoteCommandSummary,
  RosterImportSummary,
  SupportNoteSummary,
  SupportTimelineEvent,
  SupportTicketSummary,
  RemoteAssistanceSessionSummary,
  TroubleshootingPlaybook,
  StudentSummary,
  TenantSummary,
  TimetableBlockSummary,
  TeacherDashboard,
  GuardianDashboard,
  ExamReadinessSummary,
  ExamReport,
  UserSummary,
  ClassroomConnectionSummary,
  LmsConnectionSummary,
  EducationConnectionSummary,
  SisOperationsSummary,
  WebhookEndpointSummary,
  TenantWebFilterSettings,
  ContentLibraryItemSummary,
  ContentLibraryReport,
  AttendanceSettingsSummary,
  AttendanceReport,
  LearningUsageAnalyticsReport,
  AutomationRuleSummary,
  AnnouncementSummary,
  PilotFeedbackSummary,
  PlatformCapabilityCatalog,
} from "@virtual-school/shared";
import {
  requirePortalRouteAccess,
  roleCan,
  type PortalHref,
} from "./auth/portal-access";
import type { AdminPortalSession } from "./auth/session";
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
  blockedDomainAggregates: BlockedDomainAggregate[];
  policyDeploymentReport: PolicyDeploymentReport | null;
  apps: AppCatalogItemSummary[];
  appDeploymentReport: AppDeploymentReport | null;
  students: StudentSummary[];
  classes: ClassSectionSummary[];
  users: UserSummary[];
  timetableBlocks: TimetableBlockSummary[];
  calendarExceptions: AcademicCalendarExceptionSummary[];
  retentionSettings: RetentionSettingsSummary | null;
  notificationPreferences: NotificationPreferenceSummary | null;
  notificationDeliveries: NotificationDeliverySummary[];
  automationRules: AutomationRuleSummary[];
  announcements: AnnouncementSummary[];
  pilotFeedback: PilotFeedbackSummary[];
  privacyNotices: PrivacyNoticeSummary[];
  privacyAcceptances: PrivacyAcceptanceSummary[];
  billingUsage: BillingUsageSummary | null;
  session: AdminPortalSession;
  connectionIssue: boolean;
};

type ApiGetResult<T> = { data: T | null; failed: boolean };

export async function getAdminData(
  requiredPath: PortalHref = "/",
): Promise<AdminData> {
  const session = await requirePortalRouteAccess(requiredPath);
  const can = (permission: Parameters<typeof roleCan>[1]) =>
    roleCan(session.role, permission);

  const tenantsResult = await apiGet<TenantSummary[]>("/tenants");
  const tenants = tenantsResult.data ?? [];
  const selectedTenant = tenants[0] ?? null;

  if (!selectedTenant) {
    return {
      alerts: [],
      apps: [],
      billingUsage: null,
      blockedDomainAggregates: [],
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
      calendarExceptions: [],
      users: [],
      appDeploymentReport: null,
      retentionSettings: null,
      notificationPreferences: null,
      automationRules: [],
      announcements: [],
      pilotFeedback: [],
      notificationDeliveries: [],
      privacyNotices: [],
      privacyAcceptances: [],
      session,
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
    calendarExceptions,
    retentionSettings,
    billingUsage,
    blockedDomainAggregates,
    notificationPreferences,
    notificationDeliveries,
    automationRules,
    announcements,
    pilotFeedback,
    privacyNotices,
    privacyAcceptances,
  ] = await Promise.all([
    apiGet<OnboardingChecklist>(`${tenantPath}/onboarding-checklist`),
    can("device:read")
      ? apiGet<DeviceSummary[]>(`${tenantPath}/devices`)
      : skipped([]),
    can("report:export")
      ? apiGet<DeviceInventoryReport>(`${tenantPath}/reports/device-inventory`)
      : skipped<DeviceInventoryReport>(),
    can("device:read")
      ? apiGet<DeviceAlertSummary[]>(`${tenantPath}/alerts?limit=8`)
      : skipped([]),
    can("device:enroll")
      ? apiGet<EnrollmentBatchSummary[]>(`${tenantPath}/enrollment-batches`)
      : skipped([]),
    can("policy:manage")
      ? apiGet<PolicySummary[]>(`${tenantPath}/policies`)
      : skipped([]),
    can("policy:manage")
      ? apiGet<PolicyAssignmentSummary[]>(`${tenantPath}/policies/assignments`)
      : skipped([]),
    can("report:export")
      ? apiGet<PolicyDeploymentReport>(
          `${tenantPath}/reports/policy-deployments`,
        )
      : skipped<PolicyDeploymentReport>(),
    can("policy:manage")
      ? apiGet<AppCatalogItemSummary[]>(`${tenantPath}/apps`)
      : skipped([]),
    can("report:export")
      ? apiGet<AppDeploymentReport>(`${tenantPath}/reports/app-deployments`)
      : skipped<AppDeploymentReport>(),
    can("roster:manage") || can("class:manage")
      ? apiGet<StudentSummary[]>(`${tenantPath}/students`)
      : skipped([]),
    can("roster:manage") || can("class:manage")
      ? apiGet<ClassSectionSummary[]>(`${tenantPath}/classes`)
      : skipped([]),
    can("user:invite") || can("user:suspend")
      ? apiGet<UserSummary[]>(`${tenantPath}/users`)
      : skipped([]),
    can("policy:manage")
      ? apiGet<TimetableBlockSummary[]>(`${tenantPath}/timetable-blocks`)
      : skipped([]),
    can("policy:manage")
      ? apiGet<AcademicCalendarExceptionSummary[]>(
          `${tenantPath}/calendar-exceptions`,
        )
      : skipped([]),
    can("tenant:update")
      ? apiGet<RetentionSettingsSummary>(`${tenantPath}/retention-settings`)
      : skipped<RetentionSettingsSummary>(),
    can("billing:read")
      ? apiGet<BillingUsageSummary>(`${tenantPath}/billing/usage`)
      : skipped<BillingUsageSummary>(),
    can("policy:manage")
      ? apiGet<BlockedDomainAggregate[]>(
          `${tenantPath}/policies/events/blocked-domains/aggregates`,
        )
      : skipped([]),
    can("tenant:update")
      ? apiGet<NotificationPreferenceSummary>(
          `${tenantPath}/notifications/preferences`,
        )
      : skipped<NotificationPreferenceSummary>(),
    can("tenant:update")
      ? apiGet<NotificationDeliverySummary[]>(
          `${tenantPath}/notifications/deliveries?limit=20`,
        )
      : skipped([]),
    can("tenant:update")
      ? apiGet<AutomationRuleSummary[]>(`${tenantPath}/automation-rules`)
      : skipped([]),
    apiGet<AnnouncementSummary[]>(
      `${tenantPath}/communications/announcements${can("tenant:update") ? "?includeArchived=true" : ""}`,
    ),
    can("tenant:update")
      ? apiGet<PilotFeedbackSummary[]>(`${tenantPath}/communications/feedback`)
      : skipped([]),
    can("tenant:update")
      ? apiGet<PrivacyNoticeSummary[]>(`${tenantPath}/privacy/notices`)
      : skipped([]),
    can("tenant:update")
      ? apiGet<PrivacyAcceptanceSummary[]>(`${tenantPath}/privacy/acceptances`)
      : skipped([]),
  ]);

  return {
    alerts: alerts.data ?? [],
    apps: apps.data ?? [],
    billingUsage: billingUsage.data ?? null,
    blockedDomainAggregates: blockedDomainAggregates.data ?? [],
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
      calendarExceptions,
      retentionSettings,
      billingUsage,
      blockedDomainAggregates,
      notificationPreferences,
      notificationDeliveries,
      automationRules,
      announcements,
      pilotFeedback,
      privacyNotices,
      privacyAcceptances,
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
    calendarExceptions: calendarExceptions.data ?? [],
    users: users.data ?? [],
    appDeploymentReport: appDeploymentReport.data ?? null,
    retentionSettings: retentionSettings.data ?? null,
    notificationPreferences: notificationPreferences.data ?? null,
    notificationDeliveries: notificationDeliveries.data ?? [],
    automationRules: automationRules.data ?? [],
    announcements: announcements.data ?? [],
    pilotFeedback: pilotFeedback.data ?? [],
    privacyNotices: privacyNotices.data ?? [],
    privacyAcceptances: privacyAcceptances.data ?? [],
    session,
  };
}

export async function adminApiMutation(
  method: "PATCH" | "POST",
  path: string,
  body: Record<string, unknown>,
): Promise<void> {
  await adminApiJsonMutation<unknown>(method, path, body);
}

export async function getClassroomIntegration(tenantId: string): Promise<{
  integration: ClassroomConnectionSummary | null;
  connectionIssue: boolean;
}> {
  const result = await apiGet<ClassroomConnectionSummary>(
    `/tenants/${tenantId}/integrations/google-classroom`,
  );
  return { integration: result.data, connectionIssue: result.failed };
}

export async function getLmsIntegrations(
  tenantId: string,
): Promise<{ integrations: LmsConnectionSummary[]; connectionIssue: boolean }> {
  const result = await apiGet<LmsConnectionSummary[]>(
    `/tenants/${tenantId}/integrations/lms`,
  );
  return { integrations: result.data ?? [], connectionIssue: result.failed };
}

export async function getEducationResources(tenantId: string): Promise<{
  integrations: EducationConnectionSummary[];
  connectionIssue: boolean;
}> {
  const result = await apiGet<EducationConnectionSummary[]>(
    `/tenants/${tenantId}/integrations/education-resources`,
  );
  return { integrations: result.data ?? [], connectionIssue: result.failed };
}

export async function getContentLibrary(tenantId: string): Promise<{
  items: ContentLibraryItemSummary[];
  report: ContentLibraryReport | null;
  connectionIssue: boolean;
}> {
  const [items, report] = await Promise.all([
    apiGet<ContentLibraryItemSummary[]>(
      `/tenants/${tenantId}/content-library?includeUnavailable=true`,
    ),
    apiGet<ContentLibraryReport>(`/tenants/${tenantId}/content-library/report`),
  ]);
  return {
    items: items.data ?? [],
    report: report.data,
    connectionIssue: items.failed || report.failed,
  };
}

export async function getAttendanceData(
  tenantId: string,
  classId?: string,
  date?: string,
): Promise<{
  settings: AttendanceSettingsSummary | null;
  report: AttendanceReport | null;
  connectionIssue: boolean;
}> {
  const [settings, report] = await Promise.all([
    apiGet<AttendanceSettingsSummary>(
      `/tenants/${tenantId}/attendance/settings`,
    ),
    classId && date
      ? apiGet<AttendanceReport>(
          `/tenants/${tenantId}/attendance/records?classId=${encodeURIComponent(classId)}&date=${date}`,
        )
      : skipped<AttendanceReport>(),
  ]);
  return {
    settings: settings.data,
    report: report.data,
    connectionIssue: settings.failed || report.failed,
  };
}

export async function getLearningUsageAnalytics(
  tenantId: string,
  filters: {
    from: string;
    to: string;
    classId?: string;
    grade?: string;
    deviceGroup?: string;
    category?: string;
  },
): Promise<{
  report: LearningUsageAnalyticsReport | null;
  connectionIssue: boolean;
}> {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) query.set(key, value);
  });
  const result = await apiGet<LearningUsageAnalyticsReport>(
    `/tenants/${tenantId}/reports/learning-usage?${query.toString()}`,
  );
  return { report: result.data, connectionIssue: result.failed };
}

export async function getSisOperations(tenantId: string): Promise<{
  operations: SisOperationsSummary | null;
  connectionIssue: boolean;
}> {
  const result = await apiGet<SisOperationsSummary>(
    `/tenants/${tenantId}/integrations/sis/operations`,
  );
  return { operations: result.data, connectionIssue: result.failed };
}

export async function getWebhookEndpoints(
  tenantId: string,
): Promise<{ endpoints: WebhookEndpointSummary[]; connectionIssue: boolean }> {
  const result = await apiGet<WebhookEndpointSummary[]>(
    `/tenants/${tenantId}/integrations/webhooks`,
  );
  return { endpoints: result.data ?? [], connectionIssue: result.failed };
}

export async function getTeacherDashboard(tenantId: string): Promise<{
  dashboard: TeacherDashboard | null;
  connectionIssue: boolean;
}> {
  const result = await apiGet<TeacherDashboard>(
    `/tenants/${tenantId}/teacher/dashboard`,
  );
  return { dashboard: result.data, connectionIssue: result.failed };
}

export async function getGuardianDashboard(): Promise<{
  dashboard: GuardianDashboard | null;
  connectionIssue: boolean;
}> {
  const session = await requirePortalRouteAccess("/guardian");
  const tenantId = session.tenantIds.find((item) => item !== "*");
  if (!tenantId) return { dashboard: null, connectionIssue: true };
  const result = await apiGet<GuardianDashboard>(
    `/tenants/${tenantId}/guardian/dashboard`,
  );
  return { dashboard: result.data, connectionIssue: result.failed };
}

export async function getExamReadiness(
  tenantId: string,
  assignmentId: string,
): Promise<{
  readiness: ExamReadinessSummary | null;
  connectionIssue: boolean;
}> {
  const result = await apiGet<ExamReadinessSummary>(
    `/tenants/${tenantId}/policies/exam-schedules/${assignmentId}/readiness`,
  );
  return { connectionIssue: result.failed, readiness: result.data };
}

export async function getExamReport(
  tenantId: string,
  assignmentId: string,
): Promise<{ report: ExamReport | null; connectionIssue: boolean }> {
  const result = await apiGet<ExamReport>(
    `/tenants/${tenantId}/policies/exam-schedules/${assignmentId}/report`,
  );
  return { connectionIssue: result.failed, report: result.data };
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
  tickets: SupportTicketSummary[];
  assistanceSessions: RemoteAssistanceSessionSummary[];
  playbooks: TroubleshootingPlaybook[];
  connectionIssue: boolean;
}> {
  const [notes, timeline, tickets, assistanceSessions, playbooks] =
    await Promise.all([
      apiGet<SupportNoteSummary[]>(
        `/tenants/${tenantId}/support/devices/${deviceId}/notes`,
      ),
      apiGet<SupportTimelineEvent[]>(
        `/tenants/${tenantId}/support/devices/${deviceId}/timeline?limit=12`,
      ),
      apiGet<SupportTicketSummary[]>(`/tenants/${tenantId}/support/tickets`),
      apiGet<RemoteAssistanceSessionSummary[]>(
        `/tenants/${tenantId}/support/assistance/sessions?deviceId=${encodeURIComponent(deviceId)}`,
      ),
      apiGet<TroubleshootingPlaybook[]>(
        `/tenants/${tenantId}/support/assistance/playbooks`,
      ),
    ]);

  return {
    connectionIssue:
      notes.failed ||
      timeline.failed ||
      tickets.failed ||
      assistanceSessions.failed ||
      playbooks.failed,
    assistanceSessions: assistanceSessions.data ?? [],
    playbooks: playbooks.data ?? [],
    notes: notes.data ?? [],
    timeline: timeline.data ?? [],
    tickets: tickets.data ?? [],
  };
}

export async function getRosterImport(
  tenantId: string,
  importId: string,
): Promise<{
  importPreview: RosterImportSummary | null;
  connectionIssue: boolean;
}> {
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
  history: DeviceHistory;
  connectionIssue: boolean;
}> {
  const [commands, diagnostics, history] = await Promise.all([
    apiGet<RemoteCommandSummary[]>(
      `/tenants/${tenantId}/devices/${deviceId}/commands`,
    ),
    apiGet<DeviceDiagnosticSummary[]>(
      `/tenants/${tenantId}/devices/${deviceId}/diagnostics?limit=8`,
    ),
    apiGet<DeviceHistory>(`/tenants/${tenantId}/devices/${deviceId}/history`),
  ]);

  return {
    commands: commands.data ?? [],
    connectionIssue: commands.failed || diagnostics.failed || history.failed,
    diagnostics: diagnostics.data ?? [],
    history: history.data ?? { assignments: [], lifecycle: [] },
  };
}

export async function getDeviceCapabilities(tenantId: string): Promise<{
  catalog: PlatformCapabilityCatalog[];
  connectionIssue: boolean;
}> {
  const result = await apiGet<PlatformCapabilityCatalog[]>(
    `/tenants/${tenantId}/device-capabilities`,
  );
  return { catalog: result.data ?? [], connectionIssue: result.failed };
}

export async function adminApiRawGet(path: string): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    cache: "no-store",
    headers: await authHeaders(),
  });
}

export async function getWebFilterSettings(
  tenantId: string,
): Promise<TenantWebFilterSettings | null> {
  return (
    await apiGet<TenantWebFilterSettings>(
      `/tenants/${tenantId}/policies/web-filter-settings`,
    )
  ).data;
}

async function apiGet<T>(path: string): Promise<ApiGetResult<T>> {
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

function skipped<T>(data: T | null = null): Promise<ApiGetResult<T>> {
  return Promise.resolve({ data, failed: false });
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
