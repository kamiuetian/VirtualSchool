import { describe, expect, it, vi } from "vitest";
import { PoliciesService } from "./policies.service";

const now = new Date("2026-05-17T10:00:00.000Z");
const baseRules = {
  approvedAppPackageIds: [],
  defaultWebAccess: "DENY",
  launcher: {
    showMessages: true,
    showSupportContact: true,
  },
  mode: "DEFAULT_SCHOOL",
  restrictions: {
    blockAppInstall: true,
    blockSafeMode: true,
    blockSettings: true,
  },
  urlAllowlist: [],
  urlBlocklist: [],
  webShortcuts: [],
};

function connectorRegistry(overrides: Record<string, unknown> = {}) {
  return {
    getActiveConnector: () => ({
      dispatchCommand: vi.fn(),
      key: "STUB",
      publishPolicy: vi.fn().mockResolvedValue({
        accepted: true,
        connector: "STUB",
        mdmPolicyName: "stub/policies/tenant-1/policy-1",
        request: {
          mode: "stub",
        },
        response: {
          acceptedAt: now.toISOString(),
        },
        ...overrides,
      }),
    }),
  };
}

describe("PoliciesService", () => {
  it("simulates URL policy decisions with the winning rule", async () => {
    const service = new PoliciesService(
      {
        policy: {
          findFirst: async () => ({
            id: "policy-1",
            rules: {
              ...baseRules,
              urlAllowlist: ["https://school.example/learn/*"],
            },
            version: 3,
          }),
        },
      } as never,
      connectorRegistry() as never,
    );
    await expect(
      service.simulateUrlPolicy(
        "tenant-1",
        "policy-1",
        "https://school.example/learn/math?student=1",
      ),
    ).resolves.toMatchObject({
      decision: "ALLOWED",
      matchedRule: "https://school.example/learn/*",
      policyVersion: 3,
    });
  });

  it("rejects events containing URL paths and cross-tenant devices", async () => {
    const create = vi.fn().mockResolvedValue({ id: "event-1" });
    const service = new PoliciesService(
      {
        blockedDomainEvent: { create },
        device: { findFirst: async () => null },
        policy: {
          findFirst: async () => ({
            id: "policy-1",
            rules: baseRules,
            version: 1,
          }),
        },
      } as never,
      connectorRegistry() as never,
    );
    const event = {
      domain: "school.example",
      occurredAt: now.toISOString(),
      policyId: "policy-1",
      policyVersion: 1,
      reason: "BLOCKLIST",
    };
    await expect(
      service.ingestBlockedDomainEvent("tenant-1", {
        ...event,
        deviceId: "other-device",
      }),
    ).rejects.toThrow("was not found for tenant tenant-1");
    await expect(
      service.ingestBlockedDomainEvent("tenant-1", {
        ...event,
        domain: "https://school.example/private?student=1",
      }),
    ).rejects.toThrow("hostname only");
    await expect(
      service.ingestBlockedDomainEvent("tenant-1", {
        ...event,
        domain: "School.Example",
      }),
    ).resolves.toEqual({ id: "event-1" });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          domain: "school.example",
          tenantId: "tenant-1",
        }),
      }),
    );
  });

  it("aggregates blocked domains", async () => {
    const service = new PoliciesService(
      {
        blockedDomainEvent: {
          findMany: async () => [
            { domain: "school.example", occurredAt: now, reason: "BLOCKLIST" },
            {
              domain: "school.example",
              occurredAt: new Date(now.getTime() + 1000),
              reason: "DEFAULT_DENY",
            },
          ],
        },
        tenant: { findUnique: async () => ({ id: "tenant-1" }) },
      } as never,
      connectorRegistry() as never,
    );
    await expect(
      service.listBlockedDomainAggregates("tenant-1"),
    ).resolves.toEqual([
      {
        count: 2,
        domain: "school.example",
        lastOccurredAt: "2026-05-17T10:00:01.000Z",
        reasons: ["BLOCKLIST", "DEFAULT_DENY"],
      },
    ]);
  });
  it("creates a policy with an initial version and audit event", async () => {
    const auditEvents: unknown[] = [];
    const versions: unknown[] = [];
    const service = new PoliciesService(
      {
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            auditEvent: {
              create: async ({ data }: { data: unknown }) => {
                auditEvents.push(data);
                return data;
              },
            },
            policy: {
              create: async ({ data }: { data: Record<string, unknown> }) => ({
                ...data,
                createdAt: now,
                id: "policy-1",
                updatedAt: now,
                version: 1,
              }),
            },
            policyVersion: {
              create: async ({ data }: { data: unknown }) => {
                versions.push(data);
                return data;
              },
            },
          }),
        tenant: {
          findUnique: async () => ({ id: "tenant-1" }),
        },
      } as never,
      connectorRegistry() as never,
    );

    await expect(
      service.createPolicy("tenant-1", {
        name: "Default School",
        rules: baseRules,
      }),
    ).resolves.toMatchObject({
      id: "policy-1",
      name: "Default School",
      version: 1,
    });

    expect(versions[0]).toMatchObject({
      policyId: "policy-1",
      summary: "Policy created",
      version: 1,
    });
    expect(auditEvents[0]).toMatchObject({
      action: "policy.create",
      object: "Policy",
      outcome: "SUCCESS",
    });
  });

  it("creates missing starter templates without duplicating existing policies", async () => {
    const createdNames: string[] = [];
    const service = new PoliciesService(
      {
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            auditEvent: {
              create: async () => ({}),
            },
            policy: {
              create: async ({ data }: { data: Record<string, unknown> }) => {
                createdNames.push(data.name as string);
                return {
                  ...data,
                  createdAt: now,
                  id: `policy-${createdNames.length}`,
                  updatedAt: now,
                  version: 1,
                };
              },
              findFirst: async ({ where }: { where: { name: string } }) =>
                where.name === "Default School Mode"
                  ? {
                      createdAt: now,
                      id: "existing-default",
                      name: "Default School Mode",
                      rules: baseRules,
                      status: "DRAFT",
                      tenantId: "tenant-1",
                      updatedAt: now,
                      version: 1,
                    }
                  : null,
            },
            policyVersion: {
              create: async () => ({}),
            },
          }),
        tenant: {
          findUnique: async () => ({ id: "tenant-1" }),
        },
      } as never,
      connectorRegistry() as never,
    );

    const policies = await service.createStarterTemplates("tenant-1");

    expect(policies).toHaveLength(7);
    expect(createdNames).not.toContain("Default School Mode");
    expect(createdNames).toContain("Grade 1-3 Lockdown");
  });

  it("publishes a policy by incrementing the version and recording a snapshot", async () => {
    const audit = vi.fn();
    const versionCreate = vi.fn();
    const existing = {
      createdAt: now,
      id: "policy-1",
      name: "Default School",
      rules: baseRules,
      status: "DRAFT",
      tenantId: "tenant-1",
      updatedAt: now,
      version: 1,
    };
    const service = new PoliciesService(
      {
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            auditEvent: {
              create: audit,
            },
            policy: {
              update: async ({ data }: { data: Record<string, unknown> }) => ({
                ...existing,
                mdmPolicyName: data.mdmPolicyName ?? null,
                mdmPublishError: data.mdmPublishError ?? null,
                mdmPublishedAt: data.mdmPublishedAt ?? null,
                mdmPublishRequest: data.mdmPublishRequest ?? null,
                mdmPublishResponse: data.mdmPublishResponse ?? null,
                mdmPublishStatus: data.mdmPublishStatus ?? null,
                status: data.status ?? "PUBLISHED",
                version: 2,
              }),
            },
            policyVersion: {
              create: versionCreate,
            },
          }),
        appCatalogItem: {
          findMany: async () => [],
        },
        policy: {
          findFirst: async () => existing,
        },
      } as never,
      connectorRegistry() as never,
    );

    await expect(
      service.publishPolicy("tenant-1", "policy-1", {
        actorId: "admin-1",
        reason: "Ready for pilot",
      }),
    ).resolves.toMatchObject({
      mdmPolicyName: "stub/policies/tenant-1/policy-1",
      mdmPublishStatus: "PUBLISHED",
      status: "PUBLISHED",
      version: 2,
    });

    expect(versionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: "admin-1",
          summary: "Ready for pilot",
          version: 2,
        }),
      }),
    );
    expect(audit).toHaveBeenCalledTimes(2);
  });

  it("updates validated Android controls only on a tenant draft", async () => {
    const audit = vi.fn();
    const existing = {
      createdAt: now,
      id: "policy-1",
      name: "Default School",
      rules: baseRules,
      status: "DRAFT",
      tenantId: "tenant-1",
      updatedAt: now,
      version: 1,
    };
    const update = vi.fn(
      async ({ data }: { data: Record<string, unknown> }) => ({
        ...existing,
        rules: data.rules,
      }),
    );
    const service = new PoliciesService(
      {
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({ auditEvent: { create: audit }, policy: { update } }),
        policy: { findFirst: async () => existing },
      } as never,
      connectorRegistry() as never,
    );

    await expect(
      service.updateAndroidControls("tenant-1", "policy-1", {
        blockFactoryReset: true,
        kioskCustomization: {
          powerButtonActions: "POWER_BUTTON_BLOCKED",
          statusBar: "SYSTEM_INFO_ONLY",
          systemNavigation: "HOME_BUTTON_ONLY",
        },
        systemUpdate: {
          endMinutes: 300,
          startMinutes: 60,
          type: "WINDOWED",
        },
      }),
    ).resolves.toMatchObject({
      rules: {
        android: {
          systemUpdate: { endMinutes: 300, startMinutes: 60, type: "WINDOWED" },
        },
        restrictions: { blockFactoryReset: true },
      },
    });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "policy.android_controls.update",
        }),
      }),
    );
  });

  it("rejects Android controls with an empty update window", async () => {
    const service = new PoliciesService(
      {
        policy: {
          findFirst: async () => ({
            id: "policy-1",
            rules: baseRules,
            status: "DRAFT",
            tenantId: "tenant-1",
          }),
        },
      } as never,
      connectorRegistry() as never,
    );

    await expect(
      service.updateAndroidControls("tenant-1", "policy-1", {
        blockFactoryReset: true,
        kioskCustomization: {
          powerButtonActions: "POWER_BUTTON_BLOCKED",
          statusBar: "SYSTEM_INFO_ONLY",
          systemNavigation: "HOME_BUTTON_ONLY",
        },
        systemUpdate: { endMinutes: 60, startMinutes: 60, type: "WINDOWED" },
      }),
    ).rejects.toThrow("start and end must differ");
  });

  it("assigns a published tenant baseline policy with an audit event", async () => {
    const audit = vi.fn();
    const policy = {
      createdAt: now,
      id: "policy-1",
      name: "Default School",
      rules: baseRules,
      status: "PUBLISHED",
      tenantId: "tenant-1",
      updatedAt: now,
      version: 2,
    };
    const service = new PoliciesService(
      {
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            auditEvent: {
              create: audit,
            },
            policyAssignment: {
              create: async ({ data }: { data: Record<string, unknown> }) => ({
                ...data,
                active: true,
                createdAt: now,
                id: "assignment-1",
                policy,
                updatedAt: now,
              }),
            },
          }),
        policy: {
          findFirst: async () => policy,
        },
      } as never,
      connectorRegistry() as never,
    );

    await expect(
      service.assignPolicy("tenant-1", "policy-1", {
        reason: "Baseline for pilot",
        scope: "TENANT",
      }),
    ).resolves.toMatchObject({
      id: "assignment-1",
      policyName: "Default School",
      scope: "TENANT",
    });
    expect(audit).toHaveBeenCalledOnce();
  });

  it("restores a prior snapshot and republishes it as a new version", async () => {
    const audit = vi.fn();
    const policy = {
      createdAt: now,
      id: "policy-1",
      name: "Default School",
      rules: baseRules,
      status: "PUBLISHED",
      tenantId: "tenant-1",
      updatedAt: now,
      version: 4,
    };
    const restoredRules = { ...baseRules, defaultWebAccess: "ALLOW" };
    let currentRules: unknown = baseRules;
    let currentVersion = 4;
    const update = vi.fn(
      async ({ data }: { data: Record<string, unknown> }) => {
        if (data.rules) currentRules = data.rules;
        if (data.version) currentVersion += 1;
        return {
          ...policy,
          rules: currentRules,
          version: currentVersion,
          mdmPolicyName: null,
          mdmPublishError: null,
          mdmPublishedAt: null,
          mdmPublishRequest: null,
          mdmPublishResponse: null,
          mdmPublishStatus: data.mdmPublishStatus ?? null,
        };
      },
    );
    const service = new PoliciesService(
      {
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            auditEvent: { create: audit },
            policy: { update },
            policyVersion: { create: vi.fn() },
          }),
        appCatalogItem: { findMany: async () => [] },
        policy: { findFirst: async () => ({ ...policy, rules: currentRules }) },
        policyVersion: {
          findFirst: async () => ({ snapshot: restoredRules, version: 2 }),
        },
      } as never,
      connectorRegistry() as never,
    );

    await expect(
      service.rollbackPolicy("tenant-1", "policy-1", {
        actorId: "admin-1",
        reason: "Bad web rule",
        version: 2,
      }),
    ).resolves.toMatchObject({ version: 5, rules: restoredRules });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "policy.rollback",
          reason: "Bad web rule",
        }),
      }),
    );
  });

  it("issues an audited, expiring device support unlock", async () => {
    const audit = vi.fn();
    const policy = {
      createdAt: now,
      id: "policy-support",
      name: "Maintenance",
      rules: { ...baseRules, mode: "EMERGENCY_SUPPORT_OVERRIDE" },
      status: "PUBLISHED",
      tenantId: "tenant-1",
      updatedAt: now,
      version: 2,
    };
    const service = new PoliciesService(
      {
        $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
          callback({
            auditEvent: { create: audit },
            policyAssignment: {
              create: async ({ data }: { data: Record<string, unknown> }) => ({
                ...data,
                active: true,
                createdAt: now,
                id: "unlock-1",
                policy,
                updatedAt: now,
              }),
            },
          }),
        device: { findFirst: async () => ({ id: "device-1" }) },
        policy: { findFirst: async () => policy },
      } as never,
      connectorRegistry() as never,
    );

    const result = await service.issueSupportUnlock("tenant-1", {
      deviceId: "device-1",
      durationMinutes: 30,
      policyId: policy.id,
      reason: "Case VS-42",
    });
    expect(Date.parse(result.endsAt!) - Date.parse(result.startsAt!)).toBe(
      1_800_000,
    );
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "policy.support_unlock.issue",
          reason: "Case VS-42",
        }),
      }),
    );
  });

  it("resolves the active device policy using mode precedence", async () => {
    const defaultPolicy = {
      createdAt: now,
      id: "policy-default",
      name: "Default School",
      rules: baseRules,
      status: "PUBLISHED",
      tenantId: "tenant-1",
      updatedAt: now,
      version: 4,
    };
    const lostPolicy = {
      ...defaultPolicy,
      id: "policy-lost",
      name: "Lost Device",
      rules: {
        ...baseRules,
        mode: "LOST_DEVICE",
      },
      version: 1,
    };
    const service = new PoliciesService(
      {
        device: {
          findFirst: async () => ({
            classId: "class-1",
            id: "device-1",
            student: {
              grade: "5",
              id: "student-1",
            },
            studentId: "student-1",
            tenantId: "tenant-1",
          }),
        },
        policyAssignment: {
          findMany: async () => [
            {
              active: true,
              actorId: null,
              createdAt: now,
              endsAt: null,
              id: "assignment-default",
              policy: defaultPolicy,
              policyId: defaultPolicy.id,
              reason: null,
              scope: "TENANT",
              scopeId: null,
              startsAt: null,
              tenantId: "tenant-1",
              updatedAt: now,
            },
            {
              active: true,
              actorId: null,
              createdAt: now,
              endsAt: null,
              id: "assignment-lost",
              policy: lostPolicy,
              policyId: lostPolicy.id,
              reason: null,
              scope: "DEVICE",
              scopeId: "device-1",
              startsAt: null,
              tenantId: "tenant-1",
              updatedAt: now,
            },
          ],
        },
      } as never,
      connectorRegistry() as never,
    );

    await expect(
      service.resolveActivePolicyForDevice("tenant-1", "device-1"),
    ).resolves.toMatchObject({
      activePolicy: {
        id: "policy-lost",
      },
      assignment: {
        id: "assignment-lost",
      },
    });
  });

  it("builds a device launcher and browser policy payload from the active policy", async () => {
    const policy = {
      createdAt: now,
      id: "policy-1",
      name: "Default School",
      rules: {
        ...baseRules,
        approvedAppPackageIds: ["com.google.android.apps.classroom"],
        webShortcuts: [
          {
            title: "Math",
            url: "https://math.example.edu",
          },
        ],
      },
      status: "PUBLISHED",
      tenantId: "tenant-1",
      updatedAt: now,
      version: 2,
    };
    const service = new PoliciesService(
      {
        appCatalogItem: {
          findMany: async () => [
            {
              approvalStatus: "APPROVED",
              approvedGrades: ["5"],
              category: "Learning",
              createdAt: now,
              description: null,
              iconUrl: "https://cdn.example.edu/classroom.png",
              id: "app-1",
              installRules: {
                installType: "FORCE_INSTALLED",
              },
              name: "Google Classroom",
              packageId: "com.google.android.apps.classroom",
              tenantId: "tenant-1",
              updatedAt: now,
            },
          ],
        },
        device: {
          findFirst: async () => ({
            classId: null,
            id: "device-1",
            student: null,
            studentId: null,
            tenantId: "tenant-1",
          }),
        },
        policyAssignment: {
          findMany: async () => [
            {
              active: true,
              actorId: null,
              createdAt: now,
              endsAt: null,
              id: "assignment-1",
              policy,
              policyId: policy.id,
              reason: null,
              scope: "TENANT",
              scopeId: null,
              startsAt: null,
              tenantId: "tenant-1",
              updatedAt: now,
            },
          ],
        },
      } as never,
      connectorRegistry() as never,
    );

    await expect(
      service.getDevicePolicyPayload("tenant-1", "device-1"),
    ).resolves.toMatchObject({
      browser: {
        defaultWebAccess: "DENY",
      },
      launcher: {
        approvedApps: [
          {
            installType: "FORCE_INSTALLED",
            packageId: "com.google.android.apps.classroom",
          },
        ],
        webShortcuts: [
          {
            title: "Math",
          },
        ],
      },
      policy: {
        id: "policy-1",
        mode: "DEFAULT_SCHOOL",
      },
    });
  });
});
