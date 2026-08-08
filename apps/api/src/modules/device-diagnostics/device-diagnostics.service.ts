import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  DeviceAlertSeverity,
  DeviceAlertStatus,
  DeviceAlertSummary,
  DeviceAlertType,
  DeviceDiagnosticSummary,
  DeviceDiagnosticUploadResult,
  DeviceSummary,
  OfflineAlertScanSummary,
} from "@virtual-school/shared";
import {
  type Device,
  type DeviceAlert,
  type DeviceDiagnostic,
  Prisma,
} from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import type { AlertActionDto } from "./dto/alert-action.dto";
import type { OfflineAlertScanDto } from "./dto/offline-alert-scan.dto";
import type { UploadDeviceDiagnosticDto } from "./dto/upload-device-diagnostic.dto";

const healthyValues = new Set(["CHECKED_IN", "OK", "HEALTHY", "UNKNOWN"]);
const compliantValues = new Set(["COMPLIANT", "UNKNOWN"]);

type DiagnosticAlertEvent = {
  type: DeviceAlertType;
  severity: DeviceAlertSeverity;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
};

@Injectable()
export class DeviceDiagnosticsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listDeviceDiagnostics(
    tenantId: string,
    deviceId: string,
    limit = 25,
  ): Promise<DeviceDiagnosticSummary[]> {
    await this.ensureDevice(tenantId, deviceId);

    const diagnostics = await this.prisma.deviceDiagnostic.findMany({
      orderBy: {
        reportedAt: "desc",
      },
      take: Math.min(Math.max(limit, 1), 100),
      where: {
        deviceId,
        tenantId,
      },
    });

    return diagnostics.map((diagnostic) =>
      this.toDiagnosticSummary(diagnostic),
    );
  }

  async uploadDeviceDiagnostic(
    tenantId: string,
    deviceId: string,
    input: UploadDeviceDiagnosticDto,
  ): Promise<DeviceDiagnosticUploadResult> {
    const device = await this.ensureDevice(tenantId, deviceId);
    const reportedAt = input.reportedAt
      ? new Date(input.reportedAt)
      : new Date();
    const alertEvents = this.evaluateDiagnosticAlerts(input);

    const result = await this.prisma.$transaction(async (tx) => {
      const diagnostic = await tx.deviceDiagnostic.create({
        data: {
          batteryLevel: input.batteryLevel,
          browserVersion: input.browserVersion,
          compliance: input.compliance,
          details: input.details as Prisma.InputJsonValue | undefined,
          deviceId,
          health: input.health,
          launcherVersion: input.launcherVersion,
          mdmPolicyName: input.mdmPolicyName,
          networkStatus: input.networkStatus,
          policyVersion: input.policyVersion,
          reportedAt,
          storageFreeMb: input.storageFreeMb,
          tenantId,
        },
      });

      const updatedDevice = await tx.device.update({
        data: {
          compliance: input.compliance ?? device.compliance,
          health: input.health ?? device.health,
          lastCheckInAt: reportedAt,
          policyVersion: input.policyVersion ?? device.policyVersion,
          status: device.status === "PENDING" ? "ONLINE" : device.status,
        },
        where: {
          id: device.id,
        },
      });

      const alerts: DeviceAlert[] = [];
      const resolvedAlertIds: string[] = [];

      for (const event of alertEvents.toOpen) {
        alerts.push(
          await this.openOrRefreshAlert(tx, tenantId, deviceId, event),
        );
      }

      for (const type of alertEvents.toResolve) {
        const resolvedIds = await this.resolveOpenAlertsByType(
          tx,
          tenantId,
          deviceId,
          type,
          "Diagnostic returned to normal",
        );
        resolvedAlertIds.push(...resolvedIds);
      }

      await tx.auditEvent.create({
        data: {
          action: "device_diagnostic.upload",
          newValue: {
            alertCount: alerts.length,
            batteryLevel: diagnostic.batteryLevel,
            compliance: diagnostic.compliance,
            health: diagnostic.health,
            reportedAt: diagnostic.reportedAt,
            resolvedAlertCount: resolvedAlertIds.length,
            storageFreeMb: diagnostic.storageFreeMb,
          },
          object: "DeviceDiagnostic",
          objectId: diagnostic.id,
          outcome: "RECORDED",
          tenantId,
        },
      });

      return {
        alerts,
        diagnostic,
        device: updatedDevice,
        resolvedAlertIds,
      };
    });

    return {
      alerts: result.alerts.map((alert) => this.toAlertSummary(alert)),
      device: this.toDeviceSummary(result.device),
      diagnostic: this.toDiagnosticSummary(result.diagnostic),
      resolvedAlertIds: result.resolvedAlertIds,
    };
  }

  async listAlerts(
    tenantId: string,
    filters: {
      status?: string;
      severity?: string;
      deviceId?: string;
      limit?: number;
    } = {},
  ): Promise<DeviceAlertSummary[]> {
    await this.ensureTenantExists(tenantId);

    const alerts = await this.prisma.deviceAlert.findMany({
      orderBy: [
        {
          status: "asc",
        },
        {
          lastSeenAt: "desc",
        },
      ],
      take: Math.min(Math.max(filters.limit ?? 50, 1), 200),
      where: {
        deviceId: filters.deviceId,
        severity: filters.severity,
        status: filters.status,
        tenantId,
      },
    });

    return alerts.map((alert) => this.toAlertSummary(alert));
  }

  async acknowledgeAlert(
    tenantId: string,
    alertId: string,
    input: AlertActionDto,
    actorId: string | undefined,
  ): Promise<DeviceAlertSummary> {
    const alert = await this.ensureAlert(tenantId, alertId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.deviceAlert.update({
        data: {
          acknowledgedAt: new Date(),
          acknowledgedBy: actorId,
          status: "ACKNOWLEDGED",
        },
        where: {
          id: alert.id,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "device_alert.acknowledge",
          actorId,
          newValue: {
            status: saved.status,
          },
          object: "DeviceAlert",
          objectId: saved.id,
          oldValue: {
            status: alert.status,
          },
          outcome: "ACKNOWLEDGED",
          reason: input.reason,
          tenantId,
        },
      });

      return saved;
    });

    return this.toAlertSummary(updated);
  }

  async resolveAlert(
    tenantId: string,
    alertId: string,
    input: AlertActionDto,
    actorId: string | undefined,
  ): Promise<DeviceAlertSummary> {
    const alert = await this.ensureAlert(tenantId, alertId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.deviceAlert.update({
        data: {
          resolutionNote: input.reason,
          resolvedAt: new Date(),
          resolvedBy: actorId,
          status: "RESOLVED",
        },
        where: {
          id: alert.id,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "device_alert.resolve",
          actorId,
          newValue: {
            resolutionNote: saved.resolutionNote,
            status: saved.status,
          },
          object: "DeviceAlert",
          objectId: saved.id,
          oldValue: {
            status: alert.status,
          },
          outcome: "RESOLVED",
          reason: input.reason,
          tenantId,
        },
      });

      return saved;
    });

    return this.toAlertSummary(updated);
  }

  async scanOfflineAlerts(
    tenantId: string,
    input: OfflineAlertScanDto,
  ): Promise<OfflineAlertScanSummary> {
    await this.ensureTenantExists(tenantId);

    const offlineAfterMinutes = input.offlineAfterMinutes ?? 60;
    const cutoff = new Date(Date.now() - offlineAfterMinutes * 60_000);
    const devices = await this.prisma.device.findMany({
      where: {
        tenantId,
        status: {
          notIn: ["RETIRED", "ENROLLMENT_FAILED"],
        },
        OR: [
          {
            lastCheckInAt: null,
          },
          {
            lastCheckInAt: {
              lt: cutoff,
            },
          },
        ],
      },
    });

    const alerts = await this.prisma.$transaction(async (tx) => {
      const savedAlerts: DeviceAlert[] = [];

      for (const device of devices) {
        savedAlerts.push(
          await this.openOrRefreshAlert(tx, tenantId, device.id, {
            message: `Device ${device.serialNumber} has not checked in since ${device.lastCheckInAt?.toISOString() ?? "enrollment"}.`,
            metadata: {
              lastCheckInAt: device.lastCheckInAt?.toISOString() ?? null,
              offlineAfterMinutes,
              serialNumber: device.serialNumber,
            },
            severity: "WARNING",
            title: "Device offline",
            type: "DEVICE_OFFLINE",
          }),
        );
      }

      await tx.auditEvent.create({
        data: {
          action: "device_alert.offline_scan",
          newValue: {
            alertsCreatedOrUpdated: savedAlerts.length,
            evaluatedDevices: devices.length,
            offlineAfterMinutes,
          },
          object: "DeviceAlert",
          outcome: "SUCCESS",
          tenantId,
        },
      });

      return savedAlerts;
    });

    return {
      alerts: alerts.map((alert) => this.toAlertSummary(alert)),
      alertsCreatedOrUpdated: alerts.length,
      evaluatedDevices: devices.length,
      offlineAfterMinutes,
      tenantId,
    };
  }

  private evaluateDiagnosticAlerts(input: UploadDeviceDiagnosticDto): {
    toOpen: DiagnosticAlertEvent[];
    toResolve: DeviceAlertType[];
  } {
    const toOpen: DiagnosticAlertEvent[] = [];
    const toResolve: DeviceAlertType[] = [];

    if (input.batteryLevel !== undefined) {
      if (input.batteryLevel <= 20) {
        toOpen.push({
          message: `Battery level is ${input.batteryLevel}%.`,
          metadata: {
            batteryLevel: input.batteryLevel,
          },
          severity: input.batteryLevel <= 10 ? "CRITICAL" : "WARNING",
          title: "Battery low",
          type: "BATTERY_LOW",
        });
      } else {
        toResolve.push("BATTERY_LOW");
      }
    }

    if (input.storageFreeMb !== undefined) {
      if (input.storageFreeMb <= 1024) {
        toOpen.push({
          message: `Free storage is ${input.storageFreeMb} MB.`,
          metadata: {
            storageFreeMb: input.storageFreeMb,
          },
          severity: input.storageFreeMb <= 256 ? "CRITICAL" : "WARNING",
          title: "Storage low",
          type: "STORAGE_LOW",
        });
      } else {
        toResolve.push("STORAGE_LOW");
      }
    }

    if (input.compliance && !compliantValues.has(input.compliance)) {
      toOpen.push({
        message: `Device compliance is ${input.compliance}.`,
        metadata: {
          compliance: input.compliance,
        },
        severity: "WARNING",
        title: "Device non-compliant",
        type: "DEVICE_NON_COMPLIANT",
      });
    } else if (input.compliance) {
      toResolve.push("DEVICE_NON_COMPLIANT");
    }

    if (input.health && !healthyValues.has(input.health)) {
      toOpen.push({
        message: `Device health is ${input.health}.`,
        metadata: {
          health: input.health,
        },
        severity: "WARNING",
        title: "Device health issue",
        type: "DEVICE_UNHEALTHY",
      });
    } else if (input.health) {
      toResolve.push("DEVICE_UNHEALTHY");
    }

    if (input.networkStatus && input.networkStatus !== "OFFLINE") {
      toResolve.push("DEVICE_OFFLINE");
    }

    return {
      toOpen,
      toResolve,
    };
  }

  private async openOrRefreshAlert(
    tx: Prisma.TransactionClient,
    tenantId: string,
    deviceId: string,
    input: {
      type: DeviceAlertType;
      severity: DeviceAlertSeverity;
      title: string;
      message: string;
      metadata: Record<string, unknown>;
    },
  ): Promise<DeviceAlert> {
    const existing = await tx.deviceAlert.findFirst({
      where: {
        deviceId,
        status: {
          in: ["OPEN", "ACKNOWLEDGED"],
        },
        tenantId,
        type: input.type,
      },
    });

    if (existing) {
      return tx.deviceAlert.update({
        data: {
          lastSeenAt: new Date(),
          message: input.message,
          metadata: input.metadata as Prisma.InputJsonValue,
          severity: input.severity,
          status: "OPEN",
          title: input.title,
        },
        where: {
          id: existing.id,
        },
      });
    }

    return tx.deviceAlert.create({
      data: {
        deviceId,
        message: input.message,
        metadata: input.metadata as Prisma.InputJsonValue,
        severity: input.severity,
        source: "DIAGNOSTIC",
        tenantId,
        title: input.title,
        type: input.type,
      },
    });
  }

  private async resolveOpenAlertsByType(
    tx: Prisma.TransactionClient,
    tenantId: string,
    deviceId: string,
    type: DeviceAlertType,
    note: string,
  ): Promise<string[]> {
    const alerts = await tx.deviceAlert.findMany({
      select: {
        id: true,
      },
      where: {
        deviceId,
        status: {
          in: ["OPEN", "ACKNOWLEDGED"],
        },
        tenantId,
        type,
      },
    });

    if (alerts.length === 0) {
      return [];
    }

    await tx.deviceAlert.updateMany({
      data: {
        resolutionNote: note,
        resolvedAt: new Date(),
        status: "RESOLVED",
      },
      where: {
        id: {
          in: alerts.map((alert) => alert.id),
        },
      },
    });

    return alerts.map((alert) => alert.id);
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

  private async ensureDevice(
    tenantId: string,
    deviceId: string,
  ): Promise<Device> {
    const device = await this.prisma.device.findFirst({
      where: {
        id: deviceId,
        tenantId,
      },
    });

    if (!device) {
      throw new NotFoundException(
        `Device ${deviceId} was not found for tenant ${tenantId}`,
      );
    }

    return device;
  }

  private async ensureAlert(
    tenantId: string,
    alertId: string,
  ): Promise<DeviceAlert> {
    const alert = await this.prisma.deviceAlert.findFirst({
      where: {
        id: alertId,
        tenantId,
      },
    });

    if (!alert) {
      throw new NotFoundException(
        `Alert ${alertId} was not found for tenant ${tenantId}`,
      );
    }

    return alert;
  }

  private toDiagnosticSummary(
    diagnostic: DeviceDiagnostic,
  ): DeviceDiagnosticSummary {
    return {
      batteryLevel: diagnostic.batteryLevel,
      browserVersion: diagnostic.browserVersion,
      compliance: diagnostic.compliance,
      createdAt: diagnostic.createdAt.toISOString(),
      details: this.jsonRecord(diagnostic.details),
      deviceId: diagnostic.deviceId,
      health: diagnostic.health,
      id: diagnostic.id,
      launcherVersion: diagnostic.launcherVersion,
      mdmPolicyName: diagnostic.mdmPolicyName,
      networkStatus: diagnostic.networkStatus,
      policyVersion: diagnostic.policyVersion,
      reportedAt: diagnostic.reportedAt.toISOString(),
      storageFreeMb: diagnostic.storageFreeMb,
      tenantId: diagnostic.tenantId,
    };
  }

  private toAlertSummary(alert: DeviceAlert): DeviceAlertSummary {
    return {
      acknowledgedAt: alert.acknowledgedAt?.toISOString() ?? null,
      acknowledgedBy: alert.acknowledgedBy,
      createdAt: alert.createdAt.toISOString(),
      deviceId: alert.deviceId,
      firstSeenAt: alert.firstSeenAt.toISOString(),
      id: alert.id,
      lastSeenAt: alert.lastSeenAt.toISOString(),
      message: alert.message,
      metadata: this.jsonRecord(alert.metadata),
      resolutionNote: alert.resolutionNote,
      resolvedAt: alert.resolvedAt?.toISOString() ?? null,
      resolvedBy: alert.resolvedBy,
      severity: alert.severity as DeviceAlertSeverity,
      source: alert.source,
      status: alert.status as DeviceAlertStatus,
      tenantId: alert.tenantId,
      title: alert.title,
      type: alert.type as DeviceAlertType,
      updatedAt: alert.updatedAt.toISOString(),
    };
  }

  private toDeviceSummary(device: Device): DeviceSummary {
    return {
      androidVersion: device.androidVersion,
      branchId: device.branchId,
      classId: device.classId,
      compliance: device.compliance,
      connectorDeviceName: device.connectorDeviceName,
      enrollmentBatchId: device.enrollmentBatchId,
      enrollmentId: device.enrollmentId,
      health: device.health,
      id: device.id,
      lastCheckInAt: device.lastCheckInAt?.toISOString() ?? null,
      manufacturer: device.manufacturer,
      mdmConnector: device.mdmConnector,
      model: device.model,
      platform: "ANDROID",
      provider: device.mdmConnector,
      osVersion: device.androidVersion,
      enrollmentType: device.enrollmentId ? "FULLY_MANAGED" : "UNKNOWN",
      ownershipType: "SCHOOL_OWNED",
      policyVersion: device.policyVersion,
      serialNumber: device.serialNumber,
      status: device.status,
      studentId: device.studentId,
      tags: device.tags,
      tenantId: device.tenantId,
      supportedControls: ["kiosk", "web-filter", "app-deployment", "remote-lock", "remote-wipe"],
      unsupportedControls: ["hardware-reset-block"],
    };
  }

  private jsonRecord(value: Prisma.JsonValue): Record<string, unknown> | null {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return null;
  }
}
