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

describe("PoliciesService", () => {
  it("creates a policy with an initial version and audit event", async () => {
    const auditEvents: unknown[] = [];
    const versions: unknown[] = [];
    const service = new PoliciesService({
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
    } as never);

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
    const service = new PoliciesService({
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
    } as never);

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
    const service = new PoliciesService({
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          auditEvent: {
            create: audit,
          },
          policy: {
            update: async () => ({
              ...existing,
              status: "PUBLISHED",
              version: 2,
            }),
          },
          policyVersion: {
            create: versionCreate,
          },
        }),
      policy: {
        findFirst: async () => existing,
      },
    } as never);

    await expect(
      service.publishPolicy("tenant-1", "policy-1", {
        actorId: "admin-1",
        reason: "Ready for pilot",
      }),
    ).resolves.toMatchObject({
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
    expect(audit).toHaveBeenCalledOnce();
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
    const service = new PoliciesService({
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
    } as never);

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
    const service = new PoliciesService({
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
    } as never);

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
    const service = new PoliciesService({
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
    } as never);

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
