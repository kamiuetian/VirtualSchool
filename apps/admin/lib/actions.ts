"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type {
  Permission,
  RosterImportSummary,
  UrlPolicySimulation,
  PlatformPolicySimulation,
} from "@virtual-school/shared";
import { adminApiJsonMutation, adminApiMutation } from "./api";
import { roleCan } from "./auth/portal-access";
import { requireAdminSession } from "./auth/session";
import { adminLocaleCookie } from "./locale";

export async function updateAdminLanguageAction(
  formData: FormData,
): Promise<void> {
  await requireAdminSession();
  const language = required(formData, "language");
  if (!["school", "en", "ur"].includes(language))
    throw new Error("Unsupported language");
  (await cookies()).set(adminLocaleCookie, language, {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    path: "/",
  });
  revalidateAll();
}

export async function createTenantAction(formData: FormData): Promise<void> {
  await requireActionPermission("tenant:create");
  await adminApiMutation("POST", "/tenants", {
    country: text(formData, "country"),
    name: text(formData, "name"),
    planKey: text(formData, "planKey"),
    primaryContactEmail: text(formData, "primaryContactEmail"),
    status: text(formData, "status") || "PILOT",
    timezone: text(formData, "timezone"),
  });
  revalidateAll();
}

export async function createAutomationRuleAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("tenant:update");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation("POST", `/tenants/${tenantId}/automation-rules`, {
    name: required(formData, "name"),
    trigger: required(formData, "trigger"),
    threshold: Number(required(formData, "threshold")),
    windowMinutes: Number(required(formData, "windowMinutes")),
    action: required(formData, "automationAction"),
    title: required(formData, "title"),
    severity: required(formData, "severity"),
    enabled: false,
  });
  revalidatePath("/alerts");
}

export async function createAnnouncementAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("tenant:update");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/communications/announcements`,
    {
      title: required(formData, "title"),
      message: required(formData, "message"),
      targetRoles: formData.getAll("targetRoles"),
      startsAt: required(formData, "startsAt"),
      endsAt: text(formData, "endsAt") || undefined,
    },
  );
  revalidatePath("/");
  revalidatePath("/alerts");
}
export async function archiveAnnouncementAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("tenant:update");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "PATCH",
    `/tenants/${tenantId}/communications/announcements/${required(formData, "announcementId")}/archive`,
    {},
  );
  revalidatePath("/alerts");
}
export async function createPilotFeedbackAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("tenant:read");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/communications/feedback`,
    {
      module: required(formData, "module"),
      severity: required(formData, "severity"),
      summary: required(formData, "summary"),
      context: {
        route: "/alerts",
        release: text(formData, "release") || "pilot",
      },
    },
  );
  revalidatePath("/");
  revalidatePath("/alerts");
}
export async function updatePilotFeedbackAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("tenant:update");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "PATCH",
    `/tenants/${tenantId}/communications/feedback/${required(formData, "feedbackId")}`,
    { status: required(formData, "status") },
  );
  revalidatePath("/alerts");
}

export async function updateAutomationRuleAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("tenant:update");
  const tenantId = required(formData, "tenantId");
  const ruleId = required(formData, "ruleId");
  await adminApiMutation(
    "PATCH",
    `/tenants/${tenantId}/automation-rules/${ruleId}`,
    {
      name: required(formData, "name"),
      trigger: required(formData, "trigger"),
      threshold: Number(required(formData, "threshold")),
      windowMinutes: Number(required(formData, "windowMinutes")),
      action: required(formData, "automationAction"),
      title: required(formData, "title"),
      severity: required(formData, "severity"),
      enabled: booleanValue(formData, "enabled"),
    },
  );
  revalidatePath("/alerts");
}

export async function testAutomationRuleAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("tenant:update");
  await adminApiMutation(
    "POST",
    `/tenants/${required(formData, "tenantId")}/automation-rules/${required(formData, "ruleId")}/test`,
    {},
  );
  revalidatePath("/alerts");
}

export async function updateAttendanceSettingsAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("class:manage");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation("PATCH", `/tenants/${tenantId}/attendance/settings`, {
    sessionSignalEnabled: formData.get("sessionSignalEnabled") === "on",
    deviceSignalEnabled: formData.get("deviceSignalEnabled") === "on",
    lmsSignalEnabled: formData.get("lmsSignalEnabled") === "on",
    teacherSignalEnabled: formData.get("teacherSignalEnabled") === "on",
    presentThreshold: Number(required(formData, "presentThreshold")),
  });
  revalidatePath("/reports");
}

export async function captureAttendanceAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("class:manage");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation("POST", `/tenants/${tenantId}/attendance/capture`, {
    classId: required(formData, "classId"),
    attendanceDate: required(formData, "attendanceDate"),
  });
  revalidatePath("/reports");
}

export async function correctAttendanceAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("class:manage");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "PATCH",
    `/tenants/${tenantId}/attendance/records/${required(formData, "recordId")}`,
    {
      status: required(formData, "status"),
      reason: required(formData, "reason"),
    },
  );
  revalidatePath("/reports");
}

export async function createContentLibraryItemAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("policy:manage");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation("POST", `/tenants/${tenantId}/content-library`, {
    title: required(formData, "title"),
    description: text(formData, "description"),
    type: required(formData, "type"),
    category: required(formData, "category"),
    locator: required(formData, "locator"),
    grades: csvValues(formData, "grades"),
    subjects: csvValues(formData, "subjects"),
    classIds: formData
      .getAll("classIds")
      .filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0,
      ),
    expiresAt: text(formData, "expiresAt") || undefined,
    offlineEnabled: booleanValue(formData, "offlineEnabled"),
    offlineVersion: numberValue(formData, "offlineVersion"),
    offlineSha256: text(formData, "offlineSha256") || undefined,
    offlineSizeBytes: numberValue(formData, "offlineSizeBytes"),
    offlinePolicyIds: formData
      .getAll("offlinePolicyIds")
      .filter(
        (value): value is string =>
          typeof value === "string" && value.length > 0,
      ),
  });
  revalidatePath("/apps");
}

export async function updateContentLibraryItemAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("policy:manage");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "PATCH",
    `/tenants/${tenantId}/content-library/${required(formData, "itemId")}`,
    {
      status: required(formData, "status"),
    },
  );
  revalidatePath("/apps");
}

export async function reportGuardianLostDeviceAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("guardian:read");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/guardian/children/${required(formData, "studentId")}/lost-device-reports`,
    {
      reason: required(formData, "reason"),
      startLostWorkflow: booleanValue(formData, "startLostWorkflow"),
    },
  );
  revalidatePath("/guardian");
}

export async function updateGuardianAfterSchoolAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("guardian:read");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "PATCH",
    `/tenants/${tenantId}/guardian/children/${required(formData, "studentId")}/after-school-control`,
    {
      enabled: booleanValue(formData, "enabled"),
      dailyLimitMinutes: numberValue(formData, "dailyLimitMinutes"),
      allowedAppIds: formData
        .getAll("allowedAppIds")
        .filter((value): value is string => typeof value === "string"),
    },
  );
  revalidatePath("/guardian");
}

export async function acceptGuardianConsentAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("guardian:read");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/privacy/notices/${required(formData, "noticeId")}/accept`,
    { channel: "PORTAL" },
  );
  revalidatePath("/guardian");
}

export async function updateGuardianNotificationsAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("guardian:read");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "PATCH",
    `/tenants/${tenantId}/guardian/notification-preferences`,
    {
      channels: formData
        .getAll("channels")
        .filter((value): value is string => typeof value === "string"),
    },
  );
  revalidatePath("/guardian");
}

export async function updateGuardianLanguageAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("guardian:read");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation("PATCH", `/tenants/${tenantId}/guardian/language`, {
    language: required(formData, "language"),
  });
  revalidatePath("/guardian");
}

export async function createGuardianSupportRequestAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("guardian:read");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/guardian/children/${required(formData, "studentId")}/support-requests`,
    {
      category: required(formData, "category"),
      subject: required(formData, "subject"),
      description: required(formData, "description"),
    },
  );
  revalidatePath("/guardian");
}

export async function startTeacherSessionAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("session:manage");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation("POST", `/tenants/${tenantId}/teacher/sessions`, {
    classId: required(formData, "classId"),
  });
  revalidateAll();
}

export async function createTeacherSessionTemplateAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("session:manage");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation("POST", `/tenants/${tenantId}/teacher/templates`, {
    name: required(formData, "name"),
    classId: required(formData, "classId"),
    resourceId: text(formData, "resourceId"),
    focusMessage: text(formData, "focusMessage"),
    focusDurationMinutes: numberValue(formData, "focusDurationMinutes"),
    temporaryUrl: text(formData, "temporaryUrl"),
    temporaryUrlMinutes: numberValue(formData, "temporaryUrlMinutes"),
  });
  revalidateAll();
}

export async function startTeacherSessionTemplateAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("session:manage");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/teacher/templates/${required(formData, "templateId")}/start`,
    {},
  );
  revalidateAll();
}

export async function endTeacherSessionAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("session:manage");
  const tenantId = required(formData, "tenantId");
  const sessionId = required(formData, "sessionId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/teacher/sessions/${sessionId}/end`,
    {
      reason: required(formData, "reason"),
    },
  );
  revalidateAll();
}

export async function pushTeacherResourceAction(
  formData: FormData,
): Promise<void> {
  await teacherSessionMutation(formData, "resources", {
    resourceId: required(formData, "resourceId"),
  });
}

export async function showTeacherFocusScreenAction(
  formData: FormData,
): Promise<void> {
  await teacherSessionMutation(formData, "focus-screen", {
    message: required(formData, "message"),
    durationMinutes: numberValue(formData, "durationMinutes"),
  });
}

export async function approveTeacherTemporaryUrlAction(
  formData: FormData,
): Promise<void> {
  await teacherSessionMutation(formData, "temporary-url-approvals", {
    url: required(formData, "url"),
    durationMinutes: numberValue(formData, "durationMinutes"),
  });
}

async function teacherSessionMutation(
  formData: FormData,
  action: string,
  body: Record<string, unknown>,
): Promise<void> {
  await requireActionPermission("session:manage");
  const tenantId = required(formData, "tenantId");
  const sessionId = required(formData, "sessionId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/teacher/sessions/${sessionId}/${action}`,
    body,
  );
  revalidateAll();
}

export async function assignTeacherClassAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("class:manage");
  const tenantId = required(formData, "tenantId");
  const classId = required(formData, "classId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/teacher/classes/${classId}/assignments`,
    {
      teacherId: required(formData, "teacherId"),
    },
  );
  revalidateAll();
}

export async function createBranchAction(formData: FormData): Promise<void> {
  await requireActionPermission("tenant:update");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation("POST", `/tenants/${tenantId}/branches`, {
    name: text(formData, "name"),
    timezone: text(formData, "timezone"),
  });
  revalidateAll();
}

export async function updateTenantProfileAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("tenant:update");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation("PATCH", `/tenants/${tenantId}`, {
    accentColor: text(formData, "accentColor"),
    country: text(formData, "country"),
    language: text(formData, "language"),
    logoUrl: text(formData, "logoUrl"),
    name: text(formData, "name"),
    primaryColor: text(formData, "primaryColor"),
    supportEmail: text(formData, "supportEmail"),
    supportPhone: text(formData, "supportPhone"),
    studentLabel: text(formData, "studentLabel"),
    deviceLabel: text(formData, "deviceLabel"),
    timezone: text(formData, "timezone"),
    websiteUrl: text(formData, "websiteUrl"),
  });
  revalidateAll();
}

export async function completeOnboardingAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("tenant:update");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/onboarding-checklist/complete`,
    {},
  );
  revalidateAll();
}

export async function inviteStaffAction(formData: FormData): Promise<void> {
  await requireActionPermission("user:invite");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation("POST", `/tenants/${tenantId}/users/invitations`, {
    email: text(formData, "email"),
    name: text(formData, "name"),
    role: text(formData, "role"),
  });
  revalidateAll();
}

export async function bulkInviteStaffAction(formData: FormData): Promise<void> {
  await requireActionPermission("user:invite");
  const tenantId = required(formData, "tenantId");
  const rows = await csvRowsFromForm(formData, ["name", "email", "role"]);

  for (const row of rows) {
    await adminApiMutation("POST", `/tenants/${tenantId}/users/invitations`, {
      branchId: row.branchid,
      email: row.email,
      name: row.name,
      role: row.role,
    });
  }

  revalidateAll();
}

export async function updateStaffRoleAction(formData: FormData): Promise<void> {
  await requireActionPermission("user:invite");
  const tenantId = required(formData, "tenantId");
  const userId = required(formData, "userId");
  await adminApiMutation("PATCH", `/tenants/${tenantId}/users/${userId}/role`, {
    reason: text(formData, "reason"),
    role: text(formData, "role"),
  });
  revalidateAll();
}

export async function suspendStaffAction(formData: FormData): Promise<void> {
  await staffLifecycleAction(formData, "suspend");
}

export async function deactivateStaffAction(formData: FormData): Promise<void> {
  await staffLifecycleAction(formData, "deactivate");
}

export async function reactivateStaffAction(formData: FormData): Promise<void> {
  await staffLifecycleAction(formData, "reactivate");
}

export async function forceLogoutStaffAction(
  formData: FormData,
): Promise<void> {
  await staffLifecycleAction(formData, "force-logout");
}

export async function setStaffMfaAction(formData: FormData): Promise<void> {
  await requireActionPermission("user:suspend");
  const tenantId = required(formData, "tenantId");
  const userId = required(formData, "userId");
  await adminApiMutation("PATCH", `/tenants/${tenantId}/users/${userId}/mfa`, {
    mfaEnabled: booleanValue(formData, "mfaEnabled"),
    reason: text(formData, "reason"),
  });
  revalidateAll();
}

export async function createClassAction(formData: FormData): Promise<void> {
  await requireActionPermission("class:manage");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation("POST", `/tenants/${tenantId}/classes`, {
    branchId: text(formData, "branchId"),
    academicYear: text(formData, "academicYear"),
    grade: text(formData, "grade"),
    name: text(formData, "name"),
    subject: text(formData, "subject"),
  });
  revalidateAll();
}

export async function rolloverAcademicYearAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("class:manage");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/academic-year-rollovers`,
    {
      sourceAcademicYear: required(formData, "sourceAcademicYear"),
      targetAcademicYear: required(formData, "targetAcademicYear"),
      reason: text(formData, "reason"),
    },
  );
  revalidateAll();
}

export async function bulkCreateClassesAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("class:manage");
  const tenantId = required(formData, "tenantId");
  const rows = await csvRowsFromForm(formData, ["name", "grade"]);

  for (const row of rows) {
    await adminApiMutation("POST", `/tenants/${tenantId}/classes`, {
      branchId: row.branchid,
      grade: row.grade,
      name: row.name,
      subject: row.subject,
    });
  }

  revalidateAll();
}

export async function createStudentAction(formData: FormData): Promise<void> {
  await requireActionPermission("roster:manage");
  const tenantId = required(formData, "tenantId");
  const guardianName = text(formData, "guardianName");
  await adminApiMutation("POST", `/tenants/${tenantId}/students`, {
    grade: text(formData, "grade"),
    guardians: guardianName
      ? [
          {
            email: text(formData, "guardianEmail"),
            name: guardianName,
            relationship: text(formData, "guardianRelationship") || "Guardian",
          },
        ]
      : [],
    name: text(formData, "name"),
    section: text(formData, "section"),
    status: text(formData, "status") || "ACTIVE",
    studentCode: text(formData, "studentCode"),
  });
  revalidateAll();
}

export async function previewRosterImportAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("roster:manage");
  const tenantId = required(formData, "tenantId");
  const uploadedCsv = await fileText(formData, "csvFile");
  const pastedCsv = text(formData, "csv");
  const csv = uploadedCsv || pastedCsv;
  if (!csv) {
    throw new Error("CSV file or pasted rows are required");
  }
  const result = await adminApiJsonMutation<RosterImportSummary>(
    "POST",
    `/tenants/${tenantId}/roster-imports/preview`,
    {
      csv,
      filename:
        fileName(formData, "csvFile") ||
        text(formData, "filename") ||
        "roster-import.csv",
    },
  );
  revalidateAll();
  redirect(`/roster?importId=${result.id}`);
}

export async function commitRosterImportAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("roster:manage");
  const tenantId = required(formData, "tenantId");
  const importId = required(formData, "importId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/roster-imports/${importId}/commit`,
    {},
  );
  revalidateAll();
  redirect("/roster");
}

export async function createEnrollmentBatchAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("device:enroll");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation("POST", `/tenants/${tenantId}/enrollment-batches`, {
    expiresAt: text(formData, "expiresAt"),
    maxDevices: numberValue(formData, "maxDevices"),
    name: text(formData, "name"),
  });
  revalidateAll();
}

export async function assignDeviceAction(formData: FormData): Promise<void> {
  await requireActionPermission("device:enroll");
  const tenantId = required(formData, "tenantId");
  const deviceId = required(formData, "deviceId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/devices/${deviceId}/assignments`,
    {
      branchId: text(formData, "branchId"),
      classId: text(formData, "classId"),
      reason: required(formData, "reason"),
      studentId: text(formData, "studentId"),
      tags: splitList(text(formData, "tags")),
    },
  );
  revalidateAll();
}

export async function changeDeviceLifecycleAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("device:enroll");
  const tenantId = required(formData, "tenantId");
  const deviceId = required(formData, "deviceId");
  const operation = required(formData, "operation");
  if (operation !== "retire" && operation !== "unenroll") {
    throw new Error("Unsupported device lifecycle operation");
  }
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/devices/${deviceId}/${operation}`,
    {
      reason: required(formData, "reason"),
    },
  );
  revalidateAll();
}

export async function bulkAssignDevicesAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("device:enroll");
  const tenantId = required(formData, "tenantId");
  const rows = await csvRowsFromForm(formData, ["deviceid"]);

  for (const row of rows) {
    await adminApiMutation(
      "POST",
      `/tenants/${tenantId}/devices/${row.deviceid}/assignments`,
      {
        branchId: row.branchid,
        classId: row.classid,
        reason: row.reason || "Bulk assignment import",
        studentId: row.studentid,
        tags: splitList(row.tags ?? ""),
      },
    );
  }

  revalidateAll();
}

export async function queueDeviceCommandAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("device:command");
  const tenantId = required(formData, "tenantId");
  const deviceId = required(formData, "deviceId");
  const type = required(formData, "type");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/devices/${deviceId}/commands`,
    {
      confirmed: booleanValue(formData, "confirmed"),
      maxAttempts: numberValue(formData, "maxAttempts"),
      payload: commandPayload(type, formData),
      reason: text(formData, "reason"),
      ttlMinutes: numberValue(formData, "ttlMinutes"),
      type,
    },
  );
  revalidateAll();
}

export async function queueWipeDeviceAction(formData: FormData): Promise<void> {
  await requireActionPermission("device:wipe");
  const tenantId = required(formData, "tenantId");
  const deviceId = required(formData, "deviceId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/devices/${deviceId}/commands/wipe`,
    {
      confirmationSerialNumber: text(formData, "confirmationSerialNumber"),
      preserveFactoryResetProtection: booleanValue(
        formData,
        "preserveFactoryResetProtection",
      ),
      reason: text(formData, "reason"),
      ttlMinutes: numberValue(formData, "ttlMinutes"),
    },
  );
  revalidateAll();
}

export async function createStarterPoliciesAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("policy:manage");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/policies/starter-templates`,
    {},
  );
  revalidateAll();
}

export async function publishPolicyAction(formData: FormData): Promise<void> {
  await requireActionPermission("policy:manage");
  const tenantId = required(formData, "tenantId");
  const policyId = required(formData, "policyId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/policies/${policyId}/publish`,
    {
      reason: text(formData, "reason"),
    },
  );
  revalidateAll();
}

export async function updateAndroidPolicyControlsAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("policy:manage");
  const tenantId = required(formData, "tenantId");
  const policyId = required(formData, "policyId");
  const updateType = required(formData, "updateType");
  await adminApiMutation(
    "PATCH",
    `/tenants/${tenantId}/policies/${policyId}/android-controls`,
    {
      blockFactoryReset: booleanValue(formData, "blockFactoryReset"),
      kioskCustomization: {
        powerButtonActions: required(formData, "powerButtonActions"),
        statusBar: required(formData, "statusBar"),
        systemNavigation: required(formData, "systemNavigation"),
      },
      systemUpdate:
        updateType === "WINDOWED"
          ? {
              endMinutes: timeToMinute(required(formData, "updateEndTime")),
              startMinutes: timeToMinute(required(formData, "updateStartTime")),
              type: updateType,
            }
          : { type: updateType },
    },
  );
  revalidateAll();
}

export async function updateWebFilterSettingsAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("policy:manage");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "PATCH",
    `/tenants/${tenantId}/policies/web-filter-settings`,
    {
      blockedCategories: formData.getAll("blockedCategories").map(String),
      neverAllowedUrls: text(formData, "neverAllowedUrls")
        .split(/\r?\n/)
        .map((value) => value.trim())
        .filter(Boolean),
      educationalVideoAllowlist: text(formData, "educationalVideoAllowlist")
        .split(/\r?\n/)
        .map((line) => line.split("|").map((value) => value.trim()))
        .filter(([kind, value, scope]) => Boolean(kind && value && scope))
        .map(([kind, value, scope, scopeId]) => ({
          kind,
          value,
          scope,
          ...(scopeId ? { scopeId } : {}),
        })),
      safeSearch: {
        bing: booleanValue(formData, "safeSearchBing"),
        google: booleanValue(formData, "safeSearchGoogle"),
        youtubeRestrictedMode: required(formData, "youtubeRestrictedMode"),
      },
    },
  );
  revalidateAll();
}

export async function rollbackPolicyAction(formData: FormData): Promise<void> {
  await requireActionPermission("policy:manage");
  const tenantId = required(formData, "tenantId");
  const policyId = required(formData, "policyId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/policies/${policyId}/rollback`,
    {
      reason: required(formData, "reason"),
      version: numberValue(formData, "version"),
    },
  );
  revalidateAll();
}

export async function issueSupportUnlockAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("policy:manage");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/policies/support-unlocks`,
    {
      deviceId: required(formData, "deviceId"),
      durationMinutes: numberValue(formData, "durationMinutes"),
      policyId: required(formData, "policyId"),
      reason: required(formData, "reason"),
    },
  );
  revalidateAll();
}

export async function checkExamReadinessAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("policy:manage");
  redirect(
    `/policies?examAssignmentId=${encodeURIComponent(required(formData, "assignmentId"))}`,
  );
}

export async function launchAssessmentAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("policy:manage");
  const tenantId = required(formData, "tenantId");
  const assignmentId = required(formData, "assignmentId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/policies/exam-schedules/${assignmentId}/launch`,
    {
      reason: text(formData, "reason"),
      resource: required(formData, "resource"),
      resourceType: required(formData, "resourceType"),
    },
  );
  revalidateAll();
  redirect(
    `/policies?examAssignmentId=${encodeURIComponent(assignmentId)}&launch=queued`,
  );
}

export async function unlockExamDeviceAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("policy:manage");
  const tenantId = required(formData, "tenantId");
  const assignmentId = required(formData, "assignmentId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/policies/exam-schedules/${assignmentId}/emergency-unlocks`,
    {
      deviceId: required(formData, "deviceId"),
      durationMinutes: numberValue(formData, "durationMinutes"),
      reason: required(formData, "reason"),
    },
  );
  revalidateAll();
  redirect(
    `/policies?examAssignmentId=${encodeURIComponent(assignmentId)}&unlock=queued`,
  );
}

export async function assignPolicyAction(formData: FormData): Promise<void> {
  await requireActionPermission("policy:manage");
  const tenantId = required(formData, "tenantId");
  const policyId = required(formData, "policyId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/policies/${policyId}/assignments`,
    {
      endsAt: text(formData, "endsAt"),
      reason: text(formData, "reason"),
      scope: text(formData, "scope"),
      scopeId: text(formData, "scopeId"),
      startsAt: text(formData, "startsAt"),
    },
  );
  revalidateAll();
}

export async function simulateUrlPolicyAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("policy:manage");
  const tenantId = required(formData, "tenantId");
  const result = await adminApiJsonMutation<UrlPolicySimulation>(
    "POST",
    `/tenants/${tenantId}/policies/${required(formData, "policyId")}/simulate-url`,
    { url: required(formData, "url") },
  );
  const params = new URLSearchParams({
    decision: result.decision,
    effectiveAccess: result.effectiveAccess,
    matchedRule: result.matchedRule ?? "",
    reason: result.reason,
  });
  redirect(`/policies?${params.toString()}`);
}

export async function updatePlatformOverridesAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("policy:manage");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "PATCH",
    `/tenants/${tenantId}/policies/${required(formData, "policyId")}/platform-overrides`,
    {
      platform: required(formData, "platform"),
      overrides: ["kiosk", "web-filter", "app-deployment"].map((control) => ({
        control,
        enabled: formData.get(control) === "on",
      })),
    },
  );
  revalidateAll();
}

export async function simulatePlatformPolicyAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("policy:manage");
  const tenantId = required(formData, "tenantId");
  const result = await adminApiJsonMutation<PlatformPolicySimulation>(
    "POST",
    `/tenants/${tenantId}/policies/${required(formData, "policyId")}/simulate-platform`,
    {
      enrollmentType: required(formData, "enrollmentType"),
      osVersion: text(formData, "osVersion"),
      ownershipType: required(formData, "ownershipType"),
      platform: required(formData, "platform"),
    },
  );
  const params = new URLSearchParams({
    platformConflicts: result.conflicts.join(","),
    platformName: result.platform,
    platformPublishable: String(result.publishable),
    platformUnsupported: result.unsupportedControls.join(","),
  });
  redirect(`/policies?${params.toString()}`);
}

export async function createTimetableBlockAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("policy:manage");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation("POST", `/tenants/${tenantId}/timetable-blocks`, {
    branchId: text(formData, "branchId"),
    dayOfWeek: numberValue(formData, "dayOfWeek"),
    effectiveFrom: text(formData, "effectiveFrom"),
    effectiveUntil: text(formData, "effectiveUntil"),
    endMinute: timeToMinute(required(formData, "endTime")),
    name: text(formData, "name"),
    policyId: text(formData, "policyId"),
    reason: text(formData, "reason"),
    scope: text(formData, "scope"),
    scopeId: text(formData, "scopeId"),
    startMinute: timeToMinute(required(formData, "startTime")),
    subject: text(formData, "subject"),
    timezone: text(formData, "timezone"),
  });
  revalidateAll();
}

export async function deactivateTimetableBlockAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("policy:manage");
  const tenantId = required(formData, "tenantId");
  const blockId = required(formData, "blockId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/timetable-blocks/${blockId}/deactivate`,
    {
      reason: text(formData, "reason"),
    },
  );
  revalidateAll();
}

export async function createCalendarExceptionAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("policy:manage");
  const tenantId = required(formData, "tenantId");
  const kind = required(formData, "kind");
  await adminApiMutation("POST", `/tenants/${tenantId}/calendar-exceptions`, {
    endMinute: text(formData, "endTime")
      ? timeToMinute(required(formData, "endTime"))
      : undefined,
    kind,
    localDate: required(formData, "localDate"),
    name: required(formData, "name"),
    policyId: kind === "OVERRIDE" ? required(formData, "policyId") : undefined,
    reason: text(formData, "reason"),
    scope: text(formData, "scope") || "TENANT",
    scopeId: text(formData, "scopeId"),
    startMinute: text(formData, "startTime")
      ? timeToMinute(required(formData, "startTime"))
      : undefined,
    timezone: text(formData, "timezone"),
  });
  revalidateAll();
}

export async function createAppAction(formData: FormData): Promise<void> {
  await requireActionPermission("policy:manage");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation("POST", `/tenants/${tenantId}/apps`, {
    approvalStatus: text(formData, "approvalStatus") || "APPROVED",
    approvedGrades: splitList(text(formData, "approvedGrades")),
    category: text(formData, "category"),
    description: text(formData, "description"),
    installRules: {
      installType: text(formData, "installType") || "AVAILABLE",
    },
    name: text(formData, "name"),
    packageId: text(formData, "packageId"),
  });
  revalidateAll();
}

export async function bulkCreateAppsAction(formData: FormData): Promise<void> {
  await requireActionPermission("policy:manage");
  const tenantId = required(formData, "tenantId");
  const rows = await csvRowsFromForm(formData, ["name", "packageid"]);

  for (const row of rows) {
    await adminApiMutation("POST", `/tenants/${tenantId}/apps`, {
      approvalStatus: row.approvalstatus || "APPROVED",
      approvedGrades: splitList(row.approvedgrades ?? ""),
      category: row.category,
      description: row.description,
      iconUrl: row.iconurl,
      installRules: {
        installType: row.installtype || "AVAILABLE",
      },
      name: row.name,
      packageId: row.packageid,
    });
  }

  revalidateAll();
}

export async function deployAppAction(formData: FormData): Promise<void> {
  await requireActionPermission("device:command");
  const tenantId = required(formData, "tenantId");
  const appId = required(formData, "appId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/apps/${appId}/deployments`,
    {
      action: text(formData, "action"),
      maxAttempts: numberValue(formData, "maxAttempts"),
      reason: text(formData, "reason"),
      scope: text(formData, "scope"),
      scopeId: text(formData, "scopeId"),
      ttlMinutes: numberValue(formData, "ttlMinutes"),
    },
  );
  revalidateAll();
}

export async function createSupportNoteAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("device:command");
  const tenantId = required(formData, "tenantId");
  const deviceId = required(formData, "deviceId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/support/devices/${deviceId}/notes`,
    {
      body: text(formData, "body"),
      category: text(formData, "category"),
      pinned: booleanValue(formData, "pinned"),
      severity: text(formData, "severity"),
      status: text(formData, "status"),
      visibility: text(formData, "visibility"),
    },
  );
  revalidateAll();
}

export async function createSupportTicketAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("device:read");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation("POST", `/tenants/${tenantId}/support/tickets`, {
    deviceId: text(formData, "deviceId"),
    classId: text(formData, "classId"),
    category: text(formData, "category"),
    priority: text(formData, "priority"),
    subject: required(formData, "subject"),
    description: required(formData, "description"),
  });
  revalidateAll();
}

export async function updateSupportTicketAction(
  formData: FormData,
): Promise<void> {
  const session = await requireAdminSession();
  if (
    !roleCan(session.role, "device:command") &&
    !roleCan(session.role, "tenant:update")
  )
    throw new Error("Missing permission to manage support tickets");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "PATCH",
    `/tenants/${tenantId}/support/tickets/${required(formData, "ticketId")}`,
    {
      status: text(formData, "status"),
      assigneeId: text(formData, "assigneeId"),
      priority: text(formData, "priority"),
    },
  );
  revalidateAll();
}

export async function addSupportTicketNoteAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("device:read");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/support/tickets/${required(formData, "ticketId")}/notes`,
    {
      body: required(formData, "body"),
      visibility: text(formData, "visibility") || "INTERNAL",
    },
  );
  revalidateAll();
}

export async function startRemoteAssistanceAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("device:command");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/support/assistance/sessions`,
    {
      deviceId: required(formData, "deviceId"),
      ticketId: text(formData, "ticketId"),
      purpose: required(formData, "purpose"),
      consentedBy: required(formData, "consentedBy"),
      noticeAcknowledged: booleanValue(formData, "noticeAcknowledged"),
    },
  );
  revalidateAll();
}

export async function endRemoteAssistanceAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("device:command");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/support/assistance/sessions/${required(formData, "sessionId")}/end`,
    {
      resolution: required(formData, "resolution"),
    },
  );
  revalidateAll();
}

export async function updateSupportNoteAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("device:command");
  const tenantId = required(formData, "tenantId");
  const noteId = required(formData, "noteId");
  await adminApiMutation(
    "PATCH",
    `/tenants/${tenantId}/support/notes/${noteId}`,
    {
      pinned: optionalBooleanValue(formData, "pinned"),
      resolution: text(formData, "resolution"),
      status: text(formData, "status"),
    },
  );
  revalidateAll();
}

export async function updateRetentionSettingsAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("tenant:update");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation("PATCH", `/tenants/${tenantId}/retention-settings`, {
    auditRetentionDays: numberValue(formData, "auditRetentionDays"),
    commandHistoryRetentionDays: numberValue(
      formData,
      "commandHistoryRetentionDays",
    ),
    diagnosticRetentionDays: numberValue(formData, "diagnosticRetentionDays"),
    exportArtifactRetentionDays: numberValue(
      formData,
      "exportArtifactRetentionDays",
    ),
    resolvedAlertRetentionDays: numberValue(
      formData,
      "resolvedAlertRetentionDays",
    ),
    supportNoteRetentionDays: numberValue(formData, "supportNoteRetentionDays"),
  });
  revalidateAll();
}

export async function dryRunRetentionAction(formData: FormData): Promise<void> {
  await requireActionPermission("tenant:update");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/retention-runs/dry-run`,
    {
      reason: text(formData, "reason"),
    },
  );
  revalidateAll();
}

export async function applyRetentionAction(formData: FormData): Promise<void> {
  await requireActionPermission("tenant:update");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation("POST", `/tenants/${tenantId}/retention-runs`, {
    reason: text(formData, "reason"),
  });
  revalidateAll();
}

export async function acknowledgeAlertAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("device:command");
  const tenantId = required(formData, "tenantId");
  const alertId = required(formData, "alertId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/alerts/${alertId}/acknowledge`,
    {
      reason: text(formData, "reason"),
    },
  );
  revalidateAll();
}

export async function resolveAlertAction(formData: FormData): Promise<void> {
  await requireActionPermission("device:command");
  const tenantId = required(formData, "tenantId");
  const alertId = required(formData, "alertId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/alerts/${alertId}/resolve`,
    {
      reason: text(formData, "reason"),
    },
  );
  revalidateAll();
}

export async function scanOfflineAlertsAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("device:command");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation("POST", `/tenants/${tenantId}/alerts/offline-scan`, {
    offlineAfterMinutes: numberValue(formData, "offlineAfterMinutes"),
  });
  revalidateAll();
}

export async function updateNotificationPreferencesAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("tenant:update");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "PATCH",
    `/tenants/${tenantId}/notifications/preferences`,
    {
      appFailureEnabled: booleanValue(formData, "appFailureEnabled"),
      deduplicationWindowMinutes: numberValue(
        formData,
        "deduplicationWindowMinutes",
      ),
      lostDeviceEnabled: booleanValue(formData, "lostDeviceEnabled"),
      offlineAfterMinutes: numberValue(formData, "offlineAfterMinutes"),
      offlineEnabled: booleanValue(formData, "offlineEnabled"),
      policyFailureEnabled: booleanValue(formData, "policyFailureEnabled"),
      recipients: text(formData, "recipients")
        .split(/[;,\s]+/)
        .map((value) => value.trim())
        .filter(Boolean),
      repeatedEnrollmentEnabled: booleanValue(
        formData,
        "repeatedEnrollmentEnabled",
      ),
      repeatedEnrollmentThreshold: numberValue(
        formData,
        "repeatedEnrollmentThreshold",
      ),
      engagementRiskEnabled: booleanValue(formData, "engagementRiskEnabled"),
      missedSessionThreshold: numberValue(formData, "missedSessionThreshold"),
      complianceFailureThreshold: numberValue(
        formData,
        "complianceFailureThreshold",
      ),
      weeklyAdminSummaryEnabled: booleanValue(
        formData,
        "weeklyAdminSummaryEnabled",
      ),
      weeklyGuardianSummaryEnabled: booleanValue(
        formData,
        "weeklyGuardianSummaryEnabled",
      ),
    },
  );
  revalidateAll();
}

export async function updateBillingAction(formData: FormData): Promise<void> {
  await requireActionPermission("billing:manage");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation("PATCH", `/tenants/${tenantId}/billing/subscription`, {
    billingEmail: text(formData, "billingEmail"),
    billingPeriodEnd: text(formData, "billingPeriodEnd"),
    billingPeriodStart: text(formData, "billingPeriodStart"),
    branchLimit: numberValue(formData, "branchLimit"),
    deviceLimit: numberValue(formData, "deviceLimit"),
    notes: text(formData, "notes"),
    planKey: text(formData, "planKey"),
    staffLimit: numberValue(formData, "staffLimit"),
    status: text(formData, "status"),
    studentLimit: numberValue(formData, "studentLimit"),
    trialEndsAt: text(formData, "trialEndsAt"),
  });
  revalidateAll();
}

export async function publishPrivacyNoticeAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("tenant:update");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation("POST", `/tenants/${tenantId}/privacy/notices`, {
    noticeType: text(formData, "noticeType"),
    channel: text(formData, "channel"),
    title: text(formData, "title"),
    content: text(formData, "content"),
  });
  revalidateAll();
}

export async function acceptPrivacyNoticeAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("tenant:update");
  const tenantId = required(formData, "tenantId");
  const noticeId = required(formData, "noticeId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/privacy/notices/${noticeId}/accept`,
    { channel: text(formData, "channel") },
  );
  revalidateAll();
}

export async function revokePrivacyAcceptanceAction(
  formData: FormData,
): Promise<void> {
  await requireActionPermission("tenant:update");
  const tenantId = required(formData, "tenantId");
  const acceptanceId = required(formData, "acceptanceId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/privacy/acceptances/${acceptanceId}/revoke`,
    { reason: text(formData, "reason") },
  );
  revalidateAll();
}

function revalidateAll(): void {
  [
    "/",
    "/alerts",
    "/apps",
    "/billing",
    "/devices",
    "/enrollment",
    "/policies",
    "/privacy",
    "/reports",
    "/roster",
    "/support",
    "/tenants",
    "/timetable",
  ].forEach((path) => revalidatePath(path));
}

async function staffLifecycleAction(
  formData: FormData,
  action: "deactivate" | "force-logout" | "reactivate" | "suspend",
): Promise<void> {
  await requireActionPermission("user:suspend");
  const tenantId = required(formData, "tenantId");
  const userId = required(formData, "userId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/users/${userId}/${action}`,
    {
      reason: text(formData, "reason"),
    },
  );
  revalidateAll();
}

export async function authorizeClassroomAction(formData: FormData) {
  await requireActionPermission("tenant:update");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/integrations/google-classroom/authorize`,
    {
      credentialReference: required(formData, "credentialReference"),
      delegatedAdminEmail: required(formData, "delegatedAdminEmail"),
    },
  );
  revalidateAll();
}

export async function reconcileSisAction(formData: FormData) {
  await requireActionPermission("roster:manage");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/integrations/sis/reconciliations`,
    {
      source: required(formData, "source"),
      records: [
        {
          objectType: required(formData, "objectType"),
          localId: required(formData, "localId"),
          externalId: required(formData, "externalId"),
        },
      ],
    },
  );
  revalidateAll();
}

export async function retrySisAction(formData: FormData) {
  await requireActionPermission("roster:manage");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/integrations/sis/reconciliations/${required(formData, "runId")}/retry`,
    {},
  );
  revalidateAll();
}

export async function configureWebhookAction(formData: FormData) {
  await requireActionPermission("tenant:update");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation("POST", `/tenants/${tenantId}/integrations/webhooks`, {
    name: required(formData, "name"),
    url: required(formData, "url"),
    secretReference: required(formData, "secretReference"),
    maxAttempts: numberValue(formData, "maxAttempts"),
    eventTypes: formData
      .getAll("eventTypes")
      .filter((value): value is string => typeof value === "string"),
  });
  revalidateAll();
}

export async function rotateWebhookSecretAction(formData: FormData) {
  await requireActionPermission("tenant:update");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/integrations/webhooks/${required(formData, "endpointId")}/rotate-secret`,
    {
      secretReference: required(formData, "secretReference"),
    },
  );
  revalidateAll();
}

export async function setWebhookEnabledAction(formData: FormData) {
  await requireActionPermission("tenant:update");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "PATCH",
    `/tenants/${tenantId}/integrations/webhooks/${required(formData, "endpointId")}/enabled`,
    {
      enabled: required(formData, "enabled") === "true",
    },
  );
  revalidateAll();
}

export async function mapClassroomCourseAction(formData: FormData) {
  await requireActionPermission("tenant:update");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/integrations/google-classroom/course-mappings`,
    {
      classId: required(formData, "classId"),
      externalCourseId: required(formData, "externalCourseId"),
      externalCourseName: text(formData, "externalCourseName"),
      syncRoster: booleanValue(formData, "syncRoster"),
      syncMaterials: booleanValue(formData, "syncMaterials"),
    },
  );
  revalidateAll();
}

export async function mapClassroomIdentityAction(formData: FormData) {
  await requireActionPermission("tenant:update");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/integrations/google-classroom/identity-mappings`,
    {
      localType: required(formData, "localType"),
      localId: required(formData, "localId"),
      externalUserId: required(formData, "externalUserId"),
      externalEmail: text(formData, "externalEmail"),
    },
  );
  revalidateAll();
}

export async function startClassroomSyncAction(formData: FormData) {
  await requireActionPermission("tenant:update");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/integrations/google-classroom/sync-runs`,
    {
      courseMappingIds: formData
        .getAll("courseMappingIds")
        .filter((item): item is string => typeof item === "string"),
      syncRoster: booleanValue(formData, "syncRoster"),
      syncMaterials: booleanValue(formData, "syncMaterials"),
    },
  );
  revalidateAll();
}

export async function retryClassroomSyncAction(formData: FormData) {
  await requireActionPermission("tenant:update");
  const tenantId = required(formData, "tenantId");
  const runId = required(formData, "runId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/integrations/google-classroom/sync-runs/${runId}/retry`,
    {},
  );
  revalidateAll();
}

export async function configureLmsAction(formData: FormData) {
  await requireActionPermission("tenant:update");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation("POST", `/tenants/${tenantId}/integrations/lms`, {
    provider: required(formData, "provider"),
    baseUrl: required(formData, "baseUrl"),
    credentialReference: required(formData, "credentialReference"),
  });
  revalidateAll();
}
export async function mapLmsCourseAction(formData: FormData) {
  await requireActionPermission("tenant:update");
  const tenantId = required(formData, "tenantId");
  const provider = required(formData, "provider");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/integrations/lms/${provider}/course-mappings`,
    {
      classId: required(formData, "classId"),
      externalCourseId: required(formData, "externalCourseId"),
      displayName: required(formData, "displayName"),
      launchUrl: required(formData, "launchUrl"),
    },
  );
  revalidateAll();
}
export async function testLmsAction(formData: FormData) {
  await requireActionPermission("tenant:update");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/integrations/lms/${required(formData, "provider")}/test`,
    {},
  );
  revalidateAll();
}
export async function disableLmsAction(formData: FormData) {
  await requireActionPermission("tenant:update");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/integrations/lms/${required(formData, "provider")}/disable`,
    {},
  );
  revalidateAll();
}

export async function configureEducationConnectionAction(formData: FormData) {
  await requireActionPermission("tenant:update");
  const tenantId = required(formData, "tenantId");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/integrations/education-resources`,
    {
      provider: required(formData, "provider"),
      credentialReference: required(formData, "credentialReference"),
    },
  );
  revalidateAll();
}

export async function mapEducationResourceAction(formData: FormData) {
  await requireActionPermission("tenant:update");
  const tenantId = required(formData, "tenantId");
  const connectionProvider = required(formData, "connectionProvider");
  await adminApiMutation(
    "POST",
    `/tenants/${tenantId}/integrations/education-resources/${connectionProvider}/resources`,
    {
      classId: required(formData, "classId"),
      provider: required(formData, "provider"),
      externalId: required(formData, "externalId"),
      displayName: required(formData, "displayName"),
      launchUrl: required(formData, "launchUrl"),
    },
  );
  revalidateAll();
}

async function requireActionPermission(permission: Permission): Promise<void> {
  const session = await requireAdminSession();

  if (!roleCan(session.role, permission)) {
    throw new Error(`Permission ${permission} is required`);
  }
}

function required(formData: FormData, key: string): string {
  const value = text(formData, key);
  if (!value) {
    throw new Error(`${key} is required`);
  }

  return value;
}

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

async function fileText(formData: FormData, key: string): Promise<string> {
  const value = formData.get(key);
  if (!(value instanceof File) || value.size === 0) {
    return "";
  }

  return (await value.text()).trim();
}

function fileName(formData: FormData, key: string): string {
  const value = formData.get(key);
  return value instanceof File && value.size > 0 ? value.name : "";
}

function numberValue(formData: FormData, key: string): number | undefined {
  const value = text(formData, key);
  return value ? Number(value) : undefined;
}

function booleanValue(formData: FormData, key: string): boolean {
  return formData.get(key) === "true" || formData.get(key) === "on";
}

function optionalBooleanValue(
  formData: FormData,
  key: string,
): boolean | undefined {
  if (!formData.has(key)) {
    return undefined;
  }

  return booleanValue(formData, key);
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

async function csvRowsFromForm(
  formData: FormData,
  requiredHeaders: string[],
): Promise<Array<Record<string, string>>> {
  const csv = await readCsvInput(formData);
  const records = parseCsvRecords(csv);

  if (records.length === 0) {
    throw new Error("CSV must include a header row");
  }

  const headers = records[0]?.map((header) => normalizeCsvHeader(header)) ?? [];
  const missingHeaders = requiredHeaders.filter(
    (header) => !headers.includes(header),
  );

  if (missingHeaders.length > 0) {
    throw new Error(`CSV is missing headers: ${missingHeaders.join(", ")}`);
  }

  return records
    .slice(1)
    .filter((record) => record.some((cell) => cell.trim()))
    .map((record) => {
      return Object.fromEntries(
        headers.map((header, index) => [header, record[index]?.trim() ?? ""]),
      );
    });
}

async function readCsvInput(formData: FormData): Promise<string> {
  const uploadedCsv = await fileText(formData, "csvFile");
  const pastedCsv = text(formData, "csv");
  const csv = uploadedCsv || pastedCsv;

  if (!csv) {
    throw new Error("CSV file or pasted rows are required");
  }

  return csv;
}

function parseCsvRecords(csv: string): string[][] {
  const records: string[][] = [];
  let currentRecord: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const nextChar = csv[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      currentCell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRecord.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      currentRecord.push(currentCell);
      records.push(currentRecord);
      currentRecord = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  currentRecord.push(currentCell);
  records.push(currentRecord);

  return records.filter((record) => record.some((cell) => cell.trim()));
}

function normalizeCsvHeader(header: string): string {
  return header.trim().toLowerCase().replaceAll("_", "").replaceAll(" ", "");
}

function csvValues(formData: FormData, key: string): string[] {
  return text(formData, key)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function commandPayload(
  type: string,
  formData: FormData,
): Record<string, unknown> | undefined {
  if (type === "SEND_MESSAGE") {
    return {
      message: text(formData, "message"),
    };
  }

  return undefined;
}

function timeToMinute(value: string): number {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}
