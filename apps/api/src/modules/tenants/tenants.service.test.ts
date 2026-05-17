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
      domain: null
    };
    const prisma = {
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          auditEvent: {
            create: async ({ data }: { data: unknown }) => {
              auditEvents.push(data);
              return data;
            }
          },
          tenant: {
            create: async () => {
              tenants.push(tenantCreateInput);
              return tenantCreateInput;
            }
          }
        }),
      tenant: {
        findMany: async () => tenants,
        findUnique: async () => tenantCreateInput
      }
    } as never;

    const service = new TenantsService(prisma);

    const tenant = await service.create({
      country: "US",
      name: "Pilot School",
      planKey: "starter",
      status: "PILOT",
      timezone: "America/New_York"
    });

    expect(tenant.id).toBeTruthy();
    await expect(service.list()).resolves.toHaveLength(1);
    await expect(service.getById(tenant.id)).resolves.toMatchObject({
      name: "Pilot School"
    });
    expect(auditEvents).toHaveLength(1);
    expect(auditEvents[0]).toMatchObject({
      action: "tenant.create",
      object: "Tenant",
      outcome: "SUCCESS",
      tenantId: "tenant-1"
    });
  });
});
