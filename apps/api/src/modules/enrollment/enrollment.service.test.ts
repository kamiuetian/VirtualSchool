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
        studentId: "student-1",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
