import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  BranchSummary,
  OnboardingChecklist,
  TenantSummary,
} from "@virtual-school/shared";
import type { Branch, TenantStatus } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateBranchDto } from "./dto/create-branch.dto";
import type { CreateTenantDto } from "./dto/create-tenant.dto";

@Injectable()
export class TenantsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(): Promise<TenantSummary[]> {
    const tenants = await this.prisma.tenant.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return tenants.map((tenant) => this.toSummary(tenant));
  }

  async listAuthorized(tenantIds: string[]): Promise<TenantSummary[]> {
    if (tenantIds.includes("*")) {
      return this.list();
    }

    const tenants = await this.prisma.tenant.findMany({
      orderBy: {
        createdAt: "desc",
      },
      where: {
        id: {
          in: tenantIds,
        },
      },
    });

    return tenants.map((tenant) => this.toSummary(tenant));
  }

  async getById(tenantId: string): Promise<TenantSummary> {
    const tenant = await this.prisma.tenant.findUnique({
      where: {
        id: tenantId,
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} was not found`);
    }

    return this.toSummary(tenant);
  }

  async listBranches(tenantId: string): Promise<BranchSummary[]> {
    await this.ensureTenantExists(tenantId);

    const branches = await this.prisma.branch.findMany({
      orderBy: {
        name: "asc",
      },
      where: {
        tenantId,
      },
    });

    return branches.map((branch) => this.toBranchSummary(branch));
  }

  async createBranch(
    tenantId: string,
    input: CreateBranchDto,
  ): Promise<BranchSummary> {
    await this.ensureTenantExists(tenantId);

    const branch = await this.prisma.$transaction(async (tx) => {
      const created = await tx.branch.create({
        data: {
          name: input.name,
          tenantId,
          timezone: input.timezone,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "branch.create",
          newValue: {
            name: created.name,
            status: created.status,
            timezone: created.timezone,
          },
          object: "Branch",
          objectId: created.id,
          outcome: "SUCCESS",
          tenantId,
        },
      });

      return created;
    });

    return this.toBranchSummary(branch);
  }

  async getOnboardingChecklist(tenantId: string): Promise<OnboardingChecklist> {
    const tenant = await this.prisma.tenant.findUnique({
      select: {
        country: true,
        name: true,
        planKey: true,
        timezone: true,
      },
      where: {
        id: tenantId,
      },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} was not found`);
    }

    const [
      branchCount,
      studentCount,
      classCount,
      policyCount,
      appCatalogItemCount,
      enrollmentBatchCount,
      deviceCount,
    ] = await Promise.all([
      this.prisma.branch.count({ where: { tenantId } }),
      this.prisma.student.count({ where: { tenantId } }),
      this.prisma.classSection.count({ where: { tenantId } }),
      this.prisma.policy.count({ where: { tenantId } }),
      this.prisma.appCatalogItem.count({ where: { tenantId } }),
      this.prisma.enrollmentBatch.count({ where: { tenantId } }),
      this.prisma.device.count({ where: { tenantId } }),
    ]);

    const items = [
      {
        completed: Boolean(
          tenant.name && tenant.country && tenant.timezone && tenant.planKey,
        ),
        key: "school_profile" as const,
        label: "School profile complete",
      },
      {
        completed: branchCount > 0,
        key: "branch_created" as const,
        label: "Branch or campus created",
      },
      {
        completed: studentCount > 0 || classCount > 0,
        key: "roster_started" as const,
        label: "Roster started",
      },
      {
        completed: policyCount > 0,
        key: "policy_template_created" as const,
        label: "Policy template created",
      },
      {
        completed: appCatalogItemCount > 0,
        key: "app_catalog_configured" as const,
        label: "App catalog configured",
      },
      {
        completed: enrollmentBatchCount > 0,
        key: "enrollment_batch_generated" as const,
        label: "Enrollment batch generated",
      },
      {
        completed: deviceCount > 0,
        key: "first_device_enrolled" as const,
        label: "First device enrolled",
      },
    ];

    return {
      completedCount: items.filter((item) => item.completed).length,
      items,
      tenantId,
      totalCount: items.length,
    };
  }

  async create(input: CreateTenantDto): Promise<TenantSummary> {
    const tenant = await this.prisma.$transaction(async (tx) => {
      const created = await tx.tenant.create({
        data: {
          country: input.country,
          name: input.name,
          planKey: input.planKey,
          status: input.status,
          timezone: input.timezone,
        },
      });

      await tx.billingSubscription.create({
        data: {
          billingEmail: input.primaryContactEmail,
          planKey: created.planKey,
          status: created.status === "ACTIVE" ? "ACTIVE" : "TRIALING",
          tenantId: created.id,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "tenant.create",
          newValue: {
            country: created.country,
            name: created.name,
            planKey: created.planKey,
            status: created.status,
            timezone: created.timezone,
          },
          object: "Tenant",
          objectId: created.id,
          outcome: "SUCCESS",
          tenantId: created.id,
        },
      });

      return created;
    });

    return this.toSummary(tenant);
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

  private toBranchSummary(branch: Branch): BranchSummary {
    return {
      id: branch.id,
      name: branch.name,
      status: branch.status,
      tenantId: branch.tenantId,
      timezone: branch.timezone,
    };
  }

  private toSummary(tenant: {
    country: string;
    id: string;
    name: string;
    planKey: string;
    status: TenantStatus;
    timezone: string;
  }): TenantSummary {
    return {
      country: tenant.country,
      id: tenant.id,
      name: tenant.name,
      planKey: tenant.planKey,
      status: tenant.status,
      timezone: tenant.timezone,
    };
  }
}
