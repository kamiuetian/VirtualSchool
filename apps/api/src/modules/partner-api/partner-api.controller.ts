import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Inject,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { Public } from "../auth/decorators/public.decorator";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import {
  ClientCredentialsDto,
  CreateMachineCredentialDto,
  RotateMachineCredentialDto,
} from "./partner-api.dto";
import { PartnerApiService } from "./partner-api.service";

@ApiTags("machine-credentials")
@Controller("tenants/:tenantId/machine-credentials")
@RequirePermissions("tenant:update")
export class MachineCredentialsController {
  constructor(
    @Inject(PartnerApiService) private readonly service: PartnerApiService,
  ) {}
  @Get() list(@Param("tenantId") tenantId: string) {
    return this.service.list(tenantId);
  }
  @Post() create(
    @Param("tenantId") tenantId: string,
    @Body() body: CreateMachineCredentialDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.create(tenantId, body, req.user?.subject);
  }
  @Post(":id/rotate") rotate(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Body() body: RotateMachineCredentialDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.rotate(tenantId, id, body, req.user?.subject);
  }
  @Post(":id/revoke") revoke(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.revoke(tenantId, id, req.user?.subject);
  }
  @Get("sandbox") sandbox(@Param("tenantId") tenantId: string) {
    return this.service.sandbox(tenantId);
  }
}

@ApiTags("partner-auth")
@Controller("partner-auth")
export class PartnerAuthController {
  constructor(
    @Inject(PartnerApiService) private readonly service: PartnerApiService,
  ) {}
  @Public()
  @Post("token")
  @ApiOperation({
    summary: "Exchange OAuth client credentials for a one-hour bearer token",
  })
  token(@Body() body: ClientCredentialsDto) {
    return this.service.issueToken(
      body.client_id,
      body.client_secret,
      body.grant_type,
    );
  }
}

@ApiTags("partner-api")
@ApiBearerAuth()
@ApiHeader({
  name: "X-API-Key",
  required: false,
  description: "Alternative API-key authentication",
})
@Controller("partner/tenants/:tenantId")
export class PartnerApiController {
  constructor(
    @Inject(PartnerApiService) private readonly service: PartnerApiService,
  ) {}
  @Get() @RequirePermissions("tenant:read") tenant(
    @Param("tenantId") tenantId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    this.scope(req, "tenant.read");
    return this.service.tenant(tenantId, req.user?.subject);
  }
  @Get("roster") @RequirePermissions("tenant:read") roster(
    @Param("tenantId") tenantId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    this.scope(req, "roster.read");
    return this.service.roster(tenantId, req.user?.subject);
  }
  @Get("devices") @RequirePermissions("device:read") devices(
    @Param("tenantId") tenantId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    this.scope(req, "devices.read");
    return this.service.devices(tenantId, req.user?.subject);
  }
  private scope(req: AuthenticatedRequest, required: string) {
    if (
      req.user?.authMode === "machine" &&
      !req.user.scopes?.includes(required)
    )
      throw new ForbiddenException(
        `Machine credential requires scope ${required}`,
      );
  }
}
