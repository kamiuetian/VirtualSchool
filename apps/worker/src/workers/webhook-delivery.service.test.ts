import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebhookDeliveryService } from "./webhook-delivery.service";

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.WEBHOOK_SIGNING_SECRETS_JSON;
});

describe("WebhookDeliveryService", () => {
  it("captures a required event and sends a replay-resistant HMAC signature", async () => {
    process.env.WEBHOOK_SIGNING_SECRETS_JSON = JSON.stringify({
      "school/v1": "test-secret",
    });
    const audit = {
      id: "audit-1",
      tenantId: "tenant-1",
      action: "guardian.device.report_lost",
      object: "Device",
      objectId: "device-1",
      newValue: { deviceId: "device-1", studentId: "student-1" },
      createdAt: new Date("2026-08-08T10:00:00Z"),
    };
    const endpoint = {
      id: "endpoint-1",
      tenantId: "tenant-1",
      url: "https://hooks.example/events",
      enabled: true,
      eventTypes: ["lost_device.reported"],
      secretReference: "school/v1",
      secretVersion: 2,
      maxAttempts: 3,
    };
    const event = {
      id: "event-1",
      tenantId: "tenant-1",
      type: "lost_device.reported",
      objectType: "Device",
      objectId: "device-1",
      payload: { deviceId: "device-1", studentId: "student-1" },
      occurredAt: audit.createdAt,
    };
    const delivery = {
      id: "delivery-1",
      tenantId: "tenant-1",
      endpointId: endpoint.id,
      eventId: event.id,
      attemptCount: 0,
      endpoint,
      event,
    };
    const update = vi.fn(async () => delivery);
    const db: any = {
      auditEvent: { findMany: vi.fn(async () => [audit]) },
      webhookEndpoint: { findMany: vi.fn(async () => [endpoint]) },
      webhookDelivery: { findMany: vi.fn(async () => [delivery]) },
      $transaction: vi.fn(async (work: any) =>
        work({
          webhookEvent: { create: vi.fn(async () => event) },
          webhookDelivery: {
            createMany: vi.fn(async () => ({ count: 1 })),
            update,
          },
          auditEvent: { create: vi.fn(async () => ({})) },
        }),
      ),
    };
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => ({
      ok: true,
      status: 204,
      init,
    }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new WebhookDeliveryService(db).processTenant(
      "tenant-1",
    );
    expect(result).toMatchObject({
      capturedEvents: 1,
      delivered: 1,
      failed: 0,
    });
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    const expected = createHmac("sha256", "test-secret")
      .update(`${headers["X-VirtualSchool-Timestamp"]}.${init.body}`)
      .digest("hex");
    expect(headers["X-VirtualSchool-Event-Id"]).toBe("event-1");
    expect(headers["X-VirtualSchool-Signature"]).toBe(`v1=${expected}`);
    expect(headers["X-VirtualSchool-Signature-Version"]).toBe("2");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "DELIVERED", attemptCount: 1 }),
      }),
    );
  });

  it("fails safely without retrying when a referenced secret is unavailable", async () => {
    const endpoint = {
      id: "endpoint-1",
      url: "https://hooks.example",
      eventTypes: [],
      secretReference: "missing",
      secretVersion: 1,
      maxAttempts: 3,
    };
    const delivery = {
      id: "delivery-1",
      endpointId: endpoint.id,
      eventId: "event-1",
      attemptCount: 0,
      endpoint,
      event: {
        id: "event-1",
        tenantId: "tenant-1",
        type: "device.offline",
        objectType: "Device",
        objectId: "device-1",
        payload: {},
        occurredAt: new Date(),
      },
    };
    const update = vi.fn(async () => delivery);
    const db: any = {
      auditEvent: { findMany: vi.fn(async () => []) },
      webhookEndpoint: { findMany: vi.fn(async () => []) },
      webhookDelivery: { findMany: vi.fn(async () => [delivery]) },
      $transaction: vi.fn(async (work: any) =>
        work({
          webhookDelivery: { update },
          auditEvent: { create: vi.fn(async () => ({})) },
        }),
      ),
    };
    const result = await new WebhookDeliveryService(db).processTenant(
      "tenant-1",
    );
    expect(result).toMatchObject({ failed: 1 });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          failureReason: expect.stringContaining("not available"),
        }),
      }),
    );
  });
});
