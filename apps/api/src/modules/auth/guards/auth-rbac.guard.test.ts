import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AuthRbacGuard } from "./auth-rbac.guard";

function executionContext(
  params: Record<string, string> = {},
  body: unknown = undefined,
) {
  return {
    getClass: () => class TestController {},
    getHandler: () => function handler() {},
    switchToHttp: () => ({
      getRequest: () => ({
        headers: {},
        params,
        body,
        query: {},
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

  it("rejects lateral branch access for a delegated administrator", async () => {
    const guard = new AuthRbacGuard(
      {
        authenticate: vi
          .fn()
          .mockResolvedValue({
            permissions: ["policy:manage"],
            tenantIds: ["tenant-1"],
            accessScope: {
              type: "BRANCH",
              branchIds: ["branch-1"],
              regionCodes: [],
            },
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
      guard.canActivate(
        executionContext(
          { tenantId: "tenant-1" },
          { target: { branchId: "branch-2" } },
        ),
      ),
    ).rejects.toThrow("outside the delegated access scope");
  });

  it("allows a delegated administrator to target its own branch", async () => {
    const guard = new AuthRbacGuard(
      {
        authenticate: vi
          .fn()
          .mockResolvedValue({
            permissions: ["policy:manage"],
            tenantIds: ["tenant-1"],
            accessScope: {
              type: "BRANCH",
              branchIds: ["branch-1"],
              regionCodes: [],
            },
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
      guard.canActivate(
        executionContext({ tenantId: "tenant-1" }, { branchId: "branch-1" }),
      ),
    ).resolves.toBe(true);
  });
});
