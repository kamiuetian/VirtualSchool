import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AuthRbacGuard } from "./auth-rbac.guard";

function executionContext(params: Record<string, string> = {}) {
  return {
    getClass: () => class TestController {},
    getHandler: () => function handler() {},
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {},
        params,
      }),
    }),
  } as never;
}

describe("AuthRbacGuard", () => {
  it("allows authorized tenant and permission access", async () => {
    const guard = new AuthRbacGuard(
      {
        authenticate: vi.fn().mockResolvedValue({
          permissions: ["tenant:read"],
          tenantIds: ["tenant-1"],
        }),
      } as never,
      {
        getAllAndOverride: vi
          .fn()
          .mockReturnValueOnce(false)
          .mockReturnValueOnce(["tenant:read"]),
      } as never,
    );

    await expect(
      guard.canActivate(executionContext({ tenantId: "tenant-1" })),
    ).resolves.toBe(true);
  });

  it("rejects cross-tenant access", async () => {
    const guard = new AuthRbacGuard(
      {
        authenticate: vi.fn().mockResolvedValue({
          permissions: ["tenant:read"],
          tenantIds: ["tenant-2"],
        }),
      } as never,
      {
        getAllAndOverride: vi
          .fn()
          .mockReturnValueOnce(false)
          .mockReturnValueOnce(["tenant:read"]),
      } as never,
    );

    await expect(
      guard.canActivate(executionContext({ tenantId: "tenant-1" })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects missing permissions", async () => {
    const guard = new AuthRbacGuard(
      {
        authenticate: vi.fn().mockResolvedValue({
          permissions: ["tenant:read"],
          tenantIds: ["tenant-1"],
        }),
      } as never,
      {
        getAllAndOverride: vi
          .fn()
          .mockReturnValueOnce(false)
          .mockReturnValueOnce(["policy:manage"]),
      } as never,
    );

    await expect(
      guard.canActivate(executionContext({ tenantId: "tenant-1" })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
