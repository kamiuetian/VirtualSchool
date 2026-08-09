import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { IntuneIntegrationSummary } from "@virtual-school/shared";
import { PrismaService } from "../prisma/prisma.service";
import type {
  AuthorizeIntuneDto,
  IngestIntuneInventoryDto,
  MapIntuneGroupDto,
} from "./intune.dto";

@Injectable()
export class IntuneService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get(tenantId: string): Promise<IntuneIntegrationSummary | null> {
    const value = await this.prisma.intuneConnection.findUnique({
      where: { tenantId },
      include: {
        groupMappings: { orderBy: { groupName: "asc" } },
        deviceStates: {
          include: { device: true },
          orderBy: { lastSyncedAt: "desc" },
          take: 250,
        },
      },
    });
    if (!value) return null;
    return {
      id: value.id,
      entraTenantId: value.entraTenantId,
      clientId: value.clientId,
      credentialReference: value.credentialReference,
      status: value.status,
      lastValidatedAt: value.lastValidatedAt?.toISOString() ?? null,
      lastInventorySyncAt: value.lastInventorySyncAt?.toISOString() ?? null,
      groups: value.groupMappings.map((item) => ({
        id: item.id,
        groupId: item.groupId,
        groupName: item.groupName,
        branchId: item.branchId,
        enabled: item.enabled,
      })),
      devices: value.deviceStates.map((item) => ({
        id: item.device.id,
        serialNumber: item.device.serialNumber,
        externalDeviceId: item.externalDeviceId,
        groupId: item.groupId,
        model: item.device.model,
        osVersion: item.device.androidVersion,
        status: item.device.status,
        kioskStatus: item.kioskStatus as any,
        assessmentStatus: item.assessmentStatus as any,
        autopilotStatus: item.autopilotStatus as any,
        appDeploymentStatus: item.appDeploymentStatus as any,
        managementHealthStatus: item.managementHealthStatus as any,
        lastSyncedAt: item.lastSyncedAt.toISOString(),
      })),
    };
  }

  async authorize(
    tenantId: string,
    input: AuthorizeIntuneDto,
    actorId?: string,
  ) {
    if (!/^(arn:|vault:\/\/|secret:\/\/)/.test(input.credentialReference))
      throw new BadRequestException(
        "Use an ARN, vault://, or secret:// credential reference; client secrets and certificates are not accepted",
      );
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException("Tenant was not found");
    await this.prisma.$transaction(async (tx) => {
      const saved = await tx.intuneConnection.upsert({
        where: { tenantId },
        create: { tenantId, ...input, lastValidatedAt: new Date() },
        update: { ...input, status: "AUTHORIZED", lastValidatedAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "intune.authorize",
          object: "IntuneConnection",
          objectId: saved.id,
          outcome: "AUTHORIZED",
          newValue: {
            entraTenantId: input.entraTenantId,
            clientId: input.clientId,
            credentialReference: input.credentialReference,
          },
        },
      });
    });
    return this.get(tenantId);
  }

  async mapGroup(tenantId: string, input: MapIntuneGroupDto, actorId?: string) {
    const connection = await this.requireConnection(tenantId);
    if (input.branchId) {
      const branch = await this.prisma.branch.findFirst({
        where: { id: input.branchId, tenantId },
        select: { id: true },
      });
      if (!branch)
        throw new NotFoundException("Branch was not found for this tenant");
    }
    return this.prisma.$transaction(async (tx) => {
      const saved = await tx.intuneGroupMapping.upsert({
        where: { tenantId_groupId: { tenantId, groupId: input.groupId } },
        create: { tenantId, connectionId: connection.id, ...input },
        update: {
          connectionId: connection.id,
          groupName: input.groupName,
          branchId: input.branchId ?? null,
          enabled: true,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "intune.group_mapping.upsert",
          object: "IntuneGroupMapping",
          objectId: saved.id,
          outcome: "MAPPED",
          newValue: {
            groupId: input.groupId,
            groupName: input.groupName,
            branchId: input.branchId,
          },
        },
      });
      return saved;
    });
  }

  async ingestInventory(
    tenantId: string,
    input: IngestIntuneInventoryDto,
    actorId?: string,
  ) {
    if (input.devices.length > 500)
      throw new BadRequestException(
        "Inventory batches are limited to 500 devices",
      );
    const connection = await this.requireConnection(tenantId);
    const externalIds = new Set(
      input.devices.map((item) => item.externalDeviceId),
    );
    const serials = new Set(input.devices.map((item) => item.serialNumber));
    if (
      externalIds.size !== input.devices.length ||
      serials.size !== input.devices.length
    )
      throw new BadRequestException(
        "External device IDs and serial numbers must be unique within a batch",
      );
    const mappings = await this.prisma.intuneGroupMapping.findMany({
      where: {
        tenantId,
        enabled: true,
        groupId: {
          in: [...new Set(input.devices.map((item) => item.groupId))],
        },
      },
    });
    const byGroup = new Map(mappings.map((item) => [item.groupId, item]));
    if (input.devices.some((item) => !byGroup.has(item.groupId)))
      throw new BadRequestException(
        "Every inventory device must belong to an enabled tenant group mapping",
      );
    const syncedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      for (const item of input.devices) {
        const mapping = byGroup.get(item.groupId)!;
        const device = await tx.device.upsert({
          where: {
            tenantId_serialNumber: {
              tenantId,
              serialNumber: item.serialNumber,
            },
          },
          create: {
            tenantId,
            branchId: mapping.branchId,
            serialNumber: item.serialNumber,
            manufacturer: "Microsoft",
            model: item.model,
            androidVersion: item.osVersion,
            mdmConnector: "MICROSOFT_INTUNE",
            connectorDeviceName: item.externalDeviceId,
            status: "ONLINE",
            health: item.managementHealthStatus,
            lastCheckInAt: syncedAt,
          },
          update: {
            branchId: mapping.branchId,
            manufacturer: "Microsoft",
            model: item.model,
            androidVersion: item.osVersion,
            mdmConnector: "MICROSOFT_INTUNE",
            connectorDeviceName: item.externalDeviceId,
            status: "ONLINE",
            health: item.managementHealthStatus,
            lastCheckInAt: syncedAt,
          },
        });
        await tx.intuneDeviceState.upsert({
          where: {
            tenantId_externalDeviceId: {
              tenantId,
              externalDeviceId: item.externalDeviceId,
            },
          },
          create: {
            tenantId,
            connectionId: connection.id,
            deviceId: device.id,
            ...item,
            lastSyncedAt: syncedAt,
          },
          update: {
            connectionId: connection.id,
            deviceId: device.id,
            groupId: item.groupId,
            kioskStatus: item.kioskStatus,
            assessmentStatus: item.assessmentStatus,
            autopilotStatus: item.autopilotStatus,
            appDeploymentStatus: item.appDeploymentStatus,
            managementHealthStatus: item.managementHealthStatus,
            lastSyncedAt: syncedAt,
          },
        });
      }
      await tx.intuneConnection.update({
        where: { id: connection.id },
        data: { lastInventorySyncAt: syncedAt },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "intune.inventory.ingest",
          object: "IntuneConnection",
          objectId: connection.id,
          outcome: "SYNCED",
          newValue: {
            deviceCount: input.devices.length,
            groupCount: byGroup.size,
          },
        },
      });
    });
    return this.get(tenantId);
  }

  private async requireConnection(tenantId: string) {
    const value = await this.prisma.intuneConnection.findUnique({
      where: { tenantId },
    });
    if (!value || value.status !== "AUTHORIZED")
      throw new BadRequestException(
        "Authorize Microsoft Intune for this tenant first",
      );
    return value;
  }
}
