import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  ByodEligibility,
  ByodJoinSummary,
  ByodParticipationReport,
  ByodReadinessSummary,
  ByodStudySessionSummary,
  Role,
} from "@virtual-school/shared";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CheckByodReadinessDto,
  CreateByodStudySessionDto,
} from "./dto/byod.dto";

const BYOD_NOTICE = "BYOD_STUDY_SESSION";
const LIMITATION_NOTICE =
  "This secure-browser session controls only access inside this study session. The school does not control, monitor, or manage the rest of your personal device.";

@Injectable()
export class ByodService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(
    tenantId: string,
    input: CreateByodStudySessionDto,
    actorSubject: string,
    actorEmail?: string,
  ): Promise<ByodStudySessionSummary> {
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (
      endsAt.getTime() - startsAt.getTime() < 60_000 ||
      endsAt.getTime() - startsAt.getTime() > 8 * 60 * 60 * 1000
    )
      throw new BadRequestException(
        "BYOD sessions must last between 1 minute and 8 hours",
      );
    const teacher = await this.prisma.user.findFirst({
      where: {
        tenantId,
        status: "ACTIVE",
        OR: [
          { auth0Subject: actorSubject },
          ...(actorEmail ? [{ email: actorEmail }] : []),
        ],
      },
    });
    if (!teacher)
      throw new ForbiddenException("An active tenant teacher is required");
    const assignment = await this.prisma.teacherClassAssignment.findUnique({
      where: {
        teacherId_classId: { teacherId: teacher.id, classId: input.classId },
      },
      include: { class: true },
    });
    if (
      !assignment ||
      assignment.tenantId !== tenantId ||
      assignment.class.status !== "ACTIVE"
    )
      throw new ForbiddenException("The class is not assigned to this teacher");
    const eligibilityScope = input.eligibilityScope ?? "CLASS";
    if (eligibilityScope === "EXAM" && !input.examAssignmentId)
      throw new BadRequestException(
        "Exam eligibility requires an exam assignment",
      );
    const eligibility: ByodEligibility = {
      scope: eligibilityScope,
      ...(input.examAssignmentId
        ? { examAssignmentId: input.examAssignmentId }
        : {}),
      allowedPlatforms: [
        ...new Set(
          (
            input.allowedPlatforms ?? [
              "ANDROID",
              "CHROMEOS",
              "IOS",
              "MACOS",
              "WINDOWS",
            ]
          ).map((value) => value.toUpperCase()),
        ),
      ],
      allowedBrowsers: [
        ...new Set(
          (input.allowedBrowsers ?? ["CHROME", "EDGE", "SAFARI"]).map((value) =>
            value.toUpperCase(),
          ),
        ),
      ],
      minimumBrowserMajorVersion: input.minimumBrowserMajorVersion ?? 100,
    };
    const session = await this.prisma.$transaction(async (tx) => {
      const created = await tx.byodStudySession.create({
        data: {
          tenantId,
          classId: input.classId,
          title: input.title,
          startsAt,
          endsAt,
          allowedUrls: [...new Set(input.allowedUrls)],
          eligibility,
          createdBy: teacher.id,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: actorSubject,
          action: "byod_session.create",
          object: "ByodStudySession",
          objectId: created.id,
          outcome: "CREATED",
          newValue: {
            classId: input.classId,
            startsAt,
            endsAt,
            controlScope: "SESSION_ONLY",
            wholeDeviceControl: false,
            eligibilityScope: eligibility.scope,
          },
        },
      });
      return created;
    });
    return this.summary(session);
  }

  async join(
    tenantId: string,
    sessionId: string,
    subject: string,
    role: Role,
    checks: CheckByodReadinessDto,
  ): Promise<ByodJoinSummary> {
    if (role !== "STUDENT")
      throw new ForbiddenException(
        "Only an authenticated student can join a BYOD session",
      );
    const now = new Date();
    const student = await this.prisma.student.findFirst({
      where: { tenantId, auth0Subject: subject, status: "ACTIVE" },
    });
    if (!student)
      throw new ForbiddenException(
        "The login is not linked to an active student",
      );
    const session = await this.prisma.byodStudySession.findFirst({
      where: { id: sessionId, tenantId },
      include: {
        class: { include: { members: { where: { studentId: student.id } } } },
      },
    });
    if (!session)
      throw new NotFoundException("BYOD session was not found for this tenant");
    if (
      session.status !== "ACTIVE" ||
      now < session.startsAt ||
      now >= session.endsAt
    )
      throw new BadRequestException("BYOD session is not currently open");
    if (!session.class.members.length)
      throw new ForbiddenException(
        "Student is not enrolled in this session class",
      );
    const readiness = await this.evaluateReadiness(
      tenantId,
      session,
      student.id,
      checks,
      now,
    );
    if (!readiness.eligible || !readiness.ready)
      throw new ForbiddenException(
        `BYOD readiness failed: ${readiness.issues.join(", ")}`,
      );
    const notice = await this.prisma.privacyNotice.findFirst({
      where: { tenantId, noticeType: BYOD_NOTICE, channel: "WEB" },
      orderBy: { version: "desc" },
    });
    if (!notice)
      throw new BadRequestException(
        "A BYOD consent notice must be published before students can join",
      );
    const acceptance = await this.prisma.privacyAcceptance.findFirst({
      where: {
        tenantId,
        noticeId: notice.id,
        subjectType: "STUDENT",
        subjectId: subject,
        channel: "WEB",
        revokedAt: null,
      },
    });
    if (!acceptance)
      throw new ForbiddenException(
        "Accept the latest BYOD study-session consent notice before joining",
      );
    const participant = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.byodSessionParticipant.upsert({
        where: { sessionId_studentId: { sessionId, studentId: student.id } },
        create: {
          tenantId,
          sessionId,
          studentId: student.id,
          authSubject: subject,
          consentNoticeId: notice.id,
          consentVersion: notice.version,
          consentAcceptedAt: acceptance.acceptedAt,
        },
        update: {
          authSubject: subject,
          consentNoticeId: notice.id,
          consentVersion: notice.version,
          consentAcceptedAt: acceptance.acceptedAt,
          joinedAt: now,
          exitedAt: null,
          exitStatus: null,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: subject,
          action: "byod_session.join",
          object: "ByodSessionParticipant",
          objectId: saved.id,
          outcome: "JOINED",
          newValue: {
            sessionId,
            studentId: student.id,
            consentNoticeId: notice.id,
            consentVersion: notice.version,
            controlScope: "SESSION_ONLY",
            wholeDeviceControl: false,
          },
        },
      });
      return saved;
    });
    return {
      participantId: participant.id,
      session: this.summary(session),
      joinedAt: participant.joinedAt.toISOString(),
      consent: {
        noticeId: notice.id,
        version: notice.version,
        acceptedAt: acceptance.acceptedAt.toISOString(),
      },
      secureBrowser: {
        scope: "SESSION_ONLY",
        allowedUrls: session.allowedUrls,
        expiresAt: session.endsAt.toISOString(),
        wholeDeviceControl: false,
        notice: LIMITATION_NOTICE,
      },
    };
  }

  async readiness(
    tenantId: string,
    sessionId: string,
    subject: string,
    role: Role,
    checks: CheckByodReadinessDto,
  ): Promise<ByodReadinessSummary> {
    if (role !== "STUDENT")
      throw new ForbiddenException(
        "Only an authenticated student can run BYOD readiness",
      );
    const student = await this.prisma.student.findFirst({
      where: { tenantId, auth0Subject: subject, status: "ACTIVE" },
    });
    if (!student)
      throw new ForbiddenException(
        "The login is not linked to an active student",
      );
    const session = await this.prisma.byodStudySession.findFirst({
      where: { id: sessionId, tenantId },
      include: {
        class: { include: { members: { where: { studentId: student.id } } } },
      },
    });
    if (!session)
      throw new NotFoundException("BYOD session was not found for this tenant");
    return this.evaluateReadiness(
      tenantId,
      session,
      student.id,
      checks,
      new Date(),
    );
  }

  async participationReport(
    tenantId: string,
    sessionId: string,
  ): Promise<ByodParticipationReport> {
    const session = await this.prisma.byodStudySession.findFirst({
      where: { id: sessionId, tenantId },
      include: { participants: { orderBy: { joinedAt: "asc" } } },
    });
    if (!session)
      throw new NotFoundException("BYOD session was not found for this tenant");
    const generatedAt = new Date();
    return {
      sessionId,
      generatedAt: generatedAt.toISOString(),
      participants: session.participants.map((participant: any) => {
        const effectiveExit =
          participant.exitedAt ??
          (generatedAt < session.endsAt ? generatedAt : session.endsAt);
        return {
          joinedAt: participant.joinedAt.toISOString(),
          durationSeconds: Math.max(
            0,
            Math.floor(
              (effectiveExit.getTime() - participant.joinedAt.getTime()) / 1000,
            ),
          ),
          approvedAccess: session.allowedUrls,
          exitStatus:
            participant.exitStatus ??
            (generatedAt >= session.endsAt ? "SESSION_ENDED" : "ACTIVE"),
        };
      }),
    };
  }

  async exit(
    tenantId: string,
    sessionId: string,
    status: string,
    subject: string,
    role: Role,
  ) {
    if (role !== "STUDENT")
      throw new ForbiddenException(
        "Only the joined student can exit a BYOD session",
      );
    const participant = await this.prisma.byodSessionParticipant.findFirst({
      where: { tenantId, sessionId, authSubject: subject, exitedAt: null },
    });
    if (!participant)
      throw new NotFoundException("An active BYOD participation was not found");
    return this.prisma.$transaction(async (tx) => {
      const saved = await tx.byodSessionParticipant.update({
        where: { id: participant.id },
        data: { exitedAt: new Date(), exitStatus: status },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: subject,
          action: "byod_session.exit",
          object: "ByodSessionParticipant",
          objectId: saved.id,
          outcome: "EXITED",
          newValue: { status },
        },
      });
      return {
        participantId: saved.id,
        exitedAt: saved.exitedAt!.toISOString(),
        status: saved.exitStatus,
      };
    });
  }

  private summary(value: any): ByodStudySessionSummary {
    return {
      id: value.id,
      tenantId: value.tenantId,
      classId: value.classId,
      title: value.title,
      status: value.status,
      startsAt: value.startsAt.toISOString(),
      endsAt: value.endsAt.toISOString(),
      allowedUrls: value.allowedUrls,
      eligibility: value.eligibility as ByodEligibility,
    };
  }

  private async evaluateReadiness(
    tenantId: string,
    session: any,
    studentId: string,
    checks: CheckByodReadinessDto,
    checkedAt: Date,
  ): Promise<ByodReadinessSummary> {
    const eligibility = session.eligibility as ByodEligibility;
    const issues: string[] = [];
    let eligible = session.class.members.length > 0;
    if (!eligible) issues.push("NOT_ENROLLED");
    if (
      session.status !== "ACTIVE" ||
      checkedAt < session.startsAt ||
      checkedAt >= session.endsAt
    ) {
      eligible = false;
      issues.push("SESSION_CLOSED");
    }
    if (eligibility.scope === "EXAM") {
      const exam = eligibility.examAssignmentId
        ? await this.prisma.policyAssignment.findFirst({
            where: {
              id: eligibility.examAssignmentId,
              tenantId,
              active: true,
              startsAt: { lte: checkedAt },
              endsAt: { gt: checkedAt },
            },
            include: { policy: true },
          })
        : null;
      const targeted =
        exam &&
        ((exam.scope === "CLASS" && exam.scopeId === session.classId) ||
          (exam.scope === "GRADE" && exam.scopeId === session.class.grade) ||
          (exam.scope === "STUDENT" && exam.scopeId === studentId));
      const rules = exam?.policy?.rules as { mode?: string } | undefined;
      if (!targeted || rules?.mode !== "EXAM") {
        eligible = false;
        issues.push("EXAM_POLICY_INELIGIBLE");
      }
    }
    if (!eligibility.allowedPlatforms.includes(checks.platform.toUpperCase()))
      issues.push("PLATFORM_NOT_ALLOWED");
    if (!eligibility.allowedBrowsers.includes(checks.browser.toUpperCase()))
      issues.push("BROWSER_NOT_ALLOWED");
    if (checks.browserMajorVersion < eligibility.minimumBrowserMajorVersion)
      issues.push("BROWSER_OUTDATED");
    if (!checks.secureContext) issues.push("INSECURE_CONTEXT");
    if (!checks.cookiesEnabled) issues.push("COOKIES_DISABLED");
    if (!checks.javascriptEnabled) issues.push("JAVASCRIPT_DISABLED");
    return {
      checkedAt: checkedAt.toISOString(),
      eligible,
      ready: eligible && issues.length === 0,
      issues,
    };
  }
}
