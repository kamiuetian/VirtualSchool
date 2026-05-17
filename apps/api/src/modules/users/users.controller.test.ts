import { describe, expect, it, vi } from "vitest";
import { UsersController } from "./users.controller";

describe("UsersController", () => {
  it("delegates user invitation with authenticated actor", async () => {
    const inviteUser = vi.fn().mockResolvedValue({
      email: "teacher@example.com",
      id: "user-1",
      status: "INVITED",
    });
    const controller = new UsersController({
      deactivateUser: vi.fn(),
      forceLogoutUser: vi.fn(),
      inviteUser,
      listUsers: vi.fn(),
      reactivateUser: vi.fn(),
      setUserMfa: vi.fn(),
      suspendUser: vi.fn(),
      updateUserRole: vi.fn(),
    } as never);

    await expect(
      controller.inviteUser(
        "tenant-1",
        {
          email: "teacher@example.com",
          name: "Teacher One",
          role: "TEACHER",
        },
        {
          user: {
            subject: "admin-1",
          },
        } as never,
      ),
    ).resolves.toMatchObject({
      id: "user-1",
    });
    expect(inviteUser).toHaveBeenCalledWith(
      "tenant-1",
      expect.objectContaining({
        email: "teacher@example.com",
      }),
      "admin-1",
    );
  });

  it("delegates user suspension with authenticated actor", async () => {
    const suspendUser = vi.fn().mockResolvedValue({
      id: "user-1",
      status: "SUSPENDED",
    });
    const controller = new UsersController({
      deactivateUser: vi.fn(),
      forceLogoutUser: vi.fn(),
      inviteUser: vi.fn(),
      listUsers: vi.fn(),
      reactivateUser: vi.fn(),
      setUserMfa: vi.fn(),
      suspendUser,
      updateUserRole: vi.fn(),
    } as never);

    await expect(
      controller.suspendUser(
        "tenant-1",
        "user-1",
        {
          reason: "Left school",
        },
        {
          user: {
            subject: "admin-1",
          },
        } as never,
      ),
    ).resolves.toMatchObject({
      status: "SUSPENDED",
    });
    expect(suspendUser).toHaveBeenCalledWith(
      "tenant-1",
      "user-1",
      expect.objectContaining({
        reason: "Left school",
      }),
      "admin-1",
    );
  });
});
