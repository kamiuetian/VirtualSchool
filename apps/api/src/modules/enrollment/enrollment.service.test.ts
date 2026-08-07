import { BadRequestException, ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { EnrollmentService } from "./enrollment.service";

const now = new Date("2026-05-17T10:00:00.000Z");

describe("EnrollmentService", () => {
  it("creates an enrollment batch with a QR payload and audit event", async () => {
    const auditEvents: unknown[] = [];
    const service = new EnrollmentService({
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
    } as never);

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
        connector: "android-management-api",
        tenantId: "tenant-1",
      },
      status: "ACTIVE",
    });

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
    const service = new EnrollmentService({
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
    } as never);

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
    const service = new EnrollmentService({
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
    } as never);

    await expect(
      service.recordDeviceCheckIn("tenant-1", {
        enrollmentId: "new-enrollment",
        enrollmentToken: "enroll_token",
        serialNumber: "SERIAL-001",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("blocks assignment to inactive students", async () => {
    const service = new EnrollmentService({
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
    } as never);

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
    const service = new EnrollmentService({
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
    } as never);

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
    const service = new EnrollmentService({
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
    } as never);

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
});
