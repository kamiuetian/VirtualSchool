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
  AuthorizeIntuneDto,
  IngestIntuneInventoryDto,
  MapIntuneGroupDto,
} from "./intune.dto";
import { IntuneService } from "./intune.service";

@ApiTags("intune")
@Controller("tenants/:tenantId/integrations/intune")
@RequirePermissions("tenant:update")
export class IntuneController {
  constructor(@Inject(IntuneService) private readonly service: IntuneService) {}
  @Get() get(@Param("tenantId") tenantId: string) {
    return this.service.get(tenantId);
  }
  @Post("authorize") authorize(
    @Param("tenantId") tenantId: string,
    @Body() body: AuthorizeIntuneDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.authorize(tenantId, body, req.user?.subject);
  }
  @Post("groups") mapGroup(
    @Param("tenantId") tenantId: string,
    @Body() body: MapIntuneGroupDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.mapGroup(tenantId, body, req.user?.subject);
  }
  @Post("inventory") inventory(
    @Param("tenantId") tenantId: string,
    @Body() body: IngestIntuneInventoryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.ingestInventory(tenantId, body, req.user?.subject);
  }
}
