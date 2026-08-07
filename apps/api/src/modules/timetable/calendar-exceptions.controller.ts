import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { AcademicCalendarExceptionSummary } from "@virtual-school/shared";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { AcademicCalendarService } from "./calendar-exceptions.service";
import { CreateCalendarExceptionDto } from "./dto/create-calendar-exception.dto";
import { TimetableLifecycleDto } from "./dto/timetable-lifecycle.dto";

@ApiTags("academic-calendar")
@Controller("tenants/:tenantId/calendar-exceptions")
export class CalendarExceptionsController {
  constructor(
    @Inject(AcademicCalendarService)
    private readonly service: AcademicCalendarService,
  ) {}

  @Get()
  @RequirePermissions("tenant:read")
  @ApiOkResponse({ description: "Tenant-local dated timetable exceptions" })
  list(
    @Param("tenantId") tenantId: string,
  ): Promise<AcademicCalendarExceptionSummary[]> {
    return this.service.list(tenantId);
  }

  @Post()
  @RequirePermissions("policy:manage")
  @ApiCreatedResponse({ description: "Create a dated timetable exception" })
  create(
    @Param("tenantId") tenantId: string,
    @Body() body: CreateCalendarExceptionDto,
  ): Promise<AcademicCalendarExceptionSummary> {
    return this.service.create(tenantId, body);
  }

  @Post(":exceptionId/deactivate")
  @RequirePermissions("policy:manage")
  deactivate(
    @Param("tenantId") tenantId: string,
    @Param("exceptionId") exceptionId: string,
    @Body() body: TimetableLifecycleDto,
  ): Promise<AcademicCalendarExceptionSummary> {
    return this.service.deactivate(tenantId, exceptionId, body);
  }
}
