import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type {
  GuardianChildSummary,
  GuardianDashboard,
  GuardianLearningAccessSummary,
} from "@virtual-school/shared";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateGuardianSupportRequestDto,
  ReportLostDeviceDto,
  UpdateGuardianNotificationsDto,
  UpdateAfterSchoolControlDto,
} from "./dto/guardian-actions.dto";

@Injectable()
export class GuardianService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async dashboard(
    tenantId: string,
    email?: string,
    subjectId?: string,
  ): Promise<GuardianDashboard> {
    if (!email)
      throw new ForbiddenException("Guardian email claim is required");

    const guardian = await this.prisma.guardian.findFirst({
      where: { tenantId, email: { equals: email, mode: "insensitive" } },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        language: true,
        notificationPreference: { select: { channels: true } },
        supportRequests: { orderBy: { createdAt: "desc" }, take: 10 },
        tenant: {
          select: {
            accentColor: true,
            deviceLabel: true,
            logoUrl: true,
            name: true,
            primaryColor: true,
            studentLabel: true,
            timezone: true,
            supportEmail: true,
            supportPhone: true,
            websiteUrl: true,
            language: true,
          },
        },
        students: {
          where: { student: { tenantId } },
          select: {
            relationship: true,
            student: {
              select: {
                id: true,
                name: true,
                grade: true,
                section: true,
                devices: {
                  where: { status: { not: "RETIRED" } },
                  orderBy: { updatedAt: "desc" },
                  take: 1,
                  select: { status: true, lastCheckInAt: true },
                },
                classes: { select: { classId: true } },
                guardianAfterSchoolControls: {
                  select: {
                    guardianId: true,
                    enabled: true,
                    dailyLimitMinutes: true,
                    allowedAppIds: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!guardian)
      throw new ForbiddenException(
        "No guardian profile is linked to this account",
      );

    const classIds = [
      ...new Set(
        guardian.students.flatMap((link) =>
          link.student.classes.map((item) => item.classId),
        ),
      ),
    ];
    const grades = [
      ...new Set(guardian.students.map((link) => link.student.grade)),
    ];
    const [hours, sessions, accessEvents, approvedApps, notices, acceptances] =
      await Promise.all([
        this.prisma.timetableBlock.findMany({
          where: {
            tenantId,
            active: true,
            OR: [{ classId: { in: classIds } }, { scope: "TENANT" }],
          },
          select: {
            classId: true,
            grade: true,
            dayOfWeek: true,
            startMinute: true,
            endMinute: true,
            timezone: true,
          },
        }),
        this.prisma.teacherSession.findMany({
          where: { tenantId, classId: { in: classIds }, status: "ACTIVE" },
          select: { classId: true },
        }),
        this.prisma.teacherSessionEvent.findMany({
          where: {
            tenantId,
            session: { classId: { in: classIds } },
            type: { in: ["RESOURCE_PUSHED", "TEMPORARY_URL_APPROVED"] },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            type: true,
            details: true,
            createdAt: true,
            session: { select: { classId: true } },
          },
        }),
        this.prisma.appCatalogItem.findMany({
          where: {
            tenantId,
            approvalStatus: "APPROVED",
            approvedGrades: { hasSome: grades },
          },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            category: true,
            approvedGrades: true,
          },
        }),
        this.prisma.privacyNotice.findMany({
          where: { tenantId, channel: "PORTAL" },
          orderBy: [{ noticeType: "asc" }, { version: "desc" }],
        }),
        subjectId
          ? this.prisma.privacyAcceptance.findMany({
              where: {
                tenantId,
                subjectType: "GUARDIAN",
                subjectId,
                revokedAt: null,
              },
              select: { noticeId: true },
            })
          : Promise.resolve([]),
      ]);

    const children: GuardianChildSummary[] = guardian.students.map(
      ({ relationship, student }) => {
        const studentClassIds = new Set(
          student.classes.map((item) => item.classId),
        );
        const studentHours = hours.filter(
          (item) => item.classId === null || studentClassIds.has(item.classId),
        );
        const classMode = sessions.some((item) =>
          studentClassIds.has(item.classId),
        );
        const control = student.guardianAfterSchoolControls.find(
          (item) => item.guardianId === guardian.id,
        );
        const expectedMode = classMode
          ? "CLASS_MODE"
          : this.isWithinHours(studentHours, guardian.tenant.timezone)
            ? "SCHOOL_HOURS"
            : "AFTER_SCHOOL";
        return {
          id: student.id,
          name: student.name,
          grade: student.grade,
          section: student.section,
          relationship,
          device: this.deviceSummary(student.devices[0]),
          schoolHours: studentHours.map((item) => ({
            dayOfWeek: item.dayOfWeek,
            startMinute: item.startMinute,
            endMinute: item.endMinute,
            timezone: item.timezone ?? guardian.tenant.timezone,
          })),
          expectedMode,
          approvedLearningAccess: accessEvents
            .filter((event) => studentClassIds.has(event.session.classId))
            .slice(0, 8)
            .map((event) => this.accessSummary(event)),
          availableAfterSchoolApps: approvedApps
            .filter((app) => app.approvedGrades.includes(student.grade))
            .map((app) => ({
              id: app.id,
              name: app.name,
              category: app.category,
            })),
          afterSchoolControl: {
            enabled: control?.enabled ?? false,
            dailyLimitMinutes: control?.dailyLimitMinutes ?? 60,
            allowedAppIds: control?.allowedAppIds ?? [],
            effective: Boolean(
              control?.enabled &&
                expectedMode === "AFTER_SCHOOL" &&
                student.devices[0]?.status !== "LOST",
            ),
            inactiveReason:
              expectedMode !== "AFTER_SCHOOL"
                ? "School and class modes always take precedence"
                : student.devices[0]?.status === "LOST"
                  ? "Lost-device mode always takes precedence"
                  : control?.enabled
                    ? null
                    : "After-school control is off",
          },
        };
      },
    );

    const latestNotices = notices.filter(
      (notice, index) =>
        notices.findIndex((item) => item.noticeType === notice.noticeType) ===
        index,
    );
    const acceptedNoticeIds = new Set(acceptances.map((item) => item.noticeId));
    const supportedNotificationChannels = [
      ...(guardian.email ? ["EMAIL"] : []),
      ...(guardian.phone ? ["SMS"] : []),
      "IN_APP",
    ];
    const locale = this.supportedLocale(
      guardian.language ?? guardian.tenant.language,
    );
    return {
      branding: {
        accentColor: guardian.tenant.accentColor,
        deviceLabel: guardian.tenant.deviceLabel,
        logoUrl: guardian.tenant.logoUrl,
        name: guardian.tenant.name,
        primaryColor: guardian.tenant.primaryColor,
        studentLabel: guardian.tenant.studentLabel,
        supportEmail: guardian.tenant.supportEmail,
        supportPhone: guardian.tenant.supportPhone,
        websiteUrl: guardian.tenant.websiteUrl,
        timezone: guardian.tenant.timezone,
      },
      tenantId,
      guardianName: guardian.name,
      schoolName: guardian.tenant.name,
      timezone: guardian.tenant.timezone,
      locale,
      supportedLocales: [
        { code: "en", label: "English" },
        { code: "ur", label: "اردو" },
      ],
      children,
      privacyMessage:
        locale === "ur"
          ? "یہ منظر صرف اسکول کی منظور شدہ تعلیمی سرگرمی دکھاتا ہے۔ براؤزنگ ہسٹری، آلے کا مقام، پیغامات، تشخیصی معلومات اور دوسرے بچے دستیاب نہیں ہیں۔"
          : "This view shows school-approved learning activity only. Browsing history, device location, messages, diagnostics, and other children are not available.",
      notificationChannels: (
        guardian.notificationPreference?.channels ?? ["EMAIL"]
      ).filter((channel) => supportedNotificationChannels.includes(channel)),
      supportedNotificationChannels,
      consentForms: latestNotices.map((notice) => ({
        id: notice.id,
        noticeType: notice.noticeType,
        version: notice.version,
        title: notice.title,
        content: notice.content,
        accepted: acceptedNoticeIds.has(notice.id),
      })),
      supportRequests: guardian.supportRequests.map((request) => ({
        id: request.id,
        studentId: request.studentId,
        category: request.category,
        priority: request.priority,
        status: request.status,
        subject: request.subject,
        routedTo: request.routedTo,
        createdAt: request.createdAt.toISOString(),
      })),
    };
  }

  async updateLanguage(
    tenantId: string,
    language: "en" | "ur",
    actorId?: string,
    email?: string,
  ) {
    const guardian = await this.linkedGuardianAccount(tenantId, email);
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.guardian.update({
        where: { id: guardian.id },
        data: { language },
        select: { language: true },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "guardian.language.update",
          object: "Guardian",
          objectId: guardian.id,
          outcome: "SUCCESS",
          newValue: { language },
        },
      });
      return updated;
    });
  }

  private supportedLocale(value?: string | null): "en" | "ur" {
    return value?.toLowerCase().split("-")[0] === "ur" ? "ur" : "en";
  }

  async updateNotificationPreferences(
    tenantId: string,
    input: UpdateGuardianNotificationsDto,
    actorId?: string,
    email?: string,
  ) {
    const guardian = await this.linkedGuardianAccount(tenantId, email);
    const supported = new Set([
      ...(guardian.email ? ["EMAIL"] : []),
      ...(guardian.phone ? ["SMS"] : []),
      "IN_APP",
    ]);
    if (input.channels.some((channel) => !supported.has(channel)))
      throw new ForbiddenException(
        "A selected notification channel is not available for this guardian profile",
      );
    return this.prisma.$transaction(async (tx) => {
      const preference = await tx.guardianNotificationPreference.upsert({
        where: { guardianId: guardian.id },
        create: {
          tenantId,
          guardianId: guardian.id,
          channels: input.channels,
          updatedBy: actorId,
        },
        update: { channels: input.channels, updatedBy: actorId },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "guardian.notification_preferences.update",
          object: "GuardianNotificationPreference",
          objectId: preference.id,
          outcome: "SUCCESS",
          newValue: { channels: input.channels },
        },
      });
      return { channels: preference.channels };
    });
  }

  async createSupportRequest(
    tenantId: string,
    studentId: string,
    input: CreateGuardianSupportRequestDto,
    actorId?: string,
    email?: string,
  ) {
    const link = await this.linkedGuardian(tenantId, studentId, email);
    const device = link.student.devices[0];
    if (!device)
      throw new ForbiddenException("No active device is linked to this child");
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { supportEmail: true },
      });
      const ticket = await tx.supportTicket.create({
        data: {
          tenantId,
          deviceId: device.id,
          studentId,
          source: "GUARDIAN",
          category: input.category,
          priority: "NORMAL",
          subject: input.subject.trim(),
          description: input.description.trim(),
          routingQueue: "GUARDIAN_SUPPORT",
          slaDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          createdBy: actorId,
        },
      });
      const request = await tx.guardianSupportRequest.create({
        data: {
          tenantId,
          guardianId: link.id,
          studentId,
          deviceId: device.id,
          category: input.category,
          subject: input.subject.trim(),
          description: input.description.trim(),
          routedTo: tenant?.supportEmail ?? null,
          createdBy: actorId,
          supportTicketId: ticket.id,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "guardian.support_request.create",
          object: "SupportTicket",
          objectId: ticket.id,
          outcome: "ROUTED",
          newValue: {
            studentId,
            deviceId: device.id,
            category: input.category,
            routedTo: request.routedTo,
            guardianSupportRequestId: request.id,
          },
        },
      });
      return {
        id: ticket.id,
        status: ticket.status,
        routedTo: request.routedTo,
      };
    });
  }

  async reportLostDevice(
    tenantId: string,
    studentId: string,
    input: ReportLostDeviceDto,
    actorId?: string,
    email?: string,
  ) {
    const reason = input.reason.trim();
    if (!reason) throw new ForbiddenException("A report reason is required");
    const link = await this.linkedGuardian(tenantId, studentId, email);
    const device = link.student.devices[0];
    if (!device)
      throw new ForbiddenException("No active device is linked to this child");
    return this.prisma.$transaction(async (tx) => {
      const alert = await tx.deviceAlert.create({
        data: {
          tenantId,
          deviceId: device.id,
          type: "GUARDIAN_LOST_DEVICE_REPORT",
          severity: "S1",
          status: "OPEN",
          title: `Guardian reported ${link.student.name}'s device missing`,
          message: reason,
          source: "GUARDIAN_PORTAL",
          metadata: {
            guardianId: link.id,
            studentId,
            requestedLostWorkflow: Boolean(input.startLostWorkflow),
          },
        },
      });
      if (input.startLostWorkflow && device.status !== "LOST") {
        await tx.device.update({
          where: { id: device.id },
          data: { status: "LOST" },
        });
        await tx.deviceLifecycleEvent.create({
          data: {
            tenantId,
            deviceId: device.id,
            type: "LOST",
            reason,
            actorId,
            oldValue: { status: device.status },
            newValue: { status: "LOST", source: "GUARDIAN_REPORT" },
          },
        });
      }
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "guardian.device.report_lost",
          object: "Device",
          objectId: device.id,
          outcome: "SUCCESS",
          reason,
          newValue: {
            alertId: alert.id,
            studentId,
            lostWorkflowStarted: Boolean(input.startLostWorkflow),
          },
        },
      });
      return {
        alertId: alert.id,
        lostWorkflowStarted: Boolean(input.startLostWorkflow),
        status: "REPORTED" as const,
      };
    });
  }

  async updateAfterSchoolControl(
    tenantId: string,
    studentId: string,
    input: UpdateAfterSchoolControlDto,
    actorId?: string,
    email?: string,
  ) {
    const link = await this.linkedGuardian(tenantId, studentId, email);
    const approvedApps = await this.prisma.appCatalogItem.findMany({
      where: {
        id: { in: input.allowedAppIds },
        tenantId,
        approvalStatus: "APPROVED",
        approvedGrades: { has: link.student.grade },
      },
      select: { id: true },
    });
    if (approvedApps.length !== input.allowedAppIds.length)
      throw new ForbiddenException(
        "Every selected app must be school-approved for this child's grade",
      );
    return this.prisma.$transaction(async (tx) => {
      const control = await tx.guardianAfterSchoolControl.upsert({
        where: { guardianId_studentId: { guardianId: link.id, studentId } },
        create: {
          tenantId,
          guardianId: link.id,
          studentId,
          enabled: input.enabled,
          dailyLimitMinutes: input.dailyLimitMinutes,
          allowedAppIds: input.allowedAppIds,
          updatedBy: actorId,
        },
        update: {
          enabled: input.enabled,
          dailyLimitMinutes: input.dailyLimitMinutes,
          allowedAppIds: input.allowedAppIds,
          updatedBy: actorId,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "guardian.after_school_control.update",
          object: "GuardianAfterSchoolControl",
          objectId: control.id,
          outcome: "SUCCESS",
          newValue: {
            studentId,
            enabled: input.enabled,
            dailyLimitMinutes: input.dailyLimitMinutes,
            allowedAppIds: input.allowedAppIds,
          },
        },
      });
      return {
        enabled: control.enabled,
        dailyLimitMinutes: control.dailyLimitMinutes,
        allowedAppIds: control.allowedAppIds,
      };
    });
  }

  private async linkedGuardian(
    tenantId: string,
    studentId: string,
    email?: string,
  ) {
    if (!email)
      throw new ForbiddenException("Guardian email claim is required");
    const guardian = await this.prisma.guardian.findFirst({
      where: {
        tenantId,
        email: { equals: email, mode: "insensitive" },
        students: { some: { studentId, student: { tenantId } } },
      },
      select: {
        id: true,
        students: {
          where: { studentId, student: { tenantId } },
          select: {
            student: {
              select: {
                id: true,
                name: true,
                grade: true,
                devices: {
                  where: { status: { not: "RETIRED" } },
                  orderBy: { updatedAt: "desc" },
                  take: 1,
                  select: { id: true, status: true },
                },
              },
            },
          },
        },
      },
    });
    if (!guardian || !guardian.students[0])
      throw new ForbiddenException(
        "This child is not linked to the authenticated guardian",
      );
    return { id: guardian.id, student: guardian.students[0].student };
  }

  private async linkedGuardianAccount(tenantId: string, email?: string) {
    if (!email)
      throw new ForbiddenException("Guardian email claim is required");
    const guardian = await this.prisma.guardian.findFirst({
      where: { tenantId, email: { equals: email, mode: "insensitive" } },
      select: { id: true, email: true, phone: true },
    });
    if (!guardian)
      throw new ForbiddenException(
        "No guardian profile is linked to this account",
      );
    return guardian;
  }

  private deviceSummary(device?: {
    status: string;
    lastCheckInAt: Date | null;
  }) {
    const availability = !device
      ? "NOT_ASSIGNED"
      : device.status === "ONLINE"
        ? "ONLINE"
        : device.status === "OFFLINE"
          ? "OFFLINE"
          : device.status === "LOST"
            ? "LOST"
            : "NEEDS_ATTENTION";
    return {
      availability,
      lastSeenAt: device?.lastCheckInAt?.toISOString() ?? null,
    } as const;
  }

  private isWithinHours(
    hours: { dayOfWeek: number; startMinute: number; endMinute: number }[],
    timezone: string,
  ): boolean {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
      parts.find((part) => part.type === "weekday")?.value ?? "",
    );
    const minute =
      Number(parts.find((part) => part.type === "hour")?.value) * 60 +
      Number(parts.find((part) => part.type === "minute")?.value);
    return hours.some(
      (item) =>
        item.dayOfWeek === weekday &&
        item.startMinute <= minute &&
        minute < item.endMinute,
    );
  }

  private accessSummary(event: {
    type: string;
    details: unknown;
    createdAt: Date;
  }): GuardianLearningAccessSummary {
    const details =
      event.details && typeof event.details === "object"
        ? (event.details as Record<string, unknown>)
        : {};
    const isUrl = event.type === "TEMPORARY_URL_APPROVED";
    return {
      type: isUrl ? "TEMPORARY_WEBSITE" : "APP_OR_RESOURCE",
      label:
        typeof details.name === "string"
          ? details.name
          : isUrl
            ? "Teacher-approved website"
            : "Teacher-approved learning resource",
      approvedAt: event.createdAt.toISOString(),
    };
  }
}
