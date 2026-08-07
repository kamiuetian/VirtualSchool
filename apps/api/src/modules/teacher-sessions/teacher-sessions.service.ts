import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { LearningMode, PolicyRuleSet, TeacherDashboard, TeacherSessionEventSummary, TeacherSessionSummary, TeacherSessionTemplateSummary } from "@virtual-school/shared";
import { Prisma } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { evaluateUrlPolicy } from "../policies/url-policy-evaluator";
import type { CreateTeacherSessionTemplateDto, RecordTeacherDeviceEventDto } from "./dto/teacher-session.dto";

const sessionInclude = { class: true, events: { orderBy: { createdAt: "asc" as const } } };
const modePrecedence: Record<LearningMode, number> = { LOST_DEVICE: 100, EXAM: 90, EMERGENCY_SUPPORT_OVERRIDE: 80, TIMETABLE_CLASS: 70, HOMEWORK_AFTER_SCHOOL: 60, DEVICE_BASELINE: 50, DEFAULT_SCHOOL: 10 };

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
    const grades = [...new Set(assignments.map((item) => item.class.grade))];
    const resources = await this.prisma.appCatalogItem.findMany({
      orderBy: { name: "asc" },
      where: { tenantId, approvalStatus: "APPROVED", OR: [{ approvedGrades: { isEmpty: true } }, { approvedGrades: { hasSome: grades } }] },
    });
    const templates = await this.prisma.teacherSessionTemplate.findMany({
      include: { class: true }, orderBy: { name: "asc" }, where: { tenantId, teacherId: teacher.id },
    });
    return {
      activeSession: sessions.find((item) => item.status === "ACTIVE") ? this.summary(sessions.find((item) => item.status === "ACTIVE")!) : null,
      classes: assignments.map(({ class: item }) => ({ id: item.id, name: item.name, grade: item.grade, subject: item.subject, deviceCount: item.devices.length })),
      devices: [...new Map(devices.map((item) => [item.id, item])).values()].map((item) => ({ id: item.id, serialNumber: item.serialNumber, classId: item.classId, status: item.status, compliance: item.compliance, lastCheckInAt: item.lastCheckInAt?.toISOString() ?? null })),
      recentSessions: sessions.map((item) => this.summary(item)),
      approvedResources: resources.map((item) => ({ id: item.id, name: item.name, packageId: item.packageId, category: item.category })),
      templates: templates.map((item) => this.templateSummary(item)),
    };
  }

  async createTemplate(tenantId: string, input: CreateTeacherSessionTemplateDto, subject: string, email?: string): Promise<TeacherSessionTemplateSummary> {
    const teacher = await this.teacher(tenantId, subject, email);
    await this.validateTemplate(tenantId, teacher.id, input);
    const created = await this.prisma.$transaction(async (tx) => {
      const template = await tx.teacherSessionTemplate.create({ data: { tenantId, teacherId: teacher.id, classId: input.classId, name: input.name.trim(), resourceId: input.resourceId, focusMessage: input.focusMessage?.trim(), focusDurationMinutes: input.focusDurationMinutes, temporaryUrl: input.temporaryUrl, temporaryUrlMinutes: input.temporaryUrlMinutes }, include: { class: true } });
      await tx.auditEvent.create({ data: { action: "teacher_session_template.create", actorId: teacher.id, object: "TeacherSessionTemplate", objectId: template.id, outcome: "SUCCESS", tenantId, newValue: { classId: template.classId, name: template.name, resourceId: template.resourceId, hasFocusScreen: Boolean(template.focusMessage), hasTemporaryUrl: Boolean(template.temporaryUrl) } } });
      return template;
    });
    return this.templateSummary(created);
  }

  async startFromTemplate(tenantId: string, templateId: string, subject: string, email?: string): Promise<TeacherSessionSummary> {
    const teacher = await this.teacher(tenantId, subject, email);
    const template = await this.prisma.teacherSessionTemplate.findFirst({ where: { id: templateId, tenantId, teacherId: teacher.id } });
    if (!template) throw new NotFoundException("Teacher session template was not found");
    await this.validateTemplate(tenantId, teacher.id, template);
    const session = await this.start(tenantId, template.classId, subject, email);
    if (template.resourceId) await this.pushResource(tenantId, session.id, template.resourceId, subject, email);
    if (template.focusMessage && template.focusDurationMinutes) await this.showFocusScreen(tenantId, session.id, template.focusMessage, template.focusDurationMinutes, subject, email);
    if (template.temporaryUrl && template.temporaryUrlMinutes) await this.approveTemporaryUrl(tenantId, session.id, template.temporaryUrl, template.temporaryUrlMinutes, subject, email);
    await this.prisma.auditEvent.create({ data: { action: "teacher_session_template.reuse", actorId: teacher.id, object: "TeacherSessionTemplate", objectId: template.id, outcome: "SUCCESS", tenantId, newValue: { sessionId: session.id, classId: template.classId } } });
    return session;
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

  async pushResource(tenantId: string, sessionId: string, resourceId: string, subject: string, email?: string): Promise<TeacherSessionEventSummary> {
    const teacher = await this.teacher(tenantId, subject, email);
    const session = await this.ownedActiveSession(tenantId, sessionId, teacher.id);
    const classSection = await this.prisma.classSection.findFirst({ where: { id: session.classId, tenantId } });
    const resource = await this.prisma.appCatalogItem.findFirst({ where: { id: resourceId, tenantId, approvalStatus: "APPROVED" } });
    if (!classSection || !resource || (resource.approvedGrades.length > 0 && !resource.approvedGrades.includes(classSection.grade))) {
      throw new ForbiddenException("Resource is not approved for this class");
    }
    return this.dispatchSessionAction(tenantId, session, teacher.id, "RESOURCE_PUSHED", { resourceId, name: resource.name, packageId: resource.packageId }, { kind: "TEACHER_RESOURCE", resourceId, name: resource.name, packageId: resource.packageId }, 60);
  }

  async showFocusScreen(tenantId: string, sessionId: string, message: string, durationMinutes: number, subject: string, email?: string): Promise<TeacherSessionEventSummary> {
    const teacher = await this.teacher(tenantId, subject, email);
    const session = await this.ownedActiveSession(tenantId, sessionId, teacher.id);
    const expiresAt = new Date(Date.now() + durationMinutes * 60_000);
    return this.dispatchSessionAction(tenantId, session, teacher.id, "FOCUS_SCREEN_SHOWN", { message, durationMinutes, expiresAt: expiresAt.toISOString() }, { kind: "TEACHER_FOCUS_SCREEN", message, expiresAt: expiresAt.toISOString() }, durationMinutes);
  }

  async approveTemporaryUrl(tenantId: string, sessionId: string, url: string, durationMinutes: number, subject: string, email?: string): Promise<TeacherSessionEventSummary> {
    const teacher = await this.teacher(tenantId, subject, email);
    const session = await this.ownedActiveSession(tenantId, sessionId, teacher.id);
    const rules = await this.activeClassPolicyRules(tenantId, session.classId);
    let evaluation;
    try { evaluation = evaluateUrlPolicy(url, rules); } catch { throw new BadRequestException("A valid HTTP(S) URL without credentials is required"); }
    if (evaluation.decision === "BLOCKED") throw new ForbiddenException("Temporary approval cannot bypass a blocked URL rule");
    const expiresAt = new Date(Date.now() + durationMinutes * 60_000);
    return this.dispatchSessionAction(tenantId, session, teacher.id, "TEMPORARY_URL_APPROVED", { url, durationMinutes, expiresAt: expiresAt.toISOString(), policyDecision: evaluation.decision }, { kind: "TEACHER_TEMPORARY_URL", url, expiresAt: expiresAt.toISOString() }, durationMinutes);
  }

  private async activeClassPolicyRules(tenantId: string, classId: string): Promise<PolicyRuleSet> {
    const now = new Date();
    const assignments = await this.prisma.policyAssignment.findMany({
      include: { policy: true },
      where: { tenantId, active: true, OR: [{ scope: "TENANT", scopeId: null }, { scope: "CLASS", scopeId: classId }], policy: { status: "PUBLISHED" }, AND: [{ OR: [{ startsAt: null }, { startsAt: { lte: now } }] }, { OR: [{ endsAt: null }, { endsAt: { gt: now } }] }] },
    });
    const selected = assignments.sort((left, right) => {
      const leftRules = left.policy.rules as PolicyRuleSet;
      const rightRules = right.policy.rules as PolicyRuleSet;
      return modePrecedence[rightRules.mode] - modePrecedence[leftRules.mode] || right.policy.version - left.policy.version;
    })[0];
    if (!selected) throw new NotFoundException("No active published policy applies to this class");
    return selected.policy.rules as PolicyRuleSet;
  }

  private async validateTemplate(tenantId: string, teacherId: string, input: { classId: string; resourceId?: string | null; focusMessage?: string | null; focusDurationMinutes?: number | null; temporaryUrl?: string | null; temporaryUrlMinutes?: number | null }) {
    const assignment = await this.prisma.teacherClassAssignment.findUnique({ where: { teacherId_classId: { teacherId, classId: input.classId } }, include: { class: true } });
    if (!assignment || assignment.tenantId !== tenantId || assignment.class.status !== "ACTIVE") throw new ForbiddenException("Template class must be an assigned active class");
    if (!input.resourceId && !input.focusMessage && !input.temporaryUrl) throw new BadRequestException("Template must include at least one lesson action");
    if (Boolean(input.focusMessage) !== Boolean(input.focusDurationMinutes)) throw new BadRequestException("Focus message and duration must be provided together");
    if (Boolean(input.temporaryUrl) !== Boolean(input.temporaryUrlMinutes)) throw new BadRequestException("Temporary URL and duration must be provided together");
    if (input.resourceId) {
      const resource = await this.prisma.appCatalogItem.findFirst({ where: { id: input.resourceId, tenantId, approvalStatus: "APPROVED" } });
      if (!resource || (resource.approvedGrades.length > 0 && !resource.approvedGrades.includes(assignment.class.grade))) throw new ForbiddenException("Template resource is not approved for this class");
    }
    if (input.temporaryUrl) {
      let evaluation;
      try { evaluation = evaluateUrlPolicy(input.temporaryUrl, await this.activeClassPolicyRules(tenantId, input.classId)); } catch (error) { if (error instanceof NotFoundException) throw error; throw new BadRequestException("A valid HTTP(S) template URL is required"); }
      if (evaluation.decision === "BLOCKED") throw new ForbiddenException("Template URL cannot bypass a blocked URL rule");
    }
  }

  private async dispatchSessionAction(tenantId: string, session: { id: string; classId: string }, actorId: string, type: string, details: Record<string, unknown>, payload: Record<string, unknown>, ttlMinutes: number): Promise<TeacherSessionEventSummary> {
    const devices = await this.prisma.device.findMany({ select: { id: true }, where: { tenantId, classId: session.classId, status: { not: "RETIRED" } } });
    const event = await this.prisma.$transaction(async (tx) => {
      const created = await tx.teacherSessionEvent.create({ data: { tenantId, sessionId: session.id, type, details: { ...details, targetedDevices: devices.length } } });
      const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
      if (devices.length > 0) await tx.remoteCommand.createMany({ data: devices.map((device) => ({ tenantId, deviceId: device.id, type: "SEND_MESSAGE", status: "QUEUED", requestedBy: actorId, reason: `Teacher session ${type.toLowerCase()}`, payload: payload as Prisma.InputJsonValue, expiresAt })) });
      await tx.auditEvent.create({ data: { action: `teacher_session.${type.toLowerCase()}`, actorId, object: "TeacherSession", objectId: session.id, outcome: "SUCCESS", tenantId, newValue: { ...details, targetedDevices: devices.length } } });
      return created;
    });
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

  private templateSummary(template: any): TeacherSessionTemplateSummary {
    return { id: template.id, classId: template.classId, className: template.class.name, name: template.name, resourceId: template.resourceId, focusMessage: template.focusMessage, focusDurationMinutes: template.focusDurationMinutes, temporaryUrl: template.temporaryUrl, temporaryUrlMinutes: template.temporaryUrlMinutes, createdAt: template.createdAt.toISOString(), updatedAt: template.updatedAt.toISOString() };
  }
}
