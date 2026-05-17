import { describe, expect, it, vi } from "vitest";
import { TimetableController } from "./timetable.controller";

describe("TimetableController", () => {
  it("delegates timetable block creation", async () => {
    const createBlock = vi.fn().mockResolvedValue({
      id: "block-1",
      name: "Math",
    });
    const controller = new TimetableController({
      createBlock,
      deactivateBlock: vi.fn(),
      listBlocks: vi.fn(),
      resolveActiveBlockForDevice: vi.fn(),
      updateBlock: vi.fn(),
    } as never);

    await expect(
      controller.createBlock("tenant-1", {
        dayOfWeek: 1,
        endMinute: 600,
        name: "Math",
        policyId: "policy-1",
        scope: "CLASS",
        scopeId: "class-1",
        startMinute: 540,
      }),
    ).resolves.toMatchObject({
      id: "block-1",
    });
    expect(createBlock).toHaveBeenCalledWith(
      "tenant-1",
      expect.objectContaining({
        scopeId: "class-1",
      }),
    );
  });

  it("delegates active block resolution with an optional timestamp", async () => {
    const resolveActiveBlockForDevice = vi.fn().mockResolvedValue({
      activeBlock: null,
      deviceId: "device-1",
    });
    const controller = new TimetableController({
      createBlock: vi.fn(),
      deactivateBlock: vi.fn(),
      listBlocks: vi.fn(),
      resolveActiveBlockForDevice,
      updateBlock: vi.fn(),
    } as never);

    await expect(
      controller.resolveActiveBlockForDevice(
        "tenant-1",
        "device-1",
        "2026-05-18T09:30:00.000Z",
      ),
    ).resolves.toMatchObject({
      deviceId: "device-1",
    });
    expect(resolveActiveBlockForDevice).toHaveBeenCalledWith(
      "tenant-1",
      "device-1",
      new Date("2026-05-18T09:30:00.000Z"),
    );
  });
});
