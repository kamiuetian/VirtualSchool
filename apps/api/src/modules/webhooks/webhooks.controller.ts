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
import { ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import {
  ConfigureWebhookEndpointDto,
  RetryWebhookDeliveryDto,
  RotateWebhookSecretDto,
  SetWebhookEnabledDto,
} from "./dto/webhook.dto";
import { WebhooksService } from "./webhooks.service";

@ApiTags("education-webhooks")
@Controller("tenants/:tenantId/integrations/webhooks")
@RequirePermissions("tenant:update")
export class WebhooksController {
  constructor(
    @Inject(WebhooksService) private readonly service: WebhooksService,
  ) {}

  @Get() list(@Param("tenantId") tenantId: string) {
    return this.service.list(tenantId);
  }

  @Post() configure(
    @Param("tenantId") tenantId: string,
    @Body() body: ConfigureWebhookEndpointDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.configure(tenantId, body, req.user?.subject);
  }

  @Post(":endpointId/rotate-secret") rotate(
    @Param("tenantId") tenantId: string,
    @Param("endpointId") endpointId: string,
    @Body() body: RotateWebhookSecretDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.rotate(tenantId, endpointId, body, req.user?.subject);
  }

  @Patch(":endpointId/enabled") enabled(
    @Param("tenantId") tenantId: string,
    @Param("endpointId") endpointId: string,
    @Body() body: SetWebhookEnabledDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.setEnabled(
      tenantId,
      endpointId,
      body.enabled,
      req.user?.subject,
    );
  }

  @Post(":endpointId/deliveries/:deliveryId/retry") retryDelivery(
    @Param("tenantId") tenantId: string,
    @Param("endpointId") endpointId: string,
    @Param("deliveryId") deliveryId: string,
    @Body() body: RetryWebhookDeliveryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.retryDelivery(
      tenantId,
      endpointId,
      deliveryId,
      body.reason,
      req.user?.subject,
    );
  }
}
