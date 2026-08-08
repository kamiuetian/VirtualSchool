import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { AttendanceService } from "./attendance.service";
import {
  CaptureAttendanceDto,
  CorrectAttendanceDto,
  UpdateAttendanceSettingsDto,
} from "./attendance.dto";

@ApiTags("attendance")
@Controller("tenants/:tenantId/attendance")
export class AttendanceController {
  constructor(
    @Inject(AttendanceService) private readonly service: AttendanceService,
  ) {}

  @Get("settings")
  @RequirePermissions("tenant:read")
  settings(@Param("tenantId") tenantId: string) {
    return this.service.getSettings(tenantId);
  }

  @Patch("settings")
  @RequirePermissions("class:manage")
  updateSettings(
    @Param("tenantId") tenantId: string,
    @Body() dto: UpdateAttendanceSettingsDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.updateSettings(tenantId, dto, req.user?.subject);
  }

  @Post("capture")
  @RequirePermissions("class:manage")
  capture(
    @Param("tenantId") tenantId: string,
    @Body() dto: CaptureAttendanceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.capture(
      tenantId,
      dto.classId,
      dto.attendanceDate.slice(0, 10),
      req.user?.subject,
    );
  }

  @Get("records")
  @RequirePermissions("report:export")
  records(
    @Param("tenantId") tenantId: string,
    @Query("classId") classId: string,
    @Query("date") date: string,
  ) {
    return this.service.report(tenantId, classId, date);
  }

  @Patch("records/:recordId")
  @RequirePermissions("class:manage")
  correct(
    @Param("tenantId") tenantId: string,
    @Param("recordId") recordId: string,
    @Body() dto: CorrectAttendanceDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.correct(
      tenantId,
      recordId,
      dto.status,
      dto.reason,
      req.user?.subject,
    );
  }

  @Get("records.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @RequirePermissions("report:export")
  csv(
    @Param("tenantId") tenantId: string,
    @Query("classId") classId: string,
    @Query("date") date: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.service.csv(tenantId, classId, date, req.user?.subject);
  }
}
