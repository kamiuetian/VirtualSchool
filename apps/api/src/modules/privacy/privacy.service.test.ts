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

  it("creates a hashed immutable evidence snapshot from tenant-scoped sources", async () => {
    let persistedArtifact: unknown;
    const createAudit = vi.fn();
    const service = new PrivacyService({
      auditEvent: {
        findMany: vi.fn(async ({ where }: any) => [
          {
            id: "audit-1",
            tenantId: where.tenantId,
            createdAt: new Date("2026-08-01T00:00:00Z"),
          },
        ]),
      },
      accessReview: { findMany: vi.fn(async () => []) },
      complianceEvidencePack: {},
      $transaction: async (callback: (tx: any) => Promise<unknown>) =>
        callback({
          tenant: { findUnique: async () => ({ id: "tenant-1" }) },
          complianceEvidencePack: {
            create: async ({ data }: any) => {
              persistedArtifact = data.artifact;
              return {
                ...data,
                id: "pack-1",
                createdAt: new Date("2026-08-09T00:00:00Z"),
              };
            },
          },
          auditEvent: { create: createAudit },
        }),
    } as never);
    const result = await service.createEvidencePack(
      "tenant-1",
      {
        name: "Quarterly evidence",
        windowFrom: "2026-08-01T00:00:00Z",
        windowTo: "2026-08-09T00:00:00Z",
        sections: ["AUDIT_LOGS", "ACCESS_REVIEWS"],
      },
      "auditor-1",
    );
    expect(result).toMatchObject({
      id: "pack-1",
      tenantId: "tenant-1",
      sections: ["AUDIT_LOGS", "ACCESS_REVIEWS"],
    });
    expect(result.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(persistedArtifact).toMatchObject({
      tenantId: "tenant-1",
      auditLogs: [{ tenantId: "tenant-1" }],
    });
    expect(createAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "compliance_evidence_pack.create",
          objectId: "pack-1",
        }),
      }),
    );
  });

  it("rejects unbounded evidence windows and cross-tenant downloads", async () => {
    const service = new PrivacyService({
      complianceEvidencePack: { findFirst: vi.fn(async () => null) },
    } as never);
    await expect(
      service.createEvidencePack(
        "tenant-1",
        {
          name: "Too broad",
          windowFrom: "2024-01-01T00:00:00Z",
          windowTo: "2026-01-01T00:00:00Z",
          sections: ["AUDIT_LOGS"],
        },
        "auditor-1",
      ),
    ).rejects.toThrow("cannot exceed 366 days");
    await expect(
      service.downloadEvidencePack("tenant-2", "pack-1"),
    ).rejects.toThrow("not found for this tenant");
    expect(
      (service as any).prisma.complianceEvidencePack.findFirst,
    ).toHaveBeenCalledWith({ where: { id: "pack-1", tenantId: "tenant-2" } });
  });

  it("requires a different approver and blocks deletion under a legal hold", async () => {
    const update = vi.fn(async ({ data }: any) => ({
      id: "request-1",
      tenantId: "tenant-1",
      requestType: "DELETE",
      subjectType: "STUDENT",
      subjectId: "student-1",
      reason: "Verified erasure request",
      requestedBy: "privacy-1",
      retentionUntil: null,
      checksum: null,
      createdAt: new Date("2026-08-09T00:00:00Z"),
      ...data,
    }));
    const service = new PrivacyService({
      dataSubjectRequest: {
        findFirst: async () => ({
          id: "request-1",
          tenantId: "tenant-1",
          requestType: "DELETE",
          subjectType: "STUDENT",
          subjectId: "student-1",
          status: "PENDING",
          requestedBy: "privacy-1",
          retentionUntil: null,
        }),
      },
      dataLegalHold: { findFirst: async () => ({ id: "hold-1" }) },
      $transaction: async (callback: any) =>
        callback({
          dataSubjectRequest: { update },
          auditEvent: { create: vi.fn() },
        }),
    } as never);
    await expect(
      service.decideDataSubjectRequest(
        "tenant-1",
        "request-1",
        {
          decision: "APPROVE",
          reason: "Independent approval",
        },
        "privacy-1",
      ),
    ).rejects.toThrow("different authenticated administrator");
    await expect(
      service.decideDataSubjectRequest(
        "tenant-1",
        "request-1",
        {
          decision: "APPROVE",
          reason: "Independent approval",
        },
        "privacy-2",
      ),
    ).resolves.toMatchObject({ status: "BLOCKED" });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          result: expect.objectContaining({ blockers: ["LEGAL_HOLD"] }),
        }),
      }),
    );
  });

  it("creates an immutable tenant-scoped subject export after approval", async () => {
    const update = vi.fn(async ({ data }: any) => ({
      id: "request-1",
      tenantId: "tenant-1",
      requestType: "EXPORT",
      subjectType: "GUARDIAN",
      subjectId: "guardian-1",
      reason: "Verified access request",
      requestedBy: "privacy-1",
      retentionUntil: null,
      createdAt: new Date("2026-08-09T00:00:00Z"),
      ...data,
    }));
    const service = new PrivacyService({
      dataSubjectRequest: {
        findFirst: async () => ({
          id: "request-1",
          tenantId: "tenant-1",
          requestType: "EXPORT",
          subjectType: "GUARDIAN",
          subjectId: "guardian-1",
          status: "PENDING",
          requestedBy: "privacy-1",
          retentionUntil: null,
        }),
      },
      dataLegalHold: { findFirst: async () => null },
      guardian: {
        findFirst: async ({ where }: any) => ({
          id: where.id,
          tenantId: where.tenantId,
          name: "Guardian",
        }),
      },
      privacyAcceptance: { findMany: async () => [] },
      $transaction: async (callback: any) =>
        callback({
          dataSubjectRequest: { update },
          auditEvent: { create: vi.fn() },
        }),
    } as never);
    const result = await service.decideDataSubjectRequest(
      "tenant-1",
      "request-1",
      {
        decision: "APPROVE",
        reason: "Identity and scope verified",
      },
      "privacy-2",
    );
    expect(result.status).toBe("COMPLETED");
    expect(result.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          artifact: expect.objectContaining({
            tenantId: "tenant-1",
            subjectId: "guardian-1",
          }),
        }),
      }),
    );
  });

  it("creates a tenant-scoped incident with validated ownership and audit evidence", async () => {
    const audit = vi.fn();
    const create = vi.fn(async ({ data }: any) => ({
      ...data,
      id: "incident-1",
      status: "OPEN",
      closedBy: null,
      closedAt: null,
      closureSummary: null,
      createdAt: new Date("2026-08-09T00:00:00Z"),
      updatedAt: new Date("2026-08-09T00:00:00Z"),
    }));
    const service = new PrivacyService({
      user: {
        findFirst: async ({ where }: any) =>
          where.tenantId === "tenant-1" ? { id: where.id } : null,
      },
      $transaction: async (callback: any) =>
        callback({
          securityIncident: { create },
          auditEvent: { create: audit },
        }),
    } as never);
    const incident = await service.createSecurityIncident(
      "tenant-1",
      {
        title: "Unauthorized roster access",
        classification: "CONFIDENTIALITY",
        severity: "HIGH",
        description:
          "A scoped investigation confirmed unexpected access to roster metadata.",
        ownerId: "security-1",
        evidence: ["https://evidence.school.test/case-1"],
      },
      "auditor-1",
    );
    expect(incident).toMatchObject({
      tenantId: "tenant-1",
      status: "OPEN",
      ownerId: "security-1",
    });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "security_incident.create",
          outcome: "OPEN",
        }),
      }),
    );
    await expect(
      service.createSecurityIncident(
        "tenant-1",
        {
          title: "Invalid evidence",
          classification: "OTHER",
          severity: "LOW",
          description:
            "This record contains an unsafe local evidence reference.",
          ownerId: "security-1",
          evidence: ["file:///secret.log"],
        },
        "auditor-1",
      ),
    ).rejects.toThrow("valid HTTPS URLs");
  });

  it("prevents cross-tenant updates and updates to closed incidents", async () => {
    const service = new PrivacyService({
      securityIncident: {
        findFirst: async ({ where }: any) =>
          where.tenantId === "tenant-1"
            ? { id: "incident-1", status: "CLOSED" }
            : null,
      },
    } as never);
    await expect(
      service.addSecurityIncidentUpdate(
        "tenant-2",
        "incident-1",
        {
          updateType: "INVESTIGATION",
          summary: "Validated the initial security report.",
          evidence: [],
        },
        "auditor-1",
      ),
    ).rejects.toThrow("not found for this tenant");
    await expect(
      service.addSecurityIncidentUpdate(
        "tenant-1",
        "incident-1",
        {
          updateType: "RECOVERY",
          summary: "Recovery has already completed and the case is closed.",
          evidence: [],
        },
        "auditor-1",
      ),
    ).rejects.toThrow("Closed incidents");
  });
});
