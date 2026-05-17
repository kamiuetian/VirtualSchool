import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { BillingService } from "./billing.service";

const now = new Date("2026-05-17T10:00:00.000Z");

function tenant(overrides: Record<string, unknown> = {}) {
  return {
    billingSubscription: null,
    country: "PK",
    createdAt: now,
    domain: null,
    id: "tenant-1",
    language: "en",
    name: "Virtual School",
    planKey: "pilot",
    status: "PILOT",
    timezone: "Asia/Karachi",
    updatedAt: now,
    ...overrides,
  };
}

function subscription(overrides: Record<string, unknown> = {}) {
  return {
    billingEmail: "billing@example.edu",
    billingPeriodEnd: new Date("2026-06-01T00:00:00.000Z"),
    billingPeriodStart: new Date("2026-05-01T00:00:00.000Z"),
    branchLimit: 2,
    createdAt: now,
    deviceLimit: 10,
    id: "billing-1",
    notes: "pilot",
    planKey: "pilot",
    staffLimit: 5,
    status: "TRIALING",
    studentLimit: 100,
    tenantId: "tenant-1",
    trialEndsAt: null,
    updatedAt: now,
    updatedBy: "admin-1",
    ...overrides,
  };
}

describe("BillingService", () => {
  it("returns fallback subscription details from tenant plan when no billing row exists", async () => {
    const service = new BillingService({
      tenant: {
        findUnique: async () => tenant(),
      },
    } as never);

    await expect(service.getSubscription("tenant-1")).resolves.toMatchObject({
      id: null,
      planKey: "pilot",
      status: "TRIALING",
      tenantId: "tenant-1",
    });
  });

  it("computes usage metrics with subscription overrides and warning totals", async () => {
    const count = vi
      .fn()
      .mockResolvedValueOnce(9)
      .mockResolvedValueOnce(80)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(100);
    const service = new BillingService({
      appCatalogItem: { count },
      branch: { count },
      classSection: { count },
      device: { count },
      policy: { count },
      remoteCommand: { count },
      student: { count },
      tenant: {
        findUnique: async () =>
          tenant({
            billingSubscription: subscription(),
          }),
      },
      user: { count },
    } as never);

    const result = await service.getUsage("tenant-1");

    expect(result.subscription.overrides.devices).toBe(10);
    expect(result.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "devices",
          limit: 10,
          percentUsed: 90,
          used: 9,
        }),
        expect.objectContaining({
          key: "branches",
          limit: 2,
          overLimit: true,
          used: 3,
        }),
      ]),
    );
    expect(result.totals).toMatchObject({
      overLimitCount: 1,
      warningCount: 3,
    });
  });

  it("updates subscription, mirrors tenant plan key, and writes audit", async () => {
    const audit = vi.fn();
    const tenantUpdate = vi.fn();
    const service = new BillingService({
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          auditEvent: {
            create: audit,
          },
          billingSubscription: {
            upsert: async ({ create }: { create: Record<string, unknown> }) =>
              subscription({
                ...create,
                id: "billing-1",
                updatedAt: now,
              }),
          },
          tenant: {
            update: tenantUpdate,
          },
        }),
      tenant: {
        findUnique: async () => tenant(),
      },
    } as never);

    await expect(
      service.updateSubscription(
        "tenant-1",
        {
          notes: "Converted after pilot",
          planKey: "starter",
          status: "ACTIVE",
        },
        "billing-admin-1",
      ),
    ).resolves.toMatchObject({
      planKey: "starter",
      status: "ACTIVE",
      updatedBy: "billing-admin-1",
    });
    expect(tenantUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          planKey: "starter",
        },
      }),
    );
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "billing_subscription.update",
          actorId: "billing-admin-1",
          outcome: "UPDATED",
        }),
      }),
    );
  });

  it("rejects unknown tenants", async () => {
    const service = new BillingService({
      tenant: {
        findUnique: async () => null,
      },
    } as never);

    await expect(service.getUsage("missing")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
