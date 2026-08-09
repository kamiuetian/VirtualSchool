import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateResellerPartnerDto,
  ProvisionResellerTenantDto,
  UpdateResellerCustomerDto,
} from "./reseller.dto";

@Injectable()
export class ResellerService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createPartner(input: CreateResellerPartnerDto, actorId?: string) {
    if (!input.operatorIds?.length || !input.allowedPlanKeys?.length)
      throw new BadRequestException("Operators and allowed plans are required");
    return this.prisma.$transaction(async (tx) => {
      const partner = await tx.resellerPartner.create({ data: input });
      await tx.auditEvent.create({
        data: {
          actorId,
          action: "reseller.partner.create",
          object: "ResellerPartner",
          objectId: partner.id,
          outcome: "CREATED",
          newValue: {
            name: partner.name,
            maxCustomers: partner.maxCustomers,
            allowedPlanKeys: partner.allowedPlanKeys,
          },
        },
      });
      return partner;
    });
  }

  async portfolio(partnerId: string, actorId?: string) {
    const partner = await this.requirePartner(partnerId, actorId);
    const customers = await this.prisma.resellerCustomer.findMany({
      where: { partnerId },
      orderBy: { createdAt: "desc" },
      include: {
        tenant: {
          include: {
            _count: {
              select: {
                students: true,
                devices: true,
                supportTickets: {
                  where: { status: { notIn: ["RESOLVED", "CLOSED"] } },
                },
              },
            },
          },
        },
      },
    });
    return {
      partner: {
        id: partner.id,
        name: partner.name,
        maxCustomers: partner.maxCustomers,
      },
      totals: {
        customers: customers.length,
        remainingCapacity: Math.max(0, partner.maxCustomers - customers.length),
        students: customers.reduce((n, c) => n + c.tenant._count.students, 0),
        devices: customers.reduce((n, c) => n + c.tenant._count.devices, 0),
        openTickets: customers.reduce(
          (n, c) => n + c.tenant._count.supportTickets,
          0,
        ),
      },
      customers: customers.map((c) => ({
        id: c.id,
        tenantId: c.tenantId,
        name: c.tenant.name,
        status: c.tenant.status,
        planKey: c.tenant.planKey,
        onboardingState: c.onboardingState,
        renewalAt: c.renewalAt?.toISOString() ?? null,
        counts: c.tenant._count,
        actions: {
          updateOnboarding: partner.status === "ACTIVE",
          openTenant: true,
          provision: false,
        },
      })),
    };
  }

  async provision(
    partnerId: string,
    input: ProvisionResellerTenantDto,
    actorId?: string,
  ) {
    const partner = await this.requirePartner(partnerId, actorId);
    if (!partner.allowedPlanKeys.includes(input.planKey))
      throw new BadRequestException(
        "Plan is outside this reseller's commercial limits",
      );
    if (partner.approvalRequired && !input.approved)
      throw new BadRequestException("Provisioning approval is required");
    return this.prisma.$transaction(
      async (tx) => {
        const count = await tx.resellerCustomer.count({ where: { partnerId } });
        if (count >= partner.maxCustomers)
          throw new BadRequestException(
            "Reseller customer limit has been reached",
          );
        const tenant = await tx.tenant.create({
          data: {
            name: input.name.trim(),
            country: input.country,
            timezone: input.timezone,
            planKey: input.planKey,
            domain: input.domain,
            status: "PILOT",
          },
        });
        const customer = await tx.resellerCustomer.create({
          data: {
            partnerId,
            tenantId: tenant.id,
            externalRef: input.externalRef,
            renewalAt: input.renewalAt ? new Date(input.renewalAt) : undefined,
            provisionedBy: actorId,
          },
        });
        await tx.auditEvent.create({
          data: {
            tenantId: tenant.id,
            actorId,
            action: "reseller.customer.provision",
            object: "ResellerCustomer",
            objectId: customer.id,
            outcome: "PROVISIONED",
            newValue: {
              partnerId,
              planKey: input.planKey,
              approved: input.approved,
            },
          },
        });
        return { customer, tenant };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async updateCustomer(
    partnerId: string,
    customerId: string,
    input: UpdateResellerCustomerDto,
    actorId?: string,
  ) {
    await this.requirePartner(partnerId, actorId);
    const current = await this.prisma.resellerCustomer.findFirst({
      where: { id: customerId, partnerId },
    });
    if (!current)
      throw new NotFoundException("Assigned customer was not found");
    return this.prisma.$transaction(async (tx) => {
      const saved = await tx.resellerCustomer.update({
        where: { id: customerId },
        data: {
          onboardingState: input.onboardingState,
          renewalAt: input.renewalAt ? new Date(input.renewalAt) : undefined,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: current.tenantId,
          actorId,
          action: "reseller.customer.update",
          object: "ResellerCustomer",
          objectId: customerId,
          outcome: "UPDATED",
          oldValue: {
            onboardingState: current.onboardingState,
            renewalAt: current.renewalAt,
          },
          newValue: {
            onboardingState: input.onboardingState,
            renewalAt: input.renewalAt,
          },
        },
      });
      return saved;
    });
  }

  private async requirePartner(partnerId: string, actorId?: string) {
    const partner = await this.prisma.resellerPartner.findUnique({
      where: { id: partnerId },
    });
    if (!partner || partner.status !== "ACTIVE")
      throw new NotFoundException("Active reseller was not found");
    if (!actorId || !partner.operatorIds.includes(actorId))
      throw new ForbiddenException("Operator is not assigned to this reseller");
    return partner;
  }
}
