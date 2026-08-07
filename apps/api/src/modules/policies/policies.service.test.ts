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
        tenant: { findUnique: async () => ({ webFilterSettings: null }) },
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

  it("gives tenant never-allowed rules precedence over a policy allowlist", async () => {
    const service = new PoliciesService(
      {
        tenant: {
          findUnique: async () => ({
            webFilterSettings: {
              neverAllowedUrls: ["https://school.example/unsafe/*"],
              blockedCategories: ["MALWARE"],
              safeSearch: { bing: true, google: true, youtubeRestrictedMode: "STRICT" },
            },
          }),
        },
        policy: {
          findFirst: async () => ({
            id: "policy-1",
            rules: { ...baseRules, urlAllowlist: ["https://school.example/*"] },
            version: 4,
          }),
        },
      } as never,
      connectorRegistry() as never,
    );
    await expect(
      service.simulateUrlPolicy(
        "tenant-1",
        "policy-1",
        "https://school.example/unsafe/game",
      ),
    ).resolves.toMatchObject({
      decision: "BLOCKED",
      reason: "GLOBAL_NEVER_ALLOWED",
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
        tenant: { findUnique: async () => ({ webFilterSettings: null }) },
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
        tenant: {
          findUnique: async () => ({
            webFilterSettings: {
              blockedCategories: ["MALWARE"],
              neverAllowedUrls: ["https://unsafe.example/*"],
              safeSearch: { bing: true, google: true, youtubeRestrictedMode: "STRICT" },
            },
          }),
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
            classId: "class-1",
            id: "device-1",
            student: null,
            studentId: null,
            tenantId: "tenant-1",
          }),
        },
        lmsCourseMapping: {
          findMany: async () => [
            {
              displayName: "Canvas Biology",
              launchUrl: "https://canvas.school.test/courses/42",
            },
          ],
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
        tenant: {
          findUnique: async () => ({
            webFilterSettings: {
              blockedCategories: ["MALWARE"],
              neverAllowedUrls: ["https://unsafe.example/*"],
              safeSearch: { bing: true, google: true, youtubeRestrictedMode: "STRICT" },
            },
          }),
        },
      } as never,
      connectorRegistry() as never,
    );

    await expect(
      service.getDevicePolicyPayload("tenant-1", "device-1"),
    ).resolves.toMatchObject({
      browser: {
        blockedCategories: ["MALWARE"],
        defaultWebAccess: "DENY",
        neverAllowedUrls: ["https://unsafe.example/*"],
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
          {
            title: "Canvas Biology",
            url: "https://canvas.school.test/courses/42",
          },
        ],
      },
      policy: {
        id: "policy-1",
        mode: "DEFAULT_SCHOOL",
      },
    });
  });

  it("does not resolve or deliver policy to a retired device", async () => {
    const service = new PoliciesService(
      {
        device: {
          findFirst: async () => ({
            id: "device-retired",
            status: "RETIRED",
            student: null,
            studentId: null,
            classId: null,
          }),
        },
      } as never,
      connectorRegistry() as never,
    );

    await expect(
      service.getDevicePolicyPayload("tenant-1", "device-retired"),
    ).rejects.toThrow("No policy is delivered to retired device");
  });

  it("schedules an audited Exam Mode assignment for an eligible scope", async () => {
    const create = vi.fn(async ({ data }: any) => ({
      ...data,
      active: true,
      createdAt: now,
      id: "exam-assignment-1",
      policy: {
        id: "exam-policy",
        name: "Exam",
        status: "PUBLISHED",
        version: 3,
      },
    }));
    const auditCreate = vi.fn();
    const service = new PoliciesService(
      {
        policy: {
          findFirst: async () => ({
            id: "exam-policy",
            name: "Exam",
            status: "PUBLISHED",
            version: 3,
            rules: { ...baseRules, mode: "EXAM" },
          }),
        },
        classSection: { findFirst: async () => ({ id: "class-1" }) },
        $transaction: async (callback: (tx: any) => Promise<unknown>) =>
          callback({
            policyAssignment: { create },
            auditEvent: { create: auditCreate },
          }),
      } as never,
      connectorRegistry() as never,
    );

    await expect(
      service.scheduleExam(
        "tenant-1",
        {
          policyId: "exam-policy",
          scope: "CLASS",
          scopeId: "class-1",
          startsAt: "2026-08-08T08:00:00.000Z",
          endsAt: "2026-08-08T10:00:00.000Z",
          reason: "Final assessment",
        },
        "staff-1",
      ),
    ).resolves.toMatchObject({ id: "exam-assignment-1", scope: "CLASS" });
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "exam.schedule",
          actorId: "staff-1",
        }),
      }),
    );
  });

  it("selects Exam Mode over ordinary schedules while enforcing the active time window", async () => {
    const findMany = vi.fn(async () => [
      {
        active: true,
        actorId: null,
        createdAt: now,
        endsAt: null,
        id: "ordinary",
        policyId: "ordinary-policy",
        reason: null,
        scope: "CLASS",
        scopeId: "class-1",
        startsAt: null,
        tenantId: "tenant-1",
        updatedAt: now,
        policy: {
          createdAt: now,
          updatedAt: now,
          id: "ordinary-policy",
          tenantId: "tenant-1",
          name: "Class",
          status: "PUBLISHED",
          version: 9,
          rules: { ...baseRules, mode: "TIMETABLE_CLASS" },
        },
      },
      {
        active: true,
        actorId: null,
        createdAt: now,
        endsAt: new Date("2026-08-08T10:00:00Z"),
        id: "exam",
        policyId: "exam-policy",
        reason: null,
        scope: "CLASS",
        scopeId: "class-1",
        startsAt: new Date("2026-08-08T08:00:00Z"),
        tenantId: "tenant-1",
        updatedAt: now,
        policy: {
          createdAt: now,
          updatedAt: now,
          id: "exam-policy",
          tenantId: "tenant-1",
          name: "Exam",
          status: "PUBLISHED",
          version: 1,
          rules: { ...baseRules, mode: "EXAM" },
        },
      },
    ]);
    const service = new PoliciesService(
      {
        device: {
          findFirst: async () => ({
            id: "device-1",
            status: "ONLINE",
            classId: "class-1",
            studentId: null,
            student: null,
          }),
        },
        policyAssignment: { findMany },
      } as never,
      connectorRegistry() as never,
    );

    await expect(
      service.resolveActivePolicyForDevice("tenant-1", "device-1"),
    ).resolves.toMatchObject({ assignment: { id: "exam" } });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          active: true,
          AND: expect.any(Array),
        }),
      }),
    );
  });

  it("rejects non-exam policies and invalid exam windows", async () => {
    const service = new PoliciesService(
      {
        policy: {
          findFirst: async () => ({
            id: "policy-1",
            status: "PUBLISHED",
            rules: baseRules,
          }),
        },
      } as never,
      connectorRegistry() as never,
    );
    await expect(
      service.scheduleExam(
        "tenant-1",
        {
          policyId: "policy-1",
          scope: "GRADE",
          scopeId: "5",
          startsAt: "2026-08-08T10:00:00.000Z",
          endsAt: "2026-08-08T09:00:00.000Z",
        },
        "staff-1",
      ),
    ).rejects.toThrow("after its start");
    await expect(
      service.scheduleExam(
        "tenant-1",
        {
          policyId: "policy-1",
          scope: "GRADE",
          scopeId: "5",
          startsAt: "2026-08-08T08:00:00.000Z",
          endsAt: "2026-08-08T09:00:00.000Z",
        },
        "staff-1",
      ),
    ).rejects.toThrow("published Exam Mode policy");
  });

  it("completes an exam assignment immediately and audits the release", async () => {
    const auditCreate = vi.fn();
    const assignment = {
      active: true,
      actorId: "staff-1",
      createdAt: now,
      endsAt: new Date("2026-08-08T10:00:00Z"),
      id: "exam-1",
      policyId: "exam-policy",
      reason: null,
      scope: "STUDENT",
      scopeId: "student-1",
      startsAt: now,
      tenantId: "tenant-1",
      policy: {
        id: "exam-policy",
        name: "Exam",
        status: "PUBLISHED",
        version: 1,
        rules: { ...baseRules, mode: "EXAM" },
      },
    };
    const service = new PoliciesService(
      {
        policyAssignment: { findFirst: async () => assignment },
        $transaction: async (callback: (tx: any) => Promise<unknown>) =>
          callback({
            policyAssignment: {
              update: async ({ data }: any) => ({ ...assignment, ...data }),
            },
            auditEvent: { create: auditCreate },
          }),
      } as never,
      connectorRegistry() as never,
    );

    await expect(
      service.completeExam(
        "tenant-1",
        "exam-1",
        "All submissions received",
        "staff-2",
      ),
    ).resolves.toMatchObject({ active: false });
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "exam.complete",
          actorId: "staff-2",
          reason: "All submissions received",
        }),
      }),
    );
  });

  it("reports all bounded exam readiness failures for devices in the scheduled scope", async () => {
    const reportedAt = new Date();
    const assignment = {
      id: "exam-1",
      scope: "CLASS",
      scopeId: "class-1",
      policy: {
        id: "exam-policy",
        version: 4,
        rules: {
          ...baseRules,
          mode: "EXAM",
          approvedAppPackageIds: ["com.exam.app"],
        },
      },
    };
    const service = new PoliciesService(
      {
        policyAssignment: { findFirst: async () => assignment },
        device: {
          findMany: async () => [
            {
              id: "ready",
              serialNumber: "A",
              status: "ONLINE",
              policyVersion: 4,
              diagnostics: [
                {
                  batteryLevel: 80,
                  browserVersion: "1.2.0",
                  details: { installedPackageIds: ["com.exam.app"] },
                  networkStatus: "ONLINE",
                  policyVersion: 4,
                  reportedAt,
                },
              ],
            },
            {
              id: "blocked",
              serialNumber: "B",
              status: "OFFLINE",
              policyVersion: 3,
              diagnostics: [
                {
                  batteryLevel: 10,
                  browserVersion: "0.9",
                  details: { installedPackageIds: [] },
                  networkStatus: "OFFLINE",
                  policyVersion: 3,
                  reportedAt,
                },
              ],
            },
          ],
        },
      } as never,
      connectorRegistry() as never,
    );

    const result = await service.getExamReadiness("tenant-1", "exam-1");
    expect(result).toMatchObject({ ready: 1, blocked: 1, policyVersion: 4 });
    expect(result.devices[1]?.issues).toEqual([
      "OFFLINE",
      "LOW_BATTERY",
      "WRONG_POLICY",
      "MISSING_APP",
      "UNSUPPORTED_BROWSER",
    ]);
  });

  it("queues only ready devices for an approved strict-profile assessment launch", async () => {
    const reportedAt = new Date();
    const assignment = {
      active: true,
      endsAt: new Date(Date.now() + 3_600_000),
      id: "exam-1",
      startsAt: new Date(Date.now() - 60_000),
      scope: "CLASS",
      scopeId: "class-1",
      policy: {
        id: "exam-policy",
        version: 2,
        rules: {
          ...baseRules,
          mode: "EXAM",
          webShortcuts: [
            { title: "Assessment", url: "https://exam.example/start" },
          ],
          urlAllowlist: ["https://exam.example/start"],
        },
      },
    };
    const commandCreate = vi.fn(async () => ({ id: "command-1" }));
    const auditCreate = vi.fn();
    const service = new PoliciesService(
      {
        policyAssignment: { findFirst: async () => assignment },
        device: {
          findMany: async () => [
            {
              id: "ready",
              serialNumber: "A",
              status: "ONLINE",
              policyVersion: 2,
              diagnostics: [
                {
                  batteryLevel: 80,
                  browserVersion: "2.0",
                  details: { installedPackageIds: [] },
                  networkStatus: "ONLINE",
                  policyVersion: 2,
                  reportedAt,
                },
              ],
            },
          ],
        },
        $transaction: async (callback: (tx: any) => Promise<unknown>) =>
          callback({
            auditEvent: { create: auditCreate },
            remoteCommand: { create: commandCreate },
          }),
      } as never,
      connectorRegistry() as never,
    );

    await expect(
      service.launchAssessment(
        "tenant-1",
        "exam-1",
        {
          resource: "https://exam.example/start",
          resourceType: "URL",
          reason: "Begin",
        },
        "staff-1",
      ),
    ).resolves.toMatchObject({ queued: 1, skipped: 0 });
    expect(commandCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deviceId: "ready",
          status: "QUEUED",
          payload: expect.objectContaining({ strictProfile: true }),
        }),
      }),
    );
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "exam.assessment.launch",
          actorId: "staff-1",
        }),
      }),
    );
  });

  it("rejects assessment resources outside the scheduled exam policy", async () => {
    const assignment = {
      active: true,
      endsAt: new Date(Date.now() + 3_600_000),
      id: "exam-1",
      startsAt: new Date(Date.now() - 60_000),
      scope: "CLASS",
      scopeId: "class-1",
      policy: {
        id: "exam-policy",
        version: 2,
        rules: { ...baseRules, mode: "EXAM" },
      },
    };
    const service = new PoliciesService(
      { policyAssignment: { findFirst: async () => assignment } } as never,
      connectorRegistry() as never,
    );
    await expect(
      service.launchAssessment(
        "tenant-1",
        "exam-1",
        { resource: "https://unapproved.example", resourceType: "URL" },
        "staff-1",
      ),
    ).rejects.toThrow("not approved");
  });

  it("records only in-scope privacy-limited integrity events", async () => {
    const create = vi.fn().mockResolvedValue({ id: "audit-1" });
    const assignment = {
      id: "exam-1",
      startsAt: new Date("2026-05-17T09:00:00Z"),
      endsAt: new Date("2026-05-17T11:00:00Z"),
      scope: "CLASS",
      scopeId: "class-1",
      policy: { rules: { ...baseRules, mode: "EXAM" } },
    };
    const service = new PoliciesService(
      {
        policyAssignment: { findFirst: async () => assignment },
        device: { findFirst: async () => ({ id: "device-1" }) },
        auditEvent: { create },
      } as never,
      connectorRegistry() as never,
    );
    await service.ingestExamIntegrityEvent("tenant-1", "exam-1", {
      deviceId: "device-1",
      occurredAt: now.toISOString(),
      type: "APP_EXIT_ATTEMPT",
    });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "exam.integrity.event",
          newValue: expect.objectContaining({
            assignmentId: "exam-1",
            type: "APP_EXIT_ATTEMPT",
          }),
        }),
      }),
    );
  });

  it("queues and audits a bounded privileged exam unlock", async () => {
    const assignment = {
      active: true,
      id: "exam-1",
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 3_600_000),
      scope: "CLASS",
      scopeId: "class-1",
      policy: { rules: { ...baseRules, mode: "EXAM" } },
    };
    const commandCreate = vi.fn().mockResolvedValue({ id: "command-1" });
    const auditCreate = vi.fn();
    const service = new PoliciesService(
      {
        policyAssignment: { findFirst: async () => assignment },
        device: { findFirst: async () => ({ id: "device-1" }) },
        $transaction: async (callback: (tx: any) => Promise<unknown>) =>
          callback({
            remoteCommand: { create: commandCreate },
            auditEvent: { create: auditCreate },
          }),
      } as never,
      connectorRegistry() as never,
    );
    await service.unlockExamDevice(
      "tenant-1",
      "exam-1",
      { deviceId: "device-1", durationMinutes: 5, reason: "Candidate support" },
      "admin-1",
    );
    expect(commandCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payload: expect.objectContaining({
            action: "EXAM_EMERGENCY_UNLOCK",
            durationMinutes: 5,
          }),
        }),
      }),
    );
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "exam.emergency_unlock",
          actorId: "admin-1",
          reason: "Candidate support",
        }),
      }),
    );
  });

  it("builds a tenant-scoped post-exam report from durable evidence", async () => {
    const assignment = {
      id: "exam-1",
      startsAt: now,
      endsAt: new Date(now.getTime() + 3_600_000),
      scope: "CLASS",
      scopeId: "class-1",
      policy: {
        id: "exam-policy",
        version: 3,
        rules: { ...baseRules, mode: "EXAM" },
      },
    };
    const service = new PoliciesService(
      {
        policyAssignment: { findFirst: async () => assignment },
        device: {
          findMany: async () => [{ id: "device-1" }, { id: "device-2" }],
        },
        auditEvent: {
          findMany: async () => [
            {
              action: "exam.assessment.launch",
              actorId: "admin-1",
              createdAt: now,
              newValue: { assignmentId: "exam-1", queued: 1, skipped: 1 },
              reason: "Begin",
            },
            {
              action: "exam.emergency_unlock",
              actorId: "admin-1",
              createdAt: now,
              newValue: {
                assignmentId: "exam-1",
                deviceId: "device-1",
                durationMinutes: 5,
              },
              reason: "Support",
            },
          ],
        },
        remoteCommand: {
          findMany: async () => [
            {
              deviceId: "device-1",
              status: "COMPLETED",
              payload: { action: "ASSESSMENT_LAUNCH", assignmentId: "exam-1" },
              failureReason: null,
              completedAt: now,
              updatedAt: now,
            },
          ],
        },
      } as never,
      connectorRegistry() as never,
    );
    await expect(
      service.getExamReport("tenant-1", "exam-1"),
    ).resolves.toMatchObject({
      attendance: { targeted: 2, participated: 1, absent: 1 },
      readiness: { ready: 1, blocked: 1 },
      unlocks: [{ deviceId: "device-1", durationMinutes: 5 }],
    });
  });
});
