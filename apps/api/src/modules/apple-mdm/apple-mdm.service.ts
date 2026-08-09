import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { AppleMdmIntegrationSummary } from "@virtual-school/shared";
import { PrismaService } from "../prisma/prisma.service";
import type {
  ConfigureAppleMdmDto,
  IngestAppleInventoryDto,
} from "./apple-mdm.dto";

@Injectable()
export class AppleMdmService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get(tenantId: string): Promise<AppleMdmIntegrationSummary | null> {
    const value = await this.prisma.appleMdmConnection.findUnique({
      where: { tenantId },
      include: {
        deviceStates: {
          include: { device: true },
          orderBy: { lastSyncedAt: "desc" },
          take: 250,
        },
      },
    });
    if (!value) return null;
    const alertAfter = Date.now() + 30 * 24 * 60 * 60 * 1000;
    return {
      id: value.id,
      providerName: value.providerName,
      serverUrl: value.serverUrl,
      credentialReference: value.credentialReference,
      appleSchoolManagerId: value.appleSchoolManagerId,
      status: value.status,
      tokenExpiresAt: value.tokenExpiresAt.toISOString(),
      certificateExpiresAt: value.certificateExpiresAt.toISOString(),
      tokenExpiryAlert: value.tokenExpiresAt.getTime() <= alertAfter,
      certificateExpiryAlert:
        value.certificateExpiresAt.getTime() <= alertAfter,
      lastValidatedAt: value.lastValidatedAt?.toISOString() ?? null,
      lastInventorySyncAt: value.lastInventorySyncAt?.toISOString() ?? null,
      devices: value.deviceStates.map((item) => ({
        id: item.device.id,
        serialNumber: item.device.serialNumber,
        externalDeviceId: item.externalDeviceId,
        model: item.device.model,
        osVersion: item.device.androidVersion,
        status: item.device.status,
        adeStatus: item.adeStatus as any,
        supervisionStatus: item.supervisionStatus as any,
        restrictionStatus: item.restrictionStatus as any,
        appBookStatus: item.appBookStatus as any,
        managedConfigurationStatus: item.managedConfigurationStatus as any,
        lastSyncedAt: item.lastSyncedAt.toISOString(),
      })),
    };
  }

  async configure(
    tenantId: string,
    input: ConfigureAppleMdmDto,
    actorId?: string,
  ) {
    if (!/^(arn:|vault:\/\/|secret:\/\/)/.test(input.credentialReference))
      throw new BadRequestException(
        "Use an ARN, vault://, or secret:// credential reference; token and certificate values are not accepted",
      );
    const tokenExpiresAt = new Date(input.tokenExpiresAt);
    const certificateExpiresAt = new Date(input.certificateExpiresAt);
    if (tokenExpiresAt <= new Date() || certificateExpiresAt <= new Date())
      throw new BadRequestException(
        "Apple token and MDM certificate must not be expired",
      );
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException("Tenant was not found");
    await this.prisma.$transaction(async (tx) => {
      const saved = await tx.appleMdmConnection.upsert({
        where: { tenantId },
        create: {
          tenantId,
          providerName: input.providerName,
          serverUrl: input.serverUrl,
          credentialReference: input.credentialReference,
          appleSchoolManagerId: input.appleSchoolManagerId,
          tokenExpiresAt,
          certificateExpiresAt,
          lastValidatedAt: new Date(),
        },
        update: {
          providerName: input.providerName,
          serverUrl: input.serverUrl,
          credentialReference: input.credentialReference,
          appleSchoolManagerId: input.appleSchoolManagerId,
          tokenExpiresAt,
          certificateExpiresAt,
          status: "AUTHORIZED",
          lastValidatedAt: new Date(),
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "apple_mdm.configure",
          object: "AppleMdmConnection",
          objectId: saved.id,
          outcome: "AUTHORIZED",
          newValue: {
            providerName: input.providerName,
            serverUrl: input.serverUrl,
            appleSchoolManagerId: input.appleSchoolManagerId,
            credentialReference: input.credentialReference,
            tokenExpiresAt: input.tokenExpiresAt,
            certificateExpiresAt: input.certificateExpiresAt,
          },
        },
      });
    });
    return this.get(tenantId);
  }

  async ingestInventory(
    tenantId: string,
    input: IngestAppleInventoryDto,
    actorId?: string,
  ) {
    if (input.devices.length > 500)
      throw new BadRequestException(
        "Inventory batches are limited to 500 devices",
      );
    const connection = await this.prisma.appleMdmConnection.findUnique({
      where: { tenantId },
    });
    if (!connection || connection.status !== "AUTHORIZED")
      throw new BadRequestException(
        "Configure an Apple MDM connection for this tenant first",
      );
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
    const syncedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      for (const item of input.devices) {
        const device = await tx.device.upsert({
          where: {
            tenantId_serialNumber: {
              tenantId,
              serialNumber: item.serialNumber,
            },
          },
          create: {
            tenantId,
            serialNumber: item.serialNumber,
            manufacturer: "Apple",
            model: item.model,
            androidVersion: item.osVersion,
            mdmConnector: "APPLE_EXTERNAL_MDM",
            connectorDeviceName: item.externalDeviceId,
            status: "ONLINE",
            health: item.health ?? "UNKNOWN",
            lastCheckInAt: syncedAt,
          },
          update: {
            manufacturer: "Apple",
            model: item.model,
            androidVersion: item.osVersion,
            mdmConnector: "APPLE_EXTERNAL_MDM",
            connectorDeviceName: item.externalDeviceId,
            status: "ONLINE",
            health: item.health ?? "UNKNOWN",
            lastCheckInAt: syncedAt,
          },
        });
        await tx.appleDeviceState.upsert({
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
            adeStatus: item.adeStatus,
            supervisionStatus: item.supervisionStatus,
            restrictionStatus: item.restrictionStatus,
            appBookStatus: item.appBookStatus,
            managedConfigurationStatus: item.managedConfigurationStatus,
            lastSyncedAt: syncedAt,
          },
        });
      }
      await tx.appleMdmConnection.update({
        where: { id: connection.id },
        data: { lastInventorySyncAt: syncedAt },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "apple_mdm.inventory.ingest",
          object: "AppleMdmConnection",
          objectId: connection.id,
          outcome: "SYNCED",
          newValue: { deviceCount: input.devices.length },
        },
      });
    });
    return this.get(tenantId);
  }
}
