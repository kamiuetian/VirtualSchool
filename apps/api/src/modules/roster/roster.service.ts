import { ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { ClassSectionSummary, StudentSummary } from "@virtual-school/shared";
import type { ClassSection, Student, StudentStatus } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateClassSectionDto } from "./dto/create-class-section.dto";
import type { CreateStudentDto } from "./dto/create-student.dto";

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

@Injectable()
export class RosterService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listStudents(tenantId: string): Promise<StudentSummary[]> {
    await this.ensureTenantExists(tenantId);

    const students = await this.prisma.student.findMany({
      include: {
        _count: {
          select: {
            guardians: true
          }
        }
      },
      orderBy: [{ grade: "asc" }, { section: "asc" }, { name: "asc" }],
      where: {
        tenantId
      }
    });

    return students.map((student) => this.toStudentSummary(student));
  }

  async createStudent(tenantId: string, input: CreateStudentDto): Promise<StudentSummary> {
    await this.ensureTenantExists(tenantId);
    await this.ensureBranchBelongsToTenant(tenantId, input.branchId);

    const existing = await this.prisma.student.findUnique({
      where: {
        tenantId_studentCode: {
          studentCode: input.studentCode,
          tenantId
        }
      }
    });

    if (existing) {
      throw new ConflictException(`Student code ${input.studentCode} already exists for this tenant`);
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
          tenantId
        }
      });

      for (const guardian of input.guardians ?? []) {
        const createdGuardian = await tx.guardian.create({
          data: {
            email: guardian.email,
            name: guardian.name,
            phone: guardian.phone,
            tenantId
          }
        });

        await tx.studentGuardian.create({
          data: {
            guardianId: createdGuardian.id,
            relationship: guardian.relationship,
            studentId: created.id
          }
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
            studentCode: created.studentCode
          },
          object: "Student",
          objectId: created.id,
          outcome: "SUCCESS",
          tenantId
        }
      });

      return tx.student.findUniqueOrThrow({
        include: {
          _count: {
            select: {
              guardians: true
            }
          }
        },
        where: {
          id: created.id
        }
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
            members: true
          }
        }
      },
      orderBy: [{ grade: "asc" }, { name: "asc" }],
      where: {
        tenantId
      }
    });

    return classes.map((classSection) => this.toClassSummary(classSection));
  }

  async createClass(tenantId: string, input: CreateClassSectionDto): Promise<ClassSectionSummary> {
    await this.ensureTenantExists(tenantId);
    await this.ensureBranchBelongsToTenant(tenantId, input.branchId);

    const classSection = await this.prisma.$transaction(async (tx) => {
      const created = await tx.classSection.create({
        data: {
          branchId: input.branchId,
          grade: input.grade,
          name: input.name,
          subject: input.subject,
          tenantId
        }
      });

      await tx.auditEvent.create({
        data: {
          action: "class.create",
          newValue: {
            grade: created.grade,
            name: created.name,
            subject: created.subject
          },
          object: "ClassSection",
          objectId: created.id,
          outcome: "SUCCESS",
          tenantId
        }
      });

      return tx.classSection.findUniqueOrThrow({
        include: {
          _count: {
            select: {
              members: true
            }
          }
        },
        where: {
          id: created.id
        }
      });
    });

    return this.toClassSummary(classSection);
  }

  async addStudentToClass(
    tenantId: string,
    classId: string,
    studentId: string
  ): Promise<ClassSectionSummary> {
    const [classSection, student] = await Promise.all([
      this.prisma.classSection.findFirst({
        where: {
          id: classId,
          tenantId
        }
      }),
      this.prisma.student.findFirst({
        where: {
          id: studentId,
          tenantId
        }
      })
    ]);

    if (!classSection) {
      throw new NotFoundException(`Class ${classId} was not found for tenant ${tenantId}`);
    }

    if (!student) {
      throw new NotFoundException(`Student ${studentId} was not found for tenant ${tenantId}`);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.classMembership.upsert({
        create: {
          classId,
          studentId
        },
        update: {},
        where: {
          classId_studentId: {
            classId,
            studentId
          }
        }
      });

      await tx.auditEvent.create({
        data: {
          action: "class.add_student",
          newValue: {
            classId,
            studentId
          },
          object: "ClassMembership",
          objectId: `${classId}:${studentId}`,
          outcome: "SUCCESS",
          tenantId
        }
      });

      return tx.classSection.findUniqueOrThrow({
        include: {
          _count: {
            select: {
              members: true
            }
          }
        },
        where: {
          id: classId
        }
      });
    });

    return this.toClassSummary(updated);
  }

  private async ensureTenantExists(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      select: {
        id: true
      },
      where: {
        id: tenantId
      }
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} was not found`);
    }
  }

  private async ensureBranchBelongsToTenant(
    tenantId: string,
    branchId: string | undefined
  ): Promise<void> {
    if (!branchId) {
      return;
    }

    const branch = await this.prisma.branch.findFirst({
      select: {
        id: true
      },
      where: {
        id: branchId,
        tenantId
      }
    });

    if (!branch) {
      throw new NotFoundException(`Branch ${branchId} was not found for tenant ${tenantId}`);
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
      tenantId: student.tenantId
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
      tenantId: classSection.tenantId
    };
  }
}
