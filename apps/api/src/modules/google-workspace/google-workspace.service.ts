import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { GoogleWorkspaceIntegrationSummary } from "@virtual-school/shared";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthorizeGoogleWorkspaceDto, IngestChromeOsInventoryDto, MapGoogleWorkspaceOuDto } from "./google-workspace.dto";

@Injectable()
export class GoogleWorkspaceService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async get(tenantId: string): Promise<GoogleWorkspaceIntegrationSummary | null> {
    const value = await this.prisma.googleWorkspaceConnection.findUnique({
      where: { tenantId },
      include: {
        organizationalUnits: { orderBy: { organizationalUnitPath: "asc" } },
        chromeOsDeviceStates: { include: { device: true }, orderBy: { lastSyncedAt: "desc" }, take: 250 },
      },
    });
    if (!value) return null;
    return {
      id: value.id, customerId: value.customerId, delegatedAdminEmail: value.delegatedAdminEmail,
      credentialReference: value.credentialReference, status: value.status,
      lastValidatedAt: value.lastValidatedAt?.toISOString() ?? null,
      lastInventorySyncAt: value.lastInventorySyncAt?.toISOString() ?? null,
      organizationalUnits: value.organizationalUnits.map((item) => ({
        id: item.id, organizationalUnitId: item.organizationalUnitId,
        organizationalUnitPath: item.organizationalUnitPath, branchId: item.branchId, enabled: item.enabled,
      })),
      devices: value.chromeOsDeviceStates.map((item) => ({
        id: item.device.id, serialNumber: item.device.serialNumber, externalDeviceId: item.externalDeviceId,
        organizationalUnitId: item.organizationalUnitId, model: item.device.model,
        osVersion: item.device.androidVersion, status: item.device.status,
        kioskStatus: item.kioskStatus as any, managedSessionStatus: item.managedSessionStatus as any,
        appExtensionStatus: item.appExtensionStatus as any, webPolicyStatus: item.webPolicyStatus as any,
        lastSyncedAt: item.lastSyncedAt.toISOString(),
      })),
    };
  }

  async authorize(tenantId: string, input: AuthorizeGoogleWorkspaceDto, actorId?: string) {
    if (!/^(arn:|vault:\/\/|secret:\/\/)/.test(input.credentialReference))
      throw new BadRequestException("Use an ARN, vault://, or secret:// credential reference; credential values are not accepted");
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) throw new NotFoundException("Tenant was not found");
    await this.prisma.$transaction(async (tx) => {
      const saved = await tx.googleWorkspaceConnection.upsert({
        where: { tenantId },
        create: { tenantId, ...input, lastValidatedAt: new Date() },
        update: { ...input, status: "AUTHORIZED", lastValidatedAt: new Date() },
      });
      await tx.auditEvent.create({ data: { tenantId, actorId, action: "google_workspace.authorize", object: "GoogleWorkspaceConnection", objectId: saved.id, outcome: "AUTHORIZED", newValue: { customerId: input.customerId, delegatedAdminEmail: input.delegatedAdminEmail, credentialReference: input.credentialReference } } });
    });
    return this.get(tenantId);
  }

  async mapOrganizationalUnit(tenantId: string, input: MapGoogleWorkspaceOuDto, actorId?: string) {
    const connection = await this.requireConnection(tenantId);
    if (!input.organizationalUnitPath.startsWith("/")) throw new BadRequestException("Organizational unit path must start with /");
    if (input.branchId) {
      const branch = await this.prisma.branch.findFirst({ where: { id: input.branchId, tenantId }, select: { id: true } });
      if (!branch) throw new NotFoundException("Branch was not found for this tenant");
    }
    return this.prisma.$transaction(async (tx) => {
      const saved = await tx.googleWorkspaceOuMapping.upsert({
        where: { tenantId_organizationalUnitId: { tenantId, organizationalUnitId: input.organizationalUnitId } },
        create: { tenantId, connectionId: connection.id, ...input },
        update: { connectionId: connection.id, organizationalUnitPath: input.organizationalUnitPath, branchId: input.branchId ?? null, enabled: true },
      });
      await tx.auditEvent.create({ data: { tenantId, actorId, action: "google_workspace.ou_mapping.upsert", object: "GoogleWorkspaceOuMapping", objectId: saved.id, outcome: "MAPPED", newValue: { organizationalUnitId: input.organizationalUnitId, organizationalUnitPath: input.organizationalUnitPath, branchId: input.branchId } } });
      return saved;
    });
  }

  async ingestInventory(tenantId: string, input: IngestChromeOsInventoryDto, actorId?: string) {
    if (input.devices.length > 500) throw new BadRequestException("Inventory batches are limited to 500 devices");
    const connection = await this.requireConnection(tenantId);
    const externalIds = new Set(input.devices.map((item) => item.externalDeviceId));
    const serials = new Set(input.devices.map((item) => item.serialNumber));
    if (externalIds.size !== input.devices.length || serials.size !== input.devices.length)
      throw new BadRequestException("External device IDs and serial numbers must be unique within a batch");
    const mappings = await this.prisma.googleWorkspaceOuMapping.findMany({
      where: { tenantId, enabled: true, organizationalUnitId: { in: [...new Set(input.devices.map((item) => item.organizationalUnitId))] } },
    });
    const byOu = new Map(mappings.map((item) => [item.organizationalUnitId, item]));
    if (input.devices.some((item) => !byOu.has(item.organizationalUnitId)))
      throw new BadRequestException("Every inventory device must belong to an enabled tenant organizational-unit mapping");
    const syncedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      for (const item of input.devices) {
        const mapping = byOu.get(item.organizationalUnitId)!;
        const device = await tx.device.upsert({
          where: { tenantId_serialNumber: { tenantId, serialNumber: item.serialNumber } },
          create: { tenantId, branchId: mapping.branchId, serialNumber: item.serialNumber, manufacturer: "Google", model: item.model, androidVersion: item.osVersion, mdmConnector: "GOOGLE_CHROME_ENTERPRISE", connectorDeviceName: item.externalDeviceId, status: "ONLINE", health: item.health ?? "UNKNOWN", lastCheckInAt: syncedAt },
          update: { branchId: mapping.branchId, manufacturer: "Google", model: item.model, androidVersion: item.osVersion, mdmConnector: "GOOGLE_CHROME_ENTERPRISE", connectorDeviceName: item.externalDeviceId, status: "ONLINE", health: item.health ?? "UNKNOWN", lastCheckInAt: syncedAt },
        });
        await tx.chromeOsDeviceState.upsert({
          where: { tenantId_externalDeviceId: { tenantId, externalDeviceId: item.externalDeviceId } },
          create: { tenantId, connectionId: connection.id, deviceId: device.id, ...item, lastSyncedAt: syncedAt },
          update: { connectionId: connection.id, deviceId: device.id, organizationalUnitId: item.organizationalUnitId, kioskStatus: item.kioskStatus, managedSessionStatus: item.managedSessionStatus, appExtensionStatus: item.appExtensionStatus, webPolicyStatus: item.webPolicyStatus, lastSyncedAt: syncedAt },
        });
      }
      await tx.googleWorkspaceConnection.update({ where: { id: connection.id }, data: { lastInventorySyncAt: syncedAt } });
      await tx.auditEvent.create({ data: { tenantId, actorId, action: "google_workspace.inventory.ingest", object: "GoogleWorkspaceConnection", objectId: connection.id, outcome: "SYNCED", newValue: { deviceCount: input.devices.length, organizationalUnitCount: byOu.size } } });
    });
    return this.get(tenantId);
  }

  private async requireConnection(tenantId: string) {
    const value = await this.prisma.googleWorkspaceConnection.findUnique({ where: { tenantId } });
    if (!value || value.status !== "AUTHORIZED") throw new BadRequestException("Authorize Google Workspace for this tenant first");
    return value;
  }
}
