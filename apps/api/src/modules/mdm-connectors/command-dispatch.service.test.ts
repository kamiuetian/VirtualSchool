import { describe, expect, it, vi } from "vitest";
import { CommandDispatchService } from "./command-dispatch.service";

const now = new Date("2026-05-17T10:00:00.000Z");

function command(overrides: Record<string, unknown> = {}) {
  return {
    attempts: 0,
    completedAt: null,
    connectorCommandId: null,
    createdAt: now,
    deliveredAt: null,
    device: {
      connectorDeviceName: "enterprises/example/devices/device-1",
      enrollmentId: "device-1",
      id: "device-1",
      mdmConnector: "ANDROID_MANAGEMENT_API",
      tenantId: "tenant-1",
    },
    deviceId: "device-1",
    expiresAt: new Date("2030-05-17T11:00:00.000Z"),
    failureReason: null,
    id: "command-1",
    lastAttemptAt: null,
    maxAttempts: 3,
    payload: {},
    reason: "Class start",
    requestedBy: "admin-1",
    result: null,
    status: "QUEUED",
    tenantId: "tenant-1",
    type: "LOCK",
    updatedAt: now,
    ...overrides,
  };
}

describe("CommandDispatchService", () => {
  it("dispatches queued commands through the active connector", async () => {
    const audit = vi.fn();
    const dispatchCommand = vi.fn().mockResolvedValue({
      accepted: true,
      connector: "STUB",
      connectorCommandId: "stub:command-1",
      operationName: "stub:command-1",
      request: {
        type: "LOCK",
      },
      response: {
        acceptedAt: now.toISOString(),
      },
    });
    const service = new CommandDispatchService(
      {
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            auditEvent: {
              create: audit,
            },
            remoteCommand: {
              update: async ({ data }: { data: Record<string, unknown> }) =>
                command({
                  connectorCommandId: data.connectorCommandId,
                  result: data.result,
                  status: data.status,
                }),
            },
          }),
        remoteCommand: {
          findMany: vi.fn().mockResolvedValueOnce([command()]),
          update: async ({ data }: { data: Record<string, unknown> }) =>
            command({
              attempts: 1,
              deliveredAt: data.deliveredAt,
              lastAttemptAt: data.lastAttemptAt,
              status: "DELIVERED",
            }),
          updateMany: vi.fn(),
        },
      } as never,
      {
        getActiveConnector: () => ({
          dispatchCommand,
          key: "STUB",
        }),
      } as never,
    );

    await expect(
      service.dispatchQueuedCommands("tenant-1", 10),
    ).resolves.toMatchObject({
      accepted: 1,
      attempted: 1,
      commands: [
        {
          commandId: "command-1",
          connectorCommandId: "stub:command-1",
          status: "DELIVERED",
        },
      ],
      connector: "STUB",
      failed: 0,
    });
    expect(dispatchCommand).toHaveBeenCalledOnce();
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "remote_command.dispatch",
          outcome: "DELIVERED",
        }),
      }),
    );
  });

  it("fails non-retryable connector rejections", async () => {
    const service = new CommandDispatchService(
      {
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            auditEvent: {
              create: vi.fn(),
            },
            remoteCommand: {
              update: async ({ data }: { data: Record<string, unknown> }) =>
                command({
                  completedAt: data.completedAt,
                  failureReason: data.failureReason,
                  result: data.result,
                  status: data.status,
                }),
            },
          }),
        remoteCommand: {
          findMany: vi.fn().mockResolvedValueOnce([command()]),
          update: async ({ data }: { data: Record<string, unknown> }) =>
            command({
              attempts: 1,
              deliveredAt: data.deliveredAt,
              lastAttemptAt: data.lastAttemptAt,
              status: "DELIVERED",
            }),
          updateMany: vi.fn(),
        },
      } as never,
      {
        getActiveConnector: () => ({
          dispatchCommand: vi.fn().mockResolvedValue({
            accepted: false,
            connector: "ANDROID_MANAGEMENT_API",
            failureReason: "Unsupported command",
            retryable: false,
          }),
          key: "ANDROID_MANAGEMENT_API",
        }),
      } as never,
    );

    await expect(
      service.dispatchQueuedCommands("tenant-1", 10),
    ).resolves.toMatchObject({
      accepted: 0,
      failed: 1,
      commands: [
        {
          failureReason: "Unsupported command",
          status: "FAILED",
        },
      ],
    });
  });

  it("leaves app deployment commands for device-side claim instead of MDM issueCommand", async () => {
    const dispatchCommand = vi.fn();
    const findMany = vi.fn().mockResolvedValueOnce([]);
    const service = new CommandDispatchService(
      {
        remoteCommand: {
          findMany,
          updateMany: vi.fn(),
        },
      } as never,
      {
        getActiveConnector: () => ({
          dispatchCommand,
          key: "ANDROID_MANAGEMENT_API",
        }),
      } as never,
    );

    await expect(
      service.dispatchQueuedCommands("tenant-1", 10),
    ).resolves.toMatchObject({
      attempted: 0,
      commands: [],
    });
    expect(dispatchCommand).not.toHaveBeenCalled();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: {
            in: ["LOCK", "WIPE"],
          },
        }),
      }),
    );
  });
});
