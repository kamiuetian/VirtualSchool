import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { EnterpriseIdentityService } from "./enterprise-identity.service";

describe("EnterpriseIdentityService", () => {
  it("requires referenced secrets and a protected tenant-local break-glass administrator", async () => {
    const service = new EnterpriseIdentityService({
      user: {
        findFirst: async () => ({
          id: "admin-1",
          tenantId: "tenant-1",
          status: "ACTIVE",
          role: "SCHOOL_ADMIN",
          mfaEnabled: true,
        }),
      },
    } as never);
    await expect(
      service.configure("tenant-1", {
        protocol: "OIDC",
        issuer: "https://login.example.test",
        clientId: "client",
        credentialReference: "embedded-secret",
        scimTokenReference: "secret://scim/token",
        breakGlassUserId: "admin-1",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects ambiguous SCIM group-to-role resolution", async () => {
    const service = new EnterpriseIdentityService({
      enterpriseIdentityConnection: {
        findUnique: async () => ({ id: "connection-1", status: "ACTIVE" }),
      },
      scimGroupRoleMapping: {
        findMany: async () => [{ role: "TEACHER" }, { role: "IT_ADMIN" }],
      },
    } as never);
    await expect(
      service.provisionUser("tenant-1", {
        operation: "CREATE",
        externalId: "user-1",
        email: "teacher@example.test",
        name: "Teacher",
        groups: ["teachers", "admins"],
      }),
    ).rejects.toThrow("exactly one");
  });

  it("creates a tenant-scoped SCIM user and audits the resolved role", async () => {
    const calls: any[] = [];
    const tx = {
      user: {
        create: async ({ data }: any) => {
          calls.push(data);
          return { id: "user-1", ...data };
        },
      },
      auditEvent: { create: async ({ data }: any) => calls.push(data) },
    };
    const service = new EnterpriseIdentityService({
      enterpriseIdentityConnection: {
        findUnique: async () => ({ id: "connection-1", status: "ACTIVE" }),
      },
      scimGroupRoleMapping: {
        findMany: async () => [{ role: "TEACHER", branchId: "branch-1" }],
      },
      user: { findUnique: async () => null },
      $transaction: async (work: any) => work(tx),
    } as never);
    await service.provisionUser(
      "tenant-1",
      {
        operation: "CREATE",
        externalId: "external-1",
        email: "Teacher@Example.test",
        name: "Teacher",
        groups: ["teachers"],
      },
      "scim-client",
    );
    expect(calls[0]).toMatchObject({
      tenantId: "tenant-1",
      email: "teacher@example.test",
      role: "TEACHER",
      branchId: "branch-1",
      scimConnectionId: "connection-1",
    });
    expect(calls[1]).toMatchObject({
      action: "scim.user.create",
      outcome: "ACTIVE",
    });
  });

  it("soft-deletes SCIM users and forces logout", async () => {
    let update: any;
    const existing = {
      id: "user-1",
      email: "user@example.test",
      role: "TEACHER",
      status: "ACTIVE",
      branchId: null,
    };
    const service = new EnterpriseIdentityService({
      enterpriseIdentityConnection: {
        findUnique: async () => ({ id: "connection-1", status: "ACTIVE" }),
      },
      scimGroupRoleMapping: {
        findMany: async () => [{ role: "TEACHER", branchId: null }],
      },
      user: { findUnique: async () => existing },
      $transaction: async (work: any) =>
        work({
          user: {
            update: async (args: any) => {
              update = args;
              return { ...existing, ...args.data };
            },
          },
          auditEvent: { create: async () => undefined },
        }),
    } as never);
    await service.provisionUser("tenant-1", {
      operation: "DELETE",
      externalId: "external-1",
      email: "user@example.test",
      name: "User",
      groups: ["teachers"],
      reason: "Removed upstream",
    });
    expect(update.data.status).toBe("DEACTIVATED");
    expect(update.data.forcedLogoutAt).toBeInstanceOf(Date);
  });
});
