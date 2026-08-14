import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { EnrollmentService } from "./enrollment.service";

const now = new Date("2026-08-09T12:00:00.000Z");
const device = (id: string, serialNumber: string, assigned = false) => ({
  androidVersion: "14",
  branchId: assigned ? "branch-1" : null,
  classId: assigned ? "class-1" : null,
  compliance: "COMPLIANT",
  connectorDeviceName: null,
  enrollmentBatchId: null,
  enrollmentId: `enroll-${id}`,
  health: "HEALTHY",
  id,
  lastCheckInAt: now,
  manufacturer: "Vendor",
  mdmConnector: "ANDROID_MANAGEMENT_API",
  model: "Tablet",
  ownershipType: "SCHOOL_OWNED",
  policyVersion: 4,
  serialNumber,
  status: "ONLINE",
  studentId: assigned ? "student-1" : null,
  tags: ["grade-5"],
  tenantId: "tenant-1",
  createdAt: now,
  updatedAt: now,
});

describe("procurement and replacement lifecycle", () => {
  it("rejects skipped batch transitions and cross-tenant item links", async () => {
    const service = new EnrollmentService(
      {
        procurementBatch: {
          findFirst: async () => ({
            id: "batch-1",
            tenantId: "tenant-1",
            status: "PURCHASED",
          }),
        },
        procurementDevice: { findFirst: async () => null },
        device: { findFirst: async () => device("device-1", "SERIAL-1") },
      } as never,
      {} as never,
    );

    await expect(
      service.advanceProcurementBatch("tenant-1", "batch-1", {
        status: "SHIPPED",
        reason: "Skip",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.linkProcurementDevice("tenant-1", "batch-1", "foreign-item", {
        deviceId: "device-1",
        reason: "Link",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("atomically transfers assignment and preserves support, custody, and audit evidence", async () => {
    const calls = {
      assignmentsClosed: vi.fn(),
      assignmentsCreated: vi.fn(),
      audit: vi.fn(),
      custody: vi.fn(),
      lifecycle: vi.fn(),
      notes: vi.fn(),
      updates: vi.fn(),
    };
    const original = device("old", "OLD-001", true);
    const replacement = device("new", "NEW-001");
    const service = new EnrollmentService(
      {
        device: {
          findFirst: async ({ where }: { where: { id: string } }) =>
            where.id === "old" ? original : replacement,
        },
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            auditEvent: { create: calls.audit },
            deviceAssignment: {
              updateMany: calls.assignmentsClosed,
              create: calls.assignmentsCreated,
            },
            device: { update: calls.updates },
            deviceCustodyEvent: { create: calls.custody },
            deviceLifecycleEvent: { create: calls.lifecycle },
            supportNote: { create: calls.notes },
            deviceReplacement: {
              create: async ({ data }: { data: Record<string, unknown> }) => ({
                id: "replacement-1",
                createdAt: now,
                rmaNumber: null,
                ...data,
              }),
            },
          }),
      } as never,
      {} as never,
    );

    await expect(
      service.replaceDevice("tenant-1", "old", {
        replacementDeviceId: "new",
        reason: "Failed charging port",
      }),
    ).resolves.toMatchObject({
      originalDeviceId: "old",
      replacementDeviceId: "new",
      reason: "Failed charging port",
    });
    expect(calls.assignmentsClosed).toHaveBeenCalledOnce();
    expect(calls.assignmentsCreated).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deviceId: "new",
          studentId: "student-1",
          classId: "class-1",
        }),
      }),
    );
    expect(calls.notes).toHaveBeenCalledTimes(2);
    expect(calls.custody).toHaveBeenCalledTimes(2);
    expect(calls.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "device.replace",
          tenantId: "tenant-1",
        }),
      }),
    );
  });
});
