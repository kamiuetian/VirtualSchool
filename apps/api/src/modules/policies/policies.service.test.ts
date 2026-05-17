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
});
