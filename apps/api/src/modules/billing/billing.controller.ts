import { Body, Controller, Get, Inject, Param, Patch, Req } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type {
  BillingSubscriptionSummary,
  BillingUsageSummary,
} from "@virtual-school/shared";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { BillingService } from "./billing.service";
import { UpdateBillingSubscriptionDto } from "./dto/update-billing-subscription.dto";

@ApiTags("billing")
@Controller("tenants/:tenantId/billing")
export class BillingController {
  constructor(
    @Inject(BillingService) private readonly billingService: BillingService,
  ) {}

  @Get("subscription")
  @RequirePermissions("billing:read")
  @ApiOkResponse({ description: "Tenant billing subscription summary" })
  getSubscription(
    @Param("tenantId") tenantId: string,
  ): Promise<BillingSubscriptionSummary> {
    return this.billingService.getSubscription(tenantId);
  }

  @Get("usage")
  @RequirePermissions("billing:read")
  @ApiOkResponse({ description: "Current billing plan usage and limit status" })
  getUsage(@Param("tenantId") tenantId: string): Promise<BillingUsageSummary> {
    return this.billingService.getUsage(tenantId);
  }

  @Patch("subscription")
  @RequirePermissions("billing:manage")
  @ApiOkResponse({ description: "Update tenant billing subscription metadata" })
  updateSubscription(
    @Param("tenantId") tenantId: string,
    @Body() body: UpdateBillingSubscriptionDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<BillingSubscriptionSummary> {
    return this.billingService.updateSubscription(
      tenantId,
      body,
      request.user?.subject,
    );
  }
}
