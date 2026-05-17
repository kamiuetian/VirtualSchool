import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { UserSummary } from "@virtual-school/shared";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { InviteUserDto } from "./dto/invite-user.dto";
import { SetUserMfaDto } from "./dto/set-user-mfa.dto";
import { UpdateUserRoleDto } from "./dto/update-user-role.dto";
import { UserLifecycleActionDto } from "./dto/user-lifecycle-action.dto";
import { UsersService } from "./users.service";

@ApiTags("users")
@Controller("tenants/:tenantId/users")
export class UsersController {
  constructor(
    @Inject(UsersService) private readonly usersService: UsersService,
  ) {}

  @Get()
  @RequirePermissions("tenant:read")
  @ApiOkResponse({ description: "Tenant staff and user list" })
  listUsers(@Param("tenantId") tenantId: string): Promise<UserSummary[]> {
    return this.usersService.listUsers(tenantId);
  }

  @Post("invitations")
  @RequirePermissions("user:invite")
  @ApiCreatedResponse({ description: "Invite a school staff user" })
  inviteUser(
    @Param("tenantId") tenantId: string,
    @Body() body: InviteUserDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<UserSummary> {
    return this.usersService.inviteUser(tenantId, body, request.user?.subject);
  }

  @Patch(":userId/role")
  @RequirePermissions("user:invite")
  @ApiOkResponse({ description: "Update a user's staff role" })
  updateUserRole(
    @Param("tenantId") tenantId: string,
    @Param("userId") userId: string,
    @Body() body: UpdateUserRoleDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<UserSummary> {
    return this.usersService.updateUserRole(
      tenantId,
      userId,
      body,
      request.user?.subject,
    );
  }

  @Post(":userId/suspend")
  @RequirePermissions("user:suspend")
  @ApiCreatedResponse({ description: "Suspend a user and force logout" })
  suspendUser(
    @Param("tenantId") tenantId: string,
    @Param("userId") userId: string,
    @Body() body: UserLifecycleActionDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<UserSummary> {
    return this.usersService.suspendUser(
      tenantId,
      userId,
      body,
      request.user?.subject,
    );
  }

  @Post(":userId/deactivate")
  @RequirePermissions("user:suspend")
  @ApiCreatedResponse({ description: "Deactivate a user and force logout" })
  deactivateUser(
    @Param("tenantId") tenantId: string,
    @Param("userId") userId: string,
    @Body() body: UserLifecycleActionDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<UserSummary> {
    return this.usersService.deactivateUser(
      tenantId,
      userId,
      body,
      request.user?.subject,
    );
  }

  @Post(":userId/reactivate")
  @RequirePermissions("user:suspend")
  @ApiCreatedResponse({
    description: "Reactivate a suspended or deactivated user",
  })
  reactivateUser(
    @Param("tenantId") tenantId: string,
    @Param("userId") userId: string,
    @Body() body: UserLifecycleActionDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<UserSummary> {
    return this.usersService.reactivateUser(
      tenantId,
      userId,
      body,
      request.user?.subject,
    );
  }

  @Post(":userId/force-logout")
  @RequirePermissions("user:suspend")
  @ApiCreatedResponse({ description: "Force logout for a user session family" })
  forceLogoutUser(
    @Param("tenantId") tenantId: string,
    @Param("userId") userId: string,
    @Body() body: UserLifecycleActionDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<UserSummary> {
    return this.usersService.forceLogoutUser(
      tenantId,
      userId,
      body,
      request.user?.subject,
    );
  }

  @Patch(":userId/mfa")
  @RequirePermissions("user:suspend")
  @ApiOkResponse({ description: "Update MFA enrollment status metadata" })
  setUserMfa(
    @Param("tenantId") tenantId: string,
    @Param("userId") userId: string,
    @Body() body: SetUserMfaDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<UserSummary> {
    return this.usersService.setUserMfa(
      tenantId,
      userId,
      body,
      request.user?.subject,
    );
  }
}
