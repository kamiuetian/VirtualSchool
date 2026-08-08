import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  AttendanceReport,
  AttendanceSettingsSummary,
  AttendanceStatus,
} from "@virtual-school/shared";
import { Prisma } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import type { UpdateAttendanceSettingsDto } from "./attendance.dto";

@Injectable()
export class AttendanceService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getSettings(tenantId: string): Promise<AttendanceSettingsSummary> {
    await this.ensureTenant(tenantId);
    const value = await this.prisma.attendanceSettings.findUnique({
      where: { tenantId },
    });
    return value
      ? this.settings(value)
      : {
          tenantId,
          sessionSignalEnabled: true,
          deviceSignalEnabled: true,
          lmsSignalEnabled: false,
          teacherSignalEnabled: true,
          presentThreshold: 1,
          updatedAt: null,
        };
  }

  async updateSettings(
    tenantId: string,
    dto: UpdateAttendanceSettingsDto,
    actorId?: string,
  ) {
    await this.ensureTenant(tenantId);
    const oldValue = await this.getSettings(tenantId);
    const value = await this.prisma.attendanceSettings.upsert({
      where: { tenantId },
      create: { tenantId, ...dto, updatedBy: actorId },
      update: { ...dto, updatedBy: actorId },
    });
    await this.audit(
      tenantId,
      actorId,
      "attendance.settings.update",
      value.id,
      oldValue,
      this.settings(value),
      "Attendance signal configuration updated",
    );
    return this.settings(value);
  }

  async capture(
    tenantId: string,
    classId: string,
    date: string,
    actorId?: string,
  ): Promise<AttendanceReport> {
    this.validateDate(date);
    const settings = await this.getSettings(tenantId);
    const classSection = await this.prisma.classSection.findFirst({
      where: { id: classId, tenantId, status: "ACTIVE" },
      include: { members: { include: { student: true } } },
    });
    if (!classSection)
      throw new NotFoundException("Active class was not found for this tenant");
    const start = new Date(`${date}T00:00:00.000Z`);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    const [sessions, devices, signalEvents] = await Promise.all([
      settings.sessionSignalEnabled
        ? this.prisma.teacherSession.findMany({
            where: { tenantId, classId, startedAt: { gte: start, lt: end } },
          })
        : [],
      settings.deviceSignalEnabled
        ? this.prisma.device.findMany({
            where: {
              tenantId,
              classId,
              studentId: { not: null },
              lastCheckInAt: { gte: start, lt: end },
            },
          })
        : [],
      this.prisma.auditEvent.findMany({
        where: {
          tenantId,
          createdAt: { gte: start, lt: end },
          action: {
            in: ["attendance.lms.signal", "attendance.teacher.signal"],
          },
        },
      }),
    ]);
    const deviceStudents = new Set(
      devices.map((item) => item.studentId).filter(Boolean),
    );
    const eventSets = { lms: new Set<string>(), teacher: new Set<string>() };
    for (const event of signalEvents) {
      const value = this.record(event.newValue);
      if (
        value?.classId !== classId ||
        value?.attendanceDate !== date ||
        typeof value.studentId !== "string"
      )
        continue;
      if (event.action === "attendance.lms.signal")
        eventSets.lms.add(value.studentId);
      if (event.action === "attendance.teacher.signal")
        eventSets.teacher.add(value.studentId);
    }
    for (const member of classSection.members) {
      const signals = {
        session: settings.sessionSignalEnabled && sessions.length > 0,
        device:
          settings.deviceSignalEnabled && deviceStudents.has(member.studentId),
        lms: settings.lmsSignalEnabled && eventSets.lms.has(member.studentId),
        teacher:
          settings.teacherSignalEnabled &&
          eventSets.teacher.has(member.studentId),
      };
      const score = Object.values(signals).filter(Boolean).length;
      const derivedStatus: AttendanceStatus =
        score >= settings.presentThreshold ? "PRESENT" : "ABSENT";
      const existing = await this.prisma.attendanceRecord.findUnique({
        where: {
          tenantId_classId_studentId_attendanceDate: {
            tenantId,
            classId,
            studentId: member.studentId,
            attendanceDate: date,
          },
        },
      });
      await this.prisma.attendanceRecord.upsert({
        where: {
          tenantId_classId_studentId_attendanceDate: {
            tenantId,
            classId,
            studentId: member.studentId,
            attendanceDate: date,
          },
        },
        create: {
          tenantId,
          classId,
          studentId: member.studentId,
          attendanceDate: date,
          status: derivedStatus,
          derivedStatus,
          signals,
        },
        update: {
          derivedStatus,
          signals,
          ...(existing?.correctedAt ? {} : { status: derivedStatus }),
        },
      });
    }
    await this.audit(
      tenantId,
      actorId,
      "attendance.capture",
      classId,
      null,
      { attendanceDate: date, students: classSection.members.length },
      "Attendance captured from configured signals",
    );
    return this.report(tenantId, classId, date);
  }

  async correct(
    tenantId: string,
    recordId: string,
    status: string,
    reason: string,
    actorId?: string,
  ) {
    const existing = await this.prisma.attendanceRecord.findFirst({
      where: { id: recordId, tenantId },
    });
    if (!existing)
      throw new NotFoundException("Attendance record was not found");
    const updated = await this.prisma.attendanceRecord.update({
      where: { id: recordId },
      data: {
        status,
        correctionReason: reason,
        correctedBy: actorId,
        correctedAt: new Date(),
      },
    });
    await this.audit(
      tenantId,
      actorId,
      "attendance.correct",
      recordId,
      { status: existing.status },
      { status },
      reason,
    );
    return updated;
  }

  async report(
    tenantId: string,
    classId: string,
    date: string,
  ): Promise<AttendanceReport> {
    this.validateDate(date);
    const rows = await this.prisma.attendanceRecord.findMany({
      where: { tenantId, classId, attendanceDate: date },
      orderBy: { studentId: "asc" },
    });
    const students = await this.prisma.student.findMany({
      where: { tenantId, id: { in: rows.map((row) => row.studentId) } },
      select: { id: true, name: true },
    });
    const names = new Map(
      students.map((student) => [student.id, student.name]),
    );
    const records = rows.map((row) => ({
      id: row.id,
      classId: row.classId,
      studentId: row.studentId,
      studentName: names.get(row.studentId) ?? "Unknown student",
      attendanceDate: row.attendanceDate,
      status: row.status as AttendanceStatus,
      derivedStatus: row.derivedStatus as AttendanceStatus,
      signals: this.booleanRecord(row.signals),
      correctedAt: row.correctedAt?.toISOString() ?? null,
      correctionReason: row.correctionReason,
    }));
    const totals = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };
    for (const row of records) totals[row.status] += 1;
    return { tenantId, classId, attendanceDate: date, records, totals };
  }

  async csv(tenantId: string, classId: string, date: string, actorId?: string) {
    const report = await this.report(tenantId, classId, date);
    await this.audit(
      tenantId,
      actorId,
      "report.export",
      "attendance",
      null,
      { classId, attendanceDate: date, rowCount: report.records.length },
      "Attendance CSV export",
    );
    const rows = [
      [
        "date",
        "class_id",
        "student_id",
        "student_name",
        "status",
        "derived_status",
        "correction_reason",
      ],
      ...report.records.map((row) => [
        date,
        classId,
        row.studentId,
        row.studentName,
        row.status,
        row.derivedStatus,
        row.correctionReason ?? "",
      ]),
    ];
    return rows
      .map((row) =>
        row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
  }

  private settings(value: {
    tenantId: string;
    sessionSignalEnabled: boolean;
    deviceSignalEnabled: boolean;
    lmsSignalEnabled: boolean;
    teacherSignalEnabled: boolean;
    presentThreshold: number;
    updatedAt: Date;
  }): AttendanceSettingsSummary {
    return { ...value, updatedAt: value.updatedAt.toISOString() };
  }
  private validateDate(value: string) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(new Date(`${value}T00:00:00Z`).valueOf())
    )
      throw new BadRequestException("date must be YYYY-MM-DD");
  }
  private async ensureTenant(tenantId: string) {
    if (
      !(await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true },
      }))
    )
      throw new NotFoundException(`Tenant ${tenantId} was not found`);
  }
  private record(value: Prisma.JsonValue): Record<string, unknown> | null {
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }
  private booleanRecord(value: Prisma.JsonValue): Record<string, boolean> {
    const record = this.record(value) ?? {};
    return Object.fromEntries(
      Object.entries(record).map(([key, item]) => [key, item === true]),
    );
  }
  private audit(
    tenantId: string,
    actorId: string | undefined,
    action: string,
    objectId: string,
    oldValue: unknown,
    newValue: unknown,
    reason: string,
  ) {
    return this.prisma.auditEvent.create({
      data: {
        tenantId,
        actorId,
        action,
        object: "Attendance",
        objectId,
        oldValue: oldValue as Prisma.InputJsonValue | undefined,
        newValue: newValue as Prisma.InputJsonValue,
        outcome: "SUCCESS",
        reason,
      },
    });
  }
}
