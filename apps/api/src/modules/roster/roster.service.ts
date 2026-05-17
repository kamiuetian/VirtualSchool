import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  ClassSectionSummary,
  RosterImportCommitResult,
  RosterImportRowInput,
  RosterImportRowResult,
  RosterImportStatus,
  RosterImportSummary,
  StudentStatus,
  StudentSummary,
} from "@virtual-school/shared";
import {
  Prisma,
  type ClassSection,
  type RosterImport,
  type Student,
} from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateClassSectionDto } from "./dto/create-class-section.dto";
import type { CreateStudentDto } from "./dto/create-student.dto";
import type { PreviewRosterImportDto } from "./dto/preview-roster-import.dto";

type StudentWithCount = Student & {
  _count?: {
    guardians: number;
  };
};

type ClassWithCount = ClassSection & {
  _count?: {
    members: number;
  };
};

const rosterImportStatuses = [
  "ACTIVE",
  "PENDING",
  "SUSPENDED",
  "GRADUATED",
  "WITHDRAWN",
] as const satisfies readonly StudentStatus[];

@Injectable()
export class RosterService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listStudents(tenantId: string): Promise<StudentSummary[]> {
    await this.ensureTenantExists(tenantId);

    const students = await this.prisma.student.findMany({
      include: {
        _count: {
          select: {
            guardians: true,
          },
        },
      },
      orderBy: [{ grade: "asc" }, { section: "asc" }, { name: "asc" }],
      where: {
        tenantId,
      },
    });

    return students.map((student) => this.toStudentSummary(student));
  }

  async createStudent(
    tenantId: string,
    input: CreateStudentDto,
  ): Promise<StudentSummary> {
    await this.ensureTenantExists(tenantId);
    await this.ensureBranchBelongsToTenant(tenantId, input.branchId);

    const existing = await this.prisma.student.findUnique({
      where: {
        tenantId_studentCode: {
          studentCode: input.studentCode,
          tenantId,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Student code ${input.studentCode} already exists for this tenant`,
      );
    }

    const student = await this.prisma.$transaction(async (tx) => {
      const created = await tx.student.create({
        data: {
          branchId: input.branchId,
          grade: input.grade,
          name: input.name,
          section: input.section,
          status: input.status ?? "PENDING",
          studentCode: input.studentCode,
          tenantId,
        },
      });

      for (const guardian of input.guardians ?? []) {
        const createdGuardian = await tx.guardian.create({
          data: {
            email: guardian.email,
            name: guardian.name,
            phone: guardian.phone,
            tenantId,
          },
        });

        await tx.studentGuardian.create({
          data: {
            guardianId: createdGuardian.id,
            relationship: guardian.relationship,
            studentId: created.id,
          },
        });
      }

      await tx.auditEvent.create({
        data: {
          action: "student.create",
          newValue: {
            grade: created.grade,
            name: created.name,
            section: created.section,
            status: created.status,
            studentCode: created.studentCode,
          },
          object: "Student",
          objectId: created.id,
          outcome: "SUCCESS",
          tenantId,
        },
      });

      return tx.student.findUniqueOrThrow({
        include: {
          _count: {
            select: {
              guardians: true,
            },
          },
        },
        where: {
          id: created.id,
        },
      });
    });

    return this.toStudentSummary(student);
  }

  async listClasses(tenantId: string): Promise<ClassSectionSummary[]> {
    await this.ensureTenantExists(tenantId);

    const classes = await this.prisma.classSection.findMany({
      include: {
        _count: {
          select: {
            members: true,
          },
        },
      },
      orderBy: [{ grade: "asc" }, { name: "asc" }],
      where: {
        tenantId,
      },
    });

    return classes.map((classSection) => this.toClassSummary(classSection));
  }

  async createClass(
    tenantId: string,
    input: CreateClassSectionDto,
  ): Promise<ClassSectionSummary> {
    await this.ensureTenantExists(tenantId);
    await this.ensureBranchBelongsToTenant(tenantId, input.branchId);

    const classSection = await this.prisma.$transaction(async (tx) => {
      const created = await tx.classSection.create({
        data: {
          branchId: input.branchId,
          grade: input.grade,
          name: input.name,
          subject: input.subject,
          tenantId,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "class.create",
          newValue: {
            grade: created.grade,
            name: created.name,
            subject: created.subject,
          },
          object: "ClassSection",
          objectId: created.id,
          outcome: "SUCCESS",
          tenantId,
        },
      });

      return tx.classSection.findUniqueOrThrow({
        include: {
          _count: {
            select: {
              members: true,
            },
          },
        },
        where: {
          id: created.id,
        },
      });
    });

    return this.toClassSummary(classSection);
  }

  async addStudentToClass(
    tenantId: string,
    classId: string,
    studentId: string,
  ): Promise<ClassSectionSummary> {
    const [classSection, student] = await Promise.all([
      this.prisma.classSection.findFirst({
        where: {
          id: classId,
          tenantId,
        },
      }),
      this.prisma.student.findFirst({
        where: {
          id: studentId,
          tenantId,
        },
      }),
    ]);

    if (!classSection) {
      throw new NotFoundException(
        `Class ${classId} was not found for tenant ${tenantId}`,
      );
    }

    if (!student) {
      throw new NotFoundException(
        `Student ${studentId} was not found for tenant ${tenantId}`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.classMembership.upsert({
        create: {
          classId,
          studentId,
        },
        update: {},
        where: {
          classId_studentId: {
            classId,
            studentId,
          },
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "class.add_student",
          newValue: {
            classId,
            studentId,
          },
          object: "ClassMembership",
          objectId: `${classId}:${studentId}`,
          outcome: "SUCCESS",
          tenantId,
        },
      });

      return tx.classSection.findUniqueOrThrow({
        include: {
          _count: {
            select: {
              members: true,
            },
          },
        },
        where: {
          id: classId,
        },
      });
    });

    return this.toClassSummary(updated);
  }

  async previewRosterImport(
    tenantId: string,
    input: PreviewRosterImportDto,
    actorId: string | undefined,
  ): Promise<RosterImportSummary> {
    await this.ensureTenantExists(tenantId);

    const parsed = this.parseCsv(input.csv);
    const rows = await this.validateRosterImportRows(tenantId, parsed.rows);
    const errorReportCsv = this.buildRosterErrorCsv(rows);
    const validRows = rows.filter((row) => row.errors.length === 0).length;
    const importRecord = await this.prisma.$transaction(async (tx) => {
      const created = await tx.rosterImport.create({
        data: {
          createdBy: actorId,
          errorReportCsv,
          errorRows: rows.length - validRows,
          filename: input.filename,
          rows: rows as unknown as Prisma.InputJsonValue,
          status: "PREVIEWED",
          tenantId,
          totalRows: rows.length,
          validRows,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "roster_import.preview",
          actorId,
          newValue: {
            errorRows: created.errorRows,
            filename: created.filename,
            totalRows: created.totalRows,
            validRows: created.validRows,
          },
          object: "RosterImport",
          objectId: created.id,
          outcome: created.errorRows > 0 ? "VALIDATION_ERRORS" : "SUCCESS",
          tenantId,
        },
      });

      return created;
    });

    return this.toRosterImportSummary(importRecord);
  }

  async getRosterImport(
    tenantId: string,
    importId: string,
  ): Promise<RosterImportSummary> {
    const importRecord = await this.getRosterImportRecord(tenantId, importId);
    return this.toRosterImportSummary(importRecord);
  }

  async getRosterImportErrorReportCsv(
    tenantId: string,
    importId: string,
  ): Promise<string> {
    const importRecord = await this.getRosterImportRecord(tenantId, importId);
    return importRecord.errorReportCsv ?? this.buildRosterErrorCsv([]);
  }

  async commitRosterImport(
    tenantId: string,
    importId: string,
    actorId: string | undefined,
  ): Promise<RosterImportCommitResult> {
    const importRecord = await this.getRosterImportRecord(tenantId, importId);

    if (importRecord.status !== "PREVIEWED") {
      throw new BadRequestException(
        `Roster import ${importId} is already ${importRecord.status}`,
      );
    }

    if (importRecord.errorRows > 0) {
      throw new BadRequestException(
        "Roster import cannot be committed while validation errors remain",
      );
    }

    const rows = this.rosterRowsFromJson(importRecord.rows);
    const counters = await this.prisma.$transaction(async (tx) => {
      let createdStudents = 0;
      let createdGuardians = 0;
      let createdClasses = 0;
      let createdMemberships = 0;

      for (const row of rows) {
        const student = await tx.student.create({
          data: {
            branchId: row.input.branchId ?? undefined,
            grade: row.input.grade,
            name: row.input.name,
            section: row.input.section ?? undefined,
            status: row.input.status ?? "ACTIVE",
            studentCode: row.input.studentCode,
            tenantId,
          },
        });
        createdStudents += 1;

        if (row.input.guardianName) {
          const guardian = await tx.guardian.create({
            data: {
              email: row.input.guardianEmail ?? undefined,
              name: row.input.guardianName,
              phone: row.input.guardianPhone ?? undefined,
              tenantId,
            },
          });
          createdGuardians += 1;

          await tx.studentGuardian.create({
            data: {
              guardianId: guardian.id,
              relationship: row.input.guardianRelationship ?? "guardian",
              studentId: student.id,
            },
          });
        }

        if (row.input.className) {
          const existingClass = await tx.classSection.findFirst({
            where: {
              grade: row.input.grade,
              name: row.input.className,
              tenantId,
            },
          });
          const classSection =
            existingClass ??
            (await tx.classSection.create({
              data: {
                branchId: row.input.branchId ?? undefined,
                grade: row.input.grade,
                name: row.input.className,
                subject: row.input.classSubject ?? undefined,
                tenantId,
              },
            }));

          if (!existingClass) {
            createdClasses += 1;
          }

          await tx.classMembership.create({
            data: {
              classId: classSection.id,
              studentId: student.id,
            },
          });
          createdMemberships += 1;
        }
      }

      const committed = await tx.rosterImport.update({
        data: {
          committedAt: new Date(),
          committedBy: actorId,
          status: "COMMITTED",
        },
        where: {
          id: importRecord.id,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "roster_import.commit",
          actorId,
          newValue: {
            createdClasses,
            createdGuardians,
            createdMemberships,
            createdStudents,
            status: committed.status,
          },
          object: "RosterImport",
          objectId: committed.id,
          oldValue: {
            status: importRecord.status,
          },
          outcome: "SUCCESS",
          tenantId,
        },
      });

      return {
        committed,
        createdClasses,
        createdGuardians,
        createdMemberships,
        createdStudents,
      };
    });

    return {
      createdClasses: counters.createdClasses,
      createdGuardians: counters.createdGuardians,
      createdMemberships: counters.createdMemberships,
      createdStudents: counters.createdStudents,
      import: this.toRosterImportSummary(counters.committed),
    };
  }

  private async ensureTenantExists(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      select: {
        id: true,
      },
      where: {
        id: tenantId,
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} was not found`);
    }
  }

  private async getRosterImportRecord(
    tenantId: string,
    importId: string,
  ): Promise<RosterImport> {
    const importRecord = await this.prisma.rosterImport.findFirst({
      where: {
        id: importId,
        tenantId,
      },
    });

    if (!importRecord) {
      throw new NotFoundException(
        `Roster import ${importId} was not found for tenant ${tenantId}`,
      );
    }

    return importRecord;
  }

  private async validateRosterImportRows(
    tenantId: string,
    rows: RosterImportRowInput[],
  ): Promise<RosterImportRowResult[]> {
    const existingStudents = await this.prisma.student.findMany({
      select: {
        studentCode: true,
      },
      where: {
        studentCode: {
          in: rows.map((row) => row.studentCode).filter(Boolean),
        },
        tenantId,
      },
    });
    const existingStudentCodes = new Set(
      existingStudents.map((student) => student.studentCode),
    );
    const branchIds = [
      ...new Set(rows.map((row) => row.branchId).filter(Boolean) as string[]),
    ];
    const branches =
      branchIds.length === 0
        ? []
        : await this.prisma.branch.findMany({
            select: {
              id: true,
            },
            where: {
              id: {
                in: branchIds,
              },
              tenantId,
            },
          });
    const validBranchIds = new Set(branches.map((branch) => branch.id));
    const seenStudentCodes = new Set<string>();

    return rows.map((input, index) => {
      const errors: string[] = [];
      const rowNumber = index + 2;

      if (!input.studentCode) {
        errors.push("studentCode is required");
      } else if (seenStudentCodes.has(input.studentCode)) {
        errors.push(
          `studentCode ${input.studentCode} is duplicated in this file`,
        );
      } else if (existingStudentCodes.has(input.studentCode)) {
        errors.push(`studentCode ${input.studentCode} already exists`);
      }

      if (input.studentCode) {
        seenStudentCodes.add(input.studentCode);
      }

      if (!input.name) {
        errors.push("name is required");
      }

      if (!input.grade) {
        errors.push("grade is required");
      }

      if (
        input.status &&
        !rosterImportStatuses.includes(input.status as StudentStatus)
      ) {
        errors.push(`status ${input.status} is not supported`);
      }

      if (input.branchId && !validBranchIds.has(input.branchId)) {
        errors.push(`branchId ${input.branchId} was not found`);
      }

      if (input.guardianEmail && !this.isLikelyEmail(input.guardianEmail)) {
        errors.push(`guardianEmail ${input.guardianEmail} is invalid`);
      }

      if (input.guardianName && !input.guardianRelationship) {
        errors.push(
          "guardianRelationship is required when guardianName is provided",
        );
      }

      return {
        action: errors.length === 0 ? "CREATE_STUDENT" : "REJECT",
        errors,
        input,
        rowNumber,
      };
    });
  }

  private parseCsv(csv: string): { rows: RosterImportRowInput[] } {
    const records = this.parseCsvRecords(csv);

    if (records.length === 0) {
      throw new BadRequestException("CSV must include a header row");
    }

    const headers =
      records[0]?.map((header) => this.normalizeHeader(header)) ?? [];
    const requiredHeaders = ["studentcode", "name", "grade"];
    const missingHeaders = requiredHeaders.filter(
      (header) => !headers.includes(header),
    );

    if (missingHeaders.length > 0) {
      throw new BadRequestException(
        `CSV is missing required headers: ${missingHeaders.join(", ")}`,
      );
    }

    return {
      rows: records
        .slice(1)
        .filter((record) => record.some((cell) => cell.trim()))
        .map((record) => {
          const value = (header: string): string | null => {
            const index = headers.indexOf(header);
            if (index < 0) {
              return null;
            }
            const cell = record[index]?.trim();
            return cell ? cell : null;
          };

          return {
            branchId: value("branchid"),
            className: value("classname"),
            classSubject: value("classsubject"),
            grade: value("grade") ?? "",
            guardianEmail: value("guardianemail"),
            guardianName: value("guardianname"),
            guardianPhone: value("guardianphone"),
            guardianRelationship: value("guardianrelationship"),
            name: value("name") ?? "",
            section: value("section"),
            status: value("status") as StudentStatus | null,
            studentCode: value("studentcode") ?? "",
          };
        }),
    };
  }

  private parseCsvRecords(csv: string): string[][] {
    const records: string[][] = [];
    let currentRecord: string[] = [];
    let currentCell = "";
    let inQuotes = false;

    for (let index = 0; index < csv.length; index += 1) {
      const char = csv[index];
      const nextChar = csv[index + 1];

      if (char === '"' && inQuotes && nextChar === '"') {
        currentCell += '"';
        index += 1;
        continue;
      }

      if (char === '"') {
        inQuotes = !inQuotes;
        continue;
      }

      if (char === "," && !inQuotes) {
        currentRecord.push(currentCell);
        currentCell = "";
        continue;
      }

      if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && nextChar === "\n") {
          index += 1;
        }
        currentRecord.push(currentCell);
        records.push(currentRecord);
        currentRecord = [];
        currentCell = "";
        continue;
      }

      currentCell += char;
    }

    currentRecord.push(currentCell);
    records.push(currentRecord);

    return records.filter((record) => record.some((cell) => cell.trim()));
  }

  private buildRosterErrorCsv(rows: RosterImportRowResult[]): string {
    const header = ["row_number", "student_code", "name", "grade", "errors"];
    const errorRows = rows
      .filter((row) => row.errors.length > 0)
      .map((row) => [
        row.rowNumber,
        row.input.studentCode,
        row.input.name,
        row.input.grade,
        row.errors.join("; "),
      ]);

    return [header, ...errorRows]
      .map((row) => row.map((cell) => this.csvCell(cell)).join(","))
      .join("\n");
  }

  private rosterRowsFromJson(value: Prisma.JsonValue): RosterImportRowResult[] {
    if (!Array.isArray(value)) {
      throw new BadRequestException("Roster import rows are malformed");
    }

    return value as unknown as RosterImportRowResult[];
  }

  private normalizeHeader(header: string): string {
    return header.trim().toLowerCase().replaceAll("_", "").replaceAll(" ", "");
  }

  private isLikelyEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  private async ensureBranchBelongsToTenant(
    tenantId: string,
    branchId: string | undefined,
  ): Promise<void> {
    if (!branchId) {
      return;
    }

    const branch = await this.prisma.branch.findFirst({
      select: {
        id: true,
      },
      where: {
        id: branchId,
        tenantId,
      },
    });

    if (!branch) {
      throw new NotFoundException(
        `Branch ${branchId} was not found for tenant ${tenantId}`,
      );
    }
  }

  private toStudentSummary(student: StudentWithCount): StudentSummary {
    return {
      branchId: student.branchId,
      grade: student.grade,
      guardianCount: student._count?.guardians ?? 0,
      id: student.id,
      name: student.name,
      section: student.section,
      status: student.status as StudentStatus,
      studentCode: student.studentCode,
      tenantId: student.tenantId,
    };
  }

  private toClassSummary(classSection: ClassWithCount): ClassSectionSummary {
    return {
      branchId: classSection.branchId,
      grade: classSection.grade,
      id: classSection.id,
      name: classSection.name,
      studentCount: classSection._count?.members ?? 0,
      subject: classSection.subject,
      tenantId: classSection.tenantId,
    };
  }

  private toRosterImportSummary(
    importRecord: RosterImport,
  ): RosterImportSummary {
    return {
      committedAt: importRecord.committedAt?.toISOString() ?? null,
      committedBy: importRecord.committedBy,
      createdAt: importRecord.createdAt.toISOString(),
      createdBy: importRecord.createdBy,
      errorRows: importRecord.errorRows,
      filename: importRecord.filename,
      id: importRecord.id,
      rows: this.rosterRowsFromJson(importRecord.rows),
      status: importRecord.status as RosterImportStatus,
      tenantId: importRecord.tenantId,
      totalRows: importRecord.totalRows,
      validRows: importRecord.validRows,
    };
  }

  private csvCell(value: unknown): string {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replaceAll('"', '""')}"`;
  }
}
