import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  PolicyRuleSet,
  PolicyStatus,
  PolicySummary,
  PolicyVersionSummary,
} from "@virtual-school/shared";
import {
  type Policy,
  type PolicyVersion,
  Prisma,
} from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import type { CreatePolicyDto } from "./dto/create-policy.dto";
import type { PublishPolicyDto } from "./dto/publish-policy.dto";
import { starterPolicyTemplates } from "./starter-policy-templates";

@Injectable()
export class PoliciesService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listPolicies(tenantId: string): Promise<PolicySummary[]> {
    await this.ensureTenantExists(tenantId);

    const policies = await this.prisma.policy.findMany({
      orderBy: [{ status: "asc" }, { name: "asc" }],
      where: {
        tenantId,
      },
    });

    return policies.map((policy) => this.toPolicySummary(policy));
  }

  async createPolicy(
    tenantId: string,
    input: CreatePolicyDto,
  ): Promise<PolicySummary> {
    await this.ensureTenantExists(tenantId);

    const policy = await this.prisma.$transaction(async (tx) => {
      const created = await tx.policy.create({
        data: {
          name: input.name,
          rules: input.rules as Prisma.InputJsonValue,
          status: input.status ?? "DRAFT",
          tenantId,
        },
      });

      await tx.policyVersion.create({
        data: {
          policyId: created.id,
          snapshot: created.rules as Prisma.InputJsonValue,
          summary: input.summary ?? "Policy created",
          version: created.version,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "policy.create",
          newValue: {
            name: created.name,
            status: created.status,
            version: created.version,
          },
          object: "Policy",
          objectId: created.id,
          outcome: "SUCCESS",
          tenantId,
        },
      });

      return created;
    });

    return this.toPolicySummary(policy);
  }

  async createStarterTemplates(tenantId: string): Promise<PolicySummary[]> {
    await this.ensureTenantExists(tenantId);

    const policies = await this.prisma.$transaction(async (tx) => {
      const createdOrExisting: Policy[] = [];

      for (const template of starterPolicyTemplates) {
        const existing = await tx.policy.findFirst({
          where: {
            name: template.name,
            tenantId,
          },
        });

        if (existing) {
          createdOrExisting.push(existing);
          continue;
        }

        const created = await tx.policy.create({
          data: {
            name: template.name,
            rules: template.rules as Prisma.InputJsonValue,
            status: "DRAFT",
            tenantId,
          },
        });

        await tx.policyVersion.create({
          data: {
            policyId: created.id,
            snapshot: created.rules as Prisma.InputJsonValue,
            summary: `Starter template ${template.key} created`,
            version: created.version,
          },
        });

        await tx.auditEvent.create({
          data: {
            action: "policy_template.create",
            newValue: {
              key: template.key,
              name: created.name,
              status: created.status,
              version: created.version,
            },
            object: "Policy",
            objectId: created.id,
            outcome: "SUCCESS",
            tenantId,
          },
        });

        createdOrExisting.push(created);
      }

      return createdOrExisting;
    });

    return policies.map((policy) => this.toPolicySummary(policy));
  }

  async publishPolicy(
    tenantId: string,
    policyId: string,
    input: PublishPolicyDto,
  ): Promise<PolicySummary> {
    const policy = await this.prisma.policy.findFirst({
      where: {
        id: policyId,
        tenantId,
      },
    });

    if (!policy) {
      throw new NotFoundException(
        `Policy ${policyId} was not found for tenant ${tenantId}`,
      );
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.policy.update({
        data: {
          status: "PUBLISHED",
          version: {
            increment: 1,
          },
        },
        where: {
          id: policy.id,
        },
      });

      await tx.policyVersion.create({
        data: {
          actorId: input.actorId,
          policyId: saved.id,
          snapshot: saved.rules as Prisma.InputJsonValue,
          summary: input.reason ?? "Policy published",
          version: saved.version,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "policy.publish",
          actorId: input.actorId,
          newValue: {
            status: saved.status,
            version: saved.version,
          },
          object: "Policy",
          objectId: saved.id,
          oldValue: {
            status: policy.status,
            version: policy.version,
          },
          outcome: "SUCCESS",
          reason: input.reason,
          tenantId,
        },
      });

      return saved;
    });

    return this.toPolicySummary(updated);
  }

  async listPolicyVersions(
    tenantId: string,
    policyId: string,
  ): Promise<PolicyVersionSummary[]> {
    const policy = await this.prisma.policy.findFirst({
      select: {
        id: true,
      },
      where: {
        id: policyId,
        tenantId,
      },
    });

    if (!policy) {
      throw new NotFoundException(
        `Policy ${policyId} was not found for tenant ${tenantId}`,
      );
    }

    const versions = await this.prisma.policyVersion.findMany({
      orderBy: {
        version: "desc",
      },
      where: {
        policyId,
      },
    });

    return versions.map((version) => this.toPolicyVersionSummary(version));
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

  private toPolicySummary(policy: Policy): PolicySummary {
    return {
      createdAt: policy.createdAt.toISOString(),
      id: policy.id,
      name: policy.name,
      rules: policy.rules as PolicyRuleSet,
      status: policy.status as PolicyStatus,
      tenantId: policy.tenantId,
      updatedAt: policy.updatedAt.toISOString(),
      version: policy.version,
    };
  }

  private toPolicyVersionSummary(version: PolicyVersion): PolicyVersionSummary {
    return {
      actorId: version.actorId,
      createdAt: version.createdAt.toISOString(),
      id: version.id,
      policyId: version.policyId,
      snapshot: version.snapshot as PolicyRuleSet,
      summary: version.summary,
      version: version.version,
    };
  }
}
