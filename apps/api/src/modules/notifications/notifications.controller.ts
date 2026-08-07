import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Patch,
  Query,
  Req,
} from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type {
  NotificationDeliverySummary,
  NotificationPreferenceSummary,
} from "@virtual-school/shared";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { UpdateNotificationPreferenceDto } from "./dto/update-notification-preference.dto";
import { NotificationsService } from "./notifications.service";

@ApiTags("notifications")
@Controller("tenants/:tenantId/notifications")
export class NotificationsController {
  constructor(
    @Inject(NotificationsService)
    private readonly service: NotificationsService,
  ) {}

  @Get("preferences")
  @RequirePermissions("tenant:update")
  @ApiOkResponse({ description: "Tenant email notification preferences" })
  getPreferences(
    @Param("tenantId") tenantId: string,
  ): Promise<NotificationPreferenceSummary> {
    return this.service.getPreferences(tenantId);
  }

  @Patch("preferences")
  @RequirePermissions("tenant:update")
  @ApiOkResponse({
    description: "Update tenant email notification preferences",
  })
  updatePreferences(
    @Param("tenantId") tenantId: string,
    @Body() body: UpdateNotificationPreferenceDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<NotificationPreferenceSummary> {
    return this.service.updatePreferences(
      tenantId,
      body,
      request.user?.subject,
    );
  }

  @Get("deliveries")
  @RequirePermissions("tenant:update")
  @ApiOkResponse({ description: "Tenant email delivery outcomes" })
  listDeliveries(
    @Param("tenantId") tenantId: string,
    @Query("limit") limit?: string,
  ): Promise<NotificationDeliverySummary[]> {
    return this.service.listDeliveries(
      tenantId,
      limit ? Number(limit) : undefined,
    );
  }
}
