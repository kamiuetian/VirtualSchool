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
import { ReconcileSisDto } from "./dto/sis.dto";
import { SisService } from "./sis.service";

@ApiTags("sis-reconciliation")
@Controller("tenants/:tenantId/integrations/sis")
@RequirePermissions("roster:manage")
export class SisController {
  constructor(@Inject(SisService) private readonly service: SisService) {}
  @Get("operations") operations(@Param("tenantId") tenantId: string) {
    return this.service.operations(tenantId);
  }
  @Post("reconciliations") reconcile(
    @Param("tenantId") tenantId: string,
    @Body() body: ReconcileSisDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.reconcile(tenantId, body, req.user?.subject);
  }
  @Post("reconciliations/:runId/retry") retry(
    @Param("tenantId") tenantId: string,
    @Param("runId") runId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.retry(tenantId, runId, req.user?.subject);
  }
}
