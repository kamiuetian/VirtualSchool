import { describe, expect, it, vi } from "vitest";
import { WorkerJobsService } from "./worker-jobs.service";

const now = new Date("2026-05-17T10:00:00.000Z");

function command(overrides: Record<string, unknown> = {}) {
  return {
    attempts: 0,
    completedAt: null,
    connectorCommandId: null,
    createdAt: now,
    deliveredAt: null,
    deviceId: "device-1",
    expiresAt: new Date("2026-05-17T09:00:00.000Z"),
    failureReason: null,
    id: "command-1",
    lastAttemptAt: null,
    maxAttempts: 3,
    payload: {
      appId: "app-1",
      appName: "Math App",
      packageId: "com.example.math",
    },
    reason: "deploy app",
    requestedBy: "admin-1",
    result: null,
    status: "QUEUED",
    tenantId: "tenant-1",
    type: "APP_INSTALL",
    updatedAt: now,
    ...overrides,
  };
}

function retentionSettings(overrides: Record<string, unknown> = {}) {
  return {
    auditRetentionDays: null,
    commandHistoryRetentionDays: 365,
    createdAt: now,
    diagnosticRetentionDays: 90,
    exportArtifactRetentionDays: 30,
    id: "retention-1",
    resolvedAlertRetentionDays: 180,
    supportNoteRetentionDays: 730,
    tenantId: "tenant-1",
    updatedAt: now,
    updatedBy: null,
    ...overrides,
  };
}

describe("WorkerJobsService", () => {
  it("expires overdue deployment commands and creates alerts", async () => {
    const createAlert = vi.fn();
    const service = new WorkerJobsService({
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          auditEvent: {
            create: vi.fn(),
          },
          deviceAlert: {
            create: createAlert,
            findFirst: vi.fn().mockResolvedValue(null),
            updateMany: vi.fn(),
          },
          remoteCommand: {
            update: async ({ data }: { data: Record<string, unknown> }) =>
              command({
                completedAt: data.completedAt,
                failureReason: data.failureReason,
                status: data.status,
              }),
          },
        }),
      remoteCommand: {
        findMany: vi.fn().mockResolvedValue([command()]),
      },
      tenant: {
        findMany: async () => [{ id: "tenant-1" }],
      },
    } as never);

    await expect(
      service.processJob("commands.dispatch", {}),
    ).resolves.toMatchObject({
      details: [
        {
          expired: 1,
          tenantId: "tenant-1",
        },
      ],
      processed: 1,
    });
    expect(createAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: "WORKER_COMMAND_RECONCILIATION",
          type: "APP_DEPLOYMENT_FAILED",
        }),
      }),
    );
  });

  it("creates offline alerts for stale devices", async () => {
    const audit = vi.fn();
    const alert = vi.fn();
    const service = new WorkerJobsService({
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          auditEvent: {
            create: audit,
          },
          deviceAlert: {
            create: alert,
            findFirst: vi.fn().mockResolvedValue(null),
          },
        }),
      device: {
        findMany: async () => [
          {
            id: "device-1",
            lastCheckInAt: null,
            serialNumber: "SERIAL-001",
          },
        ],
      },
      tenant: {
        findMany: async () => [{ id: "tenant-1" }],
      },
    } as never);

    await expect(
      service.processJob("alerts.offline-scan", {}),
    ).resolves.toMatchObject({
      details: [
        {
          alertsCreatedOrUpdated: 1,
          evaluatedDevices: 1,
        },
      ],
    });
    expect(alert).toHaveBeenCalledOnce();
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "device_alert.offline_scan",
          outcome: "SUCCESS",
        }),
      }),
    );
  });

  it("records retention dry-run results", async () => {
    const runCreate = vi.fn(
      async ({ data }: { data: Record<string, unknown> }) => ({
        actorId: data.actorId,
        completedAt: now,
        createdAt: now,
        id: "run-1",
        mode: data.mode,
        reason: data.reason,
        startedAt: now,
        status: data.status,
        tenantId: data.tenantId,
      }),
    );
    const service = new WorkerJobsService({
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          auditEvent: {
            create: vi.fn(),
          },
          dataRetentionRun: {
            create: runCreate,
          },
        }),
      auditEvent: {
        count: async () => 0,
      },
      deviceAlert: {
        count: async () => 1,
      },
      deviceDiagnostic: {
        count: async () => 2,
      },
      remoteCommand: {
        count: async () => 3,
      },
      retentionSettings: {
        findUnique: async () => retentionSettings(),
      },
      supportNote: {
        count: async () => 4,
      },
      tenant: {
        findMany: async () => [{ id: "tenant-1" }],
      },
    } as never);

    await expect(
      service.processJob("retention.dry-run", {}),
    ).resolves.toMatchObject({
      details: [
        {
          job: "retention.dry-run",
          tenantId: "tenant-1",
        },
      ],
    });
    expect(runCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: "worker",
          mode: "DRY_RUN",
        }),
      }),
    );
  });
});
