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
import { ConfigureLmsDto, MapLmsCourseDto } from "./lms.dto";
import { LmsService } from "./lms.service";
@ApiTags("lms")
@Controller("tenants/:tenantId/integrations/lms")
@RequirePermissions("tenant:update")
export class LmsController {
  constructor(@Inject(LmsService) private readonly service: LmsService) {}
  @Get() list(@Param("tenantId") tenantId: string) {
    return this.service.list(tenantId);
  }
  @Post() configure(
    @Param("tenantId") tenantId: string,
    @Body() body: ConfigureLmsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.configure(tenantId, body, req.user?.subject);
  }
  @Post(":provider/course-mappings") map(
    @Param("tenantId") tenantId: string,
    @Param("provider") provider: string,
    @Body() body: MapLmsCourseDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.mapCourse(tenantId, provider, body, req.user?.subject);
  }
  @Post(":provider/test") test(
    @Param("tenantId") tenantId: string,
    @Param("provider") provider: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.test(tenantId, provider, req.user?.subject);
  }
  @Post(":provider/disable") disable(
    @Param("tenantId") tenantId: string,
    @Param("provider") provider: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.disable(tenantId, provider, req.user?.subject);
  }
}
