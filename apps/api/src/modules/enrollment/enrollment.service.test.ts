import { BadRequestException, ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { EnrollmentService } from "./enrollment.service";
import { assessAndroidCompliance } from "./device-capability.catalog";

const now = new Date("2026-05-17T10:00:00.000Z");
const providerExpiration = new Date("2099-08-15T12:00:00.000Z");

function connectorRegistry(overrides: Record<string, unknown> = {}) {
  return {
    getActiveConnector: () => ({
      createEnrollmentToken: vi.fn(),
      deleteEnrollmentToken: vi.fn().mockResolvedValue({
        accepted: true,
        connector: "ANDROID_MANAGEMENT_API",
      }),
      dispatchCommand: vi.fn(),
      key: "ANDROID_MANAGEMENT_API",
      publishPolicy: vi.fn(),
      ...overrides,
    }),
  };
}

describe("EnrollmentService", () => {
  it("scores observable compliance and applies OS lifecycle governance", () => {
    expect(
      assessAndroidCompliance({
        compliance: "COMPLIANT",
        health: "HEALTHY",
        osVersion: "14",
        status: "ONLINE",
      }),
    ).toMatchObject({
      grade: "GOOD",
      osLifecycle: "SUPPORTED",
      restrictions: [],
      score: 100,
    });
    expect(
      assessAndroidCompliance({
        compliance: "NON_COMPLIANT",
        health: "UNHEALTHY",
        osVersion: "10",
        status: "OFFLINE",
      }),
    ).toMatchObject({
      grade: "CRITICAL",
      osLifecycle: "UNSUPPORTED",
      restrictions: [expect.stringContaining("Block new policy")],
      score: 0,
    });
  });

  it("exposes multi-OS capabilities and filters the unified inventory", async () => {
    const service = new EnrollmentService(
      {
        device: {
          findMany: async () => [
            {
              androidVersion: "14",
              branchId: null,
              classId: null,
              compliance: "COMPLIANT",
              connectorDeviceName: null,
              enrollmentBatchId: "batch-1",
              enrollmentId: "managed-1",
              health: "HEALTHY",
              id: "device-1",
              lastCheckInAt: now,
              manufacturer: "Samsung",
              mdmConnector: "android-management-api",
              model: "Tab",
              policyVersion: 3,
              serialNumber: "SERIAL-1",
              status: "ONLINE",
              studentId: null,
              tags: [],
              tenantId: "tenant-1",
            },
          ],
        },
        tenant: { findUnique: async () => ({ id: "tenant-1" }) },
      } as never,
      {} as never,
    );

    expect(
      service.listDeviceCapabilities().map((item) => item.platform),
    ).toEqual(
      expect.arrayContaining(["ANDROID", "CHROMEOS", "IPADOS", "WINDOWS"]),
    );
    await expect(
      service.listDevices("tenant-1", {
        platform: "ANDROID",
        compliance: "COMPLIANT",
      }),
    ).resolves.toMatchObject([
      {
        platform: "ANDROID",
        enrollmentType: "FULLY_MANAGED",
        supportedControls: expect.arrayContaining(["kiosk"]),
        unsupportedControls: ["hardware-reset-block"],
      },
    ]);
    await expect(
      service.listDevices("tenant-1", { platform: "WINDOWS" }),
    ).resolves.toEqual([]);
    await expect(
      service.listDevices("tenant-1", { osLifecycle: "SUPPORTED" }),
    ).resolves.toHaveLength(1);
    await expect(
      service.listDevices("tenant-1", { osLifecycle: "UNSUPPORTED" }),
    ).resolves.toEqual([]);
  });

  it("creates an enrollment batch with a QR payload and audit event", async () => {
    const auditEvents: unknown[] = [];
    const createEnrollmentToken = vi.fn().mockResolvedValue({
      accepted: true,
      connector: "ANDROID_MANAGEMENT_API",
      enterpriseName: "enterprises/enterprise-1",
      expirationTimestamp: providerExpiration.toISOString(),
      policyName: "enterprises/enterprise-1/policies/default",
      qrCode: "google-provisioning-json",
      tokenName: "enterprises/enterprise-1/enrollmentTokens/token-1",
      tokenValue: "provider-token",
    });
    const service = new EnrollmentService(
      {
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            auditEvent: {
              create: async ({ data }: { data: unknown }) => {
                auditEvents.push(data);
                return data;
              },
            },
            enrollmentBatch: {
              create: async ({ data }: { data: Record<string, unknown> }) => ({
                createdAt: now,
                enrolledCount: 0,
                expiresAt: data.expiresAt,
                id: "batch-1",
                maxDevices: data.maxDevices,
                name: data.name,
                providerTokenName: data.providerTokenName,
                qrPayload: data.qrPayload,
                status: "ACTIVE",
                tenantId: "tenant-1",
                token: data.token,
                updatedAt: now,
              }),
            },
          }),
        tenant: {
          findUnique: async () => ({ id: "tenant-1" }),
        },
        policy: {
          findFirst: async () => null,
        },
      } as never,
      connectorRegistry({ createEnrollmentToken }) as never,
    );

    await expect(
      service.createEnrollmentBatch("tenant-1", {
        maxDevices: 50,
        name: "Pilot Grade 5",
      }),
    ).resolves.toMatchObject({
      enrolledCount: 0,
      maxDevices: 50,
      name: "Pilot Grade 5",
      qrPayload: {
        connector: "ANDROID_MANAGEMENT_API",
        tenantId: "tenant-1",
      },
      qrCode: "google-provisioning-json",
      status: "ACTIVE",
    });

    expect(createEnrollmentToken).toHaveBeenCalledWith(
      expect.objectContaining({
        maxDevices: 50,
        tenantId: "tenant-1",
      }),
    );

    expect(auditEvents[0]).toMatchObject({
      action: "enrollment_batch.create",
      object: "EnrollmentBatch",
      outcome: "SUCCESS",
      tenantId: "tenant-1",
    });
  });

  it("records a new quarantined device and increments the batch count", async () => {
    const audit = vi.fn();
    const increment = vi.fn();
    const service = new EnrollmentService(
      {
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            auditEvent: {
              create: audit,
            },
            device: {
              create: async ({ data }: { data: Record<string, unknown> }) => ({
                ...data,
                branchId: null,
                classId: null,
                compliance: "UNKNOWN",
                createdAt: now,
                id: "device-1",
                policyVersion: null,
                status: "PENDING",
                studentId: null,
                updatedAt: now,
              }),
            },
            enrollmentBatch: {
              update: increment,
            },
          }),
        device: {
          findUnique: async () => null,
        },
        enrollmentBatch: {
          findFirst: async () => ({
            createdAt: now,
            enrolledCount: 0,
            expiresAt: null,
            id: "batch-1",
            maxDevices: 10,
            name: "Pilot",
            qrPayload: {},
            status: "ACTIVE",
            tenantId: "tenant-1",
            token: "enroll_token",
            updatedAt: now,
          }),
        },
        tenant: {
          findUnique: async () => ({ id: "tenant-1" }),
        },
      } as never,
      connectorRegistry() as never,
    );

    await expect(
      service.recordDeviceCheckIn("tenant-1", {
        androidVersion: "14",
        enrollmentToken: "enroll_token",
        manufacturer: "Samsung",
        model: "Tab A9",
        serialNumber: "SERIAL-001",
      }),
    ).resolves.toMatchObject({
      device: {
        id: "device-1",
        serialNumber: "SERIAL-001",
        status: "PENDING",
      },
      quarantined: true,
      wasExistingDevice: false,
    });

    expect(increment).toHaveBeenCalledOnce();
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "device.enroll_quarantined",
          object: "Device",
        }),
      }),
    );
  });

  it("rejects duplicate serial check-ins with a different enrollment id", async () => {
    const service = new EnrollmentService(
      {
        device: {
          findUnique: async () => ({
            enrollmentId: "old-enrollment",
            id: "device-1",
            serialNumber: "SERIAL-001",
            tenantId: "tenant-1",
          }),
        },
        enrollmentBatch: {
          findFirst: async () => ({
            enrolledCount: 0,
            expiresAt: null,
            id: "batch-1",
            maxDevices: 10,
          }),
        },
        tenant: {
          findUnique: async () => ({ id: "tenant-1" }),
        },
      } as never,
      connectorRegistry() as never,
    );

    await expect(
      service.recordDeviceCheckIn("tenant-1", {
        enrollmentId: "new-enrollment",
        enrollmentToken: "enroll_token",
        serialNumber: "SERIAL-001",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("blocks assignment to inactive students", async () => {
    const service = new EnrollmentService(
      {
        branch: {
          findFirst: async () => ({ id: "branch-1" }),
        },
        classSection: {
          findFirst: async () => null,
        },
        device: {
          findFirst: async () => ({
            branchId: null,
            classId: null,
            id: "device-1",
            status: "PENDING",
            studentId: null,
            tags: [],
            tenantId: "tenant-1",
          }),
        },
        student: {
          findFirst: async () => ({ id: "student-1", status: "WITHDRAWN" }),
        },
      } as never,
      connectorRegistry() as never,
    );

    await expect(
      service.assignDevice("tenant-1", "device-1", {
        reason: "Reassign for new term",
        studentId: "student-1",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("closes the prior assignment and preserves reassignment history", async () => {
    const closeAssignments = vi.fn();
    const createAssignment = vi.fn();
    const service = new EnrollmentService(
      {
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            auditEvent: { create: vi.fn() },
            device: {
              update: async () => ({
                androidVersion: null,
                branchId: null,
                classId: null,
                compliance: "UNKNOWN",
                connectorDeviceName: null,
                enrollmentBatchId: null,
                enrollmentId: null,
                health: "UNKNOWN",
                id: "device-1",
                lastCheckInAt: null,
                manufacturer: null,
                mdmConnector: "ANDROID_MANAGEMENT_API",
                model: null,
                policyVersion: null,
                serialNumber: "SERIAL-1",
                status: "ONLINE",
                studentId: "student-2",
                tags: [],
                tenantId: "tenant-1",
              }),
            },
            deviceAssignment: {
              create: createAssignment,
              updateMany: closeAssignments,
            },
          }),
        branch: { findFirst: async () => null },
        classSection: { findFirst: async () => null },
        device: {
          findFirst: async () => ({
            id: "device-1",
            branchId: null,
            classId: null,
            status: "ONLINE",
            studentId: "student-1",
            tags: [],
            tenantId: "tenant-1",
          }),
        },
        student: {
          findFirst: async () => ({ id: "student-2", status: "ACTIVE" }),
        },
      } as never,
      connectorRegistry() as never,
    );

    await service.assignDevice("tenant-1", "device-1", {
      studentId: "student-2",
      reason: "Student transfer",
    });

    expect(closeAssignments).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ endedAt: null }),
      }),
    );
    expect(createAssignment).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          studentId: "student-2",
          reason: "Student transfer",
        }),
      }),
    );
  });

  it("retires a device, closes ownership, and writes lifecycle and audit records", async () => {
    const lifecycle = vi.fn();
    const audit = vi.fn();
    const closeAssignments = vi.fn();
    const service = new EnrollmentService(
      {
        device: {
          findFirst: async () => ({
            androidVersion: null,
            branchId: null,
            classId: null,
            compliance: "UNKNOWN",
            connectorDeviceName: "enterprises/e/devices/d",
            enrollmentBatchId: null,
            enrollmentId: "enrollment-1",
            health: "UNKNOWN",
            id: "device-1",
            lastCheckInAt: null,
            manufacturer: null,
            mdmConnector: "ANDROID_MANAGEMENT_API",
            model: null,
            policyVersion: 4,
            serialNumber: "SERIAL-1",
            status: "ONLINE",
            studentId: "student-1",
            tags: [],
            tenantId: "tenant-1",
          }),
        },
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            auditEvent: { create: audit },
            deviceAssignment: { updateMany: closeAssignments },
            deviceLifecycleEvent: { create: lifecycle },
            device: {
              update: async ({ data }: { data: Record<string, unknown> }) => ({
                androidVersion: null,
                compliance: "UNKNOWN",
                enrollmentBatchId: null,
                health: "UNKNOWN",
                id: "device-1",
                lastCheckInAt: null,
                manufacturer: null,
                mdmConnector: "ANDROID_MANAGEMENT_API",
                model: null,
                serialNumber: "SERIAL-1",
                tags: [],
                tenantId: "tenant-1",
                ...data,
              }),
            },
          }),
      } as never,
      connectorRegistry() as never,
    );

    await expect(
      service.retireDevice("tenant-1", "device-1", "Asset disposal"),
    ).resolves.toMatchObject({
      status: "RETIRED",
      studentId: null,
      policyVersion: null,
    });
    expect(closeAssignments).toHaveBeenCalledOnce();
    expect(lifecycle).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "RETIRED",
          reason: "Asset disposal",
        }),
      }),
    );
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "device.retired" }),
      }),
    );
  });

  it("revokes the provider token and records the state change", async () => {
    const deleteEnrollmentToken = vi.fn().mockResolvedValue({
      accepted: true,
      connector: "ANDROID_MANAGEMENT_API",
      tokenName: "enterprises/enterprise-1/enrollmentTokens/token-1",
    });
    const audit = vi.fn();
    const service = new EnrollmentService(
      {
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            auditEvent: { create: audit },
            enrollmentBatch: {
              update: async () => ({
                createdAt: now,
                enrolledCount: 0,
                expiresAt: providerExpiration,
                id: "batch-1",
                maxDevices: 25,
                name: "Pilot",
                providerTokenName:
                  "enterprises/enterprise-1/enrollmentTokens/token-1",
                qrPayload: { qrCode: "google-provisioning-json" },
                status: "REVOKED",
                tenantId: "tenant-1",
                token: "provider-token",
                updatedAt: now,
              }),
            },
          }),
        enrollmentBatch: {
          findFirst: async () => ({
            createdAt: now,
            enrolledCount: 0,
            expiresAt: providerExpiration,
            id: "batch-1",
            maxDevices: 25,
            name: "Pilot",
            providerTokenName:
              "enterprises/enterprise-1/enrollmentTokens/token-1",
            qrPayload: { qrCode: "google-provisioning-json" },
            status: "ACTIVE",
            tenantId: "tenant-1",
            token: "provider-token",
            updatedAt: now,
          }),
        },
      } as never,
      connectorRegistry({ deleteEnrollmentToken }) as never,
    );

    await expect(
      service.revokeEnrollmentBatch("tenant-1", "batch-1"),
    ).resolves.toMatchObject({
      id: "batch-1",
      status: "REVOKED",
    });
    expect(deleteEnrollmentToken).toHaveBeenCalledWith({
      tenantId: "tenant-1",
      tokenName: "enterprises/enterprise-1/enrollmentTokens/token-1",
    });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "enrollment_batch.revoke",
          outcome: "SUCCESS",
        }),
      }),
    );
  });
});
