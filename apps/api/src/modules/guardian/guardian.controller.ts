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
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { GuardianDashboard } from "@virtual-school/shared";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { GuardianService } from "./guardian.service";
import {
  ReportLostDeviceDto,
  UpdateAfterSchoolControlDto,
} from "./dto/guardian-actions.dto";

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

  @Post("children/:studentId/lost-device-reports")
  @RequirePermissions("guardian:read")
  reportLostDevice(
    @Param("tenantId") tenantId: string,
    @Param("studentId") studentId: string,
    @Body() input: ReportLostDeviceDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.reportLostDevice(
      tenantId,
      studentId,
      input,
      request.user?.subject,
      request.user?.email,
    );
  }

  @Patch("children/:studentId/after-school-control")
  @RequirePermissions("guardian:read")
  updateAfterSchoolControl(
    @Param("tenantId") tenantId: string,
    @Param("studentId") studentId: string,
    @Body() input: UpdateAfterSchoolControlDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.service.updateAfterSchoolControl(
      tenantId,
      studentId,
      input,
      request.user?.subject,
      request.user?.email,
    );
  }
}
