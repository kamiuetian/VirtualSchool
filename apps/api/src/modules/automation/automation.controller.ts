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
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { AutomationService } from "./automation.service";
import {
  CreateAutomationRuleDto,
  UpdateAutomationRuleDto,
} from "./dto/automation-rule.dto";

@Controller("tenants/:tenantId/automation-rules")
@RequirePermissions("tenant:update")
export class AutomationController {
  constructor(
    @Inject(AutomationService) private readonly service: AutomationService,
  ) {}
  @Get() list(@Param("tenantId") tenantId: string) {
    return this.service.list(tenantId);
  }
  @Post() create(
    @Param("tenantId") tenantId: string,
    @Body() body: CreateAutomationRuleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.create(tenantId, body, req.user?.subject);
  }
  @Patch(":ruleId") update(
    @Param("tenantId") tenantId: string,
    @Param("ruleId") ruleId: string,
    @Body() body: UpdateAutomationRuleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.update(tenantId, ruleId, body, req.user?.subject);
  }
  @Post(":ruleId/test") test(
    @Param("tenantId") tenantId: string,
    @Param("ruleId") ruleId: string,
  ) {
    return this.service.test(tenantId, ruleId);
  }
}
