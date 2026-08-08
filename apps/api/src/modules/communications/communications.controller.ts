import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { CommunicationsService } from "./communications.service";
import {
  CreateAnnouncementDto,
  CreateFeedbackDto,
  UpdateFeedbackDto,
} from "./communications.dto";

@Controller("tenants/:tenantId/communications")
export class CommunicationsController {
  constructor(
    @Inject(CommunicationsService)
    private readonly service: CommunicationsService,
  ) {}
  @Get("announcements") @RequirePermissions("tenant:read") announcements(
    @Param("tenantId") tenantId: string,
    @Req() req: AuthenticatedRequest,
    @Query("includeArchived") archived?: string,
  ) {
    return this.service.listAnnouncements(
      tenantId,
      req.user!.role,
      archived === "true" &&
        ["SCHOOL_ADMIN", "PLATFORM_SUPER_ADMIN"].includes(req.user!.role),
    );
  }
  @Post("announcements")
  @RequirePermissions("tenant:update")
  createAnnouncement(
    @Param("tenantId") tenantId: string,
    @Body() body: CreateAnnouncementDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createAnnouncement(tenantId, body, req.user?.subject);
  }
  @Patch("announcements/:id/archive")
  @RequirePermissions("tenant:update")
  archive(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.archiveAnnouncement(tenantId, id, req.user?.subject);
  }
  @Get("feedback") @RequirePermissions("tenant:update") feedback(
    @Param("tenantId") tenantId: string,
  ) {
    return this.service.listFeedback(tenantId);
  }
  @Post("feedback") @RequirePermissions("tenant:read") createFeedback(
    @Param("tenantId") tenantId: string,
    @Body() body: CreateFeedbackDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createFeedback(
      tenantId,
      req.user!.role,
      body,
      req.user?.subject,
    );
  }
  @Patch("feedback/:id") @RequirePermissions("tenant:update") updateFeedback(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Body() body: UpdateFeedbackDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateFeedback(
      tenantId,
      id,
      body.status,
      req.user?.subject,
    );
  }
}
