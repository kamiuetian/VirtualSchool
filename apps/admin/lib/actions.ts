"use server";

import { revalidatePath } from "next/cache";
import { adminApiMutation } from "./api";

export async function createTenantAction(formData: FormData): Promise<void> {
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
  const tenantId = required(formData, "tenantId");
  await adminApiMutation("POST", `/tenants/${tenantId}/branches`, {
    name: text(formData, "name"),
    timezone: text(formData, "timezone"),
  });
  revalidateAll();
}

export async function inviteStaffAction(formData: FormData): Promise<void> {
  const tenantId = required(formData, "tenantId");
  await adminApiMutation("POST", `/tenants/${tenantId}/users/invitations`, {
    email: text(formData, "email"),
    name: text(formData, "name"),
    role: text(formData, "role"),
  });
  revalidateAll();
}

export async function createClassAction(formData: FormData): Promise<void> {
  const tenantId = required(formData, "tenantId");
  await adminApiMutation("POST", `/tenants/${tenantId}/classes`, {
    grade: text(formData, "grade"),
    name: text(formData, "name"),
    subject: text(formData, "subject"),
  });
  revalidateAll();
}

export async function createStudentAction(formData: FormData): Promise<void> {
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

export async function createEnrollmentBatchAction(
  formData: FormData,
): Promise<void> {
  const tenantId = required(formData, "tenantId");
  await adminApiMutation("POST", `/tenants/${tenantId}/enrollment-batches`, {
    expiresAt: text(formData, "expiresAt"),
    maxDevices: numberValue(formData, "maxDevices"),
    name: text(formData, "name"),
  });
  revalidateAll();
}

export async function assignDeviceAction(formData: FormData): Promise<void> {
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

export async function createStarterPoliciesAction(
  formData: FormData,
): Promise<void> {
  const tenantId = required(formData, "tenantId");
  await adminApiMutation("POST", `/tenants/${tenantId}/policies/starter-templates`, {});
  revalidateAll();
}

export async function publishPolicyAction(formData: FormData): Promise<void> {
  const tenantId = required(formData, "tenantId");
  const policyId = required(formData, "policyId");
  await adminApiMutation("POST", `/tenants/${tenantId}/policies/${policyId}/publish`, {
    reason: text(formData, "reason"),
  });
  revalidateAll();
}

export async function assignPolicyAction(formData: FormData): Promise<void> {
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

export async function createAppAction(formData: FormData): Promise<void> {
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

export async function acknowledgeAlertAction(
  formData: FormData,
): Promise<void> {
  const tenantId = required(formData, "tenantId");
  const alertId = required(formData, "alertId");
  await adminApiMutation("POST", `/tenants/${tenantId}/alerts/${alertId}/acknowledge`, {
    reason: text(formData, "reason"),
  });
  revalidateAll();
}

export async function resolveAlertAction(formData: FormData): Promise<void> {
  const tenantId = required(formData, "tenantId");
  const alertId = required(formData, "alertId");
  await adminApiMutation("POST", `/tenants/${tenantId}/alerts/${alertId}/resolve`, {
    reason: text(formData, "reason"),
  });
  revalidateAll();
}

export async function updateBillingAction(formData: FormData): Promise<void> {
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
    "/roster",
    "/tenants",
  ].forEach((path) => revalidatePath(path));
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

function numberValue(formData: FormData, key: string): number | undefined {
  const value = text(formData, key);
  return value ? Number(value) : undefined;
}

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}
