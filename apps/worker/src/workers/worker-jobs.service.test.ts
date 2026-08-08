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
  it("creates explainable, deduplicated engagement-risk alerts", async () => {
    const createAlert = vi.fn().mockResolvedValue({ id: "risk-1" });
    const service = new WorkerJobsService(
      {
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            auditEvent: { create: vi.fn() },
            deviceAlert: { create: createAlert },
          }),
        attendanceRecord: {
          findMany: async () => [
            { status: "ABSENT", studentId: "student-1" },
            { status: "ABSENT", studentId: "student-1" },
            { status: "ABSENT", studentId: "student-1" },
          ],
        },
        device: {
          findMany: async () => [
            {
              id: "device-1",
              lastCheckInAt: null,
              status: "OFFLINE",
              studentId: "student-1",
            },
          ],
        },
        deviceAlert: {
          findMany: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
        },
        guardian: { findMany: async () => [] },
        notificationPreference: {
          findUnique: async () => ({
            complianceFailureThreshold: 3,
            engagementRiskEnabled: true,
            missedSessionThreshold: 3,
            weeklyAdminSummaryEnabled: true,
            weeklyGuardianSummaryEnabled: false,
          }),
        },
        student: { findMany: async () => [{ id: "student-1", name: "Amina" }] },
        tenant: { findMany: async () => [{ id: "tenant-1" }] },
      } as never,
      { dispatchCommand: vi.fn() } as never,
    );

    await expect(
      service.processJob("engagement.scan", {}),
    ).resolves.toMatchObject({
      details: [{ alertsCreated: 2, evaluatedStudents: 1, risks: 1 }],
    });
    expect(createAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          message: expect.stringContaining("3 missed sessions"),
          metadata: expect.objectContaining({
            reasons: expect.any(Array),
            studentId: "student-1",
          }),
          severity: "CRITICAL",
          type: "ENGAGEMENT_RISK",
        }),
      }),
    );
  });

  it("delivers enabled alert email once and records the outcome", async () => {
    const deliveryUpsert = vi.fn(async ({ create }) => ({
      ...create,
      id: "delivery-1",
    }));
    const email = {
      send: vi.fn().mockResolvedValue({
        delivered: true,
        provider: "WEBHOOK",
        providerId: "message-1",
      }),
    };
    const service = new WorkerJobsService(
      {
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            auditEvent: { create: vi.fn() },
            notificationDelivery: { upsert: deliveryUpsert },
          }),
        deviceAlert: {
          findMany: async () => [
            {
              device: { serialNumber: "SERIAL-1" },
              firstSeenAt: now,
              id: "alert-1",
              message: "Device offline",
              metadata: {
                notificationRecipients: ["guardian@example.edu"],
                privacyScope: "LINKED_GUARDIAN",
              },
              severity: "WARNING",
              title: "Device offline",
            },
          ],
        },
        notificationDelivery: { findUnique: async () => null },
        notificationPreference: {
          findUnique: async () => ({
            appFailureEnabled: true,
            lostDeviceEnabled: true,
            offlineEnabled: true,
            policyFailureEnabled: true,
            recipients: ["it@example.edu"],
            repeatedEnrollmentEnabled: true,
          }),
        },
        tenant: {
          findMany: async () => [{ id: "tenant-1" }],
          findUnique: async () => ({
            accentColor: "#315f91",
            logoUrl: "https://assets.example.edu/logo.png",
            name: "Northview School",
            primaryColor: "#116b5f",
            supportEmail: "support@example.edu",
            supportPhone: null,
            websiteUrl: "https://example.edu",
          }),
        },
      } as never,
      { dispatchCommand: vi.fn() } as never,
      email as never,
    );
    await expect(
      service.processJob("notifications.dispatch", {}),
    ).resolves.toMatchObject({ details: [{ delivered: 1, failed: 0 }] });
    expect(email.send).toHaveBeenCalledOnce();
    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({
        branding: expect.objectContaining({ name: "Northview School" }),
        recipient: "guardian@example.edu",
        subject: "[Northview School] Device offline",
      }),
    );
    expect(deliveryUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ status: "DELIVERED" }),
      }),
    );
  });

  it("expires overdue deployment commands and creates alerts", async () => {
    const createAlert = vi.fn();
    const service = new WorkerJobsService(
      {
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
      } as never,
      { dispatchCommand: vi.fn() } as never,
    );

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
    const service = new WorkerJobsService(
      {
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
      } as never,
      { dispatchCommand: vi.fn() } as never,
    );

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
    const service = new WorkerJobsService(
      {
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
      } as never,
      { dispatchCommand: vi.fn() } as never,
    );

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

  it.each([
    {
      expected: { accepted: 1, failed: 0, skipped: 0 },
      result: {
        accepted: true,
        connector: "ANDROID_MANAGEMENT_API",
        connectorCommandId: "operations/command-1",
      },
      status: "DELIVERED",
    },
    {
      expected: { accepted: 0, failed: 0, skipped: 1 },
      result: {
        accepted: false,
        connector: "ANDROID_MANAGEMENT_API",
        failureReason: "temporary Google API failure",
        retryable: true,
      },
      status: "QUEUED",
    },
  ])("records production connector result as $status", async (scenario) => {
    process.env.WORKER_MDM_DISPATCH_ENABLED = "true";
    const dispatchCommand = vi.fn().mockResolvedValue(scenario.result);
    const updates: Record<string, unknown>[] = [];
    const queued = command({
      expiresAt: new Date(Date.now() + 60_000),
      type: "LOCK",
    });
    const service = new WorkerJobsService(
      {
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            auditEvent: { create: vi.fn() },
            remoteCommand: {
              update: async ({ data }: { data: Record<string, unknown> }) => {
                updates.push(data);
                return command({ ...queued, ...data, attempts: 1 });
              },
            },
          }),
        remoteCommand: {
          findMany: vi.fn().mockResolvedValue([
            {
              ...queued,
              device: {
                connectorDeviceName: "enterprises/test/devices/device-1",
                enrollmentId: null,
                id: "device-1",
                tenantId: "tenant-1",
              },
            },
          ]),
          update: async ({ data }: { data: Record<string, unknown> }) =>
            command({ ...queued, ...data, attempts: 1 }),
        },
        tenant: { findMany: async () => [{ id: "tenant-1" }] },
      } as never,
      { dispatchCommand } as never,
    );

    await expect(
      service.processJob("commands.dispatch", {}),
    ).resolves.toMatchObject({ details: [scenario.expected] });
    expect(dispatchCommand).toHaveBeenCalledOnce();
    expect(updates).toContainEqual(
      expect.objectContaining({ status: scenario.status }),
    );
    delete process.env.WORKER_MDM_DISPATCH_ENABLED;
  });
});
