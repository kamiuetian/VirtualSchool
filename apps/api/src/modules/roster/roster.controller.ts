import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type {
  ClassSectionSummary,
  StudentSummary,
} from "@virtual-school/shared";
import { RequirePermissions } from "../auth/decorators/require-permissions.decorator";
import { CreateClassSectionDto } from "./dto/create-class-section.dto";
import { CreateStudentDto } from "./dto/create-student.dto";
import { RosterService } from "./roster.service";

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
}
