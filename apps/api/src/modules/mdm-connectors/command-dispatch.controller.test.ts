import { describe, expect, it, vi } from "vitest";
import { CommandDispatchController } from "./command-dispatch.controller";

describe("CommandDispatchController", () => {
  it("delegates dispatch runs to the service", async () => {
    const dispatchQueuedCommands = vi.fn().mockResolvedValue({
      accepted: 1,
      attempted: 1,
      connector: "STUB",
      failed: 0,
      requeued: 0,
      tenantId: "tenant-1",
    });
    const controller = new CommandDispatchController({
      dispatchQueuedCommands,
    } as never);

    await expect(
      controller.dispatchQueuedCommands("tenant-1", {
        limit: 5,
      }),
    ).resolves.toMatchObject({
      accepted: 1,
      connector: "STUB",
    });
    expect(dispatchQueuedCommands).toHaveBeenCalledWith("tenant-1", 5);
  });
});
