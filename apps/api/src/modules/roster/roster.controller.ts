import {
  Body,
  Controller,
  Get,
  Header,
  Inject,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type {
  ClassSectionSummary,
  AcademicYearRolloverResult,
  RosterImportCommitResult,
  RosterImportSummary,
  StudentSummary,
} from "@virtual-school/shared";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import type { AuthenticatedRequest } from "../auth/types/authenticated-request";
import { CreateClassSectionDto } from "./dto/create-class-section.dto";
import { CreateStudentDto } from "./dto/create-student.dto";
import { PreviewRosterImportDto } from "./dto/preview-roster-import.dto";
import { RosterService } from "./roster.service";
import { AcademicYearRolloverDto } from "./dto/academic-year-rollover.dto";

@ApiTags("roster")
@Controller("tenants/:tenantId")
export class RosterController {
  constructor(
    @Inject(RosterService) private readonly rosterService: RosterService,
  ) {}

  @Get("students")
  @RequirePermissions("tenant:read")
  @ApiOkResponse({ description: "Tenant student roster" })
  listStudents(@Param("tenantId") tenantId: string): Promise<StudentSummary[]> {
    return this.rosterService.listStudents(tenantId);
  }

  @Post("students")
  @RequirePermissions("roster:manage")
  @ApiCreatedResponse({ description: "Create a student profile" })
  createStudent(
    @Param("tenantId") tenantId: string,
    @Body() body: CreateStudentDto,
  ): Promise<StudentSummary> {
    return this.rosterService.createStudent(tenantId, body);
  }

  @Get("classes")
  @RequirePermissions("tenant:read")
  @ApiOkResponse({ description: "Tenant class and section list" })
  listClasses(
    @Param("tenantId") tenantId: string,
  ): Promise<ClassSectionSummary[]> {
    return this.rosterService.listClasses(tenantId);
  }

  @Post("classes")
  @RequirePermissions("class:manage")
  @ApiCreatedResponse({ description: "Create a class or section" })
  createClass(
    @Param("tenantId") tenantId: string,
    @Body() body: CreateClassSectionDto,
  ): Promise<ClassSectionSummary> {
    return this.rosterService.createClass(tenantId, body);
  }

  @Post("academic-year-rollovers")
  @RequirePermissions("class:manage")
  @ApiCreatedResponse({
    description:
      "Archive and duplicate class structures for a new academic year",
  })
  rolloverAcademicYear(
    @Param("tenantId") tenantId: string,
    @Body() body: AcademicYearRolloverDto,
  ): Promise<AcademicYearRolloverResult> {
    return this.rosterService.rolloverAcademicYear(tenantId, body);
  }

  @Post("classes/:classId/students/:studentId")
  @RequirePermissions("class:manage")
  @ApiCreatedResponse({ description: "Add a student to a class section" })
  addStudentToClass(
    @Param("tenantId") tenantId: string,
    @Param("classId") classId: string,
    @Param("studentId") studentId: string,
  ): Promise<ClassSectionSummary> {
    return this.rosterService.addStudentToClass(tenantId, classId, studentId);
  }

  @Post("roster-imports/preview")
  @RequirePermissions("roster:manage")
  @ApiCreatedResponse({
    description: "Validate and preview a roster CSV import",
  })
  previewRosterImport(
    @Param("tenantId") tenantId: string,
    @Body() body: PreviewRosterImportDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<RosterImportSummary> {
    return this.rosterService.previewRosterImport(
      tenantId,
      body,
      request.user?.subject,
    );
  }

  @Get("roster-imports/:importId")
  @RequirePermissions("roster:manage")
  @ApiOkResponse({ description: "Roster import preview details" })
  getRosterImport(
    @Param("tenantId") tenantId: string,
    @Param("importId") importId: string,
  ): Promise<RosterImportSummary> {
    return this.rosterService.getRosterImport(tenantId, importId);
  }

  @Post("roster-imports/:importId/commit")
  @RequirePermissions("roster:manage")
  @ApiCreatedResponse({ description: "Commit a validated roster import" })
  commitRosterImport(
    @Param("tenantId") tenantId: string,
    @Param("importId") importId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<RosterImportCommitResult> {
    return this.rosterService.commitRosterImport(
      tenantId,
      importId,
      request.user?.subject,
    );
  }

  @Get("roster-imports/:importId/error-report.csv")
  @Header("Content-Type", "text/csv; charset=utf-8")
  @Header(
    "Content-Disposition",
    'attachment; filename="roster-import-errors.csv"',
  )
  @RequirePermissions("roster:manage")
  @ApiOkResponse({ description: "Roster import validation error CSV" })
  getRosterImportErrorReportCsv(
    @Param("tenantId") tenantId: string,
    @Param("importId") importId: string,
  ): Promise<string> {
    return this.rosterService.getRosterImportErrorReportCsv(tenantId, importId);
  }
}
