import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { TimetableService } from "./timetable.service";

const now = new Date("2026-05-18T08:30:00.000Z");
const timetableRules = {
  approvedAppPackageIds: [],
  defaultWebAccess: "DENY",
  launcher: {
    showMessages: true,
    showSupportContact: true,
  },
  mode: "TIMETABLE_CLASS",
  restrictions: {
    blockAppInstall: true,
    blockSafeMode: true,
    blockSettings: true,
  },
  urlAllowlist: [],
  urlBlocklist: [],
  webShortcuts: [],
};
const policy = {
  createdAt: now,
  id: "policy-1",
  name: "Class Mode",
  rules: timetableRules,
  status: "PUBLISHED",
  tenantId: "tenant-1",
  updatedAt: now,
  version: 2,
};

function block(overrides: Record<string, unknown> = {}) {
  return {
    active: true,
    actorId: "admin-1",
    branchId: null,
    classId: "class-1",
    createdAt: now,
    dayOfWeek: 1,
    effectiveFrom: null,
    effectiveUntil: null,
    endMinute: 600,
    grade: null,
    id: "block-1",
    name: "Math",
    policy,
    policyId: policy.id,
    reason: "Pilot schedule",
    scope: "CLASS",
    scopeId: "class-1",
    startMinute: 540,
    subject: "Math",
    tenantId: "tenant-1",
    timezone: "UTC",
    updatedAt: now,
    ...overrides,
  };
}

describe("TimetableService", () => {
  it("creates a class timetable block with audit logging", async () => {
    const audit = vi.fn();
    const service = new TimetableService({
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          auditEvent: {
            create: audit,
          },
          timetableBlock: {
            create: async ({ data }: { data: Record<string, unknown> }) =>
              block(data),
          },
        }),
      branch: {
        findFirst: async () => null,
      },
      classSection: {
        findFirst: async () => ({ id: "class-1" }),
      },
      policy: {
        findFirst: async () => policy,
      },
      tenant: {
        findUnique: async () => ({ id: "tenant-1" }),
      },
      timetableBlock: {
        findFirst: async () => null,
      },
    } as never);

    await expect(
      service.createBlock("tenant-1", {
        dayOfWeek: 1,
        endMinute: 600,
        name: "Math",
        policyId: "policy-1",
        reason: "Pilot schedule",
        scope: "CLASS",
        scopeId: "class-1",
        startMinute: 540,
        subject: "Math",
        timezone: "UTC",
      }),
    ).resolves.toMatchObject({
      id: "block-1",
      policyName: "Class Mode",
      scope: "CLASS",
    });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "timetable_block.create",
          outcome: "SUCCESS",
        }),
      }),
    );
  });

  it("rejects timetable blocks using non-timetable policies", async () => {
    const service = new TimetableService({
      branch: {
        findFirst: async () => null,
      },
      policy: {
        findFirst: async () => ({
          ...policy,
          rules: {
            ...timetableRules,
            mode: "DEFAULT_SCHOOL",
          },
        }),
      },
      tenant: {
        findUnique: async () => ({ id: "tenant-1" }),
      },
    } as never);

    await expect(
      service.createBlock("tenant-1", {
        dayOfWeek: 1,
        endMinute: 600,
        name: "Math",
        policyId: "policy-1",
        scope: "TENANT",
        startMinute: 540,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects overlapping active blocks for the same scope", async () => {
    const service = new TimetableService({
      branch: {
        findFirst: async () => null,
      },
      classSection: {
        findFirst: async () => ({ id: "class-1" }),
      },
      policy: {
        findFirst: async () => policy,
      },
      tenant: {
        findUnique: async () => ({ id: "tenant-1" }),
      },
      timetableBlock: {
        findFirst: async () => ({ id: "existing-block" }),
      },
    } as never);

    await expect(
      service.createBlock("tenant-1", {
        dayOfWeek: 1,
        endMinute: 600,
        name: "Math",
        policyId: "policy-1",
        scope: "CLASS",
        scopeId: "class-1",
        startMinute: 540,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("resolves the active class block for a device and local time", async () => {
    const service = new TimetableService({
      academicCalendarException: { findMany: async () => [] },
      device: {
        findFirst: async () => ({
          classId: "class-1",
          id: "device-1",
          student: {
            grade: "5",
            id: "student-1",
          },
          studentId: "student-1",
          tenant: {
            timezone: "UTC",
          },
          tenantId: "tenant-1",
        }),
      },
      timetableBlock: {
        findMany: async () => [
          block({
            scope: "GRADE",
            scopeId: "5",
          }),
          block({
            id: "class-block",
            scope: "CLASS",
            scopeId: "class-1",
          }),
        ],
      },
    } as never);

    await expect(
      service.resolveActiveBlockForDevice(
        "tenant-1",
        "device-1",
        new Date("2026-05-18T09:30:00.000Z"),
      ),
    ).resolves.toMatchObject({
      activeBlock: {
        id: "class-block",
      },
      activePolicy: {
        id: "policy-1",
      },
      evaluated: expect.arrayContaining([
        expect.objectContaining({
          scope: "CLASS",
        }),
      ]),
    });
  });

  it("applies a tenant-local closure across the UTC date boundary", async () => {
    const exception = {
      active: true,
      actorId: "admin-1",
      createdAt: now,
      endMinute: null,
      id: "holiday-1",
      kind: "CLOSED",
      localDate: "2026-05-19",
      name: "School holiday",
      policy: null,
      policyId: null,
      reason: "Public holiday",
      scope: "TENANT",
      scopeId: null,
      startMinute: null,
      tenantId: "tenant-1",
      timezone: null,
      updatedAt: now,
    };
    const service = new TimetableService({
      academicCalendarException: { findMany: async () => [exception] },
      device: {
        findFirst: async () => ({
          classId: "class-1",
          id: "device-1",
          student: { grade: "5", id: "student-1" },
          tenant: { timezone: "Asia/Karachi" },
          tenantId: "tenant-1",
        }),
      },
      timetableBlock: { findMany: async () => [block({ dayOfWeek: 2 })] },
    } as never);

    await expect(
      service.resolveActiveBlockForDevice(
        "tenant-1",
        "device-1",
        new Date("2026-05-18T19:30:00.000Z"),
      ),
    ).resolves.toMatchObject({
      activeBlock: null,
      activeException: { id: "holiday-1", kind: "CLOSED" },
      activePolicy: null,
      timezone: "Asia/Karachi",
    });
  });

  it("throws when resolving a device outside the tenant scope", async () => {
    const service = new TimetableService({
      device: {
        findFirst: async () => null,
      },
    } as never);

    await expect(
      service.resolveActiveBlockForDevice("tenant-1", "device-1"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
