import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  PrivacyAcceptanceSummary,
  PrivacyNoticeSummary,
  PrivacySubjectType,
  Role,
  SecurityPrivacyOverview,
  SecurityPrivacyProfileSummary,
} from "@virtual-school/shared";
import type { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type {
  AcceptPrivacyNoticeDto,
  PublishPrivacyNoticeDto,
  UpdateSecurityPrivacyProfileDto,
} from "./dto/privacy.dto";

@Injectable()
export class PrivacyService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async securityCenter(tenantId: string): Promise<SecurityPrivacyOverview> {
    const now = new Date();
    const [
      tenant,
      retention,
      activeUsers,
      suspendedUsers,
      assignments,
      reviews,
      noticeCount,
      privilegedWithoutMfa,
    ] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          dataRegion: true,
          allowedRegionCodes: true,
          webFilterSettings: true,
          securityPrivacyProfile: true,
        },
      }),
      this.prisma.retentionSettings.findUnique({ where: { tenantId } }),
      this.prisma.user.count({ where: { tenantId, status: "ACTIVE" } }),
      this.prisma.user.count({ where: { tenantId, status: "SUSPENDED" } }),
      this.prisma.accessAssignment.count({
        where: {
          tenantId,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      }),
      this.prisma.accessReview.count({ where: { tenantId, status: "OPEN" } }),
      this.prisma.privacyNotice.count({ where: { tenantId } }),
      this.prisma.user.count({
        where: {
          tenantId,
          status: "ACTIVE",
          mfaEnabled: false,
          role: { in: ["PLATFORM_SUPER_ADMIN", "SCHOOL_ADMIN", "IT_ADMIN"] },
        },
      }),
    ]);
    if (!tenant) throw new NotFoundException("Tenant was not found");
    return {
      tenantId,
      dataSettings: {
        dataRegion: tenant.dataRegion,
        allowedRegionCodes: tenant.allowedRegionCodes,
        webFilteringConfigured: tenant.webFilterSettings !== null,
      },
      accessControls: {
        activeUsers,
        suspendedUsers,
        activeDelegatedAssignments: assignments,
        openAccessReviews: reviews,
        mfaEnforcedForPrivilegedAccess: privilegedWithoutMfa === 0,
      },
      retention: retention
        ? {
            id: retention.id,
            tenantId: retention.tenantId,
            diagnosticRetentionDays: retention.diagnosticRetentionDays,
            resolvedAlertRetentionDays: retention.resolvedAlertRetentionDays,
            commandHistoryRetentionDays: retention.commandHistoryRetentionDays,
            supportNoteRetentionDays: retention.supportNoteRetentionDays,
            exportArtifactRetentionDays: retention.exportArtifactRetentionDays,
            auditRetentionDays: retention.auditRetentionDays,
            updatedBy: retention.updatedBy,
            createdAt: retention.createdAt.toISOString(),
            updatedAt: retention.updatedAt.toISOString(),
          }
        : null,
      profile: this.profileSummary(tenant.securityPrivacyProfile),
      privacyNoticeCount: noticeCount,
      auditExportPath: `/api/v1/tenants/${tenantId}/audit-events`,
    };
  }

  async updateSecurityPrivacyProfile(
    tenantId: string,
    input: UpdateSecurityPrivacyProfileDto,
    actorId?: string,
  ): Promise<SecurityPrivacyProfileSummary> {
    for (const document of input.policyDocuments) {
      let url: URL;
      try {
        url = new URL(document.url);
      } catch {
        throw new BadRequestException(
          "Policy document URLs must be valid HTTPS URLs",
        );
      }
      if (url.protocol !== "https:")
        throw new BadRequestException(
          "Policy document URLs must be valid HTTPS URLs",
        );
    }
    const saved = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true },
      });
      if (!tenant) throw new NotFoundException("Tenant was not found");
      const profile = await tx.securityPrivacyProfile.upsert({
        where: { tenantId },
        create: {
          tenantId,
          incidentContactName: input.incidentContactName,
          incidentContactEmail: input.incidentContactEmail,
          policyDocuments:
            input.policyDocuments as unknown as Prisma.InputJsonValue,
          childSafetyGuardrails:
            input.childSafetyGuardrails as Prisma.InputJsonValue,
          incidentContactPhone: input.incidentContactPhone || null,
          updatedBy: actorId,
        },
        update: {
          incidentContactName: input.incidentContactName,
          incidentContactEmail: input.incidentContactEmail,
          policyDocuments:
            input.policyDocuments as unknown as Prisma.InputJsonValue,
          childSafetyGuardrails:
            input.childSafetyGuardrails as Prisma.InputJsonValue,
          incidentContactPhone: input.incidentContactPhone || null,
          updatedBy: actorId,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "security_privacy_profile.update",
          object: "SecurityPrivacyProfile",
          objectId: profile.id,
          outcome: "UPDATED",
          newValue: {
            incidentContactEmail: input.incidentContactEmail,
            policyDocumentCount: input.policyDocuments.length,
            childSafetyGuardrailCount: input.childSafetyGuardrails.length,
          },
        },
      });
      return profile;
    });
    return this.profileSummary(saved);
  }

  async publish(
    tenantId: string,
    input: PublishPrivacyNoticeDto,
    actorId?: string,
  ): Promise<PrivacyNoticeSummary> {
    const notice = await this.prisma.$transaction(async (tx) => {
      const latest = await tx.privacyNotice.findFirst({
        orderBy: { version: "desc" },
        where: {
          tenantId,
          noticeType: input.noticeType,
          channel: input.channel,
        },
      });
      const created = await tx.privacyNotice.create({
        data: {
          ...input,
          tenantId,
          version: (latest?.version ?? 0) + 1,
          publishedBy: actorId,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "privacy_notice.publish",
          object: "PrivacyNotice",
          objectId: created.id,
          outcome: "PUBLISHED",
          newValue: {
            noticeType: created.noticeType,
            channel: created.channel,
            version: created.version,
          },
        },
      });
      return created;
    });
    return this.noticeSummary(notice);
  }

  async listNotices(
    tenantId: string,
    noticeType?: string,
  ): Promise<PrivacyNoticeSummary[]> {
    const values = await this.prisma.privacyNotice.findMany({
      orderBy: [{ noticeType: "asc" }, { version: "desc" }],
      where: { tenantId, ...(noticeType ? { noticeType } : {}) },
    });
    return values.map((value) => this.noticeSummary(value));
  }

  async accept(
    tenantId: string,
    noticeId: string,
    input: AcceptPrivacyNoticeDto,
    subjectId: string | undefined,
    role: Role | undefined,
  ): Promise<PrivacyAcceptanceSummary> {
    const subjectType = this.subject(role, subjectId);
    const notice = await this.prisma.privacyNotice.findFirst({
      where: { id: noticeId, tenantId },
    });
    if (!notice)
      throw new NotFoundException(
        "Privacy notice was not found for this tenant",
      );
    if (notice.channel !== input.channel)
      throw new BadRequestException(
        "Acceptance channel must match the published notice channel",
      );
    const acceptance = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.privacyAcceptance.upsert({
        where: {
          noticeId_subjectType_subjectId_channel: {
            noticeId,
            subjectType,
            subjectId: subjectId!,
            channel: input.channel,
          },
        },
        create: {
          tenantId,
          noticeId,
          subjectType,
          subjectId: subjectId!,
          channel: input.channel,
        },
        update: { acceptedAt: new Date(), revokedAt: null, revokeReason: null },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: subjectId,
          action: "privacy_acceptance.accept",
          object: "PrivacyAcceptance",
          objectId: saved.id,
          outcome: "ACCEPTED",
          newValue: {
            noticeId,
            subjectType,
            channel: input.channel,
            version: notice.version,
          },
        },
      });
      return saved;
    });
    return this.acceptanceSummary(acceptance);
  }

  async revoke(
    tenantId: string,
    acceptanceId: string,
    reason: string,
    subjectId?: string,
  ): Promise<PrivacyAcceptanceSummary> {
    if (!subjectId)
      throw new ForbiddenException("An authenticated subject is required");
    const current = await this.prisma.privacyAcceptance.findFirst({
      where: { id: acceptanceId, tenantId, subjectId },
    });
    if (!current)
      throw new NotFoundException(
        "Active acceptance was not found for this subject",
      );
    const saved = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.privacyAcceptance.update({
        where: { id: acceptanceId },
        data: { revokedAt: new Date(), revokeReason: reason },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId: subjectId,
          action: "privacy_acceptance.revoke",
          object: "PrivacyAcceptance",
          objectId: acceptanceId,
          reason,
          outcome: "REVOKED",
          oldValue: { revokedAt: current.revokedAt },
          newValue: { revoked: true },
        },
      });
      return updated;
    });
    return this.acceptanceSummary(saved);
  }

  async listAcceptances(tenantId: string): Promise<PrivacyAcceptanceSummary[]> {
    const values = await this.prisma.privacyAcceptance.findMany({
      orderBy: { acceptedAt: "desc" },
      where: { tenantId },
    });
    return values.map((value) => this.acceptanceSummary(value));
  }

  private subject(role?: Role, subjectId?: string): PrivacySubjectType {
    if (!subjectId)
      throw new ForbiddenException("An authenticated subject is required");
    if (role === "GUARDIAN") return "GUARDIAN";
    if (role === "STUDENT") return "STUDENT";
    return "ADMIN";
  }
  private noticeSummary(value: any): PrivacyNoticeSummary {
    return {
      id: value.id,
      tenantId: value.tenantId,
      noticeType: value.noticeType,
      channel: value.channel,
      version: value.version,
      title: value.title,
      content: value.content,
      publishedBy: value.publishedBy,
      publishedAt: value.publishedAt.toISOString(),
    };
  }
  private acceptanceSummary(value: any): PrivacyAcceptanceSummary {
    return {
      id: value.id,
      noticeId: value.noticeId,
      subjectType: value.subjectType,
      subjectId: value.subjectId,
      channel: value.channel,
      acceptedAt: value.acceptedAt.toISOString(),
      revokedAt: value.revokedAt?.toISOString() ?? null,
      revokeReason: value.revokeReason,
    };
  }
  private profileSummary(value: any): SecurityPrivacyProfileSummary {
    return value
      ? {
          incidentContact: {
            name: value.incidentContactName,
            email: value.incidentContactEmail,
            phone: value.incidentContactPhone,
          },
          policyDocuments:
            value.policyDocuments as SecurityPrivacyProfileSummary["policyDocuments"],
          childSafetyGuardrails: value.childSafetyGuardrails as string[],
          updatedAt: value.updatedAt.toISOString(),
        }
      : {
          incidentContact: null,
          policyDocuments: [],
          childSafetyGuardrails: [],
          updatedAt: null,
        };
  }
}
