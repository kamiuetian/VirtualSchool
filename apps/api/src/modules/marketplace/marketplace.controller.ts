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
  ConfigureIntegrationDto,
  CreateIntegrationSubmissionDto,
  ReviewIntegrationSubmissionDto,
} from "./marketplace.dto";
import { MarketplaceService } from "./marketplace.service";

@ApiTags("integration-marketplace")
@Controller("tenants/:tenantId/integration-marketplace")
@RequirePermissions("tenant:update")
export class MarketplaceController {
  constructor(
    @Inject(MarketplaceService) private readonly service: MarketplaceService,
  ) {}
  @Get() list(@Param("tenantId") tenantId: string) {
    return this.service.list(tenantId);
  }
  @Get("submissions") submissions(@Param("tenantId") tenantId: string) {
    return this.service.listSubmissions(tenantId);
  }
  @Post("submissions") create(
    @Param("tenantId") tenantId: string,
    @Body() body: CreateIntegrationSubmissionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.createSubmission(tenantId, body, req.user?.subject);
  }
  @Post("submissions/:id/submit") submit(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.submit(tenantId, id, req.user?.subject);
  }
  @Patch("submissions/:id/review") review(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Body() body: ReviewIntegrationSubmissionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.review(tenantId, id, body, req.user?.subject);
  }
  @Post(":id/enable") enable(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Body() body: ConfigureIntegrationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.enable(
      tenantId,
      id,
      body.configuration,
      req.user?.subject,
    );
  }
  @Post(":id/test") test(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.test(tenantId, id, req.user?.subject);
  }
  @Post(":id/disable") disable(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.disable(tenantId, id, req.user?.subject);
  }
}
