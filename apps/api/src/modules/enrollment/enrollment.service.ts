import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  DeviceCheckInResult,
  DeviceHistory,
  DeviceSummary,
  EnrollmentBatchSummary,
  ProcurementBatchSummary,
  DeviceReplacementSummary,
  PlatformCapabilityCatalog,
} from "@virtual-school/shared";
import { randomBytes } from "node:crypto";
import type {
  Device,
  EnrollmentBatch,
  EnrollmentBatchStatus,
} from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import type { AssignDeviceDto } from "./dto/assign-device.dto";
import type { CreateEnrollmentBatchDto } from "./dto/create-enrollment-batch.dto";
import type { DeviceCheckInDto } from "./dto/device-check-in.dto";
import type { ListDevicesDto } from "./dto/list-devices.dto";
import type {
  AdvanceProcurementBatchDto,
  CreateProcurementBatchDto,
  LinkProcurementDeviceDto,
  RecordRmaDto,
  ReplaceDeviceDto,
} from "./dto/procurement.dto";
import {
  androidControlSummary,
  assessAndroidCompliance,
  platformCapabilityCatalog,
} from "./device-capability.catalog";

@Injectable()
export class EnrollmentService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listEnrollmentBatches(
    tenantId: string,
  ): Promise<EnrollmentBatchSummary[]> {
    await this.ensureTenantExists(tenantId);

    const batches = await this.prisma.enrollmentBatch.findMany({
      orderBy: {
        createdAt: "desc",
      },
      where: {
        tenantId,
      },
    });

    return batches.map((batch) => this.toEnrollmentBatchSummary(batch));
  }

  async createEnrollmentBatch(
    tenantId: string,
    input: CreateEnrollmentBatchDto,
  ): Promise<EnrollmentBatchSummary> {
    await this.ensureTenantExists(tenantId);

    const token = `enroll_${randomBytes(24).toString("base64url")}`;
    const qrPayload = {
      connector: "android-management-api",
      enrollmentToken: token,
      intendedOwnership: "SCHOOL_OWNED",
      tenantId,
    };

    const batch = await this.prisma.$transaction(async (tx) => {
      const created = await tx.enrollmentBatch.create({
        data: {
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
          maxDevices: input.maxDevices,
          name: input.name,
          qrPayload,
          tenantId,
          token,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "enrollment_batch.create",
          newValue: {
            expiresAt: created.expiresAt,
            maxDevices: created.maxDevices,
            name: created.name,
            status: created.status,
          },
          object: "EnrollmentBatch",
          objectId: created.id,
          outcome: "SUCCESS",
          tenantId,
        },
      });

      return created;
    });

    return this.toEnrollmentBatchSummary(batch);
  }

  async listProcurementBatches(
    tenantId: string,
  ): Promise<ProcurementBatchSummary[]> {
    await this.ensureTenantExists(tenantId);
    const batches = await this.prisma.procurementBatch.findMany({
      include: { items: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
      where: { tenantId },
    });
    return batches.map((batch) => this.toProcurementBatchSummary(batch));
  }

  async createProcurementBatch(
    tenantId: string,
    input: CreateProcurementBatchDto,
  ): Promise<ProcurementBatchSummary> {
    await this.ensureTenantExists(tenantId);
    const serialNumbers = [
      ...new Set(
        (input.serialNumbers ?? [])
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ];
    if (serialNumbers.length > input.expectedDevices)
      throw new BadRequestException(
        "Serial number count exceeds expected devices",
      );
    const created = await this.prisma.$transaction(async (tx) => {
      const batch = await tx.procurementBatch.create({
        data: {
          tenantId,
          reference: input.reference.trim(),
          vendor: input.vendor.trim(),
          purchaseDate: new Date(input.purchaseDate),
          expectedDevices: input.expectedDevices,
          notes: input.notes,
          items: serialNumbers.length
            ? {
                create: serialNumbers.map((serialNumber) => ({
                  tenantId,
                  serialNumber,
                })),
              }
            : undefined,
        },
        include: { items: true },
      });
      await tx.auditEvent.create({
        data: {
          action: "procurement_batch.create",
          object: "ProcurementBatch",
          objectId: batch.id,
          outcome: "SUCCESS",
          tenantId,
          newValue: {
            reference: batch.reference,
            vendor: batch.vendor,
            expectedDevices: batch.expectedDevices,
            serialNumbers,
          },
        },
      });
      return batch;
    });
    return this.toProcurementBatchSummary(created);
  }

  async advanceProcurementBatch(
    tenantId: string,
    batchId: string,
    input: AdvanceProcurementBatchDto,
  ): Promise<ProcurementBatchSummary> {
    const batch = await this.prisma.procurementBatch.findFirst({
      where: { id: batchId, tenantId },
    });
    if (!batch) throw new NotFoundException("Procurement batch was not found");
    const order = [
      "PURCHASED",
      "RECEIVED",
      "ENROLLING",
      "READY",
      "SHIPPED",
      "ASSIGNED",
      "CLOSED",
    ];
    if (order.indexOf(input.status) !== order.indexOf(batch.status) + 1)
      throw new BadRequestException(
        `Batch must advance from ${batch.status} to ${order[order.indexOf(batch.status) + 1] ?? "no further state"}`,
      );
    if (
      input.status === "SHIPPED" &&
      (!input.shippingCarrier || !input.trackingNumber || !input.destination)
    )
      throw new BadRequestException(
        "Shipment carrier, tracking number, and destination are required",
      );
    const saved = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.procurementBatch.update({
        where: { id: batchId },
        data: {
          status: input.status,
          shippingCarrier: input.shippingCarrier,
          trackingNumber: input.trackingNumber,
          destination: input.destination,
        },
        include: { items: { orderBy: { createdAt: "asc" } } },
      });
      await tx.procurementDevice.updateMany({
        where: { batchId, tenantId, status: batch.status },
        data: { status: input.status },
      });
      await tx.auditEvent.create({
        data: {
          action: "procurement_batch.advance",
          object: "ProcurementBatch",
          objectId: batchId,
          outcome: "SUCCESS",
          tenantId,
          reason: input.reason,
          oldValue: { status: batch.status },
          newValue: {
            status: input.status,
            trackingNumber: input.trackingNumber,
            destination: input.destination,
          },
        },
      });
      return updated;
    });
    return this.toProcurementBatchSummary(saved);
  }

  async linkProcurementDevice(
    tenantId: string,
    batchId: string,
    itemId: string,
    input: LinkProcurementDeviceDto,
  ): Promise<ProcurementBatchSummary> {
    const [item, device] = await Promise.all([
      this.prisma.procurementDevice.findFirst({
        where: { id: itemId, batchId, tenantId },
      }),
      this.prisma.device.findFirst({ where: { id: input.deviceId, tenantId } }),
    ]);
    if (!item || !device)
      throw new NotFoundException(
        "Procurement item or tenant device was not found",
      );
    if (item.serialNumber !== device.serialNumber)
      throw new BadRequestException(
        "Procurement and enrolled device serial numbers do not match",
      );
    await this.prisma.$transaction(async (tx) => {
      await tx.procurementDevice.update({
        where: { id: itemId },
        data: { deviceId: device.id, status: "ENROLLING" },
      });
      await tx.deviceCustodyEvent.create({
        data: {
          tenantId,
          deviceId: device.id,
          type: "ENROLLED",
          fromHolder: item.batchId,
          toHolder: "TENANT_INVENTORY",
          reason: input.reason,
          reference: item.id,
        },
      });
      await tx.auditEvent.create({
        data: {
          action: "procurement_device.link",
          object: "ProcurementDevice",
          objectId: item.id,
          outcome: "SUCCESS",
          tenantId,
          reason: input.reason,
          newValue: { deviceId: device.id, serialNumber: device.serialNumber },
        },
      });
    });
    return (await this.listProcurementBatches(tenantId)).find(
      (value) => value.id === batchId,
    )!;
  }

  async recordProcurementRma(
    tenantId: string,
    batchId: string,
    itemId: string,
    input: RecordRmaDto,
  ): Promise<ProcurementBatchSummary> {
    const item = await this.prisma.procurementDevice.findFirst({
      where: { id: itemId, batchId, tenantId },
    });
    if (!item) throw new NotFoundException("Procurement item was not found");
    await this.prisma.$transaction(async (tx) => {
      await tx.procurementDevice.update({
        where: { id: itemId },
        data: {
          status: input.status,
          rmaNumber: input.rmaNumber,
          rmaReason: input.reason,
        },
      });
      if (item.deviceId)
        await tx.deviceCustodyEvent.create({
          data: {
            tenantId,
            deviceId: item.deviceId,
            type: input.status,
            fromHolder:
              input.status === "RMA_SHIPPED" ? "TENANT_INVENTORY" : undefined,
            toHolder: input.status === "RMA_SHIPPED" ? "VENDOR" : undefined,
            reason: input.reason,
            reference: input.rmaNumber,
          },
        });
      await tx.auditEvent.create({
        data: {
          action: "procurement_device.rma",
          object: "ProcurementDevice",
          objectId: itemId,
          outcome: "SUCCESS",
          tenantId,
          reason: input.reason,
          oldValue: { status: item.status },
          newValue: { status: input.status, rmaNumber: input.rmaNumber },
        },
      });
    });
    return (await this.listProcurementBatches(tenantId)).find(
      (value) => value.id === batchId,
    )!;
  }

  async replaceDevice(
    tenantId: string,
    originalDeviceId: string,
    input: ReplaceDeviceDto,
  ): Promise<DeviceReplacementSummary> {
    if (originalDeviceId === input.replacementDeviceId)
      throw new BadRequestException("A device cannot replace itself");
    const [original, replacement] = await Promise.all([
      this.findDevice(tenantId, originalDeviceId),
      this.findDevice(tenantId, input.replacementDeviceId),
    ]);
    if (original.status === "RETIRED" || replacement.status === "RETIRED")
      throw new BadRequestException(
        "Retired devices cannot participate in replacement",
      );
    if (replacement.studentId || replacement.classId)
      throw new BadRequestException("Replacement device must be unassigned");
    const result = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.deviceAssignment.updateMany({
        where: { tenantId, deviceId: original.id, endedAt: null },
        data: { endedAt: now },
      });
      await tx.device.update({
        where: { id: original.id },
        data: {
          status: "RETIRED",
          studentId: null,
          classId: null,
          branchId: null,
          policyVersion: null,
        },
      });
      await tx.device.update({
        where: { id: replacement.id },
        data: {
          studentId: original.studentId,
          classId: original.classId,
          branchId: original.branchId,
          status: original.status,
          tags: original.tags,
        },
      });
      if (original.studentId || original.classId || original.branchId)
        await tx.deviceAssignment.create({
          data: {
            tenantId,
            deviceId: replacement.id,
            studentId: original.studentId,
            classId: original.classId,
            branchId: original.branchId,
            reason: `Replacement for ${original.serialNumber}: ${input.reason}`,
          },
        });
      const created = await tx.deviceReplacement.create({
        data: {
          tenantId,
          originalDeviceId: original.id,
          replacementDeviceId: replacement.id,
          reason: input.reason,
          rmaNumber: input.rmaNumber,
        },
      });
      await tx.deviceLifecycleEvent.create({
        data: {
          tenantId,
          deviceId: original.id,
          type: "REPLACED",
          reason: input.reason,
          oldValue: { status: original.status, studentId: original.studentId },
          newValue: { status: "RETIRED", replacementDeviceId: replacement.id },
        },
      });
      await tx.deviceCustodyEvent.create({
        data: {
          tenantId,
          deviceId: original.id,
          type: "REPLACED_OUT",
          fromHolder:
            original.studentId ?? original.branchId ?? "TENANT_INVENTORY",
          toHolder: input.rmaNumber ? "RMA" : "TENANT_INVENTORY",
          reason: input.reason,
          reference: input.rmaNumber ?? created.id,
        },
      });
      await tx.deviceCustodyEvent.create({
        data: {
          tenantId,
          deviceId: replacement.id,
          type: "REPLACED_IN",
          fromHolder: "TENANT_INVENTORY",
          toHolder:
            original.studentId ?? original.branchId ?? "TENANT_INVENTORY",
          reason: input.reason,
          reference: created.id,
        },
      });
      const supportBody = `Device ${original.serialNumber} was replaced by ${replacement.serialNumber}. ${input.reason}${input.rmaNumber ? ` RMA: ${input.rmaNumber}.` : ""}`;
      await tx.supportNote.create({
        data: {
          tenantId,
          deviceId: original.id,
          category: "HARDWARE",
          severity: "S2",
          body: supportBody,
          status: "RESOLVED",
          resolution: "Replacement issued",
        },
      });
      await tx.supportNote.create({
        data: {
          tenantId,
          deviceId: replacement.id,
          category: "HARDWARE",
          severity: "S3",
          body: supportBody,
        },
      });
      await tx.auditEvent.create({
        data: {
          action: "device.replace",
          object: "DeviceReplacement",
          objectId: created.id,
          outcome: "SUCCESS",
          tenantId,
          reason: input.reason,
          oldValue: { deviceId: original.id, studentId: original.studentId },
          newValue: {
            deviceId: replacement.id,
            studentId: original.studentId,
            rmaNumber: input.rmaNumber,
          },
        },
      });
      return created;
    });
    return {
      id: result.id,
      originalDeviceId: result.originalDeviceId,
      replacementDeviceId: result.replacementDeviceId,
      reason: result.reason,
      rmaNumber: result.rmaNumber,
      createdAt: result.createdAt.toISOString(),
    };
  }

  private toProcurementBatchSummary(batch: any): ProcurementBatchSummary {
    return {
      id: batch.id,
      tenantId: batch.tenantId,
      reference: batch.reference,
      vendor: batch.vendor,
      purchaseDate: batch.purchaseDate.toISOString(),
      expectedDevices: batch.expectedDevices,
      status: batch.status,
      shippingCarrier: batch.shippingCarrier,
      trackingNumber: batch.trackingNumber,
      destination: batch.destination,
      notes: batch.notes,
      createdAt: batch.createdAt.toISOString(),
      updatedAt: batch.updatedAt.toISOString(),
      items: (batch.items ?? []).map((item: any) => ({
        id: item.id,
        deviceId: item.deviceId,
        serialNumber: item.serialNumber,
        status: item.status,
        rmaNumber: item.rmaNumber,
        rmaReason: item.rmaReason,
      })),
    };
  }

  async listDevices(
    tenantId: string,
    filters: ListDevicesDto = {},
  ): Promise<DeviceSummary[]> {
    await this.ensureTenantExists(tenantId);

    const devices = await this.prisma.device.findMany({
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      where: {
        tenantId,
      },
    });

    return devices
      .map((device) => this.toDeviceSummary(device))
      .filter(
        (device) =>
          (!filters.platform || device.platform === filters.platform) &&
          (!filters.provider || device.provider === filters.provider) &&
          (!filters.compliance || device.compliance === filters.compliance) &&
          (!filters.enrollmentType ||
            device.enrollmentType === filters.enrollmentType) &&
          (!filters.ownershipType ||
            device.ownershipType === filters.ownershipType) &&
          (!filters.osLifecycle ||
            device.complianceAssessment.osLifecycle === filters.osLifecycle),
      );
  }

  listDeviceCapabilities(): PlatformCapabilityCatalog[] {
    return platformCapabilityCatalog;
  }

  async recordDeviceCheckIn(
    tenantId: string,
    input: DeviceCheckInDto,
  ): Promise<DeviceCheckInResult> {
    await this.ensureTenantExists(tenantId);

    const batch = await this.prisma.enrollmentBatch.findFirst({
      where: {
        status: "ACTIVE",
        tenantId,
        token: input.enrollmentToken,
      },
    });

    if (!batch) {
      throw new NotFoundException(
        "Enrollment token was not found or is no longer active",
      );
    }

    if (batch.expiresAt && batch.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException("Enrollment token has expired");
    }

    const existing = await this.prisma.device.findUnique({
      where: {
        tenantId_serialNumber: {
          serialNumber: input.serialNumber,
          tenantId,
        },
      },
    });

    if (
      existing?.enrollmentId &&
      input.enrollmentId &&
      existing.enrollmentId !== input.enrollmentId
    ) {
      throw new ConflictException(
        "Device serial number is already linked to another enrollment",
      );
    }

    if (
      !existing &&
      batch.maxDevices &&
      batch.enrolledCount >= batch.maxDevices
    ) {
      throw new BadRequestException(
        "Enrollment batch capacity has been reached",
      );
    }

    const device = await this.prisma.$transaction(async (tx) => {
      const saved = existing
        ? await tx.device.update({
            data: {
              androidVersion: input.androidVersion,
              connectorDeviceName:
                input.connectorDeviceName ?? existing.connectorDeviceName,
              enrollmentBatchId: batch.id,
              enrollmentId: input.enrollmentId ?? existing.enrollmentId,
              health: "CHECKED_IN",
              lastCheckInAt: new Date(),
              manufacturer: input.manufacturer,
              model: input.model,
              tags: input.tags ?? existing.tags,
            },
            where: {
              id: existing.id,
            },
          })
        : await tx.device.create({
            data: {
              androidVersion: input.androidVersion,
              connectorDeviceName: input.connectorDeviceName,
              enrollmentBatchId: batch.id,
              enrollmentId: input.enrollmentId,
              health: "CHECKED_IN",
              lastCheckInAt: new Date(),
              manufacturer: input.manufacturer,
              model: input.model,
              serialNumber: input.serialNumber,
              status: "PENDING",
              tags: input.tags ?? [],
              tenantId,
            },
          });

      if (!existing) {
        await tx.enrollmentBatch.update({
          data: {
            enrolledCount: {
              increment: 1,
            },
          },
          where: {
            id: batch.id,
          },
        });
      }

      await tx.auditEvent.create({
        data: {
          action: existing ? "device.check_in" : "device.enroll_quarantined",
          newValue: {
            enrollmentBatchId: batch.id,
            serialNumber: saved.serialNumber,
            status: saved.status,
          },
          object: "Device",
          objectId: saved.id,
          outcome: "SUCCESS",
          tenantId,
        },
      });

      return saved;
    });

    return {
      device: this.toDeviceSummary(device),
      quarantined: !device.studentId && !device.classId,
      wasExistingDevice: Boolean(existing),
    };
  }

  async assignDevice(
    tenantId: string,
    deviceId: string,
    input: AssignDeviceDto,
  ): Promise<DeviceSummary> {
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

    if (device.status === "RETIRED") {
      throw new BadRequestException("Retired devices cannot be reassigned");
    }

    await Promise.all([
      this.ensureBranchBelongsToTenant(tenantId, input.branchId),
      this.ensureStudentBelongsToTenantAndCanBeAssigned(
        tenantId,
        input.studentId,
      ),
      this.ensureClassBelongsToTenant(tenantId, input.classId),
    ]);

    const updated = await this.prisma.$transaction(async (tx) => {
      const assignmentChanged =
        (input.branchId !== undefined && input.branchId !== device.branchId) ||
        (input.classId !== undefined && input.classId !== device.classId) ||
        (input.studentId !== undefined && input.studentId !== device.studentId);

      if (assignmentChanged) {
        await tx.deviceAssignment.updateMany({
          data: { endedAt: new Date() },
          where: { deviceId: device.id, endedAt: null, tenantId },
        });
      }

      const saved = await tx.device.update({
        data: {
          branchId: input.branchId ?? device.branchId,
          classId: input.classId ?? device.classId,
          status: device.status === "PENDING" ? "OFFLINE" : device.status,
          studentId: input.studentId ?? device.studentId,
          tags: input.tags ?? device.tags,
        },
        where: {
          id: device.id,
        },
      });

      if (assignmentChanged) {
        await tx.deviceAssignment.create({
          data: {
            branchId: saved.branchId,
            classId: saved.classId,
            deviceId: saved.id,
            reason: input.reason,
            studentId: saved.studentId,
            tenantId,
          },
        });
      }

      await tx.auditEvent.create({
        data: {
          action: "device.assign",
          newValue: {
            branchId: saved.branchId,
            classId: saved.classId,
            studentId: saved.studentId,
            tags: saved.tags,
          },
          object: "Device",
          objectId: saved.id,
          oldValue: {
            branchId: device.branchId,
            classId: device.classId,
            studentId: device.studentId,
            tags: device.tags,
          },
          outcome: "SUCCESS",
          reason: input.reason,
          tenantId,
        },
      });

      return saved;
    });

    return this.toDeviceSummary(updated);
  }

  async getDeviceHistory(
    tenantId: string,
    deviceId: string,
  ): Promise<DeviceHistory> {
    await this.findDevice(tenantId, deviceId);
    const [assignments, lifecycle] = await Promise.all([
      this.prisma.deviceAssignment.findMany({
        orderBy: { startedAt: "desc" },
        where: { deviceId, tenantId },
      }),
      this.prisma.deviceLifecycleEvent.findMany({
        orderBy: { createdAt: "desc" },
        where: { deviceId, tenantId },
      }),
    ]);
    return {
      assignments: assignments.map((item) => ({
        actorId: item.actorId,
        branchId: item.branchId,
        classId: item.classId,
        endedAt: item.endedAt?.toISOString() ?? null,
        id: item.id,
        reason: item.reason,
        startedAt: item.startedAt.toISOString(),
        studentId: item.studentId,
      })),
      lifecycle: lifecycle.map((item) => ({
        actorId: item.actorId,
        createdAt: item.createdAt.toISOString(),
        id: item.id,
        reason: item.reason,
        type: item.type as "RETIRED" | "UNENROLLED" | "REPLACED",
      })),
    };
  }

  async retireDevice(
    tenantId: string,
    deviceId: string,
    reason: string,
  ): Promise<DeviceSummary> {
    return this.changeLifecycle(tenantId, deviceId, "RETIRED", reason);
  }

  async unenrollDevice(
    tenantId: string,
    deviceId: string,
    reason: string,
  ): Promise<DeviceSummary> {
    return this.changeLifecycle(tenantId, deviceId, "UNENROLLED", reason);
  }

  private async changeLifecycle(
    tenantId: string,
    deviceId: string,
    type: "RETIRED" | "UNENROLLED",
    reason: string,
  ): Promise<DeviceSummary> {
    const device = await this.findDevice(tenantId, deviceId);
    const saved = await this.prisma.$transaction(async (tx) => {
      await tx.deviceAssignment.updateMany({
        data: { endedAt: new Date() },
        where: { deviceId, endedAt: null, tenantId },
      });
      const updated = await tx.device.update({
        data: {
          branchId: null,
          classId: null,
          connectorDeviceName:
            type === "UNENROLLED" ? null : device.connectorDeviceName,
          enrollmentId: type === "UNENROLLED" ? null : device.enrollmentId,
          policyVersion: null,
          status: type === "RETIRED" ? "RETIRED" : "PENDING",
          studentId: null,
        },
        where: { id: deviceId },
      });
      await tx.deviceLifecycleEvent.create({
        data: {
          deviceId,
          newValue: { status: updated.status },
          oldValue: { status: device.status, studentId: device.studentId },
          reason,
          tenantId,
          type,
        },
      });
      await tx.auditEvent.create({
        data: {
          action: `device.${type.toLowerCase()}`,
          newValue: { status: updated.status },
          object: "Device",
          objectId: deviceId,
          oldValue: { status: device.status, studentId: device.studentId },
          outcome: "SUCCESS",
          reason,
          tenantId,
        },
      });
      return updated;
    });
    return this.toDeviceSummary(saved);
  }

  private async findDevice(
    tenantId: string,
    deviceId: string,
  ): Promise<Device> {
    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, tenantId },
    });
    if (!device) {
      throw new NotFoundException(
        `Device ${deviceId} was not found for tenant ${tenantId}`,
      );
    }
    return device;
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

  private async ensureBranchBelongsToTenant(
    tenantId: string,
    branchId: string | undefined,
  ): Promise<void> {
    if (!branchId) {
      return;
    }

    const branch = await this.prisma.branch.findFirst({
      select: {
        id: true,
      },
      where: {
        id: branchId,
        tenantId,
      },
    });

    if (!branch) {
      throw new NotFoundException(
        `Branch ${branchId} was not found for tenant ${tenantId}`,
      );
    }
  }

  private async ensureStudentBelongsToTenantAndCanBeAssigned(
    tenantId: string,
    studentId: string | undefined,
  ): Promise<void> {
    if (!studentId) {
      return;
    }

    const student = await this.prisma.student.findFirst({
      select: {
        id: true,
        status: true,
      },
      where: {
        id: studentId,
        tenantId,
      },
    });

    if (!student) {
      throw new NotFoundException(
        `Student ${studentId} was not found for tenant ${tenantId}`,
      );
    }

    if (["SUSPENDED", "GRADUATED", "WITHDRAWN"].includes(student.status)) {
      throw new BadRequestException(
        "Inactive students cannot be assigned to devices",
      );
    }
  }

  private async ensureClassBelongsToTenant(
    tenantId: string,
    classId: string | undefined,
  ): Promise<void> {
    if (!classId) {
      return;
    }

    const classSection = await this.prisma.classSection.findFirst({
      select: {
        id: true,
      },
      where: {
        id: classId,
        tenantId,
      },
    });

    if (!classSection) {
      throw new NotFoundException(
        `Class ${classId} was not found for tenant ${tenantId}`,
      );
    }
  }

  private toEnrollmentBatchSummary(
    batch: EnrollmentBatch,
  ): EnrollmentBatchSummary {
    return {
      createdAt: batch.createdAt.toISOString(),
      enrolledCount: batch.enrolledCount,
      expiresAt: batch.expiresAt?.toISOString() ?? null,
      id: batch.id,
      maxDevices: batch.maxDevices,
      name: batch.name,
      qrPayload: batch.qrPayload as Record<string, unknown>,
      status: batch.status as EnrollmentBatchStatus,
      tenantId: batch.tenantId,
      token: batch.token,
    };
  }

  private toDeviceSummary(device: Device): DeviceSummary {
    const controls = androidControlSummary();
    return {
      androidVersion: device.androidVersion,
      branchId: device.branchId,
      classId: device.classId,
      compliance: device.compliance,
      enrollmentBatchId: device.enrollmentBatchId,
      enrollmentId: device.enrollmentId,
      health: device.health,
      id: device.id,
      lastCheckInAt: device.lastCheckInAt?.toISOString() ?? null,
      manufacturer: device.manufacturer,
      connectorDeviceName: device.connectorDeviceName,
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
      ...controls,
      complianceAssessment: assessAndroidCompliance({
        compliance: device.compliance,
        health: device.health,
        osVersion: device.androidVersion,
        status: device.status,
      }),
    };
  }
}
