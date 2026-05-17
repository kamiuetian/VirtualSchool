import { describe, expect, it } from "vitest";
import { TenantsService } from "./tenants.service";

describe("TenantsService", () => {
  it("creates an isolated tenant summary and audit event", async () => {
    const auditEvents: unknown[] = [];
    const tenants: unknown[] = [];
    const tenantCreateInput = {
      country: "US",
      createdAt: new Date(),
      id: "tenant-1",
      language: "en",
      name: "Pilot School",
      planKey: "starter",
      status: "PILOT",
      timezone: "America/New_York",
      updatedAt: new Date(),
      domain: null,
    };
    const prisma = {
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          auditEvent: {
            create: async ({ data }: { data: unknown }) => {
              auditEvents.push(data);
              return data;
            },
          },
          tenant: {
            create: async () => {
              tenants.push(tenantCreateInput);
              return tenantCreateInput;
            },
          },
        }),
      tenant: {
        findMany: async () => tenants,
        findUnique: async () => tenantCreateInput,
      },
    } as never;

    const service = new TenantsService(prisma);

    const tenant = await service.create({
      country: "US",
      name: "Pilot School",
      planKey: "starter",
      status: "PILOT",
      timezone: "America/New_York",
    });

    expect(tenant.id).toBeTruthy();
    await expect(service.list()).resolves.toHaveLength(1);
    await expect(service.getById(tenant.id)).resolves.toMatchObject({
      name: "Pilot School",
    });
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]).toMatchObject({
      action: "tenant.create",
      object: "Tenant",
      outcome: "SUCCESS",
      tenantId: "tenant-1",
    });
  });

  it("creates a branch and records a branch audit event", async () => {
    const auditEvents: unknown[] = [];
    const branchCreateInput = {
      createdAt: new Date(),
      id: "branch-1",
      name: "Main Campus",
      status: "ACTIVE",
      tenantId: "tenant-1",
      timezone: "America/New_York",
      updatedAt: new Date(),
    };
    const prisma = {
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          auditEvent: {
            create: async ({ data }: { data: unknown }) => {
              auditEvents.push(data);
              return data;
            },
          },
          branch: {
            create: async () => branchCreateInput,
          },
        }),
      tenant: {
        findUnique: async () => ({ id: "tenant-1" }),
      },
    } as never;

    const service = new TenantsService(prisma);

    await expect(
      service.createBranch("tenant-1", {
        name: "Main Campus",
        timezone: "America/New_York",
      }),
    ).resolves.toMatchObject({
      id: "branch-1",
      name: "Main Campus",
      tenantId: "tenant-1",
    });
    expect(auditEvents[0]).toMatchObject({
      action: "branch.create",
      object: "Branch",
      outcome: "SUCCESS",
      tenantId: "tenant-1",
    });
  });

  it("lists only authorized tenants for non-platform users", async () => {
    const service = new TenantsService({
      tenant: {
        findMany: async ({ where }: { where: { id: { in: string[] } } }) =>
          where.id.in.map((id) => ({
            country: "US",
            id,
            name: `Tenant ${id}`,
            planKey: "starter",
            status: "PILOT",
            timezone: "America/New_York",
          })),
      },
    } as never);

    await expect(service.listAuthorized(["tenant-1"])).resolves.toEqual([
      expect.objectContaining({
        id: "tenant-1",
      }),
    ]);
  });

  it("lists all tenants for platform users", async () => {
    const service = new TenantsService({
      tenant: {
        findMany: async () => [
          {
            country: "US",
            id: "tenant-1",
            name: "Tenant 1",
            planKey: "starter",
            status: "PILOT",
            timezone: "America/New_York",
          },
        ],
      },
    } as never);

    await expect(service.listAuthorized(["*"])).resolves.toHaveLength(1);
  });

  it("builds the first-run onboarding checklist from tenant setup state", async () => {
    const prisma = {
      appCatalogItem: {
        count: async () => 0,
      },
      branch: {
        count: async () => 1,
      },
      classSection: {
        count: async () => 0,
      },
      device: {
        count: async () => 0,
      },
      enrollmentBatch: {
        count: async () => 0,
      },
      policy: {
        count: async () => 1,
      },
      student: {
        count: async () => 2,
      },
      tenant: {
        findUnique: async () => ({
          country: "US",
          name: "Pilot School",
          planKey: "starter",
          timezone: "America/New_York",
        }),
      },
    } as never;

    const service = new TenantsService(prisma);

    await expect(
      service.getOnboardingChecklist("tenant-1"),
    ).resolves.toMatchObject({
      completedCount: 4,
      tenantId: "tenant-1",
      totalCount: 7,
    });
  });
});
