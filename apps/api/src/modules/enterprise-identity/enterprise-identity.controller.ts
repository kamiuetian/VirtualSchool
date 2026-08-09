import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import {
  ConfigureEnterpriseIdentityDto,
  MapScimGroupDto,
  ScimLifecycleDto,
} from "./enterprise-identity.dto";
import { EnterpriseIdentityService } from "./enterprise-identity.service";

@ApiTags("enterprise-identity")
@Controller("tenants/:tenantId/enterprise-identity")
@RequirePermissions("tenant:update")
export class EnterpriseIdentityController {
  constructor(
    @Inject(EnterpriseIdentityService)
    private readonly service: EnterpriseIdentityService,
  ) {}
  @Get() get(@Param("tenantId") tenantId: string) {
    return this.service.get(tenantId);
  }
  @Post("configure") configure(
    @Param("tenantId") tenantId: string,
    @Body() body: ConfigureEnterpriseIdentityDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.configure(tenantId, body, req.user?.subject);
  }
  @Post("group-mappings") map(
    @Param("tenantId") tenantId: string,
    @Body() body: MapScimGroupDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.mapGroup(tenantId, body, req.user?.subject);
  }
  @Post("scim/users") provision(
    @Param("tenantId") tenantId: string,
    @Body() body: ScimLifecycleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.provisionUser(tenantId, body, req.user?.subject);
  }
}
