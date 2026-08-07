import { Body, Controller, Get, Inject, Param, Post, Req } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { TeacherDashboard, TeacherSessionEventSummary, TeacherSessionSummary, TeacherSessionTemplateSummary } from "@virtual-school/shared";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { ApproveTemporaryUrlDto, AssignTeacherClassDto, CreateTeacherSessionTemplateDto, EndTeacherSessionDto, PushTeacherResourceDto, RecordTeacherDeviceEventDto, ShowFocusScreenDto, StartTeacherSessionDto } from "./dto/teacher-session.dto";
import { TeacherSessionsService } from "./teacher-sessions.service";

@ApiTags("teacher-sessions")
@Controller("tenants/:tenantId/teacher")
export class TeacherSessionsController {
  constructor(@Inject(TeacherSessionsService) private readonly service: TeacherSessionsService) {}

  @Get("dashboard")
  @RequirePermissions("session:manage")
  @ApiOkResponse({ description: "Teacher-scoped classes, devices, and live sessions" })
  dashboard(@Param("tenantId") tenantId: string, @Req() request: AuthenticatedRequest): Promise<TeacherDashboard> {
    return this.service.dashboard(tenantId, request.user!.subject, request.user?.email);
  }

  @Post("classes/:classId/assignments")
  @RequirePermissions("class:manage")
  @ApiCreatedResponse({ description: "Assign a teacher to a tenant class" })
  assign(@Param("tenantId") tenantId: string, @Param("classId") classId: string, @Body() body: AssignTeacherClassDto, @Req() request: AuthenticatedRequest) {
    return this.service.assignTeacher(tenantId, classId, body.teacherId, request.user!.subject);
  }

  @Post("templates")
  @RequirePermissions("session:manage")
  createTemplate(@Param("tenantId") tenantId: string, @Body() body: CreateTeacherSessionTemplateDto, @Req() request: AuthenticatedRequest): Promise<TeacherSessionTemplateSummary> {
    return this.service.createTemplate(tenantId, body, request.user!.subject, request.user?.email);
  }

  @Post("templates/:templateId/start")
  @RequirePermissions("session:manage")
  startTemplate(@Param("tenantId") tenantId: string, @Param("templateId") templateId: string, @Req() request: AuthenticatedRequest): Promise<TeacherSessionSummary> {
    return this.service.startFromTemplate(tenantId, templateId, request.user!.subject, request.user?.email);
  }

  @Post("sessions")
  @RequirePermissions("session:manage")
  start(@Param("tenantId") tenantId: string, @Body() body: StartTeacherSessionDto, @Req() request: AuthenticatedRequest): Promise<TeacherSessionSummary> {
    return this.service.start(tenantId, body.classId, request.user!.subject, request.user?.email);
  }

  @Post("sessions/:sessionId/end")
  @RequirePermissions("session:manage")
  end(@Param("tenantId") tenantId: string, @Param("sessionId") sessionId: string, @Body() body: EndTeacherSessionDto, @Req() request: AuthenticatedRequest): Promise<TeacherSessionSummary> {
    return this.service.end(tenantId, sessionId, body.reason, request.user!.subject, request.user?.email);
  }

  @Post("sessions/:sessionId/device-events")
  @RequirePermissions("session:manage")
  recordDeviceEvent(@Param("tenantId") tenantId: string, @Param("sessionId") sessionId: string, @Body() body: RecordTeacherDeviceEventDto, @Req() request: AuthenticatedRequest): Promise<TeacherSessionEventSummary> {
    return this.service.recordDeviceEvent(tenantId, sessionId, body, request.user!.subject, request.user?.email);
  }

  @Post("sessions/:sessionId/resources")
  @RequirePermissions("session:manage")
  pushResource(@Param("tenantId") tenantId: string, @Param("sessionId") sessionId: string, @Body() body: PushTeacherResourceDto, @Req() request: AuthenticatedRequest): Promise<TeacherSessionEventSummary> {
    return this.service.pushResource(tenantId, sessionId, body.resourceId, request.user!.subject, request.user?.email);
  }

  @Post("sessions/:sessionId/focus-screen")
  @RequirePermissions("session:manage")
  showFocusScreen(@Param("tenantId") tenantId: string, @Param("sessionId") sessionId: string, @Body() body: ShowFocusScreenDto, @Req() request: AuthenticatedRequest): Promise<TeacherSessionEventSummary> {
    return this.service.showFocusScreen(tenantId, sessionId, body.message, body.durationMinutes, request.user!.subject, request.user?.email);
  }

  @Post("sessions/:sessionId/temporary-url-approvals")
  @RequirePermissions("session:manage")
  approveTemporaryUrl(@Param("tenantId") tenantId: string, @Param("sessionId") sessionId: string, @Body() body: ApproveTemporaryUrlDto, @Req() request: AuthenticatedRequest): Promise<TeacherSessionEventSummary> {
    return this.service.approveTemporaryUrl(tenantId, sessionId, body.url, body.durationMinutes, request.user!.subject, request.user?.email);
  }
}
