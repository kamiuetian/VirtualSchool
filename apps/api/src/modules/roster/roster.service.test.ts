import { BadRequestException, ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { RosterService } from "./roster.service";

describe("RosterService", () => {
  it("creates a student with guardians and an audit event", async () => {
    const auditEvents: unknown[] = [];
    const student = {
      _count: { guardians: 1 },
      branchId: "branch-1",
      createdAt: new Date(),
      grade: "5",
      id: "student-1",
      name: "Ayesha Khan",
      section: "A",
      status: "ACTIVE",
      studentCode: "S-001",
      tenantId: "tenant-1",
      updatedAt: new Date(),
    };

    const prisma = {
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          auditEvent: {
            create: async ({ data }: { data: unknown }) => {
              auditEvents.push(data);
              return data;
            },
          },
          guardian: {
            create: async () => ({ id: "guardian-1" }),
          },
          student: {
            create: async () => student,
            findUniqueOrThrow: async () => student,
          },
          studentGuardian: {
            create: async () => ({}),
          },
        }),
      branch: {
        findFirst: async () => ({ id: "branch-1" }),
      },
      student: {
        findUnique: async () => null,
      },
      tenant: {
        findUnique: async () => ({ id: "tenant-1" }),
      },
    } as never;

    const service = new RosterService(prisma);

    await expect(
      service.createStudent("tenant-1", {
        branchId: "branch-1",
        grade: "5",
        guardians: [
          {
            email: "parent@example.com",
            name: "Parent Khan",
            relationship: "mother",
          },
        ],
        name: "Ayesha Khan",
        section: "A",
        status: "ACTIVE",
        studentCode: "S-001",
      }),
    ).resolves.toMatchObject({
      guardianCount: 1,
      id: "student-1",
      studentCode: "S-001",
    });
    expect(auditEvents[0]).toMatchObject({
      action: "student.create",
      object: "Student",
      outcome: "SUCCESS",
      tenantId: "tenant-1",
    });
  });

  it("rejects duplicate student codes within a tenant", async () => {
    const service = new RosterService({
      branch: {
        findFirst: async () => null,
      },
      student: {
        findUnique: async () => ({ id: "existing-student" }),
      },
      tenant: {
        findUnique: async () => ({ id: "tenant-1" }),
      },
    } as never);

    await expect(
      service.createStudent("tenant-1", {
        grade: "5",
        name: "Ayesha Khan",
        studentCode: "S-001",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("adds a student to a class idempotently", async () => {
    const audit = vi.fn();
    const classSection = {
      _count: { members: 1 },
      branchId: null,
      createdAt: new Date(),
      grade: "5",
      id: "class-1",
      name: "Grade 5 A",
      subject: null,
      tenantId: "tenant-1",
      updatedAt: new Date(),
    };
    const service = new RosterService({
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          auditEvent: {
            create: audit,
          },
          classMembership: {
            upsert: async () => ({}),
          },
          classSection: {
            findUniqueOrThrow: async () => classSection,
          },
        }),
      classSection: {
        findFirst: async () => ({ id: "class-1" }),
      },
      student: {
        findFirst: async () => ({ id: "student-1" }),
      },
    } as never);

    await expect(
      service.addStudentToClass("tenant-1", "class-1", "student-1"),
    ).resolves.toMatchObject({
      id: "class-1",
      studentCount: 1,
    });
    expect(audit).toHaveBeenCalledOnce();
  });

  it("previews roster CSV imports with row validation and audit event", async () => {
    const audit = vi.fn();
    const now = new Date("2026-05-17T10:00:00.000Z");
    const service = new RosterService({
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          auditEvent: {
            create: audit,
          },
          rosterImport: {
            create: async ({ data }: { data: Record<string, unknown> }) => ({
              ...data,
              committedAt: null,
              committedBy: null,
              createdAt: now,
              id: "import-1",
              status: "PREVIEWED",
              updatedAt: now,
            }),
          },
        }),
      branch: {
        findMany: async () => [],
      },
      student: {
        findMany: async () => [{ studentCode: "S-002" }],
      },
      tenant: {
        findUnique: async () => ({ id: "tenant-1" }),
      },
    } as never);

    await expect(
      service.previewRosterImport(
        "tenant-1",
        {
          csv: [
            "studentCode,name,grade,status,guardianEmail",
            "S-001,Ayesha Khan,5,ACTIVE,parent@example.com",
            "S-002,Existing Student,5,ACTIVE,parent@example.com",
            "S-003,Bad Email,5,ACTIVE,not-an-email",
          ].join("\n"),
          filename: "students.csv",
        },
        "admin-1",
      ),
    ).resolves.toMatchObject({
      errorRows: 2,
      filename: "students.csv",
      rows: [
        {
          action: "CREATE_STUDENT",
          errors: [],
        },
        {
          action: "REJECT",
          errors: ["studentCode S-002 already exists"],
        },
        {
          action: "REJECT",
          errors: ["guardianEmail not-an-email is invalid"],
        },
      ],
      validRows: 1,
    });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "roster_import.preview",
          actorId: "admin-1",
          outcome: "VALIDATION_ERRORS",
        }),
      }),
    );
  });

  it("commits a valid roster import and creates students, guardians, classes, memberships", async () => {
    const now = new Date("2026-05-17T10:00:00.000Z");
    const audit = vi.fn();
    const rows = [
      {
        action: "CREATE_STUDENT",
        errors: [],
        input: {
          className: "Grade 5 A",
          grade: "5",
          guardianEmail: "parent@example.com",
          guardianName: "Parent Khan",
          guardianRelationship: "mother",
          name: "Ayesha Khan",
          section: "A",
          status: "ACTIVE",
          studentCode: "S-001",
        },
        rowNumber: 2,
      },
    ];
    const service = new RosterService({
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          auditEvent: {
            create: audit,
          },
          classMembership: {
            create: vi.fn(),
          },
          classSection: {
            create: async () => ({ id: "class-1" }),
            findFirst: async () => null,
          },
          guardian: {
            create: async () => ({ id: "guardian-1" }),
          },
          rosterImport: {
            update: async ({ data }: { data: Record<string, unknown> }) => ({
              committedAt: data.committedAt,
              committedBy: data.committedBy,
              createdAt: now,
              createdBy: "admin-1",
              errorReportCsv: "",
              errorRows: 0,
              filename: "students.csv",
              id: "import-1",
              rows,
              status: data.status,
              tenantId: "tenant-1",
              totalRows: 1,
              updatedAt: now,
              validRows: 1,
            }),
          },
          student: {
            create: async () => ({ id: "student-1" }),
          },
          studentGuardian: {
            create: vi.fn(),
          },
        }),
      rosterImport: {
        findFirst: async () => ({
          committedAt: null,
          committedBy: null,
          createdAt: now,
          createdBy: "admin-1",
          errorReportCsv: "",
          errorRows: 0,
          filename: "students.csv",
          id: "import-1",
          rows,
          status: "PREVIEWED",
          tenantId: "tenant-1",
          totalRows: 1,
          updatedAt: now,
          validRows: 1,
        }),
      },
    } as never);

    await expect(
      service.commitRosterImport("tenant-1", "import-1", "admin-2"),
    ).resolves.toMatchObject({
      createdClasses: 1,
      createdGuardians: 1,
      createdMemberships: 1,
      createdStudents: 1,
      import: {
        status: "COMMITTED",
      },
    });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "roster_import.commit",
          actorId: "admin-2",
          outcome: "SUCCESS",
        }),
      }),
    );
  });

  it("rejects committing imports with validation errors", async () => {
    const now = new Date("2026-05-17T10:00:00.000Z");
    const service = new RosterService({
      rosterImport: {
        findFirst: async () => ({
          committedAt: null,
          committedBy: null,
          createdAt: now,
          createdBy: "admin-1",
          errorReportCsv: "",
          errorRows: 1,
          filename: "students.csv",
          id: "import-1",
          rows: [],
          status: "PREVIEWED",
          tenantId: "tenant-1",
          totalRows: 1,
          updatedAt: now,
          validRows: 0,
        }),
      },
    } as never);

    await expect(
      service.commitRosterImport("tenant-1", "import-1", "admin-2"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
