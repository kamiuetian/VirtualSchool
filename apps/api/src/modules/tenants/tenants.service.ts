import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  BranchSummary,
  OnboardingChecklist,
  TenantSummary,
} from "@virtual-school/shared";
import { Prisma, type Branch, type TenantStatus } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateBranchDto } from "./dto/create-branch.dto";
import type { CreateTenantDto } from "./dto/create-tenant.dto";
import type { UpdateTenantProfileDto } from "./dto/update-tenant-profile.dto";

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

  async updateProfile(
    tenantId: string,
    input: UpdateTenantProfileDto,
    actorId: string | undefined,
  ): Promise<TenantSummary> {
    const existing = await this.prisma.tenant.findUnique({
      where: {
        id: tenantId,
      },
    });

    if (!existing) {
      throw new NotFoundException(`Tenant ${tenantId} was not found`);
    }

    const updateData = this.profileUpdateData(input);
    const updated = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.update({
        data: updateData,
        where: {
          id: tenantId,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "tenant.profile_update",
          actorId,
          newValue: this.profileAuditValue(tenant),
          object: "Tenant",
          objectId: tenant.id,
          oldValue: this.profileAuditValue(existing),
          outcome: "SUCCESS",
          tenantId,
        },
      });

      return tenant;
    });

    return this.toSummary(updated);
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
      appCatalogItemCount,
      deviceCount,
      publishedPolicyCount,
      activeEnrollmentBatchCount,
      onboardingProgress,
    ] = await Promise.all([
      this.prisma.branch.count({ where: { tenantId } }),
      this.prisma.student.count({ where: { tenantId } }),
      this.prisma.classSection.count({ where: { tenantId } }),
      this.prisma.appCatalogItem.count({ where: { tenantId } }),
      this.prisma.device.count({ where: { tenantId } }),
      this.prisma.policy.count({ where: { tenantId, status: "PUBLISHED" } }),
      this.prisma.enrollmentBatch.count({
        where: { tenantId, status: "ACTIVE" },
      }),
      this.prisma.onboardingProgress.findUnique({ where: { tenantId } }),
    ]);

    const items = [
      {
        completed: Boolean(
          tenant.name && tenant.country && tenant.timezone && tenant.planKey,
        ),
        key: "school_profile" as const,
        label: "School profile complete",
        description:
          "Confirm the school identity, country, timezone, and plan.",
        href: "/tenants" as const,
      },
      {
        completed: branchCount > 0,
        key: "branch_created" as const,
        label: "Branch or campus created",
        description:
          "Add the campus that will own classes and managed devices.",
        href: "/tenants" as const,
      },
      {
        completed: studentCount > 0 || classCount > 0,
        key: "roster_started" as const,
        label: "Roster started",
        description: "Create or import at least one student or class.",
        href: "/roster" as const,
      },
      {
        completed: publishedPolicyCount > 0,
        key: "policy_template_created" as const,
        label: "Policy published",
        description:
          "Create, review, and publish the policy for the pilot device.",
        href: "/policies" as const,
      },
      {
        completed: appCatalogItemCount > 0,
        key: "app_catalog_configured" as const,
        label: "App catalog configured",
        description: "Approve at least one learning app before enrollment.",
        href: "/apps" as const,
      },
      {
        completed: activeEnrollmentBatchCount > 0,
        key: "enrollment_batch_generated" as const,
        label: "Enrollment batch generated",
        description:
          "Generate an active enrollment token for the pilot device.",
        href: "/enrollment" as const,
      },
      {
        completed: deviceCount > 0,
        key: "first_device_enrolled" as const,
        label: "First device enrolled",
        description:
          "Enroll one pilot tablet after every readiness check passes.",
        href: "/enrollment" as const,
      },
    ];

    const readinessItems = items.filter(
      (item) => item.key !== "first_device_enrolled",
    );
    const readinessIssues = readinessItems
      .filter((item) => !item.completed)
      .map((item) => item.label);

    return {
      completedCount: items.filter((item) => item.completed).length,
      completedAt: onboardingProgress?.completedAt?.toISOString() ?? null,
      items,
      readinessIssues,
      readyForFirstEnrollment: readinessIssues.length === 0,
      tenantId,
      totalCount: items.length,
    };
  }

  async completeOnboarding(
    tenantId: string,
    actorId: string | undefined,
  ): Promise<OnboardingChecklist> {
    const checklist = await this.getOnboardingChecklist(tenantId);
    if (checklist.completedCount !== checklist.totalCount) {
      throw new BadRequestException(
        "Complete every onboarding step before finishing setup",
      );
    }

    if (!checklist.completedAt) {
      const completedAt = new Date();
      await this.prisma.$transaction([
        this.prisma.onboardingProgress.upsert({
          create: { completedAt, completedBy: actorId, tenantId },
          update: { completedAt, completedBy: actorId },
          where: { tenantId },
        }),
        this.prisma.auditEvent.create({
          data: {
            action: "tenant.onboarding_complete",
            actorId,
            newValue: { completedAt: completedAt.toISOString() },
            object: "Tenant",
            objectId: tenantId,
            outcome: "SUCCESS",
            tenantId,
          },
        }),
      ]);
    }

    return this.getOnboardingChecklist(tenantId);
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
    accentColor?: string | null;
    country: string;
    id: string;
    logoUrl?: string | null;
    language: string;
    name: string;
    planKey: string;
    primaryColor?: string | null;
    status: TenantStatus;
    supportEmail?: string | null;
    supportPhone?: string | null;
    timezone: string;
    websiteUrl?: string | null;
  }): TenantSummary {
    return {
      accentColor: tenant.accentColor,
      country: tenant.country,
      id: tenant.id,
      logoUrl: tenant.logoUrl,
      language: tenant.language === "ur" ? "ur" : "en",
      name: tenant.name,
      planKey: tenant.planKey,
      primaryColor: tenant.primaryColor,
      status: tenant.status,
      supportEmail: tenant.supportEmail,
      supportPhone: tenant.supportPhone,
      timezone: tenant.timezone,
      websiteUrl: tenant.websiteUrl,
    };
  }

  private profileUpdateData(
    input: UpdateTenantProfileDto,
  ): Prisma.TenantUpdateInput {
    return Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined),
    ) as Prisma.TenantUpdateInput;
  }

  private profileAuditValue(tenant: {
    accentColor?: string | null;
    country: string;
    logoUrl?: string | null;
    language: string;
    name: string;
    primaryColor?: string | null;
    supportEmail?: string | null;
    supportPhone?: string | null;
    timezone: string;
    websiteUrl?: string | null;
  }): Prisma.InputJsonObject {
    return {
      accentColor: tenant.accentColor ?? null,
      country: tenant.country,
      logoUrl: tenant.logoUrl ?? null,
      language: tenant.language,
      name: tenant.name,
      primaryColor: tenant.primaryColor ?? null,
      supportEmail: tenant.supportEmail ?? null,
      supportPhone: tenant.supportPhone ?? null,
      timezone: tenant.timezone,
      websiteUrl: tenant.websiteUrl ?? null,
    };
  }
}
