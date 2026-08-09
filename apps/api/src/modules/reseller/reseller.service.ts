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
  UpdateResellerBrandingDto,
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

  async updateBranding(
    partnerId: string,
    input: UpdateResellerBrandingDto,
    actorId?: string,
  ) {
    const partner = await this.requirePartner(partnerId, actorId);
    if (!input.approvedDomains?.length)
      throw new BadRequestException("At least one approved domain is required");
    const approvedDomains = [
      ...new Set(input.approvedDomains.map(normalizeDomain)),
    ];
    if (approvedDomains.some((domain) => !isDomain(domain)))
      throw new BadRequestException(
        "Approved domains must be valid host names",
      );
    const senderEmail = input.emailSenderEmail?.trim().toLowerCase();
    if (Boolean(senderEmail) !== Boolean(input.emailSenderName?.trim()))
      throw new BadRequestException(
        "Email sender name and address must be configured together",
      );
    if (senderEmail) {
      const senderDomain = senderEmail.split("@")[1];
      if (!senderDomain || !approvedDomains.includes(senderDomain))
        throw new BadRequestException(
          "Email sender must use an approved partner domain",
        );
      if (!input.emailSenderName?.trim())
        throw new BadRequestException("Email sender name is required");
    }
    if (input.logoUrl) {
      try {
        const url = new URL(input.logoUrl);
        if (url.protocol !== "https:") throw new Error();
      } catch {
        throw new BadRequestException("Logo URL must be a valid HTTPS URL");
      }
    }
    if (
      [input.primaryColor, input.accentColor].some(
        (color) => color && !/^#[0-9a-f]{6}$/i.test(color.trim()),
      )
    )
      throw new BadRequestException(
        "Brand colors must use six-digit hex values",
      );
    const data = {
      approvedDomains,
      logoUrl: input.logoUrl?.trim() ?? null,
      primaryColor: normalizeColor(input.primaryColor),
      accentColor: normalizeColor(input.accentColor),
      emailSenderName: input.emailSenderName?.trim() ?? null,
      emailSenderEmail: senderEmail ?? null,
      brandingUpdatedBy: actorId,
    };
    return this.prisma.$transaction(async (tx) => {
      const saved = await tx.resellerPartner.update({
        where: { id: partnerId },
        data,
      });
      await tx.auditEvent.create({
        data: {
          actorId,
          action: "reseller.branding.update",
          object: "ResellerPartner",
          objectId: partnerId,
          outcome: "UPDATED",
          oldValue: brandingEvidence(partner),
          newValue: brandingEvidence(saved),
        },
      });
      return brandingEvidence(saved);
    });
  }

  async commercialReport(partnerId: string, actorId?: string) {
    const partner = await this.requirePartner(partnerId, actorId);
    const customers = await this.prisma.resellerCustomer.findMany({
      where: { partnerId },
      orderBy: { renewalAt: "asc" },
      include: {
        tenant: {
          include: {
            billingSubscription: true,
            _count: { select: { students: true, devices: true } },
          },
        },
      },
    });
    const now = new Date();
    const rows = customers.map(({ tenant, ...customer }) => ({
      customerId: customer.id,
      tenantId: tenant.id,
      customerName: tenant.name,
      externalRef: customer.externalRef,
      onboardingState: customer.onboardingState,
      renewalAt: customer.renewalAt?.toISOString() ?? null,
      renewalState: renewalState(customer.renewalAt, now),
      usage: {
        students: tenant._count.students,
        devices: tenant._count.devices,
      },
      billing: {
        planKey: tenant.billingSubscription?.planKey ?? tenant.planKey,
        status: tenant.billingSubscription?.status ?? "UNCONFIGURED",
        periodStart:
          tenant.billingSubscription?.billingPeriodStart?.toISOString() ?? null,
        periodEnd:
          tenant.billingSubscription?.billingPeriodEnd?.toISOString() ?? null,
      },
    }));
    return {
      generatedAt: now.toISOString(),
      partner: { id: partner.id, name: partner.name },
      totals: {
        customers: rows.length,
        students: rows.reduce((total, row) => total + row.usage.students, 0),
        devices: rows.reduce((total, row) => total + row.usage.devices, 0),
        renewalsOverdue: rows.filter((row) => row.renewalState === "OVERDUE")
          .length,
        renewalsDueSoon: rows.filter((row) => row.renewalState === "DUE_SOON")
          .length,
      },
      billingByPlan: countBy(rows, (row) => row.billing.planKey),
      billingByStatus: countBy(rows, (row) => row.billing.status),
      customers: rows,
      privacy:
        "Commercial metadata and aggregate usage only; learning records are excluded.",
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

function normalizeDomain(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
}

function isDomain(value: string) {
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
    value,
  );
}

function normalizeColor(value?: string) {
  return value?.trim().toLowerCase() ?? null;
}

function brandingEvidence(value: any) {
  return {
    approvedDomains: value.approvedDomains ?? [],
    logoUrl: value.logoUrl ?? null,
    primaryColor: value.primaryColor ?? null,
    accentColor: value.accentColor ?? null,
    emailSenderName: value.emailSenderName ?? null,
    emailSenderEmail: value.emailSenderEmail ?? null,
  };
}

function renewalState(value: Date | null, now: Date) {
  if (!value) return "UNSCHEDULED";
  if (value < now) return "OVERDUE";
  const dueSoon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  return value <= dueSoon ? "DUE_SOON" : "SCHEDULED";
}

function countBy<T>(values: T[], key: (value: T) => string) {
  return values.reduce<Record<string, number>>((counts, value) => {
    const name = key(value);
    counts[name] = (counts[name] ?? 0) + 1;
    return counts;
  }, {});
}
