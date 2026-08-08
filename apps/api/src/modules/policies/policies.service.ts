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
  UrlPolicySimulation,
  BlockedDomainAggregate,
  ExamReadinessSummary,
  AssessmentLaunchSummary,
  ExamIntegrityEventType,
  ExamReport,
  TenantWebFilterSettings,
  EducationalVideoAccessEvaluation,
  EducationalVideoAllowlistEntry,
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
import type { ScheduleExamDto } from "./dto/schedule-exam.dto";
import type { AssignPolicyDto } from "./dto/assign-policy.dto";
import type { CreatePolicyDto } from "./dto/create-policy.dto";
import type { IssueSupportUnlockDto } from "./dto/issue-support-unlock.dto";
import type { PublishPolicyDto } from "./dto/publish-policy.dto";
import type { RollbackPolicyDto } from "./dto/rollback-policy.dto";
import type { UpdateAndroidControlsDto } from "./dto/update-android-controls.dto";
import type { IngestBlockedDomainEventDto } from "./dto/ingest-blocked-domain-event.dto";
import type { LaunchAssessmentDto } from "./dto/launch-assessment.dto";
import type {
  IngestExamIntegrityEventDto,
  UnlockExamDeviceDto,
} from "./dto/exam-operations.dto";
import { starterPolicyTemplates } from "./starter-policy-templates";
import { evaluateUrlPolicy } from "./url-policy-evaluator";
import type { UpdateWebFilterSettingsDto } from "./dto/update-web-filter-settings.dto";
import type { EvaluateEducationalVideoDto } from "./dto/evaluate-educational-video.dto";
import { matchesEducationalVideo } from "./educational-video-evaluator";

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

const defaultWebFilterSettings: TenantWebFilterSettings = {
  blockedCategories: [],
  educationalVideoAllowlist: [],
  neverAllowedUrls: [],
  provider: "MANAGED_BROWSER",
  safeSearch: { bing: true, google: true, youtubeRestrictedMode: "STRICT" },
};

@Injectable()
export class PoliciesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(MdmConnectorRegistry)
    private readonly connectorRegistry: MdmConnectorRegistry,
  ) {}

  async getWebFilterSettings(
    tenantId: string,
  ): Promise<TenantWebFilterSettings> {
    const tenant = await this.prisma.tenant.findUnique({
      select: { webFilterSettings: true },
      where: { id: tenantId },
    });
    if (!tenant)
      throw new NotFoundException(`Tenant ${tenantId} was not found`);
    return this.parseWebFilterSettings(tenant.webFilterSettings);
  }

  async updateWebFilterSettings(
    tenantId: string,
    input: UpdateWebFilterSettingsDto,
    actorId?: string,
  ): Promise<TenantWebFilterSettings> {
    const neverAllowedUrls = [
      ...new Set(input.neverAllowedUrls.map((value) => value.trim())),
    ];
    for (const rule of neverAllowedUrls) this.assertUrlRule(rule);
    const educationalVideoAllowlist = (
      input.educationalVideoAllowlist ?? []
    ).map((entry) => this.normalizeEducationalVideoEntry(entry));
    const settings: TenantWebFilterSettings = {
      blockedCategories: [...new Set(input.blockedCategories)],
      educationalVideoAllowlist,
      neverAllowedUrls,
      provider: "MANAGED_BROWSER",
      safeSearch: input.safeSearch,
    };
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.tenant.updateMany({
        data: { webFilterSettings: settings as Prisma.InputJsonValue },
        where: { id: tenantId },
      });
      if (updated.count === 0)
        throw new NotFoundException(`Tenant ${tenantId} was not found`);
      await tx.auditEvent.create({
        data: {
          action: "policy.web_filter_settings.update",
          actorId,
          newValue: settings as Prisma.InputJsonValue,
          object: "Tenant",
          objectId: tenantId,
          outcome: "SUCCESS",
          tenantId,
        },
      });
    });
    return settings;
  }

  async evaluateEducationalVideo(
    tenantId: string,
    input: EvaluateEducationalVideoDto,
  ): Promise<EducationalVideoAccessEvaluation> {
    const settings = await this.getWebFilterSettings(tenantId);
    const globalDecision = evaluateUrlPolicy(input.url, {
      defaultWebAccess: "DENY",
      neverAllowedUrls: settings.neverAllowedUrls,
      urlAllowlist: [],
      urlBlocklist: [],
    });
    if (globalDecision.reason === "GLOBAL_NEVER_ALLOWED")
      return {
        decision: "BLOCKED",
        matchedEntry: null,
        reason: "GLOBAL_NEVER_ALLOWED",
        url: input.url,
      };
    const applicable = (settings.educationalVideoAllowlist ?? []).filter(
      (entry) =>
        entry.scope === "TENANT" ||
        (entry.scope === input.scope && entry.scopeId === input.scopeId),
    );
    const matchedEntry = matchesEducationalVideo(input.url, applicable);
    return matchedEntry
      ? {
          decision: "ALLOWED",
          matchedEntry,
          reason: "APPROVED_RESOURCE",
          url: input.url,
        }
      : {
          decision: "BLOCKED",
          matchedEntry: null,
          reason: "NOT_APPROVED",
          url: input.url,
        };
  }

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

  async simulateUrlPolicy(
    tenantId: string,
    policyId: string,
    url: string,
  ): Promise<UrlPolicySimulation> {
    const [policy, settings] = await Promise.all([
      this.prisma.policy.findFirst({ where: { id: policyId, tenantId } }),
      this.getWebFilterSettings(tenantId),
    ]);
    if (!policy)
      throw new NotFoundException(
        `Policy ${policyId} was not found for tenant ${tenantId}`,
      );
    try {
      return {
        ...evaluateUrlPolicy(url, {
          ...(policy.rules as PolicyRuleSet),
          neverAllowedUrls: settings.neverAllowedUrls,
        }),
        policyId: policy.id,
        policyVersion: policy.version,
        url,
      };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Invalid URL",
      );
    }
  }

  async ingestBlockedDomainEvent(
    tenantId: string,
    input: IngestBlockedDomainEventDto,
  ): Promise<{ id: string }> {
    const domain = input.domain.trim().toLowerCase();
    if (
      !/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(
        domain,
      )
    ) {
      throw new BadRequestException(
        "domain must be a hostname only, without a URL path or query",
      );
    }
    const policy = await this.prisma.policy.findFirst({
      select: { id: true, rules: true, version: true },
      where: { id: input.policyId, tenantId },
    });
    if (!policy)
      throw new NotFoundException(
        `Policy ${input.policyId} was not found for tenant ${tenantId}`,
      );
    let rules = policy.rules as PolicyRuleSet;
    if (input.policyVersion !== policy.version) {
      const version = await this.prisma.policyVersion.findFirst({
        select: { snapshot: true },
        where: { policyId: input.policyId, version: input.policyVersion },
      });
      if (!version) {
        throw new BadRequestException(
          `Policy version ${input.policyVersion} was not found`,
        );
      }
      rules = version.snapshot as PolicyRuleSet;
    }
    if (input.matchedRule && !rules.urlBlocklist.includes(input.matchedRule)) {
      throw new BadRequestException(
        "matchedRule is not in the policy blocklist",
      );
    }
    if (input.deviceId) {
      const device = await this.prisma.device.findFirst({
        select: { id: true },
        where: { id: input.deviceId, tenantId },
      });
      if (!device)
        throw new NotFoundException(
          `Device ${input.deviceId} was not found for tenant ${tenantId}`,
        );
    }
    const created = await this.prisma.blockedDomainEvent.create({
      data: {
        deviceId: input.deviceId,
        domain,
        matchedRule: input.matchedRule,
        occurredAt: new Date(input.occurredAt),
        policyId: input.policyId,
        policyVersion: input.policyVersion,
        reason: input.reason,
        tenantId,
      },
      select: { id: true },
    });
    return created;
  }

  async listBlockedDomainAggregates(
    tenantId: string,
  ): Promise<BlockedDomainAggregate[]> {
    await this.ensureTenantExists(tenantId);
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const events = await this.prisma.blockedDomainEvent.findMany({
      select: { domain: true, occurredAt: true, reason: true },
      where: { occurredAt: { gte: since }, tenantId },
    });
    const aggregates = new Map<
      string,
      { count: number; lastOccurredAt: Date; reasons: Set<string> }
    >();
    for (const event of events) {
      const current = aggregates.get(event.domain);
      if (!current)
        aggregates.set(event.domain, {
          count: 1,
          lastOccurredAt: event.occurredAt,
          reasons: new Set([event.reason]),
        });
      else {
        current.count += 1;
        if (event.occurredAt > current.lastOccurredAt)
          current.lastOccurredAt = event.occurredAt;
        current.reasons.add(event.reason);
      }
    }
    return [...aggregates.entries()]
      .map(([domain, value]) => ({
        count: value.count,
        domain,
        lastOccurredAt: value.lastOccurredAt.toISOString(),
        reasons: [...value.reasons].sort(),
      }))
      .sort(
        (left, right) =>
          right.count - left.count || left.domain.localeCompare(right.domain),
      )
      .slice(0, 20);
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

  async updateAndroidControls(
    tenantId: string,
    policyId: string,
    input: UpdateAndroidControlsDto,
  ): Promise<PolicySummary> {
    const policy = await this.prisma.policy.findFirst({
      where: { id: policyId, tenantId },
    });
    if (!policy) {
      throw new NotFoundException(
        `Policy ${policyId} was not found for tenant ${tenantId}`,
      );
    }
    if (policy.status !== "DRAFT") {
      throw new BadRequestException(
        "Android controls can only be changed on a draft policy",
      );
    }
    if (
      input.systemUpdate.type === "WINDOWED" &&
      input.systemUpdate.startMinutes === input.systemUpdate.endMinutes
    ) {
      throw new BadRequestException(
        "The Android update window start and end must differ",
      );
    }

    const existingRules = policy.rules as PolicyRuleSet;
    const rules: PolicyRuleSet = {
      ...existingRules,
      android: {
        kioskCustomization: input.kioskCustomization,
        systemUpdate:
          input.systemUpdate.type === "WINDOWED"
            ? {
                endMinutes: input.systemUpdate.endMinutes!,
                startMinutes: input.systemUpdate.startMinutes!,
                type: "WINDOWED",
              }
            : { type: input.systemUpdate.type },
      },
      restrictions: {
        ...existingRules.restrictions,
        blockFactoryReset: input.blockFactoryReset,
      },
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.policy.update({
        data: { rules: rules as Prisma.InputJsonValue },
        where: { id: policy.id },
      });
      await tx.auditEvent.create({
        data: {
          action: "policy.android_controls.update",
          newValue: input as unknown as Prisma.InputJsonValue,
          object: "Policy",
          objectId: policy.id,
          outcome: "SUCCESS",
          tenantId,
        },
      });
      return saved;
    });

    return this.toPolicySummary(updated);
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
    const offlineItems = this.prisma.contentLibraryItem?.findMany
      ? await this.prisma.contentLibraryItem.findMany({
          where: {
            tenantId,
            status: "ACTIVE",
            offlineEnabled: true,
            offlinePolicyIds: { has: updated.id },
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
        })
      : [];
    const offlineResources = offlineItems
      .filter(
        (item) =>
          item.offlineVersion && item.offlineSha256 && item.offlineSizeBytes,
      )
      .map((item) => ({
        id: item.id,
        title: item.title,
        type: item.type,
        url: item.locator,
        version: item.offlineVersion!,
        sha256: item.offlineSha256!,
        sizeBytes: item.offlineSizeBytes!,
        expiresAtEpochMillis: item.expiresAt?.getTime() ?? null,
      }));
    const connector = this.connectorRegistry.getActiveConnector();
    let publishResult: MdmPolicyPublishResult;

    try {
      publishResult = await connector.publishPolicy({
        apps,
        offlineResources,
        policy: {
          id: updated.id,
          name: updated.name,
          rules: await this.rulesWithGlobalWebFiltering(
            tenantId,
            updated.rules as PolicyRuleSet,
          ),
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

  async rollbackPolicy(
    tenantId: string,
    policyId: string,
    input: RollbackPolicyDto,
  ): Promise<PolicyPublishSummary> {
    if (!input.reason.trim()) {
      throw new BadRequestException("Rollback reason is required");
    }
    const policy = await this.prisma.policy.findFirst({
      where: { id: policyId, tenantId },
    });
    if (!policy) {
      throw new NotFoundException(
        `Policy ${policyId} was not found for tenant ${tenantId}`,
      );
    }
    if (input.version >= policy.version) {
      throw new BadRequestException("Rollback requires a prior policy version");
    }

    const snapshot = await this.prisma.policyVersion.findFirst({
      where: { policyId, version: input.version },
    });
    if (!snapshot) {
      throw new NotFoundException(
        `Policy version ${input.version} was not found for policy ${policyId}`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.policy.update({
        data: { rules: snapshot.snapshot as Prisma.InputJsonValue },
        where: { id: policyId },
      });
      await tx.auditEvent.create({
        data: {
          action: "policy.rollback",
          actorId: input.actorId,
          newValue: { restoredVersion: input.version },
          object: "Policy",
          objectId: policyId,
          oldValue: { version: policy.version },
          outcome: "SUCCESS",
          reason: input.reason,
          tenantId,
        },
      });
    });

    return this.publishPolicy(tenantId, policyId, {
      actorId: input.actorId,
      reason: `Rollback to v${input.version}: ${input.reason}`,
    });
  }

  async issueSupportUnlock(
    tenantId: string,
    input: IssueSupportUnlockDto,
  ): Promise<PolicyAssignmentSummary> {
    if (!input.reason.trim()) {
      throw new BadRequestException("Support unlock reason is required");
    }
    if (input.durationMinutes < 5 || input.durationMinutes > 480) {
      throw new BadRequestException(
        "Support unlock duration must be between 5 and 480 minutes",
      );
    }
    const policy = await this.prisma.policy.findFirst({
      where: { id: input.policyId, tenantId },
    });
    if (!policy) {
      throw new NotFoundException(
        `Policy ${input.policyId} was not found for tenant ${tenantId}`,
      );
    }
    if (policy.status !== "PUBLISHED") {
      throw new BadRequestException("Support unlock policy must be published");
    }
    const rules = policy.rules as PolicyRuleSet;
    if (rules.mode !== "EMERGENCY_SUPPORT_OVERRIDE") {
      throw new BadRequestException(
        "Support unlock requires an emergency-support policy",
      );
    }
    await this.ensureAssignmentTargetExists(tenantId, "DEVICE", input.deviceId);

    const startsAt = new Date();
    const endsAt = new Date(
      startsAt.getTime() + input.durationMinutes * 60_000,
    );
    const assignment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.policyAssignment.create({
        data: {
          actorId: input.actorId,
          endsAt,
          policyId: input.policyId,
          reason: input.reason,
          scope: "DEVICE",
          scopeId: input.deviceId,
          startsAt,
          tenantId,
        },
        include: { policy: true },
      });
      await tx.auditEvent.create({
        data: {
          action: "policy.support_unlock.issue",
          actorId: input.actorId,
          newValue: {
            deviceId: input.deviceId,
            endsAt,
            policyId: input.policyId,
            policyVersion: policy.version,
            startsAt,
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

  async scheduleExam(
    tenantId: string,
    input: ScheduleExamDto,
    actorId: string,
  ): Promise<PolicyAssignmentSummary> {
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (endsAt <= startsAt) {
      throw new BadRequestException("Exam end must be after its start");
    }

    const policy = await this.prisma.policy.findFirst({
      where: { id: input.policyId, tenantId },
    });
    if (!policy) {
      throw new NotFoundException(
        `Policy ${input.policyId} was not found for tenant ${tenantId}`,
      );
    }
    if (
      policy.status !== "PUBLISHED" ||
      (policy.rules as PolicyRuleSet).mode !== "EXAM"
    ) {
      throw new BadRequestException(
        "Exam schedules require a published Exam Mode policy",
      );
    }
    await this.ensureAssignmentTargetExists(
      tenantId,
      input.scope,
      input.scopeId,
    );

    const assignment = await this.prisma.$transaction(async (tx) => {
      const created = await tx.policyAssignment.create({
        data: {
          actorId,
          endsAt,
          policyId: policy.id,
          reason: input.reason,
          scope: input.scope,
          scopeId: input.scopeId,
          startsAt,
          tenantId,
        },
        include: { policy: true },
      });
      await tx.auditEvent.create({
        data: {
          action: "exam.schedule",
          actorId,
          newValue: {
            endsAt,
            policyId: policy.id,
            policyVersion: policy.version,
            scope: input.scope,
            scopeId: input.scopeId,
            startsAt,
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

  async completeExam(
    tenantId: string,
    assignmentId: string,
    reason: string,
    actorId: string,
  ): Promise<PolicyAssignmentSummary> {
    if (!reason.trim())
      throw new BadRequestException("Exam completion reason is required");
    const assignment = await this.prisma.policyAssignment.findFirst({
      include: { policy: true },
      where: { id: assignmentId, tenantId },
    });
    if (
      !assignment ||
      (assignment.policy.rules as PolicyRuleSet).mode !== "EXAM"
    ) {
      throw new NotFoundException(
        `Exam schedule ${assignmentId} was not found for tenant ${tenantId}`,
      );
    }
    if (!assignment.active)
      throw new BadRequestException("Exam schedule has already completed");

    const completed = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.policyAssignment.update({
        data: { active: false, endsAt: new Date() },
        include: { policy: true },
        where: { id: assignment.id },
      });
      await tx.auditEvent.create({
        data: {
          action: "exam.complete",
          actorId,
          newValue: { active: false, endsAt: updated.endsAt },
          object: "PolicyAssignment",
          objectId: assignment.id,
          oldValue: { active: assignment.active, endsAt: assignment.endsAt },
          outcome: "SUCCESS",
          reason,
          tenantId,
        },
      });
      return updated;
    });
    return this.toPolicyAssignmentSummary(completed);
  }

  async getExamReadiness(
    tenantId: string,
    assignmentId: string,
  ): Promise<ExamReadinessSummary> {
    const assignment = await this.getExamAssignment(tenantId, assignmentId);
    const rules = assignment.policy.rules as PolicyRuleSet;
    const devices = await this.prisma.device.findMany({
      include: { diagnostics: { orderBy: { reportedAt: "desc" }, take: 1 } },
      orderBy: { serialNumber: "asc" },
      where: {
        tenantId,
        status: { not: "RETIRED" },
        ...this.examDeviceScope(assignment.scope, assignment.scopeId),
      },
    });
    const checkedAt = new Date();
    const recentCutoff = checkedAt.getTime() - 15 * 60_000;
    const results = devices.map((device) => {
      const diagnostic = device.diagnostics[0];
      const details = diagnostic?.details;
      const installed =
        typeof details === "object" &&
        details !== null &&
        !Array.isArray(details) &&
        "installedPackageIds" in details &&
        Array.isArray(details.installedPackageIds)
          ? details.installedPackageIds.filter(
              (value): value is string => typeof value === "string",
            )
          : [];
      const missingAppPackageIds = rules.approvedAppPackageIds.filter(
        (packageId) => !installed.includes(packageId),
      );
      const issues: ExamReadinessSummary["devices"][number]["issues"] = [];
      if (
        device.status !== "ONLINE" ||
        !diagnostic ||
        diagnostic.reportedAt.getTime() < recentCutoff ||
        diagnostic.networkStatus === "OFFLINE"
      )
        issues.push("OFFLINE");
      if (
        diagnostic?.batteryLevel !== null &&
        diagnostic?.batteryLevel !== undefined &&
        diagnostic.batteryLevel <= 20
      )
        issues.push("LOW_BATTERY");
      if (
        (diagnostic?.policyVersion ?? device.policyVersion) !==
        assignment.policy.version
      )
        issues.push("WRONG_POLICY");
      if (missingAppPackageIds.length > 0) issues.push("MISSING_APP");
      if (
        !diagnostic?.browserVersion ||
        !/^[1-9]\d*(?:\.|$)/.test(diagnostic.browserVersion)
      )
        issues.push("UNSUPPORTED_BROWSER");
      return {
        batteryLevel: diagnostic?.batteryLevel ?? null,
        browserVersion: diagnostic?.browserVersion ?? null,
        deviceId: device.id,
        issues,
        lastReportedAt: diagnostic?.reportedAt.toISOString() ?? null,
        missingAppPackageIds,
        policyVersion:
          diagnostic?.policyVersion ?? device.policyVersion ?? null,
        ready: issues.length === 0,
        serialNumber: device.serialNumber,
      };
    });
    return {
      assignmentId,
      blocked: results.filter((device) => !device.ready).length,
      checkedAt: checkedAt.toISOString(),
      devices: results,
      policyId: assignment.policy.id,
      policyVersion: assignment.policy.version,
      ready: results.filter((device) => device.ready).length,
    };
  }

  async launchAssessment(
    tenantId: string,
    assignmentId: string,
    input: LaunchAssessmentDto,
    actorId: string,
  ): Promise<AssessmentLaunchSummary> {
    const assignment = await this.getExamAssignment(tenantId, assignmentId);
    const now = new Date();
    if (
      !assignment.active ||
      (assignment.startsAt && assignment.startsAt > now) ||
      (assignment.endsAt && assignment.endsAt <= now)
    ) {
      throw new BadRequestException(
        "Assessment launch requires an active Exam Mode window",
      );
    }
    const rules = assignment.policy.rules as PolicyRuleSet;
    const resource = input.resource.trim();
    const approvedApp =
      input.resourceType === "APP" &&
      rules.approvedAppPackageIds.includes(resource)
        ? await this.prisma.appCatalogItem.findFirst({
            where: {
              approvalStatus: "APPROVED",
              packageId: resource,
              tenantId,
            },
          })
        : null;
    const approved =
      input.resourceType === "APP"
        ? Boolean(approvedApp)
        : rules.webShortcuts.some((shortcut) => shortcut.url === resource) &&
          evaluateUrlPolicy(resource, rules).effectiveAccess === "ALLOW";
    if (!approved)
      throw new BadRequestException(
        "Assessment resource is not approved by the scheduled Exam Mode policy",
      );

    const readiness = await this.getExamReadiness(tenantId, assignmentId);
    const readyDeviceIds = readiness.devices
      .filter((device) => device.ready)
      .map((device) => device.deviceId);
    const expiresAt =
      assignment.endsAt ?? new Date(now.getTime() + 60 * 60_000);
    const commandIds = await this.prisma.$transaction(async (tx) => {
      const ids: string[] = [];
      for (const deviceId of readyDeviceIds) {
        const command = await tx.remoteCommand.create({
          data: {
            deviceId,
            expiresAt,
            maxAttempts: 3,
            payload: {
              action: "ASSESSMENT_LAUNCH",
              assignmentId,
              policyId: assignment.policy.id,
              policyVersion: assignment.policy.version,
              resource,
              resourceType: input.resourceType,
              strictProfile: true,
            },
            reason: input.reason,
            requestedBy: actorId,
            status: "QUEUED",
            tenantId,
            type: "SEND_MESSAGE",
          },
        });
        ids.push(command.id);
      }
      await tx.auditEvent.create({
        data: {
          action: "exam.assessment.launch",
          actorId,
          newValue: {
            assignmentId,
            policyId: assignment.policy.id,
            policyVersion: assignment.policy.version,
            queued: ids.length,
            resource,
            resourceType: input.resourceType,
            skipped: readiness.blocked,
          },
          object: "PolicyAssignment",
          objectId: assignmentId,
          outcome: "SUCCESS",
          reason: input.reason,
          tenantId,
        },
      });
      return ids;
    });
    return {
      assignmentId,
      commandIds,
      queued: commandIds.length,
      resource,
      resourceType: input.resourceType,
      skipped: readiness.blocked,
    };
  }

  async ingestExamIntegrityEvent(
    tenantId: string,
    assignmentId: string,
    input: IngestExamIntegrityEventDto,
  ) {
    const assignment = await this.getExamAssignment(tenantId, assignmentId);
    const device = await this.prisma.device.findFirst({
      where: {
        id: input.deviceId,
        tenantId,
        ...this.examDeviceScope(assignment.scope, assignment.scopeId),
      },
    });
    if (!device)
      throw new NotFoundException("Device is not targeted by this exam");
    const occurredAt = input.occurredAt
      ? new Date(input.occurredAt)
      : new Date();
    if (
      (assignment.startsAt && occurredAt < assignment.startsAt) ||
      (assignment.endsAt && occurredAt > assignment.endsAt)
    ) {
      throw new BadRequestException(
        "Integrity event falls outside the exam window",
      );
    }
    return this.prisma.auditEvent.create({
      data: {
        action: "exam.integrity.event",
        actorId: device.id,
        newValue: {
          assignmentId,
          deviceId: device.id,
          occurredAt,
          type: input.type,
        },
        object: "Device",
        objectId: device.id,
        outcome: "RECORDED",
        tenantId,
      },
    });
  }

  async unlockExamDevice(
    tenantId: string,
    assignmentId: string,
    input: UnlockExamDeviceDto,
    actorId: string,
  ) {
    const assignment = await this.getExamAssignment(tenantId, assignmentId);
    const now = new Date();
    if (
      !assignment.active ||
      (assignment.startsAt && assignment.startsAt > now) ||
      (assignment.endsAt && assignment.endsAt <= now)
    ) {
      throw new BadRequestException(
        "Emergency unlock requires an active exam window",
      );
    }
    const device = await this.prisma.device.findFirst({
      where: {
        id: input.deviceId,
        tenantId,
        status: { not: "RETIRED" },
        ...this.examDeviceScope(assignment.scope, assignment.scopeId),
      },
    });
    if (!device)
      throw new NotFoundException("Device is not targeted by this exam");
    const expiresAt = new Date(
      Math.min(
        now.getTime() + input.durationMinutes * 60_000,
        assignment.endsAt?.getTime() ?? Number.MAX_SAFE_INTEGER,
      ),
    );
    return this.prisma.$transaction(async (tx) => {
      const command = await tx.remoteCommand.create({
        data: {
          deviceId: device.id,
          expiresAt,
          maxAttempts: 3,
          payload: {
            action: "EXAM_EMERGENCY_UNLOCK",
            assignmentId,
            durationMinutes: input.durationMinutes,
          },
          reason: input.reason,
          requestedBy: actorId,
          status: "QUEUED",
          tenantId,
          type: "SEND_MESSAGE",
        },
      });
      await tx.auditEvent.create({
        data: {
          action: "exam.emergency_unlock",
          actorId,
          newValue: {
            assignmentId,
            commandId: command.id,
            deviceId: device.id,
            durationMinutes: input.durationMinutes,
            expiresAt,
          },
          object: "Device",
          objectId: device.id,
          outcome: "SUCCESS",
          reason: input.reason,
          tenantId,
        },
      });
      return command;
    });
  }

  async getExamReport(
    tenantId: string,
    assignmentId: string,
  ): Promise<ExamReport> {
    const assignment = await this.getExamAssignment(tenantId, assignmentId);
    const [devices, audits, commands] = await Promise.all([
      this.prisma.device.findMany({
        select: { id: true },
        where: {
          tenantId,
          status: { not: "RETIRED" },
          ...this.examDeviceScope(assignment.scope, assignment.scopeId),
        },
      }),
      this.prisma.auditEvent.findMany({
        orderBy: { createdAt: "asc" },
        where: {
          tenantId,
          OR: [
            { objectId: assignmentId },
            {
              action: { in: ["exam.integrity.event", "exam.emergency_unlock"] },
              newValue: { path: ["assignmentId"], equals: assignmentId },
            },
          ],
        },
      }),
      this.prisma.remoteCommand.findMany({
        where: {
          tenantId,
          payload: { path: ["assignmentId"], equals: assignmentId },
        },
      }),
    ]);
    const json = (value: Prisma.JsonValue | null) =>
      value && typeof value === "object" && !Array.isArray(value)
        ? (value as Prisma.JsonObject)
        : {};
    const launches = audits.filter(
      (event) => event.action === "exam.assessment.launch",
    );
    const lastLaunch = launches.at(-1);
    const launchValue = json(lastLaunch?.newValue ?? null);
    const participants = new Set(
      commands
        .filter(
          (command) => json(command.payload).action === "ASSESSMENT_LAUNCH",
        )
        .map((command) => command.deviceId),
    );
    const scheduled = audits.find((event) => event.action === "exam.schedule");
    const scheduleValue = json(scheduled?.newValue ?? null);
    const completed = [...audits]
      .reverse()
      .find((event) => event.action === "exam.complete");
    return {
      assignmentId,
      policyId: assignment.policy.id,
      policyVersion: assignment.policy.version,
      scope: assignment.scope as ExamReport["scope"],
      scopeId: assignment.scopeId,
      scheduledStart:
        typeof scheduleValue.startsAt === "string"
          ? scheduleValue.startsAt
          : (assignment.startsAt?.toISOString() ?? null),
      scheduledEnd:
        typeof scheduleValue.endsAt === "string"
          ? scheduleValue.endsAt
          : (assignment.endsAt?.toISOString() ?? null),
      actualEnd: completed?.createdAt.toISOString() ?? null,
      generatedAt: new Date().toISOString(),
      attendance: {
        targeted: devices.length,
        participated: participants.size,
        absent: Math.max(0, devices.length - participants.size),
      },
      readiness: {
        ready: typeof launchValue.queued === "number" ? launchValue.queued : 0,
        blocked:
          typeof launchValue.skipped === "number" ? launchValue.skipped : 0,
        checkedAt: lastLaunch?.createdAt.toISOString() ?? null,
      },
      integrityEvents: audits
        .filter((e) => e.action === "exam.integrity.event")
        .map((e) => {
          const v = json(e.newValue);
          return {
            deviceId: String(v.deviceId),
            type: String(v.type) as ExamIntegrityEventType,
            occurredAt:
              typeof v.occurredAt === "string"
                ? v.occurredAt
                : e.createdAt.toISOString(),
          };
        }),
      failures: commands
        .filter((c) => c.status === "FAILED")
        .map((c) => ({
          deviceId: c.deviceId,
          reason: c.failureReason ?? "Command failed",
          occurredAt: (c.completedAt ?? c.updatedAt).toISOString(),
        })),
      unlocks: audits
        .filter((e) => e.action === "exam.emergency_unlock")
        .map((e) => {
          const v = json(e.newValue);
          return {
            deviceId: String(v.deviceId),
            actorId: e.actorId,
            reason: e.reason ?? "",
            durationMinutes: Number(v.durationMinutes),
            occurredAt: e.createdAt.toISOString(),
          };
        }),
    };
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

  private async getExamAssignment(tenantId: string, assignmentId: string) {
    const assignment = await this.prisma.policyAssignment.findFirst({
      include: { policy: true },
      where: { id: assignmentId, tenantId },
    });
    if (
      !assignment ||
      (assignment.policy.rules as PolicyRuleSet).mode !== "EXAM"
    ) {
      throw new NotFoundException(
        `Exam schedule ${assignmentId} was not found for tenant ${tenantId}`,
      );
    }
    return assignment;
  }

  private examDeviceScope(scope: string, scopeId: string | null) {
    if (scope === "GRADE") return { student: { grade: scopeId ?? "" } };
    if (scope === "CLASS") return { classId: scopeId };
    if (scope === "STUDENT") return { studentId: scopeId };
    return { id: "__unsupported_exam_scope__" };
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

    if (device.status === "RETIRED") {
      throw new NotFoundException(
        `No policy is delivered to retired device ${deviceId}`,
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

    const afterSchoolControl =
      rules.mode === "HOMEWORK_AFTER_SCHOOL"
        ? await this.prisma.guardianAfterSchoolControl.findFirst({
            where: {
              student: { devices: { some: { id: deviceId, tenantId } } },
              tenantId,
            },
            select: {
              allowedAppIds: true,
              dailyLimitMinutes: true,
              enabled: true,
            },
          })
        : null;

    const apps =
      rules.approvedAppPackageIds.length === 0
        ? []
        : await this.prisma.appCatalogItem.findMany({
            orderBy: {
              name: "asc",
            },
            where: {
              approvalStatus: "APPROVED",
              ...(afterSchoolControl?.enabled
                ? { id: { in: afterSchoolControl.allowedAppIds } }
                : {}),
              packageId: {
                in: rules.approvedAppPackageIds,
              },
              tenantId,
            },
          });

    const device = await this.prisma.device.findFirst({
      where: { id: deviceId, tenantId },
      select: {
        classId: true,
        class: { select: { grade: true, subject: true } },
        student: { select: { grade: true } },
      },
    });
    const offlineRows = this.prisma.contentLibraryItem?.findMany
      ? await this.prisma.contentLibraryItem.findMany({
          where: {
            tenantId,
            status: "ACTIVE",
            offlineEnabled: true,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          orderBy: { title: "asc" },
        })
      : [];
    const deviceGrade = device?.class?.grade ?? device?.student?.grade;
    const deviceSubject = device?.class?.subject;
    const offlineResources = offlineRows.filter(
      (item) =>
        item.offlinePolicyIds.includes(resolution.activePolicy.id) &&
        (!item.grades.length ||
          (!!deviceGrade && item.grades.includes(deviceGrade))) &&
        (!item.subjects.length ||
          (!!deviceSubject && item.subjects.includes(deviceSubject))) &&
        (!item.classIds.length ||
          (!!device?.classId && item.classIds.includes(device.classId))) &&
        !!item.offlineVersion &&
        !!item.offlineSha256 &&
        !!item.offlineSizeBytes &&
        ["PDF", "WORKSHEET", "VIDEO"].includes(item.type),
    );
    const lmsLinks = device?.classId
      ? await this.prisma.lmsCourseMapping.findMany({
          where: {
            tenantId,
            classId: device.classId,
            enabled: true,
            connection: { status: "ENABLED" },
          },
          orderBy: { displayName: "asc" },
        })
      : [];
    const lmsUrls = lmsLinks.map((item) => item.launchUrl);

    const webFilterSettings = await this.getWebFilterSettings(tenantId);
    const educationalVideoAllowlist = (
      webFilterSettings.educationalVideoAllowlist ?? []
    ).filter(
      (entry) =>
        entry.scope === "TENANT" ||
        (entry.scope === "CLASS" && entry.scopeId === device?.classId) ||
        (entry.scope === "GRADE" &&
          entry.scopeId === (device?.class?.grade ?? device?.student?.grade)) ||
        (entry.scope === "MODE" && entry.scopeId === rules.mode),
    );
    const tenantBranding = await this.prisma.tenant.findUnique({
      select: {
        accentColor: true,
        deviceLabel: true,
        logoUrl: true,
        name: true,
        primaryColor: true,
        studentLabel: true,
        supportEmail: true,
        supportPhone: true,
        timezone: true,
        websiteUrl: true,
      },
      where: { id: tenantId },
    });
    if (!tenantBranding) {
      throw new NotFoundException(`Tenant ${tenantId} was not found`);
    }
    return {
      browser: {
        blockedCategories: webFilterSettings.blockedCategories,
        defaultWebAccess: rules.defaultWebAccess,
        neverAllowedUrls: webFilterSettings.neverAllowedUrls,
        safeSearch: webFilterSettings.safeSearch,
        educationalVideoAllowlist,
        urlAllowlist: [...new Set([...rules.urlAllowlist, ...lmsUrls])],
        urlBlocklist: [
          ...new Set([
            ...webFilterSettings.neverAllowedUrls,
            ...rules.urlBlocklist,
          ]),
        ],
      },
      cache: {
        ttlSeconds: 3600,
        useLastKnownPolicyWhenOffline: true,
      },
      offlineMode: {
        enabled: offlineResources.length > 0,
        authoritative: true,
        refreshAfterSeconds: 3600,
        resources: offlineResources.map((item) => ({
          id: item.id,
          title: item.title,
          type: item.type as "PDF" | "WORKSHEET" | "VIDEO",
          url: item.locator,
          version: item.offlineVersion!,
          sha256: item.offlineSha256!,
          sizeBytes: item.offlineSizeBytes!,
          expiresAt: item.expiresAt?.toISOString() ?? null,
        })),
      },
      deviceId,
      generatedAt: new Date().toISOString(),
      launcher: {
        branding: tenantBranding,
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
        webShortcuts: [
          ...rules.webShortcuts,
          ...lmsLinks
            .filter(
              (link) =>
                !rules.webShortcuts.some((item) => item.url === link.launchUrl),
            )
            .map((link) => ({ title: link.displayName, url: link.launchUrl })),
        ],
      },
      policy: {
        explanation: `${resolution.explanation}${afterSchoolControl?.enabled ? ` Guardian after-school selection applied within the school app allowlist for ${afterSchoolControl.dailyLimitMinutes} minutes daily.` : ""}`,
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

  private parseWebFilterSettings(
    value: Prisma.JsonValue | null,
  ): TenantWebFilterSettings {
    if (!value || typeof value !== "object" || Array.isArray(value))
      return defaultWebFilterSettings;
    const candidate = value as Record<string, unknown>;
    const safeSearch = candidate.safeSearch as
      | Record<string, unknown>
      | undefined;
    return {
      blockedCategories: Array.isArray(candidate.blockedCategories)
        ? (candidate.blockedCategories.filter(
            (item) => typeof item === "string",
          ) as TenantWebFilterSettings["blockedCategories"])
        : [],
      educationalVideoAllowlist: Array.isArray(
        candidate.educationalVideoAllowlist,
      )
        ? candidate.educationalVideoAllowlist.flatMap((item) => {
            try {
              return [
                this.normalizeEducationalVideoEntry(
                  item as EducationalVideoAllowlistEntry,
                ),
              ];
            } catch {
              return [];
            }
          })
        : [],
      neverAllowedUrls: Array.isArray(candidate.neverAllowedUrls)
        ? candidate.neverAllowedUrls.filter(
            (item): item is string => typeof item === "string",
          )
        : [],
      provider: "MANAGED_BROWSER",
      safeSearch: {
        bing: typeof safeSearch?.bing === "boolean" ? safeSearch.bing : true,
        google:
          typeof safeSearch?.google === "boolean" ? safeSearch.google : true,
        youtubeRestrictedMode:
          safeSearch?.youtubeRestrictedMode === "OFF" ||
          safeSearch?.youtubeRestrictedMode === "MODERATE"
            ? safeSearch.youtubeRestrictedMode
            : "STRICT",
      },
    };
  }

  private async rulesWithGlobalWebFiltering(
    tenantId: string,
    rules: PolicyRuleSet,
  ): Promise<PolicyRuleSet> {
    const settings = await this.getWebFilterSettings(tenantId);
    return {
      ...rules,
      urlBlocklist: [
        ...new Set([...settings.neverAllowedUrls, ...rules.urlBlocklist]),
      ],
      webFilter: settings,
    };
  }

  private assertUrlRule(rule: string): void {
    const target = rule.endsWith("*") ? rule.slice(0, -1) : rule;
    try {
      const url = new URL(target);
      if (
        !rule ||
        (url.protocol !== "http:" && url.protocol !== "https:") ||
        url.username ||
        url.password
      )
        throw new Error();
    } catch {
      throw new BadRequestException(
        `Never-allowed rule must be a valid HTTP(S) URL or trailing-wildcard URL: ${rule}`,
      );
    }
  }

  private normalizeEducationalVideoEntry(
    entry: EducationalVideoAllowlistEntry,
  ): EducationalVideoAllowlistEntry {
    const value = entry.value.trim();
    const scopeId = entry.scopeId?.trim();
    if (!value || (entry.scope !== "TENANT" && !scopeId))
      throw new BadRequestException(
        "Video allowlist entries require a value and non-tenant scopes require a scope ID",
      );
    if (entry.kind === "DOMAIN") {
      const domain = value
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/\/$/, "");
      if (
        !/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(
          domain,
        )
      )
        throw new BadRequestException(
          "Educational video domains must be hostnames without paths",
        );
      return {
        kind: entry.kind,
        scope: entry.scope,
        ...(scopeId ? { scopeId } : {}),
        value: domain,
      };
    }
    if (!/^[A-Za-z0-9_-]{3,128}$/.test(value))
      throw new BadRequestException(
        "Video, playlist, and channel values must be provider IDs",
      );
    return {
      kind: entry.kind,
      scope: entry.scope,
      ...(scopeId ? { scopeId } : {}),
      value,
    };
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
