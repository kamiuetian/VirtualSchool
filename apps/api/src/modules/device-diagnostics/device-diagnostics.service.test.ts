import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { DeviceDiagnosticsService } from "./device-diagnostics.service";

const now = new Date("2026-05-17T10:00:00.000Z");

function device(overrides: Record<string, unknown> = {}) {
  return {
    androidVersion: "14",
    branchId: null,
    classId: null,
    compliance: "UNKNOWN",
    connectorDeviceName: "enterprises/example/devices/device-1",
    createdAt: now,
    enrollmentBatchId: "batch-1",
    enrollmentId: "device-1",
    health: "CHECKED_IN",
    id: "device-1",
    lastCheckInAt: now,
    manufacturer: "Samsung",
    mdmConnector: "ANDROID_MANAGEMENT_API",
    model: "Tab A",
    ownershipType: "SCHOOL_OWNED",
    policyVersion: null,
    serialNumber: "SERIAL-001",
    status: "ONLINE",
    studentId: null,
    tags: [],
    tenantId: "tenant-1",
    updatedAt: now,
    ...overrides,
  };
}

function diagnostic(overrides: Record<string, unknown> = {}) {
  return {
    batteryLevel: 9,
    browserVersion: "1.0.0",
    compliance: "NON_COMPLIANT",
    createdAt: now,
    details: {
      launcherState: "foreground",
    },
    deviceId: "device-1",
    health: "CHECKED_IN",
    id: "diagnostic-1",
    launcherVersion: "1.0.0",
    mdmPolicyName: "policy-name",
    networkStatus: "WIFI",
    policyVersion: 2,
    reportedAt: now,
    storageFreeMb: 2048,
    tenantId: "tenant-1",
    ...overrides,
  };
}

function alert(overrides: Record<string, unknown> = {}) {
  return {
    acknowledgedAt: null,
    acknowledgedBy: null,
    createdAt: now,
    deviceId: "device-1",
    firstSeenAt: now,
    id: "alert-1",
    lastSeenAt: now,
    message: "Battery level is 9%.",
    metadata: {
      batteryLevel: 9,
    },
    resolutionNote: null,
    resolvedAt: null,
    resolvedBy: null,
    severity: "CRITICAL",
    source: "DIAGNOSTIC",
    status: "OPEN",
    tenantId: "tenant-1",
    title: "Battery low",
    type: "BATTERY_LOW",
    updatedAt: now,
    ...overrides,
  };
}

describe("DeviceDiagnosticsService", () => {
  it("stores diagnostics, updates device state, and opens alerts", async () => {
    const audit = vi.fn();
    const alertCreate = vi.fn(
      async ({ data }: { data: Record<string, unknown> }) =>
        alert({
          ...data,
          id: `alert-${alertCreate.mock.calls.length}`,
        }),
    );
    const service = new DeviceDiagnosticsService({
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          auditEvent: {
            create: audit,
          },
          device: {
            update: async ({ data }: { data: Record<string, unknown> }) =>
              device(data),
          },
          deviceAlert: {
            create: alertCreate,
            findFirst: async () => null,
            findMany: async () => [],
          },
          deviceDiagnostic: {
            create: async ({ data }: { data: Record<string, unknown> }) =>
              diagnostic(data),
          },
        }),
      device: {
        findFirst: async () => device({ status: "PENDING" }),
      },
    } as never);

    await expect(
      service.uploadDeviceDiagnostic("tenant-1", "device-1", {
        batteryLevel: 9,
        compliance: "NON_COMPLIANT",
        health: "CHECKED_IN",
        launcherVersion: "1.0.0",
        networkStatus: "WIFI",
        policyVersion: 2,
        reportedAt: now.toISOString(),
        storageFreeMb: 2048,
      }),
    ).resolves.toMatchObject({
      alerts: expect.arrayContaining([
        expect.objectContaining({
          severity: "CRITICAL",
          type: "BATTERY_LOW",
        }),
        expect.objectContaining({
          type: "DEVICE_NON_COMPLIANT",
        }),
      ]),
      device: {
        policyVersion: 2,
        status: "ONLINE",
      },
      diagnostic: {
        batteryLevel: 9,
      },
    });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "device_diagnostic.upload",
          outcome: "RECORDED",
        }),
      }),
    );
  });

  it("resolves low battery and offline alerts when diagnostics recover", async () => {
    const updateMany = vi.fn();
    const service = new DeviceDiagnosticsService({
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          auditEvent: {
            create: vi.fn(),
          },
          device: {
            update: async () => device(),
          },
          deviceAlert: {
            create: vi.fn(),
            findFirst: async () => null,
            findMany: async ({ where }: { where: { type: string } }) =>
              ["BATTERY_LOW", "DEVICE_OFFLINE"].includes(where.type)
                ? [{ id: `${where.type}-alert` }]
                : [],
            updateMany,
          },
          deviceDiagnostic: {
            create: async ({ data }: { data: Record<string, unknown> }) =>
              diagnostic(data),
          },
        }),
      device: {
        findFirst: async () => device(),
      },
    } as never);

    await expect(
      service.uploadDeviceDiagnostic("tenant-1", "device-1", {
        batteryLevel: 80,
        health: "CHECKED_IN",
        networkStatus: "WIFI",
        storageFreeMb: 4096,
      }),
    ).resolves.toMatchObject({
      alerts: [],
      resolvedAlertIds: expect.arrayContaining([
        "BATTERY_LOW-alert",
        "DEVICE_OFFLINE-alert",
      ]),
    });
    expect(updateMany).toHaveBeenCalled();
  });

  it("acknowledges and resolves alerts with audit events", async () => {
    const audit = vi.fn();
    const service = new DeviceDiagnosticsService({
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          auditEvent: {
            create: audit,
          },
          deviceAlert: {
            update: async ({ data }: { data: Record<string, unknown> }) =>
              alert(data),
          },
        }),
      deviceAlert: {
        findFirst: async () => alert(),
      },
    } as never);

    await expect(
      service.acknowledgeAlert(
        "tenant-1",
        "alert-1",
        {
          reason: "Investigating",
        },
        "admin-1",
      ),
    ).resolves.toMatchObject({
      acknowledgedBy: "admin-1",
      status: "ACKNOWLEDGED",
    });
    await expect(
      service.resolveAlert(
        "tenant-1",
        "alert-1",
        {
          reason: "Battery charged",
        },
        "admin-1",
      ),
    ).resolves.toMatchObject({
      resolutionNote: "Battery charged",
      status: "RESOLVED",
    });
    expect(audit).toHaveBeenCalledTimes(2);
  });

  it("creates offline alerts for stale devices", async () => {
    const service = new DeviceDiagnosticsService({
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          auditEvent: {
            create: vi.fn(),
          },
          deviceAlert: {
            create: async ({ data }: { data: Record<string, unknown> }) =>
              alert({
                ...data,
                type: "DEVICE_OFFLINE",
              }),
            findFirst: async () => null,
          },
        }),
      device: {
        findMany: async () => [
          device({
            lastCheckInAt: new Date("2026-05-17T08:00:00.000Z"),
          }),
        ],
      },
      tenant: {
        findUnique: async () => ({ id: "tenant-1" }),
      },
    } as never);

    await expect(
      service.scanOfflineAlerts("tenant-1", {
        offlineAfterMinutes: 30,
      }),
    ).resolves.toMatchObject({
      alertsCreatedOrUpdated: 1,
      evaluatedDevices: 1,
      alerts: [
        {
          type: "DEVICE_OFFLINE",
        },
      ],
    });
  });

  it("throws for diagnostics outside the tenant scope", async () => {
    const service = new DeviceDiagnosticsService({
      device: {
        findFirst: async () => null,
      },
    } as never);

    await expect(
      service.uploadDeviceDiagnostic("tenant-1", "device-1", {
        batteryLevel: 50,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
