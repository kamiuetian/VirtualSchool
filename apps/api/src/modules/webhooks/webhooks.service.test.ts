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
    webhookDelivery: {
      findFirst: vi.fn(async () => ({
        id: "delivery-1",
        tenantId: "tenant-1",
        endpointId: "endpoint-1",
        eventId: "event-1",
        status: "FAILED",
      })),
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
        webhookDelivery: {
          update: vi.fn(async ({ data }: any) => ({
            id: "delivery-1",
            endpointId: "endpoint-1",
            eventId: "event-1",
            ...data,
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

  it("requeues a failed tenant-scoped delivery with reasoned audit evidence", async () => {
    const { auditCreate, db, service } = fixture();
    const result = await service.retryDelivery(
      "tenant-1",
      "endpoint-1",
      "delivery-1",
      "Receiver outage has been resolved",
      "admin-1",
    );
    expect(result).toMatchObject({ status: "PENDING", attemptCount: 0 });
    expect(db.webhookDelivery.findFirst).toHaveBeenCalledWith({
      where: {
        id: "delivery-1",
        endpointId: "endpoint-1",
        tenantId: "tenant-1",
      },
    });
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "webhook.delivery.retry",
          reason: "Receiver outage has been resolved",
          tenantId: "tenant-1",
        }),
      }),
    );
  });

  it("does not replay a successful delivery", async () => {
    const { db, service } = fixture();
    db.webhookDelivery.findFirst.mockResolvedValueOnce({
      id: "delivery-1",
      status: "DELIVERED",
    });
    await expect(
      service.retryDelivery(
        "tenant-1",
        "endpoint-1",
        "delivery-1",
        "Unnecessary replay",
      ),
    ).rejects.toThrow("Only failed webhook deliveries can be retried");
  });
});
