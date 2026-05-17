import { describe, expect, it, vi } from "vitest";
import { ReportsController } from "./reports.controller";

describe("ReportsController", () => {
  it("delegates device inventory report lookup", async () => {
    const getDeviceInventoryReport = vi.fn().mockResolvedValue({
      devices: [],
      tenantId: "tenant-1",
      totals: {
        devices: 0,
      },
    });
    const controller = new ReportsController({
      getAppDeploymentReport: vi.fn(),
      getDeviceInventoryCsv: vi.fn(),
      getDeviceInventoryReport,
      getPolicyDeploymentReport: vi.fn(),
    } as never);

    await expect(
      controller.getDeviceInventoryReport("tenant-1"),
    ).resolves.toMatchObject({
      tenantId: "tenant-1",
    });
    expect(getDeviceInventoryReport).toHaveBeenCalledWith("tenant-1");
  });

  it("passes authenticated actor to CSV export", async () => {
    const getDeviceInventoryCsv = vi.fn().mockResolvedValue("csv");
    const controller = new ReportsController({
      getAppDeploymentReport: vi.fn(),
      getDeviceInventoryCsv,
      getDeviceInventoryReport: vi.fn(),
      getPolicyDeploymentReport: vi.fn(),
    } as never);

    await expect(
      controller.getDeviceInventoryCsv("tenant-1", {
        user: {
          subject: "admin-1",
        },
      } as never),
    ).resolves.toBe("csv");
    expect(getDeviceInventoryCsv).toHaveBeenCalledWith("tenant-1", "admin-1");
  });
});
