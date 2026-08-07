import { describe, expect, it, vi } from "vitest";
import { PrivacyService } from "./privacy.service";

describe("PrivacyService", () => {
  it("publishes the next immutable tenant/channel version and audits it", async () => {
    const createAudit = vi.fn();
    const service = new PrivacyService({
      $transaction: async (callback: (tx: any) => Promise<unknown>) =>
        callback({
          auditEvent: { create: createAudit },
          privacyNotice: {
            findFirst: async () => ({ version: 2 }),
            create: async ({ data }: any) => ({
              ...data,
              id: "notice-3",
              publishedAt: new Date("2026-08-07T00:00:00Z"),
            }),
          },
        }),
    } as never);
    await expect(
      service.publish(
        "tenant-1",
        {
          noticeType: "PRIVACY",
          channel: "WEB",
          title: "Privacy notice",
          content: "A sufficiently detailed privacy notice.",
        },
        "admin-1",
      ),
    ).resolves.toMatchObject({ version: 3, tenantId: "tenant-1" });
    expect(createAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "privacy_notice.publish",
          tenantId: "tenant-1",
        }),
      }),
    );
  });

  it("records guardian acceptance only for a notice in the same tenant", async () => {
    const upsert = vi.fn(async ({ create }) => ({
      ...create,
      id: "acceptance-1",
      acceptedAt: new Date(),
      revokedAt: null,
      revokeReason: null,
    }));
    const service = new PrivacyService({
      privacyNotice: {
        findFirst: async ({ where }: any) =>
          where.tenantId === "tenant-1"
            ? {
                id: "notice-1",
                tenantId: "tenant-1",
                channel: "WEB",
                version: 1,
              }
            : null,
      },
      $transaction: async (callback: (tx: any) => Promise<unknown>) =>
        callback({
          auditEvent: { create: vi.fn() },
          privacyAcceptance: { upsert },
        }),
    } as never);
    await expect(
      service.accept(
        "tenant-1",
        "notice-1",
        { channel: "WEB" },
        "guardian-auth-1",
        "GUARDIAN",
      ),
    ).resolves.toMatchObject({
      subjectType: "GUARDIAN",
      subjectId: "guardian-auth-1",
    });
    await expect(
      service.accept(
        "tenant-2",
        "notice-1",
        { channel: "WEB" },
        "guardian-auth-1",
        "GUARDIAN",
      ),
    ).rejects.toThrow("not found for this tenant");
  });

  it("prevents one subject from revoking another subject's acceptance", async () => {
    const service = new PrivacyService({
      privacyAcceptance: { findFirst: async () => null },
    } as never);
    await expect(
      service.revoke("tenant-1", "acceptance-1", "Changed decision", "admin-2"),
    ).rejects.toThrow("not found for this subject");
  });

  it("records authenticated student consent for BYOD notices", async () => {
    const service = new PrivacyService({
      privacyNotice: {
        findFirst: async () => ({
          id: "byod-notice-1",
          tenantId: "tenant-1",
          channel: "WEB",
          version: 1,
        }),
      },
      $transaction: async (callback: (tx: any) => Promise<unknown>) =>
        callback({
          auditEvent: { create: vi.fn() },
          privacyAcceptance: {
            upsert: async ({ create }: any) => ({
              ...create,
              id: "student-acceptance-1",
              acceptedAt: new Date(),
              revokedAt: null,
              revokeReason: null,
            }),
          },
        }),
    } as never);

    await expect(
      service.accept(
        "tenant-1",
        "byod-notice-1",
        { channel: "WEB" },
        "auth0|student-1",
        "STUDENT",
      ),
    ).resolves.toMatchObject({
      subjectType: "STUDENT",
      subjectId: "auth0|student-1",
    });
  });
});
