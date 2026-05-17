import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  DeviceCheckInResult,
  DeviceSummary,
  EnrollmentBatchSummary,
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

  async listDevices(tenantId: string): Promise<DeviceSummary[]> {
    await this.ensureTenantExists(tenantId);

    const devices = await this.prisma.device.findMany({
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      where: {
        tenantId,
      },
    });

    return devices.map((device) => this.toDeviceSummary(device));
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

    await Promise.all([
      this.ensureBranchBelongsToTenant(tenantId, input.branchId),
      this.ensureStudentBelongsToTenantAndCanBeAssigned(
        tenantId,
        input.studentId,
      ),
      this.ensureClassBelongsToTenant(tenantId, input.classId),
    ]);

    const updated = await this.prisma.$transaction(async (tx) => {
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
      model: device.model,
      ownershipType: "SCHOOL_OWNED",
      policyVersion: device.policyVersion,
      serialNumber: device.serialNumber,
      status: device.status,
      studentId: device.studentId,
      tags: device.tags,
      tenantId: device.tenantId,
    };
  }
}
