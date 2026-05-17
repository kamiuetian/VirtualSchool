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
      timezone: "America/New_York"
    });
    const controller = new TenantsController({
      create,
      getById: vi.fn(),
      list: vi.fn()
    } as never);

    await expect(
      controller.create({
        country: "US",
        name: "Pilot School",
        planKey: "starter",
        status: "PILOT",
        timezone: "America/New_York"
      })
    ).resolves.toMatchObject({
      id: "tenant-1",
      name: "Pilot School"
    });
    expect(create).toHaveBeenCalledOnce();
  });
});
