import { Body, Controller, Get, Inject, Param, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { AuthorizeGoogleWorkspaceDto, IngestChromeOsInventoryDto, MapGoogleWorkspaceOuDto } from "./google-workspace.dto";
import { GoogleWorkspaceService } from "./google-workspace.service";

@ApiTags("google-workspace")
@Controller("tenants/:tenantId/integrations/google-workspace")
@RequirePermissions("tenant:update")
export class GoogleWorkspaceController {
  constructor(@Inject(GoogleWorkspaceService) private readonly service: GoogleWorkspaceService) {}
  @Get() get(@Param("tenantId") tenantId: string) { return this.service.get(tenantId); }
  @Post("authorize") authorize(@Param("tenantId") tenantId: string, @Body() body: AuthorizeGoogleWorkspaceDto, @Req() req: AuthenticatedRequest) {
    return this.service.authorize(tenantId, body, req.user?.subject);
  }
  @Post("organizational-units") mapOu(@Param("tenantId") tenantId: string, @Body() body: MapGoogleWorkspaceOuDto, @Req() req: AuthenticatedRequest) {
    return this.service.mapOrganizationalUnit(tenantId, body, req.user?.subject);
  }
  @Post("inventory") inventory(@Param("tenantId") tenantId: string, @Body() body: IngestChromeOsInventoryDto, @Req() req: AuthenticatedRequest) {
    return this.service.ingestInventory(tenantId, body, req.user?.subject);
  }
}
