import { describe, expect, it, vi } from "vitest";
import { AppCatalogController } from "./app-catalog.controller";

describe("AppCatalogController", () => {
  it("delegates app creation to the service", async () => {
    const createApp = vi.fn().mockResolvedValue({
      approvalStatus: "APPROVED",
      id: "app-1",
      name: "Google Classroom",
      packageId: "com.google.android.apps.classroom",
      tenantId: "tenant-1",
    });
    const controller = new AppCatalogController({
      createApp,
      listApps: vi.fn(),
      updateApp: vi.fn(),
    } as never);

    await expect(
      controller.createApp("tenant-1", {
        name: "Google Classroom",
        packageId: "com.google.android.apps.classroom",
      }),
    ).resolves.toMatchObject({
      id: "app-1",
    });
    expect(createApp).toHaveBeenCalledOnce();
  });

  it("delegates app updates to the service", async () => {
    const updateApp = vi.fn().mockResolvedValue({
      approvalStatus: "DEPRECATED",
      id: "app-1",
    });
    const controller = new AppCatalogController({
      createApp: vi.fn(),
      listApps: vi.fn(),
      updateApp,
    } as never);

    await expect(
      controller.updateApp("tenant-1", "app-1", {
        approvalStatus: "DEPRECATED",
      }),
    ).resolves.toMatchObject({
      approvalStatus: "DEPRECATED",
    });
    expect(updateApp).toHaveBeenCalledOnce();
  });
});
