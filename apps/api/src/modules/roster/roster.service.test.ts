import { ConflictException } from "@nestjs/common";
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
      updatedAt: new Date()
    };

    const prisma = {
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          auditEvent: {
            create: async ({ data }: { data: unknown }) => {
              auditEvents.push(data);
              return data;
            }
          },
          guardian: {
            create: async () => ({ id: "guardian-1" })
          },
          student: {
            create: async () => student,
            findUniqueOrThrow: async () => student
          },
          studentGuardian: {
            create: async () => ({})
          }
        }),
      branch: {
        findFirst: async () => ({ id: "branch-1" })
      },
      student: {
        findUnique: async () => null
      },
      tenant: {
        findUnique: async () => ({ id: "tenant-1" })
      }
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
            relationship: "mother"
          }
        ],
        name: "Ayesha Khan",
        section: "A",
        status: "ACTIVE",
        studentCode: "S-001"
      })
    ).resolves.toMatchObject({
      guardianCount: 1,
      id: "student-1",
      studentCode: "S-001"
    });
    expect(auditEvents[0]).toMatchObject({
      action: "student.create",
      object: "Student",
      outcome: "SUCCESS",
      tenantId: "tenant-1"
    });
  });

  it("rejects duplicate student codes within a tenant", async () => {
    const service = new RosterService({
      branch: {
        findFirst: async () => null
      },
      student: {
        findUnique: async () => ({ id: "existing-student" })
      },
      tenant: {
        findUnique: async () => ({ id: "tenant-1" })
      }
    } as never);

    await expect(
      service.createStudent("tenant-1", {
        grade: "5",
        name: "Ayesha Khan",
        studentCode: "S-001"
      })
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
      updatedAt: new Date()
    };
    const service = new RosterService({
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          auditEvent: {
            create: audit
          },
          classMembership: {
            upsert: async () => ({})
          },
          classSection: {
            findUniqueOrThrow: async () => classSection
          }
        }),
      classSection: {
        findFirst: async () => ({ id: "class-1" })
      },
      student: {
        findFirst: async () => ({ id: "student-1" })
      }
    } as never);

    await expect(service.addStudentToClass("tenant-1", "class-1", "student-1")).resolves.toMatchObject({
      id: "class-1",
      studentCount: 1
    });
    expect(audit).toHaveBeenCalledOnce();
  });
});
