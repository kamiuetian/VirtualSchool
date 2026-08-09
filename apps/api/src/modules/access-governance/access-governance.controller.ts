import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import {
  AssignAccessRoleDto,
  CreateAccessReviewDto,
  CreateAccessRoleTemplateDto,
  DecideAccessReviewDto,
} from "./access-governance.dto";
import { AccessGovernanceService } from "./access-governance.service";

@Controller("tenants/:tenantId/access-governance")
@RequirePermissions("user:invite", "audit:read")
export class AccessGovernanceController {
  constructor(
    @Inject(AccessGovernanceService)
    private readonly service: AccessGovernanceService,
  ) {}
  @Get() dashboard(@Param("tenantId") tenantId: string) {
    return this.service.dashboard(tenantId);
  }
  @Post("role-templates") createTemplate(
    @Param("tenantId") t: string,
    @Body() b: CreateAccessRoleTemplateDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.createTemplate(t, b, r.user?.subject);
  }
  @Post("assignments") assign(
    @Param("tenantId") t: string,
    @Body() b: AssignAccessRoleDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.assign(t, b, r.user?.subject);
  }
  @Post("reviews") review(
    @Param("tenantId") t: string,
    @Body() b: CreateAccessReviewDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.createReview(t, b, r.user?.subject);
  }
  @Post("reviews/:reviewId/items/:itemId") decide(
    @Param("tenantId") t: string,
    @Param("reviewId") reviewId: string,
    @Param("itemId") itemId: string,
    @Body() b: DecideAccessReviewDto,
    @Req() r: AuthenticatedRequest,
  ) {
    return this.service.decide(t, reviewId, itemId, b, r.user?.subject);
  }
  @Get("reviews/:reviewId/export")
  @Header("Content-Type", "text/csv; charset=utf-8")
  export(@Param("tenantId") t: string, @Param("reviewId") id: string) {
    return this.service.exportReview(t, id);
  }
}
