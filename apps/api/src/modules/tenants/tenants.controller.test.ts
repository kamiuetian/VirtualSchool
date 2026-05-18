import { describe, expect, it, vi } from "vitest";
import { TenantsController } from "./tenants.controller";

describe("TenantsController", () => {
  it("delegates tenant creation to the tenant service", async () => {
    const create = vi.fn().mockResolvedValue({
      country: "US",
      id: "tenant-1",
      name: "Pilot School",
      planKey: "starter",
      status: "PILOT",
      timezone: "America/New_York",
    });
    const controller = new TenantsController({
      create,
      getById: vi.fn(),
      listAuthorized: vi.fn(),
    } as never);

    await expect(
      controller.create({
        country: "US",
        name: "Pilot School",
        planKey: "starter",
        status: "PILOT",
        timezone: "America/New_York",
      }),
    ).resolves.toMatchObject({
      id: "tenant-1",
      name: "Pilot School",
    });
    expect(create).toHaveBeenCalledOnce();
  });

  it("delegates tenant profile updates with the authenticated actor", async () => {
    const updateProfile = vi.fn().mockResolvedValue({
      country: "US",
      id: "tenant-1",
      logoUrl: "https://assets.example.edu/logo.png",
      name: "Pilot School",
      planKey: "starter",
      primaryColor: "#116b5f",
      status: "PILOT",
      timezone: "America/New_York",
    });
    const controller = new TenantsController({
      getById: vi.fn(),
      listAuthorized: vi.fn(),
      updateProfile,
    } as never);

    await expect(
      controller.updateProfile(
        "tenant-1",
        {
          logoUrl: "https://assets.example.edu/logo.png",
          primaryColor: "#116b5f",
        },
        {
          user: {
            subject: "auth0|admin",
          },
        } as never,
      ),
    ).resolves.toMatchObject({
      id: "tenant-1",
      logoUrl: "https://assets.example.edu/logo.png",
    });
    expect(updateProfile).toHaveBeenCalledWith(
      "tenant-1",
      {
        logoUrl: "https://assets.example.edu/logo.png",
        primaryColor: "#116b5f",
      },
      "auth0|admin",
    );
  });
});
