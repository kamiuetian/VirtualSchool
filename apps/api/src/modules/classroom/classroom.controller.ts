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
import { ClassroomService } from "./classroom.service";
import {
  AuthorizeClassroomDto,
  MapClassroomCourseDto,
  MapClassroomIdentityDto,
  StartClassroomSyncDto,
} from "./dto/classroom.dto";

@ApiTags("google-classroom")
@Controller("tenants/:tenantId/integrations/google-classroom")
@RequirePermissions("tenant:update")
export class ClassroomController {
  constructor(
    @Inject(ClassroomService) private readonly service: ClassroomService,
  ) {}
  @Get() get(@Param("tenantId") tenantId: string) {
    return this.service.get(tenantId);
  }
  @Post("authorize") authorize(
    @Param("tenantId") tenantId: string,
    @Body() body: AuthorizeClassroomDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.authorize(tenantId, body, req.user?.subject);
  }
  @Post("course-mappings") mapCourse(
    @Param("tenantId") tenantId: string,
    @Body() body: MapClassroomCourseDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.mapCourse(tenantId, body, req.user?.subject);
  }
  @Post("identity-mappings") mapIdentity(
    @Param("tenantId") tenantId: string,
    @Body() body: MapClassroomIdentityDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.mapIdentity(tenantId, body, req.user?.subject);
  }
  @Post("sync-runs") sync(
    @Param("tenantId") tenantId: string,
    @Body() body: StartClassroomSyncDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.startSync(tenantId, body, req.user?.subject);
  }
  @Post("sync-runs/:runId/retry") retry(
    @Param("tenantId") tenantId: string,
    @Param("runId") runId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.retry(tenantId, runId, req.user?.subject);
  }
}
