import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { RemoteCommandSummary } from "@virtual-school/shared";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { ClaimRemoteCommandsDto } from "./dto/claim-remote-commands.dto";
import { CreateRemoteCommandDto } from "./dto/create-remote-command.dto";
import { CreateWipeCommandDto } from "./dto/create-wipe-command.dto";
import { RecordCommandResultDto } from "./dto/record-command-result.dto";
import { RecordDeliveryFailureDto } from "./dto/record-delivery-failure.dto";
import { RemoteCommandsService } from "./remote-commands.service";

@ApiTags("remote-commands")
@Controller("tenants/:tenantId/devices/:deviceId/commands")
export class RemoteCommandsController {
  constructor(
    @Inject(RemoteCommandsService)
    private readonly remoteCommandsService: RemoteCommandsService,
  ) {}

  @Get()
  @RequirePermissions("device:read")
  @ApiOkResponse({ description: "Device command history" })
  listDeviceCommands(
    @Param("tenantId") tenantId: string,
    @Param("deviceId") deviceId: string,
  ): Promise<RemoteCommandSummary[]> {
    return this.remoteCommandsService.listDeviceCommands(tenantId, deviceId);
  }

  @Post()
  @RequirePermissions("device:command")
  @ApiCreatedResponse({ description: "Queue a non-destructive device command" })
  createDeviceCommand(
    @Param("tenantId") tenantId: string,
    @Param("deviceId") deviceId: string,
    @Body() body: CreateRemoteCommandDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<RemoteCommandSummary> {
    return this.remoteCommandsService.createDeviceCommand(
      tenantId,
      deviceId,
      body,
      request.user?.subject,
    );
  }

  @Post("wipe")
  @RequirePermissions("device:wipe")
  @ApiCreatedResponse({
    description: "Queue a confirmed destructive wipe/reset command",
  })
  createWipeCommand(
    @Param("tenantId") tenantId: string,
    @Param("deviceId") deviceId: string,
    @Body() body: CreateWipeCommandDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<RemoteCommandSummary> {
    return this.remoteCommandsService.createWipeCommand(
      tenantId,
      deviceId,
      body,
      request.user?.subject,
    );
  }

  @Post("claim")
  @RequirePermissions("device:command")
  @ApiCreatedResponse({
    description: "Claim queued commands for connector/device dispatch",
  })
  claimQueuedCommands(
    @Param("tenantId") tenantId: string,
    @Param("deviceId") deviceId: string,
    @Body() body: ClaimRemoteCommandsDto,
  ): Promise<RemoteCommandSummary[]> {
    return this.remoteCommandsService.claimQueuedCommands(
      tenantId,
      deviceId,
      body.limit,
    );
  }

  @Post(":commandId/delivery-failures")
  @RequirePermissions("device:command")
  @ApiCreatedResponse({
    description: "Record command delivery failure and retry or fail",
  })
  recordDeliveryFailure(
    @Param("tenantId") tenantId: string,
    @Param("deviceId") deviceId: string,
    @Param("commandId") commandId: string,
    @Body() body: RecordDeliveryFailureDto,
  ): Promise<RemoteCommandSummary> {
    return this.remoteCommandsService.recordDeliveryFailure(
      tenantId,
      deviceId,
      commandId,
      body,
    );
  }

  @Post(":commandId/results")
  @RequirePermissions("device:command")
  @ApiCreatedResponse({ description: "Record command execution result" })
  recordCommandResult(
    @Param("tenantId") tenantId: string,
    @Param("deviceId") deviceId: string,
    @Param("commandId") commandId: string,
    @Body() body: RecordCommandResultDto,
  ): Promise<RemoteCommandSummary> {
    return this.remoteCommandsService.recordCommandResult(
      tenantId,
      deviceId,
      commandId,
      body,
    );
  }
}
