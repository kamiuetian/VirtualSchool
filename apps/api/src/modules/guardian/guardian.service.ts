import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type {
  GuardianChildSummary,
  GuardianDashboard,
  GuardianLearningAccessSummary,
} from "@virtual-school/shared";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class GuardianService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async dashboard(
    tenantId: string,
    email?: string,
  ): Promise<GuardianDashboard> {
    if (!email)
      throw new ForbiddenException("Guardian email claim is required");

    const guardian = await this.prisma.guardian.findFirst({
      where: { tenantId, email: { equals: email, mode: "insensitive" } },
      select: {
        name: true,
        tenant: { select: { name: true, timezone: true } },
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
    const [hours, sessions, accessEvents] = await Promise.all([
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
          expectedMode: classMode
            ? "CLASS_MODE"
            : this.isWithinHours(studentHours, guardian.tenant.timezone)
              ? "SCHOOL_HOURS"
              : "AFTER_SCHOOL",
          approvedLearningAccess: accessEvents
            .filter((event) => studentClassIds.has(event.session.classId))
            .slice(0, 8)
            .map((event) => this.accessSummary(event)),
        };
      },
    );

    return {
      guardianName: guardian.name,
      schoolName: guardian.tenant.name,
      timezone: guardian.tenant.timezone,
      children,
      privacyMessage:
        "This view shows school-approved learning activity only. Browsing history, device location, messages, diagnostics, and other children are not available.",
    };
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
