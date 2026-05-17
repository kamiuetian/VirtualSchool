import { describe, expect, it, vi } from "vitest";
import { DeviceDiagnosticsController } from "./device-diagnostics.controller";

describe("DeviceDiagnosticsController", () => {
  it("delegates diagnostic upload", async () => {
    const uploadDeviceDiagnostic = vi.fn().mockResolvedValue({
      diagnostic: {
        id: "diagnostic-1",
      },
    });
    const controller = new DeviceDiagnosticsController({
      acknowledgeAlert: vi.fn(),
      listAlerts: vi.fn(),
      listDeviceDiagnostics: vi.fn(),
      resolveAlert: vi.fn(),
      scanOfflineAlerts: vi.fn(),
      uploadDeviceDiagnostic,
    } as never);

    await expect(
      controller.uploadDeviceDiagnostic("tenant-1", "device-1", {
        batteryLevel: 15,
      }),
    ).resolves.toMatchObject({
      diagnostic: {
        id: "diagnostic-1",
      },
    });
    expect(uploadDeviceDiagnostic).toHaveBeenCalledWith(
      "tenant-1",
      "device-1",
      expect.objectContaining({
        batteryLevel: 15,
      }),
    );
  });

  it("delegates alert acknowledgement with authenticated actor", async () => {
    const acknowledgeAlert = vi.fn().mockResolvedValue({
      id: "alert-1",
      status: "ACKNOWLEDGED",
    });
    const controller = new DeviceDiagnosticsController({
      acknowledgeAlert,
      listAlerts: vi.fn(),
      listDeviceDiagnostics: vi.fn(),
      resolveAlert: vi.fn(),
      scanOfflineAlerts: vi.fn(),
      uploadDeviceDiagnostic: vi.fn(),
    } as never);

    await expect(
      controller.acknowledgeAlert(
        "tenant-1",
        "alert-1",
        {
          reason: "Investigating",
        },
        {
          user: {
            subject: "admin-1",
          },
        } as never,
      ),
    ).resolves.toMatchObject({
      status: "ACKNOWLEDGED",
    });
    expect(acknowledgeAlert).toHaveBeenCalledWith(
      "tenant-1",
      "alert-1",
      expect.objectContaining({
        reason: "Investigating",
      }),
      "admin-1",
    );
  });
});
