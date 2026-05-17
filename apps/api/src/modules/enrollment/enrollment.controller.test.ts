import { describe, expect, it, vi } from "vitest";
import { EnrollmentController } from "./enrollment.controller";

describe("EnrollmentController", () => {
  it("delegates enrollment batch creation to the service", async () => {
    const createEnrollmentBatch = vi.fn().mockResolvedValue({
      enrolledCount: 0,
      id: "batch-1",
      name: "Pilot",
      status: "ACTIVE",
      tenantId: "tenant-1",
      token: "enroll_token",
    });
    const controller = new EnrollmentController({
      assignDevice: vi.fn(),
      createEnrollmentBatch,
      listDevices: vi.fn(),
      listEnrollmentBatches: vi.fn(),
      recordDeviceCheckIn: vi.fn(),
    } as never);

    await expect(
      controller.createEnrollmentBatch("tenant-1", {
        name: "Pilot",
      }),
    ).resolves.toMatchObject({
      id: "batch-1",
      name: "Pilot",
    });
    expect(createEnrollmentBatch).toHaveBeenCalledOnce();
  });

  it("delegates device check-ins to the service", async () => {
    const recordDeviceCheckIn = vi.fn().mockResolvedValue({
      device: {
        id: "device-1",
        serialNumber: "SERIAL-001",
      },
      quarantined: true,
      wasExistingDevice: false,
    });
    const controller = new EnrollmentController({
      assignDevice: vi.fn(),
      createEnrollmentBatch: vi.fn(),
      listDevices: vi.fn(),
      listEnrollmentBatches: vi.fn(),
      recordDeviceCheckIn,
    } as never);

    await expect(
      controller.recordDeviceCheckIn("tenant-1", {
        enrollmentToken: "enroll_token",
        serialNumber: "SERIAL-001",
      }),
    ).resolves.toMatchObject({
      quarantined: true,
    });
    expect(recordDeviceCheckIn).toHaveBeenCalledOnce();
  });
});
