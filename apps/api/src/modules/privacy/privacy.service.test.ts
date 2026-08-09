import { describe, expect, it, vi } from "vitest";
import { PrivacyService } from "./privacy.service";

describe("PrivacyService", () => {
  it("builds the security center only from the requested tenant", async () => {
    const userCount = vi.fn(async ({ where }: any) =>
      where.status === "SUSPENDED" ? 1 : 3,
    );
    const service = new PrivacyService({
      tenant: {
        findUnique: async ({ where }: any) =>
          where.id === "tenant-1"
            ? {
                id: "tenant-1",
                dataRegion: "PK",
                allowedRegionCodes: ["PK-IS"],
                webFilterSettings: {},
                securityPrivacyProfile: null,
              }
            : null,
      },
      retentionSettings: { findUnique: async () => null },
      user: { count: userCount },
      accessAssignment: { count: async () => 2 },
      accessReview: { count: async () => 1 },
      privacyNotice: { count: async () => 4 },
    } as never);
    await expect(service.securityCenter("tenant-1")).resolves.toMatchObject({
      tenantId: "tenant-1",
      dataSettings: { dataRegion: "PK" },
      accessControls: { activeDelegatedAssignments: 2, openAccessReviews: 1 },
      privacyNoticeCount: 4,
    });
    expect(
      userCount.mock.calls.every(
        ([input]) => input.where.tenantId === "tenant-1",
      ),
    ).toBe(true);
    await expect(service.securityCenter("tenant-2")).rejects.toThrow(
      "Tenant was not found",
    );
  });

  it("validates HTTPS policy evidence and audits governance profile updates", async () => {
    const createAudit = vi.fn();
    const upsert = vi.fn(async ({ create }: any) => ({
      ...create,
      id: "profile-1",
      updatedAt: new Date("2026-08-09T00:00:00Z"),
    }));
    const service = new PrivacyService({
      $transaction: async (callback: any) =>
        callback({
          tenant: { findUnique: async () => ({ id: "tenant-1" }) },
          securityPrivacyProfile: { upsert },
          auditEvent: { create: createAudit },
        }),
    } as never);
    const input = {
      incidentContactName: "Privacy office",
      incidentContactEmail: "privacy@school.test",
      policyDocuments: [
        { title: "Privacy policy", url: "https://school.test/privacy" },
      ],
      childSafetyGuardrails: ["No covert monitoring of children"],
    };
    await expect(
      service.updateSecurityPrivacyProfile("tenant-1", input, "admin-1"),
    ).resolves.toMatchObject({
      incidentContact: { email: "privacy@school.test" },
    });
    expect(createAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: "tenant-1",
          action: "security_privacy_profile.update",
        }),
      }),
    );
    await expect(
      service.updateSecurityPrivacyProfile(
        "tenant-1",
        {
          ...input,
          policyDocuments: [{ title: "Unsafe", url: "http://school.test" }],
        },
        "admin-1",
      ),
    ).rejects.toThrow("valid HTTPS URLs");
  });

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
