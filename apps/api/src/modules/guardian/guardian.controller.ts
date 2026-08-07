import { Controller, Get, Inject, Param, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { GuardianDashboard } from "@virtual-school/shared";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { GuardianService } from "./guardian.service";

@ApiTags("guardian")
@Controller("tenants/:tenantId/guardian")
export class GuardianController {
  constructor(
    @Inject(GuardianService) private readonly service: GuardianService,
  ) {}

  @Get("dashboard")
  @RequirePermissions("guardian:read")
  @ApiOkResponse({
    description: "Privacy-limited dashboard for the authenticated guardian",
  })
  dashboard(
    @Param("tenantId") tenantId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<GuardianDashboard> {
    return this.service.dashboard(tenantId, request.user?.email);
  }
}
