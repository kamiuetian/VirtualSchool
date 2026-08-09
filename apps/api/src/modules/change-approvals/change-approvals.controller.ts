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
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { ChangeApprovalsService } from "./change-approvals.service";
import {
  CreateChangeRequestDto,
  DecideChangeRequestDto,
  UpdateApprovalConfigDto,
} from "./change-approvals.dto";
@Controller("tenants/:tenantId/change-approvals")
export class ChangeApprovalsController {
  constructor(
    @Inject(ChangeApprovalsService)
    private readonly service: ChangeApprovalsService,
  ) {}
  @Get() @RequirePermissions("audit:read") dashboard(
    @Param("tenantId") t: string,
  ) {
    return this.service.dashboard(t);
  }
  @Patch("config") @RequirePermissions("tenant:update") configure(
    @Param("tenantId") t: string,
    @Body() b: UpdateApprovalConfigDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.configure(t, b, r.user?.subject);
  }
  @Post("requests") @RequirePermissions("policy:manage") create(
    @Param("tenantId") t: string,
    @Body() b: CreateChangeRequestDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.create(t, b, r.user?.subject);
  }
  @Post("requests/:id/decisions") @RequirePermissions("audit:read") decide(
    @Param("tenantId") t: string,
    @Param("id") id: string,
    @Body() b: DecideChangeRequestDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.decide(t, id, b, r.user?.subject);
  }
}
