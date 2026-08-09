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
import { ConfigureAppleMdmDto, IngestAppleInventoryDto } from "./apple-mdm.dto";
import { AppleMdmService } from "./apple-mdm.service";
@ApiTags("apple-mdm")
@Controller("tenants/:tenantId/integrations/apple-mdm")
@RequirePermissions("tenant:update")
export class AppleMdmController {
  constructor(
    @Inject(AppleMdmService) private readonly service: AppleMdmService,
  ) {}
  @Get() get(@Param("tenantId") tenantId: string) {
    return this.service.get(tenantId);
  }
  @Post("configure") configure(
    @Param("tenantId") tenantId: string,
    @Body() body: ConfigureAppleMdmDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.configure(tenantId, body, req.user?.subject);
  }
  @Post("inventory") inventory(
    @Param("tenantId") tenantId: string,
    @Body() body: IngestAppleInventoryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.ingestInventory(tenantId, body, req.user?.subject);
  }
}
