import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  Role,
  StaffRole,
  UserStatus,
  UserSummary,
} from "@virtual-school/shared";
import type { User } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import type { InviteUserDto } from "./dto/invite-user.dto";
import type { SetUserMfaDto } from "./dto/set-user-mfa.dto";
import type { UpdateUserRoleDto } from "./dto/update-user-role.dto";
import type { UserLifecycleActionDto } from "./dto/user-lifecycle-action.dto";

const privilegedMfaRoles = new Set<Role>([
  "SCHOOL_ADMIN",
  "IT_ADMIN",
  "SUPPORT_AGENT",
]);

@Injectable()
export class UsersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listUsers(tenantId: string): Promise<UserSummary[]> {
    await this.ensureTenantExists(tenantId);

    const users = await this.prisma.user.findMany({
      orderBy: [{ status: "asc" }, { role: "asc" }, { name: "asc" }],
      where: {
        tenantId,
      },
    });

    return users.map((user) => this.toUserSummary(user));
  }

  async inviteUser(
    tenantId: string,
    input: InviteUserDto,
    actorId: string | undefined,
  ): Promise<UserSummary> {
    await this.ensureTenantExists(tenantId);
    await this.ensureBranchBelongsToTenant(tenantId, input.branchId);

    const email = input.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({
      where: {
        tenantId_email: {
          email,
          tenantId,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `User ${email} already exists for this tenant`,
      );
    }

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          auth0Subject: input.auth0Subject,
          branchId: input.branchId,
          email,
          invitedAt: new Date(),
          invitedBy: actorId,
          name: input.name,
          role: input.role,
          status: "INVITED",
          tenantId,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "user.invite",
          actorId,
          newValue: {
            branchId: created.branchId,
            email: created.email,
            name: created.name,
            role: created.role,
            status: created.status,
          },
          object: "User",
          objectId: created.id,
          outcome: "INVITED",
          tenantId,
        },
      });

      return created;
    });

    return this.toUserSummary(user);
  }

  async updateUserRole(
    tenantId: string,
    userId: string,
    input: UpdateUserRoleDto,
    actorId: string | undefined,
  ): Promise<UserSummary> {
    const user = await this.getTenantUser(tenantId, userId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.user.update({
        data: {
          forcedLogoutAt: new Date(),
          lastRoleChangedAt: new Date(),
          role: input.role,
        },
        where: {
          id: user.id,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "user.role_update",
          actorId,
          newValue: {
            forcedLogoutAt: saved.forcedLogoutAt,
            role: saved.role,
          },
          object: "User",
          objectId: saved.id,
          oldValue: {
            role: user.role,
          },
          outcome: "SUCCESS",
          reason: input.reason,
          tenantId,
        },
      });

      return saved;
    });

    return this.toUserSummary(updated);
  }

  async suspendUser(
    tenantId: string,
    userId: string,
    input: UserLifecycleActionDto,
    actorId: string | undefined,
  ): Promise<UserSummary> {
    return this.updateLifecycle(tenantId, userId, {
      action: "user.suspend",
      actorId,
      data: {
        forcedLogoutAt: new Date(),
        status: "SUSPENDED",
        suspendedAt: new Date(),
      },
      outcome: "SUSPENDED",
      reason: input.reason,
    });
  }

  async deactivateUser(
    tenantId: string,
    userId: string,
    input: UserLifecycleActionDto,
    actorId: string | undefined,
  ): Promise<UserSummary> {
    return this.updateLifecycle(tenantId, userId, {
      action: "user.deactivate",
      actorId,
      data: {
        deactivatedAt: new Date(),
        forcedLogoutAt: new Date(),
        status: "DEACTIVATED",
      },
      outcome: "DEACTIVATED",
      reason: input.reason,
    });
  }

  async reactivateUser(
    tenantId: string,
    userId: string,
    input: UserLifecycleActionDto,
    actorId: string | undefined,
  ): Promise<UserSummary> {
    return this.updateLifecycle(tenantId, userId, {
      action: "user.reactivate",
      actorId,
      data: {
        deactivatedAt: null,
        status: "ACTIVE",
        suspendedAt: null,
      },
      outcome: "ACTIVE",
      reason: input.reason,
    });
  }

  async forceLogoutUser(
    tenantId: string,
    userId: string,
    input: UserLifecycleActionDto,
    actorId: string | undefined,
  ): Promise<UserSummary> {
    return this.updateLifecycle(tenantId, userId, {
      action: "user.force_logout",
      actorId,
      data: {
        forcedLogoutAt: new Date(),
      },
      outcome: "FORCED_LOGOUT",
      reason: input.reason,
    });
  }

  async setUserMfa(
    tenantId: string,
    userId: string,
    input: SetUserMfaDto,
    actorId: string | undefined,
  ): Promise<UserSummary> {
    const user = await this.getTenantUser(tenantId, userId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.user.update({
        data: {
          mfaEnabled: input.mfaEnabled,
        },
        where: {
          id: user.id,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "user.mfa_update",
          actorId,
          newValue: {
            mfaEnabled: saved.mfaEnabled,
          },
          object: "User",
          objectId: saved.id,
          oldValue: {
            mfaEnabled: user.mfaEnabled,
          },
          outcome: "SUCCESS",
          reason: input.reason,
          tenantId,
        },
      });

      return saved;
    });

    return this.toUserSummary(updated);
  }

  private async updateLifecycle(
    tenantId: string,
    userId: string,
    input: {
      action: string;
      actorId?: string;
      data: Partial<
        Pick<
          User,
          "deactivatedAt" | "forcedLogoutAt" | "status" | "suspendedAt"
        >
      >;
      outcome: string;
      reason?: string;
    },
  ): Promise<UserSummary> {
    const user = await this.getTenantUser(tenantId, userId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.user.update({
        data: input.data,
        where: {
          id: user.id,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: input.action,
          actorId: input.actorId,
          newValue: {
            forcedLogoutAt: saved.forcedLogoutAt,
            status: saved.status,
          },
          object: "User",
          objectId: saved.id,
          oldValue: {
            status: user.status,
          },
          outcome: input.outcome,
          reason: input.reason,
          tenantId,
        },
      });

      return saved;
    });

    return this.toUserSummary(updated);
  }

  private async ensureTenantExists(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      select: {
        id: true,
      },
      where: {
        id: tenantId,
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} was not found`);
    }
  }

  private async ensureBranchBelongsToTenant(
    tenantId: string,
    branchId: string | undefined,
  ): Promise<void> {
    if (!branchId) {
      return;
    }

    const branch = await this.prisma.branch.findFirst({
      select: {
        id: true,
      },
      where: {
        id: branchId,
        tenantId,
      },
    });

    if (!branch) {
      throw new NotFoundException(
        `Branch ${branchId} was not found for tenant ${tenantId}`,
      );
    }
  }

  private async getTenantUser(tenantId: string, userId: string): Promise<User> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenantId,
      },
    });

    if (!user) {
      throw new NotFoundException(
        `User ${userId} was not found for tenant ${tenantId}`,
      );
    }

    return user;
  }

  private toUserSummary(user: User): UserSummary {
    return {
      auth0Subject: user.auth0Subject,
      branchId: user.branchId,
      createdAt: user.createdAt.toISOString(),
      deactivatedAt: user.deactivatedAt?.toISOString() ?? null,
      email: user.email,
      forcedLogoutAt: user.forcedLogoutAt?.toISOString() ?? null,
      id: user.id,
      invitedAt: user.invitedAt?.toISOString() ?? null,
      invitedBy: user.invitedBy,
      lastRoleChangedAt: user.lastRoleChangedAt?.toISOString() ?? null,
      mfaEnabled: user.mfaEnabled,
      mfaRequired: privilegedMfaRoles.has(user.role as Role),
      name: user.name,
      role: user.role as Role,
      status: user.status as UserStatus,
      suspendedAt: user.suspendedAt?.toISOString() ?? null,
      tenantId: user.tenantId,
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}
