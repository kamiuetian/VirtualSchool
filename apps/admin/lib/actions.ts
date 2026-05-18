"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Permission, RosterImportSummary } from "@virtual-school/shared";
import { adminApiJsonMutation, adminApiMutation } from "./api";
import { roleCan } from "./auth/portal-access";
import { requireAdminSession } from "./auth/session";

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
    logoUrl: text(formData, "logoUrl"),
    name: text(formData, "name"),
    primaryColor: text(formData, "primaryColor"),
    supportEmail: text(formData, "supportEmail"),
    supportPhone: text(formData, "supportPhone"),
    timezone: text(formData, "timezone"),
    websiteUrl: text(formData, "websiteUrl"),
  });
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
    grade: text(formData, "grade"),
    name: text(formData, "name"),
    subject: text(formData, "subject"),
  });
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
      reason: text(formData, "reason"),
      studentId: text(formData, "studentId"),
      tags: splitList(text(formData, "tags")),
    },
  );
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

function revalidateAll(): void {
  [
    "/",
    "/alerts",
    "/apps",
    "/billing",
    "/devices",
    "/enrollment",
    "/policies",
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
