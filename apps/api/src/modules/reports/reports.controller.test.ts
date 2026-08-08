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

  it("passes learning usage filters to the report service", async () => {
    const getLearningUsageAnalytics = vi.fn().mockResolvedValue({ tenantId: "tenant-1" });
    const controller = new ReportsController({ getLearningUsageAnalytics } as never);
    await controller.getLearningUsageAnalytics(
      "tenant-1", "2026-05-01", "2026-05-17", "class-1", "5", "pilot", "MATH",
    );
    expect(getLearningUsageAnalytics).toHaveBeenCalledWith("tenant-1", {
      category: "MATH",
      classId: "class-1",
      deviceGroup: "pilot",
      from: "2026-05-01",
      grade: "5",
      to: "2026-05-17",
    });
  });
});
