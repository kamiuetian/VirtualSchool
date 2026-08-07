import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { TeacherDashboard, TeacherSessionEventSummary, TeacherSessionSummary } from "@virtual-school/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { RecordTeacherDeviceEventDto } from "./dto/teacher-session.dto";

const sessionInclude = { class: true, events: { orderBy: { createdAt: "asc" as const } } };

@Injectable()
export class TeacherSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async dashboard(tenantId: string, subject: string, email?: string): Promise<TeacherDashboard> {
    const teacher = await this.teacher(tenantId, subject, email);
    const assignments = await this.prisma.teacherClassAssignment.findMany({
      include: { class: { include: { devices: { orderBy: { serialNumber: "asc" } } } } },
      orderBy: { class: { name: "asc" } },
      where: { tenantId, teacherId: teacher.id, class: { status: "ACTIVE" } },
    });
    const sessions = await this.prisma.teacherSession.findMany({
      include: sessionInclude,
      orderBy: { startedAt: "desc" },
      take: 10,
      where: { tenantId, teacherId: teacher.id },
    });
    const devices = assignments.flatMap((item) => item.class.devices);
    return {
      activeSession: sessions.find((item) => item.status === "ACTIVE") ? this.summary(sessions.find((item) => item.status === "ACTIVE")!) : null,
      classes: assignments.map(({ class: item }) => ({ id: item.id, name: item.name, grade: item.grade, subject: item.subject, deviceCount: item.devices.length })),
      devices: [...new Map(devices.map((item) => [item.id, item])).values()].map((item) => ({ id: item.id, serialNumber: item.serialNumber, classId: item.classId, status: item.status, compliance: item.compliance, lastCheckInAt: item.lastCheckInAt?.toISOString() ?? null })),
      recentSessions: sessions.map((item) => this.summary(item)),
    };
  }

  async assignTeacher(tenantId: string, classId: string, teacherId: string, actorId: string) {
    const [classSection, teacher] = await Promise.all([
      this.prisma.classSection.findFirst({ where: { id: classId, tenantId, status: "ACTIVE" } }),
      this.prisma.user.findFirst({ where: { id: teacherId, tenantId, role: "TEACHER", status: { in: ["ACTIVE", "INVITED"] } } }),
    ]);
    if (!classSection) throw new NotFoundException("Class was not found in this tenant");
    if (!teacher) throw new NotFoundException("Active teacher was not found in this tenant");
    return this.prisma.$transaction(async (tx) => {
      const assignment = await tx.teacherClassAssignment.upsert({ create: { tenantId, classId, teacherId, assignedBy: actorId }, update: { assignedBy: actorId }, where: { teacherId_classId: { teacherId, classId } } });
      await tx.auditEvent.create({ data: { action: "teacher.class.assign", actorId, object: "TeacherClassAssignment", objectId: `${teacherId}:${classId}`, outcome: "SUCCESS", tenantId, newValue: { teacherId, classId } } });
      return assignment;
    });
  }

  async start(tenantId: string, classId: string, subject: string, email?: string): Promise<TeacherSessionSummary> {
    const teacher = await this.teacher(tenantId, subject, email);
    const assignment = await this.prisma.teacherClassAssignment.findUnique({ where: { teacherId_classId: { teacherId: teacher.id, classId } }, include: { class: true } });
    if (!assignment || assignment.tenantId !== tenantId || assignment.class.status !== "ACTIVE") throw new ForbiddenException("Teacher is not assigned to this active class");
    const active = await this.prisma.teacherSession.findFirst({ where: { tenantId, status: "ACTIVE", OR: [{ teacherId: teacher.id }, { classId }] } });
    if (active) throw new ConflictException("The teacher or class already has an active session");
    const created = await this.prisma.$transaction(async (tx) => {
      const session = await tx.teacherSession.create({ data: { tenantId, classId, teacherId: teacher.id } });
      await tx.teacherSessionEvent.create({ data: { tenantId, sessionId: session.id, type: "SESSION_STARTED", details: { classId } } });
      await tx.auditEvent.create({ data: { action: "teacher_session.start", actorId: teacher.id, object: "TeacherSession", objectId: session.id, outcome: "SUCCESS", tenantId, newValue: { classId, status: "ACTIVE" } } });
      return tx.teacherSession.findUniqueOrThrow({ include: sessionInclude, where: { id: session.id } });
    });
    return this.summary(created);
  }

  async end(tenantId: string, sessionId: string, reason: string, subject: string, email?: string): Promise<TeacherSessionSummary> {
    const teacher = await this.teacher(tenantId, subject, email);
    const session = await this.ownedActiveSession(tenantId, sessionId, teacher.id);
    const ended = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.teacherSession.update({ data: { status: "ENDED", endedAt: new Date(), reason }, where: { id: session.id } });
      await tx.teacherSessionEvent.create({ data: { tenantId, sessionId, type: "SESSION_ENDED", details: { reason } } });
      await tx.auditEvent.create({ data: { action: "teacher_session.end", actorId: teacher.id, object: "TeacherSession", objectId: sessionId, outcome: "SUCCESS", reason, tenantId, oldValue: { status: "ACTIVE" }, newValue: { status: "ENDED" } } });
      return tx.teacherSession.findUniqueOrThrow({ include: sessionInclude, where: { id: updated.id } });
    });
    return this.summary(ended);
  }

  async recordDeviceEvent(tenantId: string, sessionId: string, input: RecordTeacherDeviceEventDto, subject: string, email?: string): Promise<TeacherSessionEventSummary> {
    const teacher = await this.teacher(tenantId, subject, email);
    const session = await this.ownedActiveSession(tenantId, sessionId, teacher.id);
    const device = await this.prisma.device.findFirst({ where: { id: input.deviceId, tenantId, classId: session.classId } });
    if (!device) throw new ForbiddenException("Device is not assigned to the active class");
    const event = await this.prisma.teacherSessionEvent.create({ data: { tenantId, sessionId, deviceId: device.id, type: input.type, details: { status: device.status, compliance: device.compliance, lastCheckInAt: device.lastCheckInAt?.toISOString() ?? null } } });
    return this.eventSummary(event);
  }

  private async teacher(tenantId: string, subject: string, email?: string) {
    const teacher = await this.prisma.user.findFirst({ where: { tenantId, role: "TEACHER", status: { in: ["ACTIVE", "INVITED"] }, OR: [{ auth0Subject: subject }, { email: email ?? subject }] } });
    if (!teacher) throw new ForbiddenException("Authenticated teacher profile was not found in this tenant");
    return teacher;
  }

  private async ownedActiveSession(tenantId: string, id: string, teacherId: string) {
    const session = await this.prisma.teacherSession.findFirst({ where: { id, tenantId, teacherId } });
    if (!session) throw new NotFoundException("Teacher session was not found");
    if (session.status !== "ACTIVE") throw new BadRequestException("Teacher session has already ended");
    return session;
  }

  private summary(session: any): TeacherSessionSummary {
    return { id: session.id, classId: session.classId, className: session.class.name, teacherId: session.teacherId, status: session.status, startedAt: session.startedAt.toISOString(), endedAt: session.endedAt?.toISOString() ?? null, reason: session.reason, events: session.events.map((item: any) => this.eventSummary(item)) };
  }

  private eventSummary(event: any): TeacherSessionEventSummary {
    return { id: event.id, type: event.type, deviceId: event.deviceId, details: event.details as Record<string, unknown> | null, createdAt: event.createdAt.toISOString() };
  }
}
