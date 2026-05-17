import { UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AuthService } from "./auth.service";

describe("AuthService", () => {
  it("builds a development user from explicit dev headers", async () => {
    vi.stubEnv("AUTH_MODE", "development");
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
    const service = new AuthService();

    await expect(
      service.authenticate({
        "x-dev-role": "ROOT",
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
