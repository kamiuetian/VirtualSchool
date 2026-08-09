import { describe, expect, it, vi } from "vitest";
import { PartnerApiService } from "./partner-api.service";

function fixture() {
  const credentials: any[] = [];
  const tokens: any[] = [];
  const prisma: any = {
    tenant: { findUnique: vi.fn().mockResolvedValue({ id: "tenant-1" }) },
    auditEvent: { create: vi.fn().mockResolvedValue({}) },
    machineCredential: {
      create: vi.fn(async ({ data }) => {
        const row = {
          id: "credential-1",
          status: "ACTIVE",
          lastUsedAt: null,
          rotatedAt: null,
          revokedAt: null,
          createdAt: new Date(),
          ...data,
        };
        credentials.push(row);
        return row;
      }),
      findMany: vi.fn(async () => credentials),
      findUnique: vi.fn(async ({ where }) =>
        credentials.find((row) => row.clientId === where.clientId),
      ),
      findFirst: vi.fn(async ({ where }) =>
        credentials.find(
          (row) => row.id === where.id && row.tenantId === where.tenantId,
        ),
      ),
      update: vi.fn(async ({ where, data }) => {
        const row = credentials.find((item) => item.id === where.id);
        Object.assign(row, data);
        return row;
      }),
    },
    machineAccessToken: {
      create: vi.fn(async ({ data }) => {
        tokens.push(data);
        return data;
      }),
      deleteMany: vi.fn(async ({ where }) => {
        const count = tokens.length;
        tokens.splice(
          0,
          tokens.length,
          ...tokens.filter(
            (token) => token.credentialId !== where.credentialId,
          ),
        );
        return { count };
      }),
    },
    $transaction: vi.fn(async (value) =>
      typeof value === "function" ? value(prisma) : Promise.all(value),
    ),
  };
  return {
    credentials,
    prisma,
    service: new PartnerApiService(prisma),
    tokens,
  };
}

describe("PartnerApiService", () => {
  it("returns an API key once while persisting only its hash", async () => {
    const { credentials, service } = fixture();
    const created = await service.create(
      "tenant-1",
      {
        name: "Sandbox",
        kind: "API_KEY",
        scopes: ["tenant.read"],
        rateLimitPerMinute: 60,
      },
      "admin-1",
    );
    expect(created.secret).toMatch(/^vsk_[a-f0-9]{24}\./);
    expect(credentials[0].secretHash).not.toContain(created.secret);
    expect((await service.list("tenant-1"))[0]).not.toHaveProperty("secret");
  });

  it("exchanges an OAuth client secret for a bounded bearer token", async () => {
    const { service, tokens } = fixture();
    const created = await service.create(
      "tenant-1",
      { name: "Partner", kind: "OAUTH_CLIENT", scopes: ["roster.read"] },
      "admin-1",
    );
    const token = await service.issueToken(
      created.clientId,
      created.secret,
      "client_credentials",
    );
    expect(token.access_token).toMatch(/^vst_/);
    expect(token.expires_in).toBe(3600);
    expect(token.scope).toBe("roster.read");
    expect(tokens[0].tokenHash).not.toBe(token.access_token);
  });

  it("rotates secrets with a grace period and revokes credentials", async () => {
    const { service } = fixture();
    const created = await service.create(
      "tenant-1",
      { name: "Partner", kind: "OAUTH_CLIENT", scopes: ["tenant.read"] },
      "admin-1",
    );
    const rotated = await service.rotate(
      "tenant-1",
      created.id,
      { graceMinutes: 5 },
      "admin-1",
    );
    expect(rotated.secret).not.toBe(created.secret);
    await expect(
      service.issueToken(created.clientId, created.secret),
    ).resolves.toMatchObject({ token_type: "Bearer" });
    await expect(
      service.revoke("tenant-1", created.id, "admin-1"),
    ).resolves.toMatchObject({ status: "REVOKED" });
    await expect(
      service.issueToken(created.clientId, rotated.secret),
    ).rejects.toThrow("invalid or revoked");
  });
});
