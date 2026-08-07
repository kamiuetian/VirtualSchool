import { describe, expect, it, vi } from "vitest";
import { WebhooksService } from "./webhooks.service";

function fixture() {
  const auditCreate = vi.fn(async () => ({ id: "audit-1" }));
  const endpoint = {
    id: "endpoint-1",
    tenantId: "tenant-1",
    name: "SIS",
    url: "https://hooks.example/events",
    enabled: true,
    eventTypes: ["device.offline"],
    secretReference: "school/webhook-v1",
    secretVersion: 1,
    maxAttempts: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    deliveries: [],
  };
  const db: any = {
    tenant: { findUnique: vi.fn(async () => ({ id: "tenant-1" })) },
    webhookEndpoint: {
      findMany: vi.fn(async () => [endpoint]),
      findFirst: vi.fn(async () => endpoint),
    },
    $transaction: vi.fn(async (work: any) =>
      work({
        webhookEndpoint: {
          upsert: vi.fn(async ({ create }: any) => ({
            ...endpoint,
            ...create,
          })),
          update: vi.fn(async ({ data }: any) => ({
            ...endpoint,
            ...data,
            secretVersion: data.secretVersion ? 2 : 1,
          })),
        },
        auditEvent: { create: auditCreate },
      }),
    ),
  };
  return { auditCreate, db, endpoint, service: new WebhooksService(db) };
}

describe("WebhooksService", () => {
  it("configures an HTTPS endpoint without accepting secret material", async () => {
    const { auditCreate, service } = fixture();
    const result = await service.configure(
      "tenant-1",
      {
        name: "SIS",
        url: "https://hooks.example/events",
        eventTypes: ["device.offline"],
        secretReference: "school/webhook-v1",
        maxAttempts: 3,
      },
      "admin-1",
    );
    expect(result.secretReference).toBe("school/webhook-v1");
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "webhook.endpoint.configure",
          tenantId: "tenant-1",
        }),
      }),
    );
  });

  it("rotates the secret reference and version within the tenant", async () => {
    const { auditCreate, service } = fixture();
    const result = await service.rotate(
      "tenant-1",
      "endpoint-1",
      { secretReference: "school/webhook-v2" },
      "admin-1",
    );
    expect(result.secretVersion).toBe(2);
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "webhook.secret.rotate" }),
      }),
    );
  });

  it("disables delivery while preserving endpoint history", async () => {
    const { service } = fixture();
    const result = await service.setEnabled(
      "tenant-1",
      "endpoint-1",
      false,
      "admin-1",
    );
    expect(result.enabled).toBe(false);
  });
});
