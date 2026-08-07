import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { ByodService } from "./byod.service";
import {
  CreateByodStudySessionDto,
  CheckByodReadinessDto,
  ExitByodStudySessionDto,
} from "./dto/byod.dto";

@ApiTags("byod-study-sessions")
@Controller("tenants/:tenantId/byod-sessions")
export class ByodController {
  constructor(@Inject(ByodService) private readonly service: ByodService) {}

  @Post()
  @RequirePermissions("session:manage")
  create(
    @Param("tenantId") tenantId: string,
    @Body() body: CreateByodStudySessionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.create(
      tenantId,
      body,
      req.user!.subject,
      req.user?.email,
    );
  }

  @Post(":sessionId/join")
  join(
    @Param("tenantId") tenantId: string,
    @Param("sessionId") sessionId: string,
    @Body() body: CheckByodReadinessDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.join(
      tenantId,
      sessionId,
      req.user!.subject,
      req.user!.role,
      body,
    );
  }

  @Post(":sessionId/readiness")
  readiness(
    @Param("tenantId") tenantId: string,
    @Param("sessionId") sessionId: string,
    @Body() body: CheckByodReadinessDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.readiness(
      tenantId,
      sessionId,
      req.user!.subject,
      req.user!.role,
      body,
    );
  }

  @Get(":sessionId/participation-report")
  @RequirePermissions("report:export")
  report(
    @Param("tenantId") tenantId: string,
    @Param("sessionId") sessionId: string,
  ) {
    return this.service.participationReport(tenantId, sessionId);
  }

  @Post(":sessionId/exit")
  exit(
    @Param("tenantId") tenantId: string,
    @Param("sessionId") sessionId: string,
    @Body() body: ExitByodStudySessionDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.exit(
      tenantId,
      sessionId,
      body.status,
      req.user!.subject,
      req.user!.role,
    );
  }
}
