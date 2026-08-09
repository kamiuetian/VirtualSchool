import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { ResellerService } from "./reseller.service";

const partner = {
  id: "partner-1",
  name: "North",
  status: "ACTIVE",
  operatorIds: ["operator-1"],
  maxCustomers: 2,
  allowedPlanKeys: ["pilot"],
  approvalRequired: true,
};

describe("ResellerService", () => {
  it("denies operators from another reseller", async () => {
    const service = new ResellerService({
      resellerPartner: { findUnique: async () => partner },
    } as never);
    await expect(
      service.portfolio("partner-1", "operator-2"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("does not reveal a customer assigned to another portfolio", async () => {
    const service = new ResellerService({
      resellerPartner: { findUnique: async () => partner },
      resellerCustomer: { findFirst: async () => null },
    } as never);
    await expect(
      service.updateCustomer(
        "partner-1",
        "customer-2",
        { onboardingState: "LIVE" },
        "operator-1",
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("enforces plan, approval, and customer-count limits before provisioning", async () => {
    const service = new ResellerService({
      resellerPartner: { findUnique: async () => partner },
    } as never);
    const base = {
      name: "School",
      country: "PK",
      timezone: "Asia/Karachi",
      planKey: "enterprise",
      approved: true,
    };
    await expect(
      service.provision("partner-1", base, "operator-1"),
    ).rejects.toThrow("commercial limits");
    await expect(
      service.provision(
        "partner-1",
        { ...base, planKey: "pilot", approved: false },
        "operator-1",
      ),
    ).rejects.toThrow("approval is required");

    const limited = new ResellerService({
      resellerPartner: {
        findUnique: async () => ({ ...partner, maxCustomers: 1 }),
      },
      $transaction: async (work: any) =>
        work({ resellerCustomer: { count: async () => 1 } }),
    } as never);
    await expect(
      limited.provision(
        "partner-1",
        { ...base, planKey: "pilot" },
        "operator-1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("provisions and audits a tenant atomically", async () => {
    const writes: any[] = [];
    const tx = {
      resellerCustomer: {
        count: async () => 0,
        create: async ({ data }: any) => (
          writes.push(data), { id: "customer-1", ...data }
        ),
      },
      tenant: {
        create: async ({ data }: any) => ({ id: "tenant-1", ...data }),
      },
      auditEvent: { create: async ({ data }: any) => writes.push(data) },
    };
    const service = new ResellerService({
      resellerPartner: { findUnique: async () => partner },
      $transaction: async (work: any) => work(tx),
    } as never);
    await service.provision(
      "partner-1",
      {
        name: "School",
        country: "PK",
        timezone: "Asia/Karachi",
        planKey: "pilot",
        approved: true,
      },
      "operator-1",
    );
    expect(writes[0]).toMatchObject({
      partnerId: "partner-1",
      tenantId: "tenant-1",
      provisionedBy: "operator-1",
    });
    expect(writes[1]).toMatchObject({
      action: "reseller.customer.provision",
      outcome: "PROVISIONED",
      tenantId: "tenant-1",
    });
  });

  it("validates approved domains and sender identity before saving branding", async () => {
    const service = new ResellerService({
      resellerPartner: { findUnique: async () => partner },
    } as never);
    await expect(
      service.updateBranding(
        "partner-1",
        {
          approvedDomains: ["north.example"],
          emailSenderName: "North Schools",
          emailSenderEmail: "hello@another.example",
        },
        "operator-1",
      ),
    ).rejects.toThrow("approved partner domain");
    await expect(
      service.updateBranding(
        "partner-1",
        { approvedDomains: ["not a domain"], primaryColor: "blue" },
        "operator-1",
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("normalizes, saves, and audits reseller white-label settings", async () => {
    const writes: any[] = [];
    const service = new ResellerService({
      resellerPartner: { findUnique: async () => partner },
      $transaction: async (work: any) =>
        work({
          resellerPartner: {
            update: async ({ data }: any) => ({ ...partner, ...data }),
          },
          auditEvent: { create: async ({ data }: any) => writes.push(data) },
        }),
    } as never);
    const result = await service.updateBranding(
      "partner-1",
      {
        approvedDomains: [" Portal.North.Example/", "portal.north.example"],
        logoUrl: "https://cdn.north.example/logo.png",
        primaryColor: "#AABBCC",
        emailSenderName: "North Schools",
        emailSenderEmail: "WELCOME@PORTAL.NORTH.EXAMPLE",
      },
      "operator-1",
    );
    expect(result).toMatchObject({
      approvedDomains: ["portal.north.example"],
      primaryColor: "#aabbcc",
      emailSenderEmail: "welcome@portal.north.example",
    });
    expect(writes[0]).toMatchObject({
      action: "reseller.branding.update",
      objectId: "partner-1",
      outcome: "UPDATED",
    });
  });

  it("reports commercial totals without querying learning records", async () => {
    const service = new ResellerService({
      resellerPartner: { findUnique: async () => partner },
      resellerCustomer: {
        findMany: async () => [
          {
            id: "customer-1",
            externalRef: "crm-1",
            onboardingState: "LIVE",
            renewalAt: new Date("2027-01-01T00:00:00.000Z"),
            tenant: {
              id: "tenant-1",
              name: "Customer School",
              planKey: "pilot",
              _count: { students: 20, devices: 12 },
              billingSubscription: {
                planKey: "growth",
                status: "ACTIVE",
                billingPeriodStart: new Date("2026-12-01T00:00:00.000Z"),
                billingPeriodEnd: new Date("2027-01-01T00:00:00.000Z"),
              },
            },
          },
        ],
      },
    } as never);
    const report = await service.commercialReport("partner-1", "operator-1");
    expect(report.totals).toMatchObject({
      customers: 1,
      students: 20,
      devices: 12,
    });
    expect(report.billingByPlan).toEqual({ growth: 1 });
    expect(report.billingByStatus).toEqual({ ACTIVE: 1 });
    expect(report.customers[0]).not.toHaveProperty("attendance");
    expect(report.customers[0]).not.toHaveProperty("engagement");
  });

  it("keeps implementation projects inside the assigned tenant or portfolio", async () => {
    const service = new ResellerService({
      resellerCustomer: {
        findFirst: async () => ({
          id: "customer-1",
          tenantId: "tenant-1",
          partner: { ...partner, operatorIds: ["operator-1"] },
        }),
      },
    } as never);
    await expect(
      service.implementationProject("partner-1", "customer-1", "outsider", [
        "tenant-2",
      ]),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("computes go-live blockers and refuses a premature ready status", async () => {
    const service = new ResellerService({
      resellerCustomer: {
        findFirst: async () => ({
          id: "customer-1",
          tenantId: "tenant-1",
          partner,
        }),
      },
    } as never);
    await expect(
      service.saveImplementationProject(
        "partner-1",
        "customer-1",
        {
          name: "Customer launch",
          status: "READY",
          ownerIds: ["owner-1"],
          targetGoLiveAt: "2026-09-01T00:00:00.000Z",
          milestones: [
            {
              id: "security-review",
              title: "Security review",
              ownerId: "owner-1",
              status: "IN_PROGRESS",
              dueAt: "2026-08-20T00:00:00.000Z",
              readinessGate: true,
              evidenceIds: [],
            },
          ],
          risks: [],
          evidence: [],
          decisions: [],
          reason: "Review readiness",
        },
        "operator-1",
      ),
    ).rejects.toThrow("every go-live gate passes");
  });

  it("saves a ready project with immutable history and audit evidence", async () => {
    const writes: any[] = [];
    const tx = {
      implementationProject: {
        findUnique: async () => null,
        create: async ({ data }: any) => ({
          id: "project-1",
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
      implementationProjectEvent: {
        create: async ({ data }: any) => writes.push(data),
      },
      auditEvent: { create: async ({ data }: any) => writes.push(data) },
    };
    const service = new ResellerService({
      resellerCustomer: {
        findFirst: async () => ({
          id: "customer-1",
          tenantId: "tenant-1",
          partner,
        }),
      },
      $transaction: async (work: any) => work(tx),
    } as never);
    const result = await service.saveImplementationProject(
      "partner-1",
      "customer-1",
      {
        name: "Customer launch",
        status: "READY",
        ownerIds: ["owner-1"],
        targetGoLiveAt: "2026-09-01T00:00:00.000Z",
        milestones: [
          {
            id: "security-review",
            title: "Security review",
            ownerId: "owner-1",
            status: "COMPLETE",
            dueAt: "2026-08-20T00:00:00.000Z",
            readinessGate: true,
            evidenceIds: ["evidence-1"],
          },
        ],
        risks: [],
        evidence: [
          {
            id: "evidence-1",
            title: "Signed review",
            url: "https://evidence.example/review",
          },
        ],
        decisions: [],
        reason: "Approve launch readiness",
      },
      "operator-1",
    );
    expect(result.readiness.ready).toBe(true);
    expect(writes[0]).toMatchObject({
      projectId: "project-1",
      action: "CREATED",
      reason: "Approve launch readiness",
    });
    expect(writes[1]).toMatchObject({
      tenantId: "tenant-1",
      action: "implementation.project.create",
      outcome: "CREATED",
    });
  });
});
