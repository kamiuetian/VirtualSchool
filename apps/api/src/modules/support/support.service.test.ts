import { describe, expect, it, vi } from "vitest";
import { SupportService } from "./support.service";

const now = new Date("2026-05-17T10:00:00.000Z");
const older = new Date("2026-05-16T10:00:00.000Z");

function supportNote(overrides: Record<string, unknown> = {}) {
  return {
    authorEmail: "support@example.com",
    authorId: "support-1",
    body: "Investigating app deployment",
    category: "DEPLOYMENT",
    createdAt: older,
    deviceId: "device-1",
    id: "note-1",
    pinned: true,
    resolution: null,
    severity: "S2",
    status: "OPEN",
    tenantId: "tenant-1",
    updatedAt: now,
    visibility: "INTERNAL",
    ...overrides,
  };
}

function retentionSettings(overrides: Record<string, unknown> = {}) {
  return {
    auditRetentionDays: null,
    commandHistoryRetentionDays: 365,
    createdAt: older,
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

function retentionRun(overrides: Record<string, unknown> = {}) {
  return {
    actorId: "admin-1",
    completedAt: now,
    createdAt: now,
    cutoffs: {
      auditEvents: null,
      diagnostics: "2026-02-16T10:00:00.000Z",
      exportArtifacts: "2026-04-17T10:00:00.000Z",
      remoteCommands: "2025-05-17T10:00:00.000Z",
      resolvedAlerts: "2025-11-18T10:00:00.000Z",
      supportNotes: "2024-05-17T10:00:00.000Z",
    },
    id: "run-1",
    mode: "APPLY",
    reason: "scheduled cleanup",
    result: {
      auditEvents: 0,
      diagnostics: 2,
      exportArtifacts: 0,
      remoteCommands: 1,
      resolvedAlerts: 1,
      supportNotes: 1,
    },
    startedAt: now,
    status: "COMPLETED",
    tenantId: "tenant-1",
    ...overrides,
  };
}

describe("SupportService", () => {
  it("creates device support notes with audit context", async () => {
    const audit = vi.fn();
    const service = new SupportService({
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          auditEvent: {
            create: audit,
          },
          supportNote: {
            create: async ({ data }: { data: Record<string, unknown> }) =>
              supportNote(data),
          },
        }),
      device: {
        findFirst: async () => ({ id: "device-1" }),
      },
    } as never);

    await expect(
      service.createDeviceSupportNote(
        "tenant-1",
        "device-1",
        {
          body: "Investigating app deployment",
          category: "DEPLOYMENT",
          pinned: true,
          severity: "S2",
        },
        {
          email: "support@example.com",
          subject: "support-1",
        },
      ),
    ).resolves.toMatchObject({
      authorId: "support-1",
      category: "DEPLOYMENT",
      pinned: true,
      severity: "S2",
    });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "support_note.create",
          actorId: "support-1",
          object: "SupportNote",
          outcome: "CREATED",
        }),
      }),
    );
  });

  it("builds a device support timeline from notes, commands, diagnostics, and alerts", async () => {
    const service = new SupportService({
      device: {
        findFirst: async () => ({ id: "device-1" }),
      },
      deviceAlert: {
        findMany: async () => [
          {
            createdAt: older,
            deviceId: "device-1",
            id: "alert-1",
            lastSeenAt: older,
            message: "App deployment failed",
            severity: "WARNING",
            source: "COMMAND_RECONCILIATION",
            status: "OPEN",
            tenantId: "tenant-1",
            title: "App deployment failed",
            type: "APP_DEPLOYMENT_FAILED",
          },
        ],
      },
      deviceDiagnostic: {
        findMany: async () => [
          {
            batteryLevel: 90,
            compliance: "COMPLIANT",
            deviceId: "device-1",
            health: "CHECKED_IN",
            id: "diagnostic-1",
            networkStatus: "WIFI",
            policyVersion: 2,
            reportedAt: now,
            storageFreeMb: 4096,
            tenantId: "tenant-1",
          },
        ],
      },
      remoteCommand: {
        findMany: async () => [
          {
            attempts: 1,
            deviceId: "device-1",
            failureReason: null,
            id: "command-1",
            maxAttempts: 3,
            reason: "Refresh app deployment",
            status: "EXECUTED",
            tenantId: "tenant-1",
            type: "APP_INSTALL",
            updatedAt: now,
          },
        ],
      },
      supportNote: {
        findMany: async () => [supportNote()],
      },
    } as never);

    await expect(
      service.getDeviceSupportTimeline("tenant-1", "device-1", 10),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "SUPPORT_NOTE" }),
        expect.objectContaining({ type: "REMOTE_COMMAND" }),
        expect.objectContaining({ type: "DEVICE_DIAGNOSTIC" }),
        expect.objectContaining({ type: "DEVICE_ALERT" }),
      ]),
    );
  });

  it("updates retention settings with an audit record", async () => {
    const audit = vi.fn();
    const service = new SupportService({
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          auditEvent: {
            create: audit,
          },
          retentionSettings: {
            update: async ({ data }: { data: Record<string, unknown> }) =>
              retentionSettings({
                ...data,
                updatedBy: "admin-1",
              }),
          },
        }),
      retentionSettings: {
        findUnique: async () => retentionSettings(),
      },
      tenant: {
        findUnique: async () => ({ id: "tenant-1" }),
      },
    } as never);

    await expect(
      service.updateRetentionSettings(
        "tenant-1",
        {
          diagnosticRetentionDays: 120,
        },
        "admin-1",
      ),
    ).resolves.toMatchObject({
      diagnosticRetentionDays: 120,
      updatedBy: "admin-1",
    });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "retention_settings.update",
          actorId: "admin-1",
          outcome: "UPDATED",
        }),
      }),
    );
  });

  it("applies retention cleanup and records a retention run", async () => {
    const runCreate = vi.fn(async () => retentionRun());
    const audit = vi.fn();
    const service = new SupportService({
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          auditEvent: {
            create: audit,
          },
          dataRetentionRun: {
            create: runCreate,
          },
        }),
      auditEvent: {
        deleteMany: async () => ({ count: 0 }),
      },
      deviceAlert: {
        deleteMany: async () => ({ count: 1 }),
      },
      deviceDiagnostic: {
        deleteMany: async () => ({ count: 2 }),
      },
      remoteCommand: {
        deleteMany: async () => ({ count: 1 }),
      },
      retentionSettings: {
        findUnique: async () => retentionSettings(),
      },
      supportNote: {
        deleteMany: async () => ({ count: 1 }),
      },
      tenant: {
        findUnique: async () => ({ id: "tenant-1" }),
      },
    } as never);

    await expect(
      service.applyRetention(
        "tenant-1",
        {
          reason: "scheduled cleanup",
        },
        "admin-1",
      ),
    ).resolves.toMatchObject({
      mode: "APPLY",
      result: {
        diagnostics: 2,
        remoteCommands: 1,
        resolvedAlerts: 1,
        supportNotes: 1,
      },
    });
    expect(runCreate).toHaveBeenCalledOnce();
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "retention.apply",
          outcome: "COMPLETED",
        }),
      }),
    );
  });
});
