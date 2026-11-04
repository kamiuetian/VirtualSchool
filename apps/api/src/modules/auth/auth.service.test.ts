import { UnauthorizedException } from "@nestjs/common";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthService } from "./auth.service";
import { createHash } from "node:crypto";
import type { AuthenticatedUser } from "./types/authenticated-request";

describe("AuthService", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds a development user from explicit dev headers", async () => {
    vi.stubEnv("AUTH_MODE", "development");
    vi.stubEnv("NODE_ENV", "test");
    const service = new AuthService();

    await expect(
      service.authenticate({
        "x-dev-role": "IT_ADMIN",
        "x-dev-subject": "auth0|it-admin",
        "x-dev-tenant-id": "tenant-1,tenant-2",
      }),
    ).resolves.toMatchObject({
      permissions: expect.arrayContaining(["device:read", "device:enroll"]),
      role: "IT_ADMIN",
      subject: "auth0|it-admin",
      tenantIds: ["tenant-1", "tenant-2"],
    });
  });

  it("rejects unsupported development roles", async () => {
    vi.stubEnv("AUTH_MODE", "development");
    vi.stubEnv("NODE_ENV", "test");
    const service = new AuthService();

    await expect(
      service.authenticate({
        "x-dev-role": "ROOT",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects wildcard tenant scope for non-platform development roles", async () => {
    vi.stubEnv("AUTH_MODE", "development");
    vi.stubEnv("NODE_ENV", "test");
    const service = new AuthService();

    await expect(
      service.authenticate({
        "x-dev-role": "SCHOOL_ADMIN",
        "x-dev-subject": "local|school-admin",
        "x-dev-tenant-id": "*",
      }),
    ).rejects.toThrow("explicit tenant scope");
  });

  it("normalizes platform development users to wildcard scope", async () => {
    vi.stubEnv("AUTH_MODE", "development");
    vi.stubEnv("NODE_ENV", "test");
    const service = new AuthService();

    await expect(
      service.authenticate({
        "x-dev-role": "PLATFORM_SUPER_ADMIN",
        "x-dev-tenant-id": "tenant-1",
      }),
    ).resolves.toMatchObject({ tenantIds: ["*"] });
  });

  it("rejects development authentication during production startup", () => {
    vi.stubEnv("AUTH_MODE", "development");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => new AuthService()).toThrow(
      "AUTH_MODE=development is allowed only",
    );
  });

  it("rejects missing and unrecognized authentication modes", () => {
    vi.stubEnv("AUTH_MODE", "");
    expect(() => new AuthService()).toThrow("AUTH_MODE must be explicitly set");

    vi.stubEnv("AUTH_MODE", "auth-zero");
    expect(() => new AuthService()).toThrow("AUTH_MODE must be explicitly set");
  });

  it("rejects Auth0 users that are not active in stored staff state", async () => {
    vi.stubEnv("AUTH_MODE", "development");
    vi.stubEnv("NODE_ENV", "test");
    const service = new AuthService({
      user: {
        findFirst: vi.fn().mockResolvedValue({
          forcedLogoutAt: null,
          status: "SUSPENDED",
        }),
      },
    } as never);
    const enforce = storedStateEnforcer(service);

    await expect(enforce(auth0User())).rejects.toThrow(
      "User account is not active",
    );
  });

  it("rejects Auth0 tokens issued before a forced logout", async () => {
    vi.stubEnv("AUTH_MODE", "development");
    vi.stubEnv("NODE_ENV", "test");
    const service = new AuthService({
      user: {
        findFirst: vi.fn().mockResolvedValue({
          forcedLogoutAt: new Date("2026-01-01T12:00:00.000Z"),
          status: "ACTIVE",
        }),
      },
    } as never);
    const enforce = storedStateEnforcer(service);

    await expect(
      enforce(
        auth0User({
          tokenIssuedAt: new Date("2026-01-01T11:59:59.000Z"),
        }),
      ),
    ).rejects.toThrow("User session has been revoked");
  });

  it("authenticates a tenant-scoped API key with only mapped scopes", async () => {
    vi.stubEnv("AUTH_MODE", "development");
    vi.stubEnv("NODE_ENV", "test");
    const key = "vsk_client123456789012345678.secret-value";
    const service = new AuthService({
      machineCredential: {
        findUnique: vi.fn().mockResolvedValue({
          id: "machine-1",
          tenantId: "tenant-1",
          status: "ACTIVE",
          secretHash: createHash("sha256").update(key).digest("hex"),
          previousSecretHash: null,
          previousValidUntil: null,
          scopes: ["devices.read"],
          rateLimitPerMinute: 20,
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    } as never);
    await expect(
      service.authenticate({ "x-api-key": key }),
    ).resolves.toMatchObject({
      authMode: "machine",
      tenantIds: ["tenant-1"],
      scopes: ["devices.read"],
      permissions: expect.arrayContaining(["device:read"]),
    });
  });

  it("enforces the configured per-credential request limit", async () => {
    vi.stubEnv("AUTH_MODE", "development");
    vi.stubEnv("NODE_ENV", "test");
    const key = "vsk_client123456789012345678.secret-value";
    const service = new AuthService({
      machineCredential: {
        findUnique: vi.fn().mockResolvedValue({
          id: "limited-machine",
          tenantId: "tenant-1",
          status: "ACTIVE",
          secretHash: createHash("sha256").update(key).digest("hex"),
          previousSecretHash: null,
          previousValidUntil: null,
          scopes: ["tenant.read"],
          rateLimitPerMinute: 1,
        }),
        update: vi.fn().mockResolvedValue({}),
      },
    } as never);
    await service.authenticate({ "x-api-key": key });
    await expect(
      service.authenticate({ "x-api-key": key }),
    ).rejects.toMatchObject({ status: 429 });
  });
});

function storedStateEnforcer(
  service: AuthService,
): (user: AuthenticatedUser) => Promise<AuthenticatedUser> {
  return (
    service as unknown as {
      enforceStoredUserState(
        user: AuthenticatedUser,
      ): Promise<AuthenticatedUser>;
    }
  ).enforceStoredUserState.bind(service);
}

function auth0User(
  overrides: Partial<AuthenticatedUser> = {},
): AuthenticatedUser {
  return {
    authMode: "auth0",
    email: "admin@example.com",
    permissions: ["tenant:read"],
    role: "SCHOOL_ADMIN",
    subject: "auth0|admin",
    tenantIds: ["tenant-1"],
    tokenIssuedAt: new Date("2026-01-01T12:00:01.000Z"),
    ...overrides,
  };
}
