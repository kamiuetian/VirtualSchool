import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  ActivePolicyResolution,
  DevicePolicyPayload,
  LearningMode,
  PolicyAssignmentScope,
  PolicyAssignmentSummary,
  PolicyMdmPublishStatus,
  PolicyPublishSummary,
  PolicyRuleSet,
  PolicyStatus,
  PolicySummary,
  PolicyVersionSummary,
} from "@virtual-school/shared";
import {
  type AppCatalogItem,
  type Policy,
  type PolicyAssignment,
  type PolicyVersion,
  Prisma,
} from "../../generated/prisma";
import { MdmConnectorRegistry } from "../mdm-connectors/mdm-connector.registry";
import type { MdmPolicyPublishResult } from "../mdm-connectors/mdm-connector.types";
import { PrismaService } from "../prisma/prisma.service";
import type { AssignPolicyDto } from "./dto/assign-policy.dto";
import type { CreatePolicyDto } from "./dto/create-policy.dto";
import type { PublishPolicyDto } from "./dto/publish-policy.dto";
import { starterPolicyTemplates } from "./starter-policy-templates";

type PolicyAssignmentWithPolicy = PolicyAssignment & {
  policy: Policy;
};

const policyPrecedence: Record<LearningMode, number> = {
  LOST_DEVICE: 100,
  EXAM: 90,
  EMERGENCY_SUPPORT_OVERRIDE: 80,
  TIMETABLE_CLASS: 70,
  HOMEWORK_AFTER_SCHOOL: 60,
  DEVICE_BASELINE: 50,
  DEFAULT_SCHOOL: 10,
};

@Injectable()
export class PoliciesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MdmConnectorRegistry)
    private readonly connectorRegistry: MdmConnectorRegistry,
  ) {}

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
  ): Promise<PolicyPublishSummary> {
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
          mdmPublishError: null,
          mdmPublishStatus: null,
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

    const apps = await this.getApprovedPolicyApps(tenantId, updated);
    const connector = this.connectorRegistry.getActiveConnector();
    let publishResult: MdmPolicyPublishResult;

    try {
      publishResult = await connector.publishPolicy({
        apps,
        policy: {
          id: updated.id,
          name: updated.name,
          rules: updated.rules as PolicyRuleSet,
          version: updated.version,
        },
        tenantId,
      });
    } catch (error) {
      publishResult = {
        accepted: false,
        connector: connector.key,
        failureReason:
          error instanceof Error ? error.message : "MDM policy publish failed",
        retryable: true,
      };
    }

    const publishStatus: PolicyMdmPublishStatus = publishResult.accepted
      ? "PUBLISHED"
      : publishResult.skipped
        ? "SKIPPED"
        : "FAILED";
    const mdmUpdated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.policy.update({
        data: {
          mdmPolicyName: publishResult.mdmPolicyName ?? null,
          mdmPublishError: publishResult.failureReason,
          mdmPublishRequest:
            (publishResult.request as Prisma.InputJsonValue | undefined) ??
            Prisma.JsonNull,
          mdmPublishResponse:
            (publishResult.response as Prisma.InputJsonValue | undefined) ??
            Prisma.JsonNull,
          mdmPublishStatus: publishStatus,
          mdmPublishedAt: publishResult.accepted ? new Date() : null,
        },
        where: {
          id: updated.id,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: publishResult.accepted
            ? "policy.mdm_publish"
            : "policy.mdm_publish_fail",
          actorId: input.actorId,
          newValue: {
            connector: publishResult.connector,
            mdmPolicyName: publishResult.mdmPolicyName,
            mdmPublishStatus: publishStatus,
          },
          object: "Policy",
          objectId: saved.id,
          outcome: publishStatus,
          reason: publishResult.failureReason ?? input.reason,
          tenantId,
        },
      });

      return saved;
    });

    return this.toPolicyPublishSummary(mdmUpdated);
  }

  async listPolicyAssignments(
    tenantId: string,
  ): Promise<PolicyAssignmentSummary[]> {
    await this.ensureTenantExists(tenantId);

    const assignments = await this.prisma.policyAssignment.findMany({
      include: {
        policy: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      where: {
        tenantId,
      },
    });

    return assignments.map((assignment) =>
      this.toPolicyAssignmentSummary(assignment),
    );
  }

  async assignPolicy(
    tenantId: string,
    policyId: string,
    input: AssignPolicyDto,
  ): Promise<PolicyAssignmentSummary> {
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

    if (policy.status !== "PUBLISHED") {
      throw new BadRequestException("Only published policies can be assigned");
    }

    this.validateAssignmentScope(input.scope, input.scopeId);
    await this.ensureAssignmentTargetExists(
      tenantId,
      input.scope,
      input.scopeId,
    );

    const assignment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.policyAssignment.create({
        data: {
          actorId: input.actorId,
          endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
          policyId,
          reason: input.reason,
          scope: input.scope,
          scopeId: input.scopeId,
          startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
          tenantId,
        },
        include: {
          policy: true,
        },
      });

      await tx.auditEvent.create({
        data: {
          action: "policy.assign",
          actorId: input.actorId,
          newValue: {
            endsAt: created.endsAt,
            policyId,
            policyVersion: policy.version,
            scope: created.scope,
            scopeId: created.scopeId,
            startsAt: created.startsAt,
          },
          object: "PolicyAssignment",
          objectId: created.id,
          outcome: "SUCCESS",
          reason: input.reason,
          tenantId,
        },
      });

      return created;
    });

    return this.toPolicyAssignmentSummary(assignment);
  }

  async resolveActivePolicyForDevice(
    tenantId: string,
    deviceId: string,
  ): Promise<ActivePolicyResolution> {
    const device = await this.prisma.device.findFirst({
      include: {
        student: {
          select: {
            grade: true,
            id: true,
          },
        },
      },
      where: {
        id: deviceId,
        tenantId,
      },
    });

    if (!device) {
      throw new NotFoundException(
        `Device ${deviceId} was not found for tenant ${tenantId}`,
      );
    }

    const scopeMatches: Array<{ scope: string; scopeId?: string | null }> = [
      {
        scope: "TENANT",
        scopeId: null,
      },
    ];

    if (device.student?.grade) {
      scopeMatches.push({
        scope: "GRADE",
        scopeId: device.student.grade,
      });
    }

    if (device.classId) {
      scopeMatches.push({
        scope: "CLASS",
        scopeId: device.classId,
      });
    }

    if (device.studentId) {
      scopeMatches.push({
        scope: "STUDENT",
        scopeId: device.studentId,
      });
    }

    scopeMatches.push({
      scope: "DEVICE",
      scopeId: device.id,
    });

    const now = new Date();
    const assignments = await this.prisma.policyAssignment.findMany({
      include: {
        policy: true,
      },
      where: {
        active: true,
        tenantId,
        OR: scopeMatches,
        policy: {
          status: "PUBLISHED",
        },
        AND: [
          {
            OR: [
              {
                startsAt: null,
              },
              {
                startsAt: {
                  lte: now,
                },
              },
            ],
          },
          {
            OR: [
              {
                endsAt: null,
              },
              {
                endsAt: {
                  gt: now,
                },
              },
            ],
          },
        ],
      },
    });

    if (assignments.length === 0) {
      throw new NotFoundException(
        `No active published policy assignment was found for device ${deviceId}`,
      );
    }

    const candidates = assignments.map((assignment) => {
      const rules = assignment.policy.rules as PolicyRuleSet;

      return {
        id: assignment.id,
        mode: rules.mode,
        policyVersion: assignment.policy.version,
        source: this.assignmentSource(assignment),
      };
    });

    const sortedCandidates = [...candidates].sort((left, right) => {
      const precedenceDiff =
        policyPrecedence[right.mode] - policyPrecedence[left.mode];
      if (precedenceDiff !== 0) {
        return precedenceDiff;
      }

      return right.policyVersion - left.policyVersion;
    });
    const resolved = sortedCandidates[0];
    if (!resolved) {
      throw new Error("Policy resolution failed");
    }
    const activeAssignment = assignments.find(
      (assignment) => assignment.id === resolved.id,
    );

    if (!activeAssignment) {
      throw new Error("Policy assignment resolution failed");
    }

    return {
      activePolicy: this.toPolicySummary(activeAssignment.policy),
      assignment: this.toPolicyAssignmentSummary(activeAssignment),
      deviceId,
      evaluated: assignments.map((assignment) => {
        const rules = assignment.policy.rules as PolicyRuleSet;

        return {
          assignment: this.toPolicyAssignmentSummary(assignment),
          mode: rules.mode,
          precedence: policyPrecedence[rules.mode],
          source: this.assignmentSource(assignment),
        };
      }),
      explanation: `${resolved.mode} from ${resolved.source} won with precedence ${policyPrecedence[resolved.mode]} and policy version ${resolved.policyVersion}.`,
      tenantId,
    };
  }

  async getDevicePolicyPayload(
    tenantId: string,
    deviceId: string,
  ): Promise<DevicePolicyPayload> {
    const resolution = await this.resolveActivePolicyForDevice(
      tenantId,
      deviceId,
    );
    const rules = resolution.activePolicy.rules;

    const apps =
      rules.approvedAppPackageIds.length === 0
        ? []
        : await this.prisma.appCatalogItem.findMany({
            orderBy: {
              name: "asc",
            },
            where: {
              approvalStatus: "APPROVED",
              packageId: {
                in: rules.approvedAppPackageIds,
              },
              tenantId,
            },
          });

    return {
      browser: {
        defaultWebAccess: rules.defaultWebAccess,
        urlAllowlist: rules.urlAllowlist,
        urlBlocklist: rules.urlBlocklist,
      },
      cache: {
        ttlSeconds: 3600,
        useLastKnownPolicyWhenOffline: true,
      },
      deviceId,
      generatedAt: new Date().toISOString(),
      launcher: {
        approvedApps: apps.map((app) => ({
          category: app.category,
          iconUrl: app.iconUrl,
          installType:
            typeof app.installRules === "object" &&
            app.installRules !== null &&
            !Array.isArray(app.installRules) &&
            "installType" in app.installRules
              ? (app.installRules.installType as
                  | "AVAILABLE"
                  | "FORCE_INSTALLED"
                  | "BLOCKED")
              : undefined,
          name: app.name,
          packageId: app.packageId,
        })),
        showMessages: rules.launcher.showMessages,
        showSupportContact: rules.launcher.showSupportContact,
        webShortcuts: rules.webShortcuts,
      },
      policy: {
        explanation: resolution.explanation,
        id: resolution.activePolicy.id,
        mode: rules.mode,
        name: resolution.activePolicy.name,
        source: `${resolution.assignment.scope}:${resolution.assignment.scopeId ?? "baseline"}`,
        version: resolution.activePolicy.version,
      },
      restrictions: rules.restrictions,
      tenantId,
    };
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

  private validateAssignmentScope(
    scope: PolicyAssignmentScope,
    scopeId: string | undefined,
  ): void {
    if (scope === "TENANT" && scopeId) {
      throw new BadRequestException(
        "Tenant baseline assignments must not include scopeId",
      );
    }

    if (scope !== "TENANT" && !scopeId) {
      throw new BadRequestException(`${scope} assignments require scopeId`);
    }
  }

  private async ensureAssignmentTargetExists(
    tenantId: string,
    scope: PolicyAssignmentScope,
    scopeId: string | undefined,
  ): Promise<void> {
    if (scope === "TENANT") {
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

  private toPolicySummary(policy: Policy): PolicySummary {
    return {
      createdAt: policy.createdAt.toISOString(),
      id: policy.id,
      mdmPolicyName: policy.mdmPolicyName,
      mdmPublishError: policy.mdmPublishError,
      mdmPublishedAt: policy.mdmPublishedAt?.toISOString() ?? null,
      mdmPublishStatus:
        (policy.mdmPublishStatus as PolicyMdmPublishStatus | null) ?? null,
      name: policy.name,
      rules: policy.rules as PolicyRuleSet,
      status: policy.status as PolicyStatus,
      tenantId: policy.tenantId,
      updatedAt: policy.updatedAt.toISOString(),
      version: policy.version,
    };
  }

  private toPolicyPublishSummary(policy: Policy): PolicyPublishSummary {
    return {
      ...this.toPolicySummary(policy),
      mdmPublishRequest: this.jsonRecord(policy.mdmPublishRequest),
      mdmPublishResponse: this.jsonRecord(policy.mdmPublishResponse),
    };
  }

  private async getApprovedPolicyApps(
    tenantId: string,
    policy: Policy,
  ): Promise<
    Array<
      Pick<
        AppCatalogItem,
        "approvalStatus" | "installRules" | "name" | "packageId"
      >
    >
  > {
    const rules = policy.rules as PolicyRuleSet;

    if (rules.approvedAppPackageIds.length === 0) {
      return [];
    }

    return this.prisma.appCatalogItem.findMany({
      select: {
        approvalStatus: true,
        installRules: true,
        name: true,
        packageId: true,
      },
      where: {
        approvalStatus: "APPROVED",
        packageId: {
          in: rules.approvedAppPackageIds,
        },
        tenantId,
      },
    });
  }

  private jsonRecord(
    value: Prisma.JsonValue | null,
  ): Record<string, unknown> | null {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }

    return null;
  }

  private toPolicyAssignmentSummary(
    assignment: PolicyAssignmentWithPolicy,
  ): PolicyAssignmentSummary {
    return {
      active: assignment.active,
      actorId: assignment.actorId,
      createdAt: assignment.createdAt.toISOString(),
      endsAt: assignment.endsAt?.toISOString() ?? null,
      id: assignment.id,
      policyId: assignment.policyId,
      policyName: assignment.policy.name,
      policyStatus: assignment.policy.status as PolicyStatus,
      policyVersion: assignment.policy.version,
      reason: assignment.reason,
      scope: assignment.scope as PolicyAssignmentScope,
      scopeId: assignment.scopeId,
      startsAt: assignment.startsAt?.toISOString() ?? null,
      tenantId: assignment.tenantId,
    };
  }

  private assignmentSource(assignment: PolicyAssignment): string {
    return `${assignment.scope}:${assignment.scopeId ?? "baseline"}`;
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
