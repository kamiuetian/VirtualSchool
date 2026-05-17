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
      deployApp: vi.fn(),
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
      deployApp: vi.fn(),
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

  it("delegates app deployment with authenticated actor", async () => {
    const deployApp = vi.fn().mockResolvedValue({
      appId: "app-1",
      queuedCommands: 2,
    });
    const controller = new AppCatalogController({
      createApp: vi.fn(),
      deployApp,
      listApps: vi.fn(),
      updateApp: vi.fn(),
    } as never);

    await expect(
      controller.deployApp(
        "tenant-1",
        "app-1",
        {
          action: "INSTALL",
          scope: "CLASS",
          scopeId: "class-1",
        },
        {
          user: {
            subject: "admin-1",
          },
        } as never,
      ),
    ).resolves.toMatchObject({
      queuedCommands: 2,
    });
    expect(deployApp).toHaveBeenCalledWith(
      "tenant-1",
      "app-1",
      expect.objectContaining({
        scopeId: "class-1",
      }),
      "admin-1",
    );
  });
});
