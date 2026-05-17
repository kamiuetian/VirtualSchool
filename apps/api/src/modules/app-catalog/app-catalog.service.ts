import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  AppApprovalStatus,
  AppCatalogItemSummary,
  AppDeploymentAction,
  AppDeploymentScope,
  AppDeploymentSummary,
  AppInstallRule,
  RemoteCommandType,
} from "@virtual-school/shared";
import {
  type AppCatalogItem,
  type Device,
  Prisma,
} from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateAppCatalogItemDto } from "./dto/create-app-catalog-item.dto";
import type { DeployAppDto } from "./dto/deploy-app.dto";
import type { UpdateAppCatalogItemDto } from "./dto/update-app-catalog-item.dto";

const deployableDeviceStatuses: Device["status"][] = [
  "ONLINE",
  "OFFLINE",
  "LOCKED",
  "NON_COMPLIANT",
  "PENDING",
];

@Injectable()
export class AppCatalogService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listApps(tenantId: string): Promise<AppCatalogItemSummary[]> {
    await this.ensureTenantExists(tenantId);

    const apps = await this.prisma.appCatalogItem.findMany({
      orderBy: [{ approvalStatus: "asc" }, { name: "asc" }],
      where: {
        tenantId,
      },
    });

    return apps.map((app) => this.toSummary(app));
  }

  async createApp(
    tenantId: string,
    input: CreateAppCatalogItemDto,
  ): Promise<AppCatalogItemSummary> {
    await this.ensureTenantExists(tenantId);

    const existing = await this.prisma.appCatalogItem.findUnique({
      where: {
        tenantId_packageId: {
          packageId: input.packageId,
          tenantId,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Package ${input.packageId} already exists in this app catalog`,
      );
    }

    const app = await this.prisma.$transaction(async (tx) => {
      const created = await tx.appCatalogItem.create({
        data: {
          approvalStatus: input.approvalStatus ?? "APPROVED",
          approvedGrades: input.approvedGrades ?? [],
          category: input.category,
          description: input.description,
          iconUrl: input.iconUrl,
          installRules: input.installRules as Prisma.InputJsonValue | undefined,
          name: input.name,
          packageId: input.packageId,
          tenantId,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "app_catalog.create",
          newValue: {
            approvalStatus: created.approvalStatus,
            approvedGrades: created.approvedGrades,
            installRules: created.installRules,
            name: created.name,
            packageId: created.packageId,
          },
          object: "AppCatalogItem",
          objectId: created.id,
          outcome: "SUCCESS",
          tenantId,
        },
      });

      return created;
    });

    return this.toSummary(app);
  }

  async updateApp(
    tenantId: string,
    appId: string,
    input: UpdateAppCatalogItemDto,
  ): Promise<AppCatalogItemSummary> {
    const app = await this.prisma.appCatalogItem.findFirst({
      where: {
        id: appId,
        tenantId,
      },
    });

    if (!app) {
      throw new NotFoundException(
        `App ${appId} was not found for tenant ${tenantId}`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.appCatalogItem.update({
        data: {
          approvalStatus: input.approvalStatus ?? app.approvalStatus,
          approvedGrades: input.approvedGrades ?? app.approvedGrades,
          category: input.category ?? app.category,
          description: input.description ?? app.description,
          iconUrl: input.iconUrl ?? app.iconUrl,
          ...(input.installRules !== undefined
            ? { installRules: input.installRules as Prisma.InputJsonValue }
            : {}),
          name: input.name ?? app.name,
        },
        where: {
          id: app.id,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "app_catalog.update",
          newValue: {
            approvalStatus: saved.approvalStatus,
            approvedGrades: saved.approvedGrades,
            installRules: saved.installRules,
            name: saved.name,
          },
          object: "AppCatalogItem",
          objectId: saved.id,
          oldValue: {
            approvalStatus: app.approvalStatus,
            approvedGrades: app.approvedGrades,
            installRules: app.installRules,
            name: app.name,
          },
          outcome: "SUCCESS",
          tenantId,
        },
      });

      return saved;
    });

    return this.toSummary(updated);
  }

  async deployApp(
    tenantId: string,
    appId: string,
    input: DeployAppDto,
    actorId: string | undefined,
  ): Promise<AppDeploymentSummary> {
    const app = await this.prisma.appCatalogItem.findFirst({
      where: {
        id: appId,
        tenantId,
      },
    });

    if (!app) {
      throw new NotFoundException(
        `App ${appId} was not found for tenant ${tenantId}`,
      );
    }

    if (input.action === "INSTALL" && app.approvalStatus !== "APPROVED") {
      throw new BadRequestException(
        "Only approved apps can be deployed for installation",
      );
    }

    this.validateDeploymentScope(input.scope, input.scopeId);
    await this.ensureDeploymentTargetExists(
      tenantId,
      input.scope,
      input.scopeId,
    );

    const devices = await this.findDeploymentDevices(
      tenantId,
      input.scope,
      input.scopeId,
    );
    const expiresAt = new Date(Date.now() + (input.ttlMinutes ?? 120) * 60_000);
    const commandType: RemoteCommandType =
      input.action === "INSTALL" ? "APP_INSTALL" : "APP_REMOVE";
    const payload = this.deploymentPayload(app, input.action, input);

    const result = await this.prisma.$transaction(async (tx) => {
      const commandIds: string[] = [];

      for (const device of devices) {
        const created = await tx.remoteCommand.create({
          data: {
            deviceId: device.id,
            expiresAt,
            maxAttempts: input.maxAttempts ?? 3,
            payload: payload as Prisma.InputJsonValue,
            reason: input.reason,
            requestedBy: actorId,
            status: "QUEUED",
            tenantId,
            type: commandType,
          },
        });

        commandIds.push(created.id);
      }

      await tx.auditEvent.create({
        data: {
          action: "app_deployment.queue",
          actorId,
          newValue: {
            action: input.action,
            commandType,
            packageId: app.packageId,
            queuedCommands: commandIds.length,
            scope: input.scope,
            scopeId: input.scopeId,
          },
          object: "AppCatalogItem",
          objectId: app.id,
          outcome: "QUEUED",
          reason: input.reason,
          tenantId,
        },
      });

      return commandIds;
    });

    return {
      action: input.action,
      appId: app.id,
      commandIds: result,
      packageId: app.packageId,
      queuedCommands: result.length,
      scope: input.scope,
      scopeId: input.scope === "TENANT" ? null : input.scopeId,
      skippedDevices: 0,
      targetedDevices: devices.length,
      tenantId,
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

  private toSummary(app: AppCatalogItem): AppCatalogItemSummary {
    return {
      approvalStatus: app.approvalStatus as AppApprovalStatus,
      approvedGrades: app.approvedGrades,
      category: app.category,
      createdAt: app.createdAt.toISOString(),
      description: app.description,
      iconUrl: app.iconUrl,
      id: app.id,
      installRules: app.installRules as AppInstallRule | null,
      name: app.name,
      packageId: app.packageId,
      tenantId: app.tenantId,
      updatedAt: app.updatedAt.toISOString(),
    };
  }

  private validateDeploymentScope(
    scope: AppDeploymentScope,
    scopeId: string | undefined,
  ): void {
    if (scope === "TENANT" && scopeId) {
      throw new BadRequestException(
        "Tenant deployments must not include scopeId",
      );
    }

    if (scope !== "TENANT" && !scopeId) {
      throw new BadRequestException(`${scope} deployments require scopeId`);
    }
  }

  private async ensureDeploymentTargetExists(
    tenantId: string,
    scope: AppDeploymentScope,
    scopeId: string | undefined,
  ): Promise<void> {
    if (scope === "TENANT") {
      await this.ensureTenantExists(tenantId);
      return;
    }

    if (scope === "GRADE") {
      const student = await this.prisma.student.findFirst({
        select: {
          id: true,
        },
        where: {
          grade: scopeId,
          tenantId,
        },
      });

      if (!student) {
        throw new NotFoundException(
          `Grade ${scopeId} was not found for tenant ${tenantId}`,
        );
      }
      return;
    }

    if (scope === "CLASS") {
      const classSection = await this.prisma.classSection.findFirst({
        select: {
          id: true,
        },
        where: {
          id: scopeId,
          tenantId,
        },
      });

      if (!classSection) {
        throw new NotFoundException(
          `Class ${scopeId} was not found for tenant ${tenantId}`,
        );
      }
      return;
    }

    if (scope === "STUDENT") {
      const student = await this.prisma.student.findFirst({
        select: {
          id: true,
        },
        where: {
          id: scopeId,
          tenantId,
        },
      });

      if (!student) {
        throw new NotFoundException(
          `Student ${scopeId} was not found for tenant ${tenantId}`,
        );
      }
      return;
    }

    const device = await this.prisma.device.findFirst({
      select: {
        id: true,
      },
      where: {
        id: scopeId,
        tenantId,
      },
    });

    if (!device) {
      throw new NotFoundException(
        `Device ${scopeId} was not found for tenant ${tenantId}`,
      );
    }
  }

  private async findDeploymentDevices(
    tenantId: string,
    scope: AppDeploymentScope,
    scopeId: string | undefined,
  ): Promise<Array<Pick<Device, "id">>> {
    const baseWhere = {
      status: {
        in: deployableDeviceStatuses,
      },
      tenantId,
    };

    if (scope === "TENANT") {
      return this.prisma.device.findMany({
        select: {
          id: true,
        },
        where: baseWhere,
      });
    }

    if (scope === "GRADE") {
      return this.prisma.device.findMany({
        select: {
          id: true,
        },
        where: {
          ...baseWhere,
          student: {
            grade: scopeId,
          },
        },
      });
    }

    if (scope === "CLASS") {
      return this.prisma.device.findMany({
        select: {
          id: true,
        },
        where: {
          ...baseWhere,
          classId: scopeId,
        },
      });
    }

    if (scope === "STUDENT") {
      return this.prisma.device.findMany({
        select: {
          id: true,
        },
        where: {
          ...baseWhere,
          studentId: scopeId,
        },
      });
    }

    return this.prisma.device.findMany({
      select: {
        id: true,
      },
      where: {
        ...baseWhere,
        id: scopeId,
      },
    });
  }

  private deploymentPayload(
    app: AppCatalogItem,
    action: AppDeploymentAction,
    input: DeployAppDto,
  ): Record<string, unknown> {
    const installRules = app.installRules as AppInstallRule | null;

    return {
      action,
      appId: app.id,
      appName: app.name,
      installRules,
      packageId: app.packageId,
      scope: input.scope,
      scopeId: input.scope === "TENANT" ? null : input.scopeId,
      source: "APP_DEPLOYMENT",
    };
  }
}
