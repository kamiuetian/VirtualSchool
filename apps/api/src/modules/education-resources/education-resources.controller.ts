import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import {
  ConfigureEducationConnectionDto,
  MapEducationResourceDto,
} from "./education-resources.dto";
import { EducationResourcesService } from "./education-resources.service";
@Controller("tenants/:tenantId/integrations/education-resources")
@RequirePermissions("tenant:update")
export class EducationResourcesController {
  constructor(
    @Inject(EducationResourcesService)
    private readonly service: EducationResourcesService,
  ) {}
  @Get() list(@Param("tenantId") tenantId: string) {
    return this.service.list(tenantId);
  }
  @Post() configure(
    @Param("tenantId") tenantId: string,
    @Body() body: ConfigureEducationConnectionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.configure(tenantId, body, req.user?.subject);
  }
  @Post(":provider/resources") map(
    @Param("tenantId") tenantId: string,
    @Param("provider") provider: string,
    @Body() body: MapEducationResourceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.map(tenantId, provider, body, req.user?.subject);
  }
}
