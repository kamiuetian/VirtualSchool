import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { RemoteCommandsService } from "./remote-commands.service";

const now = new Date("2026-05-17T10:00:00.000Z");

function command(overrides: Record<string, unknown> = {}) {
  return {
    attempts: 0,
    completedAt: null,
    connectorCommandId: null,
    createdAt: now,
    deliveredAt: null,
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

describe("RemoteCommandsService", () => {
  it("queues non-destructive commands with audit capture", async () => {
    const audit = vi.fn();
    const service = new RemoteCommandsService({
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          auditEvent: {
            create: audit,
          },
          remoteCommand: {
            create: async ({ data }: { data: Record<string, unknown> }) =>
              command(data),
          },
        }),
      device: {
        findFirst: async () => ({
          id: "device-1",
          serialNumber: "SERIAL-001",
          status: "ONLINE",
        }),
      },
    } as never);

    await expect(
      service.createDeviceCommand(
        "tenant-1",
        "device-1",
        {
          reason: "Class start",
          type: "LOCK",
        },
        "admin-1",
      ),
    ).resolves.toMatchObject({
      requestedBy: "admin-1",
      status: "QUEUED",
      type: "LOCK",
    });

    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "remote_command.queue",
          actorId: "admin-1",
          object: "RemoteCommand",
          outcome: "QUEUED",
          reason: "Class start",
        }),
      }),
    );
  });

  it("rejects wipe through the generic command endpoint", async () => {
    const service = new RemoteCommandsService({
      device: {
        findFirst: async () => ({
          id: "device-1",
          serialNumber: "SERIAL-001",
          status: "ONLINE",
        }),
      },
    } as never);

    await expect(
      service.createDeviceCommand(
        "tenant-1",
        "device-1",
        {
          confirmed: true,
          reason: "Lost device",
          type: "WIPE",
        },
        "admin-1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("requires exact serial confirmation before queueing a wipe", async () => {
    const service = new RemoteCommandsService({
      device: {
        findFirst: async () => ({
          id: "device-1",
          serialNumber: "SERIAL-001",
          status: "ONLINE",
        }),
      },
    } as never);

    await expect(
      service.createWipeCommand(
        "tenant-1",
        "device-1",
        {
          confirmationSerialNumber: "WRONG",
          reason: "Lost device",
        },
        "admin-1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("claims queued commands and marks delivery attempt metadata", async () => {
    const update = vi.fn(async ({ data }: { data: Record<string, unknown> }) =>
      command({
        attempts: 1,
        deliveredAt: data.deliveredAt,
        lastAttemptAt: data.lastAttemptAt,
        status: "DELIVERED",
      }),
    );
    const service = new RemoteCommandsService({
      device: {
        findFirst: async () => ({
          id: "device-1",
          serialNumber: "SERIAL-001",
          status: "ONLINE",
        }),
      },
      remoteCommand: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([command()]),
        update,
      },
    } as never);

    await expect(
      service.claimQueuedCommands("tenant-1", "device-1", 10),
    ).resolves.toMatchObject([
      {
        attempts: 1,
        status: "DELIVERED",
      },
    ]);
    expect(update).toHaveBeenCalledOnce();
  });

  it("requeues delivery failures until max attempts is reached", async () => {
    const service = new RemoteCommandsService({
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          auditEvent: {
            create: vi.fn(),
          },
          remoteCommand: {
            update: async ({ data }: { data: Record<string, unknown> }) =>
              command({
                attempts: 1,
                failureReason: data.failureReason,
                status: data.status,
              }),
          },
        }),
      remoteCommand: {
        findFirst: async () =>
          command({
            attempts: 1,
            status: "DELIVERED",
          }),
      },
    } as never);

    await expect(
      service.recordDeliveryFailure("tenant-1", "device-1", "command-1", {
        failureReason: "Connector timeout",
      }),
    ).resolves.toMatchObject({
      failureReason: "Connector timeout",
      status: "QUEUED",
    });
  });

  it("marks delivery failures failed when max attempts is reached", async () => {
    const service = new RemoteCommandsService({
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          auditEvent: {
            create: vi.fn(),
          },
          remoteCommand: {
            update: async ({ data }: { data: Record<string, unknown> }) =>
              command({
                attempts: 3,
                completedAt: data.completedAt,
                failureReason: data.failureReason,
                maxAttempts: 3,
                status: data.status,
              }),
          },
        }),
      remoteCommand: {
        findFirst: async () =>
          command({
            attempts: 3,
            maxAttempts: 3,
            status: "DELIVERED",
          }),
      },
    } as never);

    await expect(
      service.recordDeliveryFailure("tenant-1", "device-1", "command-1", {
        failureReason: "Connector rejected command",
      }),
    ).resolves.toMatchObject({
      failureReason: "Connector rejected command",
      status: "FAILED",
    });
  });

  it("applies device side effects when lock command execution succeeds", async () => {
    const updateMany = vi.fn();
    const service = new RemoteCommandsService({
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          auditEvent: {
            create: vi.fn(),
          },
          device: {
            updateMany,
          },
          remoteCommand: {
            update: async ({ data }: { data: Record<string, unknown> }) =>
              command({
                completedAt: data.completedAt,
                result: data.result,
                status: data.status,
              }),
          },
        }),
      remoteCommand: {
        findFirst: async () =>
          command({
            status: "DELIVERED",
            type: "LOCK",
          }),
      },
    } as never);

    await expect(
      service.recordCommandResult("tenant-1", "device-1", "command-1", {
        result: {
          connectorState: "done",
        },
        status: "EXECUTED",
      }),
    ).resolves.toMatchObject({
      status: "EXECUTED",
    });

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: "LOCKED",
        },
      }),
    );
  });
});
