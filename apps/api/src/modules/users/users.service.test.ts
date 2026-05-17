import { ConflictException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { UsersService } from "./users.service";

const now = new Date("2026-05-17T10:00:00.000Z");

function user(overrides: Record<string, unknown> = {}) {
  return {
    auth0Subject: null,
    branchId: null,
    createdAt: now,
    deactivatedAt: null,
    email: "teacher@example.com",
    forcedLogoutAt: null,
    id: "user-1",
    invitedAt: now,
    invitedBy: "admin-1",
    lastRoleChangedAt: null,
    mfaEnabled: false,
    name: "Teacher One",
    role: "TEACHER",
    status: "INVITED",
    suspendedAt: null,
    tenantId: "tenant-1",
    updatedAt: now,
    ...overrides,
  };
}

describe("UsersService", () => {
  it("invites a staff user with normalized email and audit event", async () => {
    const audit = vi.fn();
    const service = new UsersService({
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          auditEvent: {
            create: audit,
          },
          user: {
            create: async ({ data }: { data: Record<string, unknown> }) =>
              user(data),
          },
        }),
      branch: {
        findFirst: async () => ({ id: "branch-1" }),
      },
      tenant: {
        findUnique: async () => ({ id: "tenant-1" }),
      },
      user: {
        findUnique: async () => null,
      },
    } as never);

    await expect(
      service.inviteUser(
        "tenant-1",
        {
          branchId: "branch-1",
          email: "Teacher@Example.COM",
          name: "Teacher One",
          role: "TEACHER",
        },
        "admin-1",
      ),
    ).resolves.toMatchObject({
      email: "teacher@example.com",
      invitedBy: "admin-1",
      mfaRequired: false,
      status: "INVITED",
    });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "user.invite",
          actorId: "admin-1",
          outcome: "INVITED",
        }),
      }),
    );
  });

  it("rejects duplicate invited users within a tenant", async () => {
    const service = new UsersService({
      branch: {
        findFirst: async () => null,
      },
      tenant: {
        findUnique: async () => ({ id: "tenant-1" }),
      },
      user: {
        findUnique: async () => ({ id: "existing-user" }),
      },
    } as never);

    await expect(
      service.inviteUser(
        "tenant-1",
        {
          email: "teacher@example.com",
          name: "Teacher One",
          role: "TEACHER",
        },
        "admin-1",
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("updates role and forces logout", async () => {
    const audit = vi.fn();
    const service = new UsersService({
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          auditEvent: {
            create: audit,
          },
          user: {
            update: async ({ data }: { data: Record<string, unknown> }) =>
              user({
                forcedLogoutAt: data.forcedLogoutAt,
                lastRoleChangedAt: data.lastRoleChangedAt,
                role: data.role,
              }),
          },
        }),
      user: {
        findFirst: async () => user(),
      },
    } as never);

    await expect(
      service.updateUserRole(
        "tenant-1",
        "user-1",
        {
          reason: "Promotion",
          role: "IT_ADMIN",
        },
        "admin-1",
      ),
    ).resolves.toMatchObject({
      mfaRequired: true,
      role: "IT_ADMIN",
    });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "user.role_update",
          reason: "Promotion",
        }),
      }),
    );
  });

  it("suspends users and records forced logout metadata", async () => {
    const service = new UsersService({
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          auditEvent: {
            create: vi.fn(),
          },
          user: {
            update: async ({ data }: { data: Record<string, unknown> }) =>
              user({
                forcedLogoutAt: data.forcedLogoutAt,
                status: data.status,
                suspendedAt: data.suspendedAt,
              }),
          },
        }),
      user: {
        findFirst: async () => user({ status: "ACTIVE" }),
      },
    } as never);

    await expect(
      service.suspendUser(
        "tenant-1",
        "user-1",
        {
          reason: "Left school",
        },
        "admin-1",
      ),
    ).resolves.toMatchObject({
      status: "SUSPENDED",
    });
  });

  it("throws when target user is outside the tenant scope", async () => {
    const service = new UsersService({
      user: {
        findFirst: async () => null,
      },
    } as never);

    await expect(
      service.forceLogoutUser("tenant-1", "missing-user", {}, "admin-1"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
