import { describe, expect, it, vi } from "vitest";
import { RemoteCommandsController } from "./remote-commands.controller";

describe("RemoteCommandsController", () => {
  it("delegates command creation with authenticated actor", async () => {
    const createDeviceCommand = vi.fn().mockResolvedValue({
      id: "command-1",
      requestedBy: "admin-1",
      status: "QUEUED",
      type: "LOCK",
    });
    const controller = new RemoteCommandsController({
      claimQueuedCommands: vi.fn(),
      createDeviceCommand,
      createWipeCommand: vi.fn(),
      listDeviceCommands: vi.fn(),
      recordCommandResult: vi.fn(),
      recordDeliveryFailure: vi.fn(),
    } as never);

    await expect(
      controller.createDeviceCommand(
        "tenant-1",
        "device-1",
        {
          reason: "Class start",
          type: "LOCK",
        },
        {
          user: {
            subject: "admin-1",
          },
        } as never,
      ),
    ).resolves.toMatchObject({
      requestedBy: "admin-1",
      status: "QUEUED",
    });

    expect(createDeviceCommand).toHaveBeenCalledWith(
      "tenant-1",
      "device-1",
      expect.objectContaining({
        type: "LOCK",
      }),
      "admin-1",
    );
  });

  it("delegates wipe commands to the dedicated service method", async () => {
    const createWipeCommand = vi.fn().mockResolvedValue({
      id: "command-1",
      status: "QUEUED",
      type: "WIPE",
    });
    const controller = new RemoteCommandsController({
      claimQueuedCommands: vi.fn(),
      createDeviceCommand: vi.fn(),
      createWipeCommand,
      listDeviceCommands: vi.fn(),
      recordCommandResult: vi.fn(),
      recordDeliveryFailure: vi.fn(),
    } as never);

    await expect(
      controller.createWipeCommand(
        "tenant-1",
        "device-1",
        {
          confirmationSerialNumber: "SERIAL-001",
          reason: "Lost device",
        },
        {
          user: {
            subject: "admin-1",
          },
        } as never,
      ),
    ).resolves.toMatchObject({
      type: "WIPE",
    });

    expect(createWipeCommand).toHaveBeenCalledOnce();
  });

  it("delegates result recording", async () => {
    const recordCommandResult = vi.fn().mockResolvedValue({
      id: "command-1",
      status: "EXECUTED",
    });
    const controller = new RemoteCommandsController({
      claimQueuedCommands: vi.fn(),
      createDeviceCommand: vi.fn(),
      createWipeCommand: vi.fn(),
      listDeviceCommands: vi.fn(),
      recordCommandResult,
      recordDeliveryFailure: vi.fn(),
    } as never);

    await expect(
      controller.recordCommandResult("tenant-1", "device-1", "command-1", {
        status: "EXECUTED",
      }),
    ).resolves.toMatchObject({
      status: "EXECUTED",
    });
    expect(recordCommandResult).toHaveBeenCalledOnce();
  });
});
