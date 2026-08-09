import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  AppDeploymentReport,
  DeviceInventoryReport,
  DeviceInventoryReportRow,
  LearningUsageAnalyticsReport,
  LearningUsageBreakdown,
  PolicyDeploymentReport,
  PolicyRuleSet,
  PolicyStatus,
  EnterpriseAnalyticsMetrics,
  EnterpriseAnalyticsNode,
  EnterpriseAnalyticsReport,
} from "@virtual-school/shared";
import { createHash } from "node:crypto";
import {
  Prisma,
  type AppCatalogItem,
  type Device,
  type RemoteCommand,
} from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { assessAndroidCompliance } from "../enrollment/device-capability.catalog";
import type { CreateAnalyticsExportScheduleDto } from "./enterprise-reports.dto";

@Injectable()
export class ReportsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getDeviceInventoryReport(
    tenantId: string,
  ): Promise<DeviceInventoryReport> {
    await this.ensureTenantExists(tenantId);

    const devices = await this.prisma.device.findMany({
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      where: {
        tenantId,
      },
    });
    const rows = devices.map((device) => this.toDeviceInventoryRow(device));

    return {
      byCompliance: this.countBy(rows, (row) => row.compliance),
      byHealth: this.countBy(rows, (row) => row.health),
      devices: rows,
      generatedAt: new Date().toISOString(),
      tenantId,
      totals: {
        devices: rows.length,
        locked: rows.filter((row) => row.status === "LOCKED").length,
        nonCompliant: rows.filter((row) => row.status === "NON_COMPLIANT")
          .length,
        offline: rows.filter((row) => row.status === "OFFLINE").length,
        online: rows.filter((row) => row.status === "ONLINE").length,
        pending: rows.filter((row) => row.status === "PENDING").length,
      },
    };
  }

  async getDeviceInventoryCsv(
    tenantId: string,
    actorId: string | undefined,
  ): Promise<string> {
    const report = await this.getDeviceInventoryReport(tenantId);
    const rows = [
      [
        "device_id",
        "serial_number",
        "manufacturer",
        "model",
        "android_version",
        "status",
        "health",
        "compliance",
        "compliance_score",
        "compliance_grade",
        "os_lifecycle",
        "update_recommendation",
        "lifecycle_restrictions",
        "policy_version",
        "student_id",
        "class_id",
        "branch_id",
        "mdm_connector",
        "connector_device_name",
        "last_check_in_at",
        "tags",
      ],
      ...report.devices.map((device) => [
        device.id,
        device.serialNumber,
        device.manufacturer,
        device.model,
        device.androidVersion,
        device.status,
        device.health,
        device.compliance,
        device.complianceAssessment?.score,
        device.complianceAssessment?.grade,
        device.complianceAssessment?.osLifecycle,
        device.complianceAssessment?.updateRecommendation,
        device.complianceAssessment?.restrictions.join("|"),
        device.policyVersion,
        device.studentId,
        device.classId,
        device.branchId,
        device.mdmConnector,
        device.connectorDeviceName,
        device.lastCheckInAt,
        device.tags.join("|"),
      ]),
    ];

    await this.prisma.auditEvent.create({
      data: {
        action: "report.export",
        actorId,
        newValue: {
          format: "csv",
          report: "device_inventory",
          rowCount: report.devices.length,
        },
        object: "Report",
        objectId: "device_inventory",
        outcome: "SUCCESS",
        reason: "Device inventory CSV export",
        tenantId,
      },
    });

    return rows
      .map((row) => row.map((cell) => this.csvCell(cell)).join(","))
      .join("\n");
  }

  async getPolicyDeploymentReport(
    tenantId: string,
  ): Promise<PolicyDeploymentReport> {
    await this.ensureTenantExists(tenantId);

    const [policies, commands] = await Promise.all([
      this.prisma.policy.findMany({
        include: {
          assignments: {
            select: {
              active: true,
              id: true,
            },
          },
          versions: {
            orderBy: {
              version: "desc",
            },
            take: 1,
          },
        },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        where: {
          tenantId,
        },
      }),
      this.prisma.remoteCommand.findMany({
        where: {
          status: {
            in: ["QUEUED", "DELIVERED", "FAILED", "EXPIRED"],
          },
          tenantId,
          type: "POLICY_REFRESH",
        },
      }),
    ]);
    const rows = policies.map((policy) => ({
      activeAssignmentCount: policy.assignments.filter(
        (assignment) => assignment.active,
      ).length,
      assignmentCount: policy.assignments.length,
      failedDeploymentCount: this.countCommandsForPayloadMatch(
        commands,
        "policyId",
        policy.id,
        ["FAILED", "EXPIRED"],
      ),
      latestVersionSummary: policy.versions[0]?.summary ?? null,
      name: policy.name,
      policyId: policy.id,
      queuedDeploymentCount: this.countCommandsForPayloadMatch(
        commands,
        "policyId",
        policy.id,
        ["QUEUED", "DELIVERED"],
      ),
      status: policy.status as PolicyStatus,
      updatedAt: policy.updatedAt.toISOString(),
      version: policy.version,
    }));

    return {
      generatedAt: new Date().toISOString(),
      policies: rows,
      tenantId,
      totals: {
        activeAssignments: rows.reduce(
          (total, row) => total + row.activeAssignmentCount,
          0,
        ),
        draft: rows.filter((row) => row.status === "DRAFT").length,
        failedDeployments: rows.reduce(
          (total, row) => total + row.failedDeploymentCount,
          0,
        ),
        policies: rows.length,
        published: rows.filter((row) => row.status === "PUBLISHED").length,
        queuedDeploymentCommands: rows.reduce(
          (total, row) => total + row.queuedDeploymentCount,
          0,
        ),
      },
    };
  }

  async getAppDeploymentReport(tenantId: string): Promise<AppDeploymentReport> {
    await this.ensureTenantExists(tenantId);

    const [apps, policies, commands] = await Promise.all([
      this.prisma.appCatalogItem.findMany({
        orderBy: [{ approvalStatus: "asc" }, { name: "asc" }],
        where: {
          tenantId,
        },
      }),
      this.prisma.policy.findMany({
        select: {
          name: true,
          rules: true,
        },
        where: {
          tenantId,
          status: "PUBLISHED",
        },
      }),
      this.prisma.remoteCommand.findMany({
        where: {
          status: {
            in: ["QUEUED", "DELIVERED", "FAILED", "EXPIRED"],
          },
          tenantId,
          type: {
            in: ["APP_INSTALL", "APP_REMOVE"],
          },
        },
      }),
    ]);
    const rows = apps.map((app) =>
      this.toAppDeploymentRow(
        app,
        policies
          .filter((policy) =>
            (
              (policy.rules as PolicyRuleSet).approvedAppPackageIds ?? []
            ).includes(app.packageId),
          )
          .map((policy) => policy.name),
        commands,
      ),
    );

    return {
      apps: rows,
      generatedAt: new Date().toISOString(),
      tenantId,
      totals: {
        apps: rows.length,
        approved: rows.filter((row) => row.approvalStatus === "APPROVED")
          .length,
        assignedApps: rows.filter((row) => row.assignedPolicyCount > 0).length,
        blocked: rows.filter((row) => row.approvalStatus === "BLOCKED").length,
        failedDeployments: rows.reduce(
          (total, row) => total + row.failedDeploymentCount,
          0,
        ),
        queuedCommands: rows.reduce(
          (total, row) => total + row.queuedCommandCount,
          0,
        ),
      },
    };
  }

  async getLearningUsageAnalytics(
    tenantId: string,
    input: {
      from?: string;
      to?: string;
      classId?: string;
      grade?: string;
      deviceGroup?: string;
      category?: string;
    },
  ): Promise<LearningUsageAnalyticsReport> {
    await this.ensureTenantExists(tenantId);
    const to = this.reportDate(
      input.to ?? new Date().toISOString().slice(0, 10),
      "to",
    );
    const defaultFrom = new Date(`${to}T00:00:00.000Z`);
    defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29);
    const from = this.reportDate(
      input.from ?? defaultFrom.toISOString().slice(0, 10),
      "from",
    );
    const startedAt = new Date(`${from}T00:00:00.000Z`);
    const endedAt = new Date(`${to}T23:59:59.999Z`);
    if (
      startedAt > endedAt ||
      endedAt.getTime() - startedAt.getTime() >= 366 * 86_400_000
    ) {
      throw new BadRequestException(
        "Analytics window must be ordered and no longer than 366 days",
      );
    }

    const classes = await this.prisma.classSection.findMany({
      select: { grade: true, id: true, name: true },
      where: {
        tenantId,
        ...(input.classId ? { id: input.classId } : {}),
        ...(input.grade ? { grade: input.grade } : {}),
      },
    });
    const classIds = classes.map((item) => item.id);
    const [sessions, attendance, devices, appCatalog] = await Promise.all([
      this.prisma.teacherSession.findMany({
        include: {
          events: { where: { createdAt: { gte: startedAt, lte: endedAt } } },
        },
        where: {
          tenantId,
          classId: { in: classIds },
          startedAt: { gte: startedAt, lte: endedAt },
        },
      }),
      this.prisma.attendanceRecord.findMany({
        where: {
          tenantId,
          classId: { in: classIds },
          attendanceDate: { gte: from, lte: to },
        },
      }),
      this.prisma.device.findMany({
        select: { classId: true, status: true, tags: true },
        where: {
          tenantId,
          classId: { in: classIds },
          ...(input.deviceGroup ? { tags: { has: input.deviceGroup } } : {}),
        },
      }),
      this.prisma.appCatalogItem.findMany({
        select: { category: true, id: true },
        where: { tenantId },
      }),
    ]);
    const appCategories = new Map(
      appCatalog.map((item) => [item.id, item.category ?? "APPROVED_RESOURCE"]),
    );
    const launches = sessions
      .flatMap((session) =>
        session.events
          .filter((event) =>
            ["RESOURCE_PUSHED", "EDUCATION_RESOURCE_PUSHED"].includes(
              event.type,
            ),
          )
          .map((event) => ({
            category: this.eventCategory(event.details, appCategories),
            classId: session.classId,
            date: event.createdAt.toISOString().slice(0, 10),
          })),
      )
      .filter((event) => !input.category || event.category === input.category);
    const participants = attendance.filter((row) =>
      ["PRESENT", "LATE"].includes(row.status),
    );
    const missed = attendance.filter((row) => row.status === "ABSENT");
    const offline = devices.filter((device) => device.status === "OFFLINE");
    const buildBreakdown = (
      entries: Array<{ key: string; label: string; classIds: string[] }>,
    ): LearningUsageBreakdown[] =>
      entries.map((entry) => ({
        key: entry.key,
        label: entry.label,
        sessions: sessions.filter((row) => entry.classIds.includes(row.classId))
          .length,
        participants: participants.filter((row) =>
          entry.classIds.includes(row.classId),
        ).length,
        missedSessions: missed.filter((row) =>
          entry.classIds.includes(row.classId),
        ).length,
        approvedResourceLaunches: launches.filter((row) =>
          entry.classIds.includes(row.classId),
        ).length,
        offlineDevices: offline.filter(
          (row) => row.classId && entry.classIds.includes(row.classId),
        ).length,
      }));
    const gradeGroups = [...new Set(classes.map((item) => item.grade))].map(
      (grade) => ({
        key: grade,
        label: grade,
        classIds: classes
          .filter((item) => item.grade === grade)
          .map((item) => item.id),
      }),
    );
    const deviceGroups = [
      ...new Set(devices.flatMap((device) => device.tags)),
    ].map((tag) => ({
      key: tag,
      label: tag,
      classIds: [
        ...new Set(
          devices
            .filter((device) => device.tags.includes(tag) && device.classId)
            .map((device) => device.classId!),
        ),
      ],
    }));
    const categories = [
      ...new Set(launches.map((event) => event.category)),
    ].map((category) => ({
      key: category,
      label: category,
      classIds: [
        ...new Set(
          launches
            .filter((event) => event.category === category)
            .map((event) => event.classId),
        ),
      ],
    }));
    const trend: LearningUsageAnalyticsReport["trend"] = [];
    for (
      const cursor = new Date(startedAt);
      cursor <= endedAt;
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    ) {
      const date = cursor.toISOString().slice(0, 10);
      trend.push({
        date,
        sessions: sessions.filter(
          (row) => row.startedAt.toISOString().slice(0, 10) === date,
        ).length,
        participants: participants.filter((row) => row.attendanceDate === date)
          .length,
        missedSessions: missed.filter((row) => row.attendanceDate === date)
          .length,
        approvedResourceLaunches: launches.filter((row) => row.date === date)
          .length,
      });
    }
    return {
      tenantId,
      generatedAt: new Date().toISOString(),
      filters: {
        from,
        to,
        ...(input.classId ? { classId: input.classId } : {}),
        ...(input.grade ? { grade: input.grade } : {}),
        ...(input.deviceGroup ? { deviceGroup: input.deviceGroup } : {}),
        ...(input.category ? { category: input.category } : {}),
      },
      totals: {
        sessions: sessions.length,
        participants: participants.length,
        missedSessions: missed.length,
        approvedResourceLaunches: launches.length,
        offlineDevices: offline.length,
      },
      byClass: buildBreakdown(
        classes.map((item) => ({
          key: item.id,
          label: item.name,
          classIds: [item.id],
        })),
      ),
      byGrade: buildBreakdown(gradeGroups),
      byDeviceGroup: buildBreakdown(deviceGroups),
      byCategory: buildBreakdown(categories),
      trend,
    };
  }

  async getTenantEnterpriseAnalytics(
    tenantId: string,
    input: { from?: string; to?: string },
  ): Promise<EnterpriseAnalyticsReport> {
    const range = this.analyticsRange(input);
    const tenant = await this.prisma.tenant.findUnique({
      select: {
        id: true,
        name: true,
        branches: { select: { id: true, name: true } },
      },
      where: { id: tenantId },
    });
    if (!tenant)
      throw new NotFoundException(`Tenant ${tenantId} was not found`);
    const [devices, attendance, sessions, tickets] = await Promise.all([
      this.prisma.device.findMany({
        select: { branchId: true, compliance: true },
        where: { tenantId },
      }),
      this.prisma.attendanceRecord.findMany({
        select: { status: true, classId: true },
        where: { tenantId, attendanceDate: { gte: range.from, lte: range.to } },
      }),
      this.prisma.teacherSession.findMany({
        select: { classId: true },
        where: {
          tenantId,
          startedAt: { gte: range.startedAt, lte: range.endedAt },
        },
      }),
      this.prisma.supportTicket.findMany({
        select: { device: { select: { branchId: true } } },
        where: {
          tenantId,
          status: { notIn: ["RESOLVED", "CLOSED", "CANCELED"] },
        },
      }),
    ]);
    const classes = await this.prisma.classSection.findMany({
      select: { id: true, branchId: true },
      where: { tenantId },
    });
    const classBranch = new Map(
      classes.map((item) => [item.id, item.branchId]),
    );
    const metricsFor = (branchId?: string): EnterpriseAnalyticsMetrics => {
      const scopedDevices = branchId
        ? devices.filter((item) => item.branchId === branchId)
        : devices;
      const scopedAttendance = branchId
        ? attendance.filter(
            (item) => classBranch.get(item.classId) === branchId,
          )
        : attendance;
      const scopedSessions = branchId
        ? sessions.filter((item) => classBranch.get(item.classId) === branchId)
        : sessions;
      const scopedTickets = branchId
        ? tickets.filter((item) => item.device?.branchId === branchId)
        : tickets;
      const compliantDevices = scopedDevices.filter(
        (item) => item.compliance === "COMPLIANT",
      ).length;
      const presentAttendance = scopedAttendance.filter((item) =>
        ["PRESENT", "LATE"].includes(item.status),
      ).length;
      return {
        devices: scopedDevices.length,
        compliantDevices,
        complianceRate: this.rate(compliantDevices, scopedDevices.length),
        attendanceRecords: scopedAttendance.length,
        presentAttendance,
        attendanceRate: this.rate(presentAttendance, scopedAttendance.length),
        learningSessions: scopedSessions.length,
        openSupportTickets: scopedTickets.length,
      };
    };
    const node: EnterpriseAnalyticsNode = {
      level: "TENANT",
      id: tenant.id,
      name: tenant.name,
      metrics: metricsFor(),
      children: tenant.branches.map((branch) => ({
        level: "BRANCH",
        id: branch.id,
        name: branch.name,
        metrics: metricsFor(branch.id),
      })),
    };
    return {
      scope: "TENANT",
      scopeId: tenantId,
      generatedAt: new Date().toISOString(),
      from: range.from,
      to: range.to,
      metrics: node.metrics,
      tenants: [node],
    };
  }

  async getPartnerEnterpriseAnalytics(
    partnerId: string,
    actorId: string | undefined,
    input: { from?: string; to?: string },
  ): Promise<EnterpriseAnalyticsReport> {
    const partner = await this.requirePartnerOperator(partnerId, actorId);
    const customers = await this.prisma.resellerCustomer.findMany({
      select: { tenantId: true },
      where: { partnerId },
    });
    const reports = await Promise.all(
      customers.map((item) =>
        this.getTenantEnterpriseAnalytics(item.tenantId, input),
      ),
    );
    const tenants = reports.flatMap((report) => report.tenants);
    return {
      scope: "PARTNER",
      scopeId: partnerId,
      generatedAt: new Date().toISOString(),
      from: reports[0]?.from ?? this.analyticsRange(input).from,
      to: reports[0]?.to ?? this.analyticsRange(input).to,
      metrics: this.sumMetrics(tenants.map((item) => item.metrics)),
      tenants,
    };
  }

  listTenantExportSchedules(tenantId: string) {
    return this.prisma.analyticsExportSchedule.findMany({
      include: { runs: { orderBy: { startedAt: "desc" }, take: 10 } },
      orderBy: { createdAt: "desc" },
      where: { tenantId },
    });
  }

  async createTenantExportSchedule(
    tenantId: string,
    input: CreateAnalyticsExportScheduleDto,
    actorId?: string,
  ) {
    await this.ensureTenantExists(tenantId);
    return this.createExportSchedule(
      { tenantId, scope: "TENANT" },
      input,
      actorId,
    );
  }

  async createPartnerExportSchedule(
    partnerId: string,
    input: CreateAnalyticsExportScheduleDto,
    actorId?: string,
  ) {
    await this.requirePartnerOperator(partnerId, actorId);
    return this.createExportSchedule(
      { partnerId, scope: "PARTNER" },
      input,
      actorId,
    );
  }

  async runTenantExport(
    tenantId: string,
    scheduleId: string,
    actorId?: string,
  ) {
    const schedule = await this.prisma.analyticsExportSchedule.findFirst({
      where: { id: scheduleId, tenantId },
    });
    if (!schedule)
      throw new NotFoundException("Analytics export schedule was not found");
    const report = await this.getTenantEnterpriseAnalytics(tenantId, {});
    const payload =
      schedule.format === "CSV"
        ? this.enterpriseCsv(report)
        : JSON.stringify(report);
    const checksum = createHash("sha256").update(payload).digest("hex");
    const completedAt = new Date();
    const run = await this.prisma.$transaction(async (tx) => {
      const value = await tx.analyticsExportRun.create({
        data: {
          scheduleId,
          tenantId,
          status: "DELIVERED",
          rowCount: report.tenants.reduce(
            (count, item) => count + 1 + (item.children?.length ?? 0),
            0,
          ),
          checksum,
          destination: schedule.destinationReference,
          completedAt,
        },
      });
      await tx.analyticsExportSchedule.update({
        where: { id: scheduleId },
        data: { nextRunAt: this.nextRun(completedAt, schedule.cadence) },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "analytics_export.deliver",
          object: "AnalyticsExportSchedule",
          objectId: scheduleId,
          outcome: "SUCCESS",
          reason: "Scheduled enterprise analytics delivery",
          newValue: {
            runId: value.id,
            checksum,
            destinationType: schedule.destinationType,
            rowCount: value.rowCount,
          },
        },
      });
      return value;
    });
    return { ...run, payload };
  }

  async runPartnerExport(
    partnerId: string,
    scheduleId: string,
    actorId?: string,
  ) {
    await this.requirePartnerOperator(partnerId, actorId);
    const schedule = await this.prisma.analyticsExportSchedule.findFirst({
      where: { id: scheduleId, partnerId },
    });
    if (!schedule)
      throw new NotFoundException("Analytics export schedule was not found");
    const report = await this.getPartnerEnterpriseAnalytics(
      partnerId,
      actorId,
      {},
    );
    const payload =
      schedule.format === "CSV"
        ? this.enterpriseCsv(report)
        : JSON.stringify(report);
    const checksum = createHash("sha256").update(payload).digest("hex");
    const completedAt = new Date();
    const run = await this.prisma.$transaction(async (tx) => {
      const value = await tx.analyticsExportRun.create({
        data: {
          scheduleId,
          status: "DELIVERED",
          rowCount: report.tenants.reduce(
            (count, item) => count + 1 + (item.children?.length ?? 0),
            0,
          ),
          checksum,
          destination: schedule.destinationReference,
          completedAt,
        },
      });
      await tx.analyticsExportSchedule.update({
        where: { id: scheduleId },
        data: { nextRunAt: this.nextRun(completedAt, schedule.cadence) },
      });
      return value;
    });
    return { ...run, payload };
  }

  private createExportSchedule(
    owner: { tenantId?: string; partnerId?: string; scope: string },
    input: CreateAnalyticsExportScheduleDto,
    actorId?: string,
  ) {
    const nextRunAt = new Date(input.nextRunAt);
    if (nextRunAt.getTime() < Date.now() - 60_000)
      throw new BadRequestException("nextRunAt cannot be in the past");
    return this.prisma.analyticsExportSchedule.create({
      data: {
        ...owner,
        name: input.name.trim(),
        cadence: input.cadence,
        format: input.format,
        destinationType: input.destinationType,
        destinationReference: input.destinationReference,
        enabled: input.enabled ?? true,
        nextRunAt,
        createdBy: actorId,
      },
    });
  }

  private async requirePartnerOperator(partnerId: string, actorId?: string) {
    const partner = await this.prisma.resellerPartner.findUnique({
      where: { id: partnerId },
    });
    if (!partner || partner.status !== "ACTIVE")
      throw new NotFoundException("Active reseller partner was not found");
    if (!actorId || !partner.operatorIds.includes(actorId))
      throw new NotFoundException("Active reseller partner was not found");
    return partner;
  }

  private async ensureTenantExists(tenantId: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUnique({
      select: {
        id: true,
      },
      where: {
        id: tenantId,
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} was not found`);
    }
  }

  private toDeviceInventoryRow(device: Device): DeviceInventoryReportRow {
    return {
      androidVersion: device.androidVersion,
      branchId: device.branchId,
      classId: device.classId,
      compliance: device.compliance,
      connectorDeviceName: device.connectorDeviceName,
      health: device.health,
      id: device.id,
      lastCheckInAt: device.lastCheckInAt?.toISOString() ?? null,
      manufacturer: device.manufacturer,
      mdmConnector: device.mdmConnector,
      model: device.model,
      policyVersion: device.policyVersion,
      serialNumber: device.serialNumber,
      status: device.status,
      studentId: device.studentId,
      tags: device.tags,
      complianceAssessment: assessAndroidCompliance({
        compliance: device.compliance,
        health: device.health,
        osVersion: device.androidVersion,
        status: device.status,
      }),
    };
  }

  private toAppDeploymentRow(
    app: AppCatalogItem,
    policyNames: string[],
    commands: RemoteCommand[],
  ): AppDeploymentReport["apps"][number] {
    return {
      appId: app.id,
      approvalStatus: app.approvalStatus,
      approvedGrades: app.approvedGrades,
      assignedPolicyCount: policyNames.length,
      category: app.category,
      failedDeploymentCount: this.countAppCommands(commands, app, [
        "FAILED",
        "EXPIRED",
      ]),
      name: app.name,
      packageId: app.packageId,
      policyNames,
      queuedCommandCount: this.countAppCommands(commands, app, [
        "QUEUED",
        "DELIVERED",
      ]),
      updatedAt: app.updatedAt.toISOString(),
    };
  }

  private countCommandsForPayloadMatch(
    commands: RemoteCommand[],
    key: string,
    value: string,
    statuses: string[],
  ): number {
    return commands.filter((command) => {
      const payload = this.jsonRecord(command.payload);

      return statuses.includes(command.status) && payload?.[key] === value;
    }).length;
  }

  private countAppCommands(
    commands: RemoteCommand[],
    app: Pick<AppCatalogItem, "id" | "packageId">,
    statuses: string[],
  ): number {
    return commands.filter((command) => {
      const payload = this.jsonRecord(command.payload);

      return (
        statuses.includes(command.status) &&
        (payload?.appId === app.id || payload?.packageId === app.packageId)
      );
    }).length;
  }

  private countBy<T>(
    values: T[],
    keySelector: (value: T) => string,
  ): Record<string, number> {
    return values.reduce<Record<string, number>>((counts, value) => {
      const key = keySelector(value);
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {});
  }

  private csvCell(value: unknown): string {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replaceAll('"', '""')}"`;
  }

  private jsonRecord(value: Prisma.JsonValue): Record<string, unknown> | null {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return null;
  }

  private reportDate(value: string, field: string): string {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestException(`${field} must be an ISO date`);
    }
    return value;
  }

  private eventCategory(
    value: Prisma.JsonValue | null,
    appCategories: Map<string, string>,
  ): string {
    const details = value ? this.jsonRecord(value) : null;
    return typeof details?.category === "string"
      ? details.category
      : typeof details?.provider === "string"
        ? details.provider
        : typeof details?.resourceId === "string"
          ? (appCategories.get(details.resourceId) ?? "APPROVED_RESOURCE")
          : "APPROVED_RESOURCE";
  }

  private analyticsRange(input: { from?: string; to?: string }) {
    const to = this.reportDate(
      input.to ?? new Date().toISOString().slice(0, 10),
      "to",
    );
    const defaultFrom = new Date(`${to}T00:00:00.000Z`);
    defaultFrom.setUTCDate(defaultFrom.getUTCDate() - 29);
    const from = this.reportDate(
      input.from ?? defaultFrom.toISOString().slice(0, 10),
      "from",
    );
    const startedAt = new Date(`${from}T00:00:00.000Z`);
    const endedAt = new Date(`${to}T23:59:59.999Z`);
    if (
      startedAt > endedAt ||
      endedAt.getTime() - startedAt.getTime() >= 366 * 86_400_000
    ) {
      throw new BadRequestException(
        "Analytics window must be ordered and no longer than 366 days",
      );
    }
    return { from, to, startedAt, endedAt };
  }

  private rate(numerator: number, denominator: number): number {
    return denominator === 0
      ? 0
      : Math.round((numerator / denominator) * 10_000) / 100;
  }

  private sumMetrics(
    values: EnterpriseAnalyticsMetrics[],
  ): EnterpriseAnalyticsMetrics {
    const totals = values.reduce(
      (sum, item) => ({
        devices: sum.devices + item.devices,
        compliantDevices: sum.compliantDevices + item.compliantDevices,
        attendanceRecords: sum.attendanceRecords + item.attendanceRecords,
        presentAttendance: sum.presentAttendance + item.presentAttendance,
        learningSessions: sum.learningSessions + item.learningSessions,
        openSupportTickets: sum.openSupportTickets + item.openSupportTickets,
        complianceRate: 0,
        attendanceRate: 0,
      }),
      {
        devices: 0,
        compliantDevices: 0,
        complianceRate: 0,
        attendanceRecords: 0,
        presentAttendance: 0,
        attendanceRate: 0,
        learningSessions: 0,
        openSupportTickets: 0,
      },
    );
    totals.complianceRate = this.rate(totals.compliantDevices, totals.devices);
    totals.attendanceRate = this.rate(
      totals.presentAttendance,
      totals.attendanceRecords,
    );
    return totals;
  }

  private enterpriseCsv(report: EnterpriseAnalyticsReport): string {
    const header = [
      "tenant_id",
      "tenant_name",
      "branch_id",
      "branch_name",
      "devices",
      "compliance_rate",
      "attendance_rate",
      "learning_sessions",
      "open_support_tickets",
    ];
    const rows = report.tenants.flatMap((tenant) =>
      (tenant.children?.length ? tenant.children : [tenant]).map((node) => [
        tenant.id,
        tenant.name,
        node.level === "BRANCH" ? node.id : "",
        node.level === "BRANCH" ? node.name : "",
        node.metrics.devices,
        node.metrics.complianceRate,
        node.metrics.attendanceRate,
        node.metrics.learningSessions,
        node.metrics.openSupportTickets,
      ]),
    );
    return [header, ...rows]
      .map((row) => row.map((cell) => this.csvCell(cell)).join(","))
      .join("\n");
  }

  private nextRun(from: Date, cadence: string): Date {
    const value = new Date(from);
    if (cadence === "DAILY") value.setUTCDate(value.getUTCDate() + 1);
    else if (cadence === "WEEKLY") value.setUTCDate(value.getUTCDate() + 7);
    else value.setUTCMonth(value.getUTCMonth() + 1);
    return value;
  }
}
