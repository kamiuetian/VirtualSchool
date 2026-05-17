import { Injectable, NotFoundException } from "@nestjs/common";
import type { TenantSummary } from "@virtual-school/shared";
import type { TenantStatus } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import type { CreateTenantDto } from "./dto/create-tenant.dto";

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<TenantSummary[]> {
    const tenants = await this.prisma.tenant.findMany({
      orderBy: {
        createdAt: "desc"
      }
    });

    return tenants.map((tenant) => this.toSummary(tenant));
  }

  async getById(tenantId: string): Promise<TenantSummary> {
    const tenant = await this.prisma.tenant.findUnique({
      where: {
        id: tenantId
      }
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant ${tenantId} was not found`);
    }

    return this.toSummary(tenant);
  }

  async create(input: CreateTenantDto): Promise<TenantSummary> {
    const tenant = await this.prisma.$transaction(async (tx) => {
      const created = await tx.tenant.create({
        data: {
          country: input.country,
          name: input.name,
          planKey: input.planKey,
          status: input.status,
          timezone: input.timezone
        }
      });

      await tx.auditEvent.create({
        data: {
          action: "tenant.create",
          newValue: {
            country: created.country,
            name: created.name,
            planKey: created.planKey,
            status: created.status,
            timezone: created.timezone
          },
          object: "Tenant",
          objectId: created.id,
          outcome: "SUCCESS",
          tenantId: created.id
        }
      });

      return created;
    });

    return this.toSummary(tenant);
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
      timezone: tenant.timezone
    };
  }
}
