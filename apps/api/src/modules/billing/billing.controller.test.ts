import { describe, expect, it, vi } from "vitest";
import { BillingController } from "./billing.controller";

describe("BillingController", () => {
  it("delegates usage lookup", async () => {
    const getUsage = vi.fn().mockResolvedValue({
      metrics: [],
      tenantId: "tenant-1",
    });
    const controller = new BillingController({
      getSubscription: vi.fn(),
      getUsage,
      updateSubscription: vi.fn(),
    } as never);

    await expect(controller.getUsage("tenant-1")).resolves.toMatchObject({
      tenantId: "tenant-1",
    });
    expect(getUsage).toHaveBeenCalledWith("tenant-1");
  });

  it("passes authenticated actor to subscription updates", async () => {
    const updateSubscription = vi.fn().mockResolvedValue({
      planKey: "starter",
      tenantId: "tenant-1",
    });
    const controller = new BillingController({
      getSubscription: vi.fn(),
      getUsage: vi.fn(),
      updateSubscription,
    } as never);

    await expect(
      controller.updateSubscription(
        "tenant-1",
        {
          notes: "Pilot converted",
          planKey: "starter",
        },
        {
          user: {
            subject: "billing-admin-1",
          },
        } as never,
      ),
    ).resolves.toMatchObject({
      planKey: "starter",
    });
    expect(updateSubscription).toHaveBeenCalledWith(
      "tenant-1",
      expect.objectContaining({
        planKey: "starter",
      }),
      "billing-admin-1",
    );
  });
});
