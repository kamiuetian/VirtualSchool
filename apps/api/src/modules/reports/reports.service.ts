import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AppDeploymentReport,
  DeviceInventoryReport,
  DeviceInventoryReportRow,
  PolicyDeploymentReport,
  PolicyRuleSet,
  PolicyStatus,
} from "@virtual-school/shared";
import {
  Prisma,
  type AppCatalogItem,
  type Device,
} from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";

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

    const policies = await this.prisma.policy.findMany({
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
    });
    const rows = policies.map((policy) => ({
      activeAssignmentCount: policy.assignments.filter(
        (assignment) => assignment.active,
      ).length,
      assignmentCount: policy.assignments.length,
      latestVersionSummary: policy.versions[0]?.summary ?? null,
      name: policy.name,
      policyId: policy.id,
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
        policies: rows.length,
        published: rows.filter((row) => row.status === "PUBLISHED").length,
      },
    };
  }

  async getAppDeploymentReport(tenantId: string): Promise<AppDeploymentReport> {
    await this.ensureTenantExists(tenantId);

    const [apps, policies] = await Promise.all([
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
      },
    };
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
    };
  }

  private toAppDeploymentRow(
    app: AppCatalogItem,
    policyNames: string[],
  ): AppDeploymentReport["apps"][number] {
    return {
      appId: app.id,
      approvalStatus: app.approvalStatus,
      approvedGrades: app.approvedGrades,
      assignedPolicyCount: policyNames.length,
      category: app.category,
      name: app.name,
      packageId: app.packageId,
      policyNames,
      updatedAt: app.updatedAt.toISOString(),
    };
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
}
