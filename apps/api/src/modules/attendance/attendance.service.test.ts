import { describe, expect, it, vi } from "vitest";
import { AttendanceService } from "./attendance.service";

const now = new Date("2026-08-08T10:00:00.000Z");

describe("AttendanceService", () => {
  it("derives attendance only from enabled signals and preserves corrections", async () => {
    const upsert = vi.fn(async ({ create, update }) => ({
      id: "record-1",
      ...create,
      ...update,
    }));
    const service = new AttendanceService({
      tenant: { findUnique: async () => ({ id: "tenant-1" }) },
      attendanceSettings: {
        findUnique: async () => ({
          tenantId: "tenant-1",
          sessionSignalEnabled: false,
          deviceSignalEnabled: true,
          lmsSignalEnabled: true,
          teacherSignalEnabled: false,
          presentThreshold: 2,
          updatedAt: now,
        }),
      },
      classSection: {
        findFirst: async () => ({
          members: [{ studentId: "student-1", student: { name: "A" } }],
        }),
      },
      teacherSession: { findMany: async () => [] },
      device: { findMany: async () => [{ studentId: "student-1" }] },
      auditEvent: {
        findMany: async () => [
          {
            action: "attendance.lms.signal",
            newValue: {
              classId: "class-1",
              studentId: "student-1",
              attendanceDate: "2026-08-08",
            },
          },
        ],
        create: async () => ({}),
      },
      attendanceRecord: {
        findUnique: async () => ({ correctedAt: now }),
        upsert,
        findMany: async () => [
          {
            id: "record-1",
            tenantId: "tenant-1",
            classId: "class-1",
            studentId: "student-1",
            attendanceDate: "2026-08-08",
            status: "EXCUSED",
            derivedStatus: "PRESENT",
            signals: { device: true, lms: true },
            correctedAt: now,
            correctionReason: "Medical",
          },
        ],
      },
      student: { findMany: async () => [{ id: "student-1", name: "A" }] },
    } as never);

    const result = await service.capture(
      "tenant-1",
      "class-1",
      "2026-08-08",
      "admin-1",
    );
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.not.objectContaining({ status: expect.anything() }),
      }),
    );
    expect(result.records[0]).toMatchObject({
      status: "EXCUSED",
      derivedStatus: "PRESENT",
    });
  });

  it("rejects cross-tenant corrections and audits authorized corrections", async () => {
    const audit = vi.fn(async () => ({}));
    const service = new AttendanceService({
      attendanceRecord: {
        findFirst: async ({ where }: { where: { tenantId: string } }) =>
          where.tenantId === "tenant-1"
            ? { id: "record-1", status: "ABSENT" }
            : null,
        update: async () => ({ id: "record-1", status: "PRESENT" }),
      },
      auditEvent: { create: audit },
    } as never);
    await expect(
      service.correct(
        "tenant-2",
        "record-1",
        "PRESENT",
        "Teacher verified",
        "admin-1",
      ),
    ).rejects.toThrow("not found");
    await expect(
      service.correct(
        "tenant-1",
        "record-1",
        "PRESENT",
        "Teacher verified",
        "admin-1",
      ),
    ).resolves.toMatchObject({ status: "PRESENT" });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "attendance.correct",
          tenantId: "tenant-1",
          reason: "Teacher verified",
        }),
      }),
    );
  });

  it("exports only tenant/class/date-scoped records and audits the export", async () => {
    const audit = vi.fn(async () => ({}));
    const service = new AttendanceService({
      attendanceRecord: {
        findMany: vi.fn(async () => [
          {
            id: "r1",
            classId: "class-1",
            studentId: "student-1",
            attendanceDate: "2026-08-08",
            status: "PRESENT",
            derivedStatus: "PRESENT",
            signals: {},
            correctedAt: null,
            correctionReason: null,
          },
        ]),
      },
      student: {
        findMany: async () => [{ id: "student-1", name: "Student One" }],
      },
      auditEvent: { create: audit },
    } as never);
    await expect(
      service.csv("tenant-1", "class-1", "2026-08-08", "auditor-1"),
    ).resolves.toContain('"Student One","PRESENT"');
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "report.export",
          tenantId: "tenant-1",
        }),
      }),
    );
  });
});
