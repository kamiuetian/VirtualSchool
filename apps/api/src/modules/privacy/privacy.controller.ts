import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
  Req,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import {
  AcceptPrivacyNoticeDto,
  PublishPrivacyNoticeDto,
  RevokePrivacyAcceptanceDto,
  UpdateSecurityPrivacyProfileDto,
} from "./dto/privacy.dto";
import { PrivacyService } from "./privacy.service";

@ApiTags("privacy")
@Controller("tenants/:tenantId/privacy")
export class PrivacyController {
  constructor(
    @Inject(PrivacyService) private readonly service: PrivacyService,
  ) {}
  @Get("security-center") @RequirePermissions("audit:read") overview(
    @Param("tenantId") tenantId: string,
  ) {
    return this.service.securityCenter(tenantId);
  }
  @Put("security-center/profile")
  @RequirePermissions("tenant:update")
  updateProfile(
    @Param("tenantId") tenantId: string,
    @Body() body: UpdateSecurityPrivacyProfileDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateSecurityPrivacyProfile(
      tenantId,
      body,
      req.user?.subject,
    );
  }
  @Post("notices") @RequirePermissions("tenant:update") publish(
    @Param("tenantId") tenantId: string,
    @Body() body: PublishPrivacyNoticeDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.publish(tenantId, body, req.user?.subject);
  }
  @Get("notices") listNotices(
    @Param("tenantId") tenantId: string,
    @Query("noticeType") noticeType?: string,
  ) {
    return this.service.listNotices(tenantId, noticeType);
  }
  @Post("notices/:noticeId/accept") accept(
    @Param("tenantId") tenantId: string,
    @Param("noticeId") noticeId: string,
    @Body() body: AcceptPrivacyNoticeDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.accept(
      tenantId,
      noticeId,
      body,
      req.user?.subject,
      req.user?.role,
    );
  }
  @Post("acceptances/:acceptanceId/revoke") revoke(
    @Param("tenantId") tenantId: string,
    @Param("acceptanceId") acceptanceId: string,
    @Body() body: RevokePrivacyAcceptanceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.revoke(
      tenantId,
      acceptanceId,
      body.reason,
      req.user?.subject,
    );
  }
  @Get("acceptances") @RequirePermissions("tenant:update") listAcceptances(
    @Param("tenantId") tenantId: string,
  ) {
    return this.service.listAcceptances(tenantId);
  }
}
