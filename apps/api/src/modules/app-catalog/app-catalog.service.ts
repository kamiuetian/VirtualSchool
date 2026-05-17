import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  AppApprovalStatus,
  AppCatalogItemSummary,
  AppInstallRule,
} from "@virtual-school/shared";
import { type AppCatalogItem, Prisma } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateAppCatalogItemDto } from "./dto/create-app-catalog-item.dto";
import type { UpdateAppCatalogItemDto } from "./dto/update-app-catalog-item.dto";

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
}
