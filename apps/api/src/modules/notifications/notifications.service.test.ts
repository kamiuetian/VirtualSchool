import { describe, expect, it, vi } from "vitest";
import { NotificationsService } from "./notifications.service";

describe("NotificationsService", () => {
  it("normalizes recipients and audits tenant-scoped preference updates", async () => {
    const audit = vi.fn();
    const upsert = vi.fn(async ({ create }) => ({
      ...create,
      appFailureEnabled: true,
      createdAt: new Date(),
      deduplicationWindowMinutes: 60,
      id: "preference-1",
      lostDeviceEnabled: true,
      offlineAfterMinutes: 30,
      offlineEnabled: true,
      policyFailureEnabled: true,
      repeatedEnrollmentEnabled: true,
      repeatedEnrollmentThreshold: 3,
      updatedAt: new Date(),
    }));
    const service = new NotificationsService({
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          auditEvent: { create: audit },
          notificationPreference: { upsert },
        }),
      notificationPreference: { findUnique: async () => null },
      tenant: { findUnique: async () => ({ id: "tenant-1" }) },
    } as never);

    await expect(
      service.updatePreferences(
        "tenant-1",
        {
          offlineAfterMinutes: 30,
          recipients: ["IT@Example.edu", "it@example.edu", "ops@example.edu"],
        },
        "admin-1",
      ),
    ).resolves.toMatchObject({
      recipients: ["it@example.edu", "ops@example.edu"],
      tenantId: "tenant-1",
    });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "notification_preference.update",
          tenantId: "tenant-1",
        }),
      }),
    );
  });
});
