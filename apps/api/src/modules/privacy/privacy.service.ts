import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import type {
  ComplianceEvidencePackSummary,
  DataSubjectRequestSummary,
  PrivacyAcceptanceSummary,
  PrivacyNoticeSummary,
  PrivacySubjectType,
  Role,
  SecurityPrivacyOverview,
  SecurityPrivacyProfileSummary,
  SecurityIncidentSummary,
} from "@virtual-school/shared";
import type { Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type {
  AcceptPrivacyNoticeDto,
  CreateComplianceEvidencePackDto,
  CreateDataSubjectRequestDto,
  DecideDataSubjectRequestDto,
  CreateDataLegalHoldDto,
  PublishPrivacyNoticeDto,
  UpdateSecurityPrivacyProfileDto,
  CreateSecurityIncidentDto,
  AddSecurityIncidentUpdateDto,
} from "./dto/privacy.dto";

@Injectable()
export class PrivacyService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async listSecurityIncidents(
    tenantId: string,
  ): Promise<SecurityIncidentSummary[]> {
    const incidents = await this.prisma.securityIncident.findMany({
      where: { tenantId },
      include: { timeline: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
    return incidents.map((value) => this.securityIncidentSummary(value));
  }

  async createSecurityIncident(
    tenantId: string,
    input: CreateSecurityIncidentDto,
    actorId?: string,
  ) {
    this.validateEvidenceReferences(input.evidence);
    const owner = await this.prisma.user.findFirst({
      where: { id: input.ownerId, tenantId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!owner)
      throw new BadRequestException(
        "Incident owner must be an active user in this tenant",
      );
    const saved = await this.prisma.$transaction(async (tx) => {
      const incident = await tx.securityIncident.create({
        data: {
          ...input,
          evidence: input.evidence,
          tenantId,
          reportedBy: actorId,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "security_incident.create",
          object: "SecurityIncident",
          objectId: incident.id,
          outcome: "OPEN",
          newValue: {
            classification: input.classification,
            severity: input.severity,
            ownerId: input.ownerId,
            evidenceCount: input.evidence.length,
          },
        },
      });
      return incident;
    });
    return this.securityIncidentSummary({ ...saved, timeline: [] });
  }

  async addSecurityIncidentUpdate(
    tenantId: string,
    incidentId: string,
    input: AddSecurityIncidentUpdateDto,
    actorId?: string,
  ) {
    this.validateEvidenceReferences(input.evidence);
    const incident = await this.prisma.securityIncident.findFirst({
      where: { id: incidentId, tenantId },
    });
    if (!incident)
      throw new NotFoundException(
        "Security incident was not found for this tenant",
      );
    if (incident.status === "CLOSED")
      throw new BadRequestException(
        "Closed incidents cannot receive timeline updates",
      );
    return this.prisma.$transaction(async (tx) => {
      const update = await tx.securityIncidentUpdate.create({
        data: {
          incidentId,
          ...input,
          evidence: input.evidence,
          createdBy: actorId,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "security_incident.update",
          object: "SecurityIncident",
          objectId: incidentId,
          outcome: input.updateType,
          newValue: {
            updateType: input.updateType,
            evidenceCount: input.evidence.length,
          },
        },
      });
      return update;
    });
  }

  async closeSecurityIncident(
    tenantId: string,
    incidentId: string,
    closureSummary: string,
    actorId?: string,
  ) {
    const incident = await this.prisma.securityIncident.findFirst({
      where: { id: incidentId, tenantId },
    });
    if (!incident)
      throw new NotFoundException(
        "Security incident was not found for this tenant",
      );
    if (incident.status === "CLOSED")
      throw new BadRequestException("Security incident is already closed");
    const saved = await this.prisma.$transaction(async (tx) => {
      const value = await tx.securityIncident.update({
        where: { id: incident.id },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          closedBy: actorId,
          closureSummary,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "security_incident.close",
          object: "SecurityIncident",
          objectId: incident.id,
          outcome: "CLOSED",
          newValue: { closureSummaryLength: closureSummary.length },
        },
      });
      return value;
    });
    return this.securityIncidentSummary({ ...saved, timeline: [] });
  }

  async exportSecurityIncident(tenantId: string, incidentId: string) {
    const incident = await this.prisma.securityIncident.findFirst({
      where: { id: incidentId, tenantId },
      include: {
        timeline: { orderBy: { createdAt: "asc" } },
        tenant: { select: { name: true } },
      },
    });
    if (!incident)
      throw new NotFoundException(
        "Security incident was not found for this tenant",
      );
    return {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      customer: { tenantId, name: incident.tenant.name },
      incident: this.securityIncidentSummary(incident),
    };
  }

  private validateEvidenceReferences(references: string[]) {
    for (const reference of references) {
      let url: URL;
      try {
        url = new URL(reference);
      } catch {
        throw new BadRequestException(
          "Evidence references must be valid HTTPS URLs",
        );
      }
      if (url.protocol !== "https:")
        throw new BadRequestException(
          "Evidence references must be valid HTTPS URLs",
        );
    }
  }

  private securityIncidentSummary(value: any): SecurityIncidentSummary {
    return {
      id: value.id,
      tenantId: value.tenantId,
      title: value.title,
      classification: value.classification,
      severity: value.severity,
      description: value.description,
      status: value.status,
      ownerId: value.ownerId,
      evidence: value.evidence as string[],
      reportedBy: value.reportedBy,
      closedBy: value.closedBy,
      closedAt: value.closedAt?.toISOString() ?? null,
      closureSummary: value.closureSummary,
      createdAt: value.createdAt.toISOString(),
      updatedAt: value.updatedAt.toISOString(),
      timeline: (value.timeline ?? []).map((item: any) => ({
        ...item,
        evidence: item.evidence as string[],
        createdAt: item.createdAt.toISOString(),
      })),
      exportPath: `/api/v1/tenants/${value.tenantId}/privacy/security-incidents/${value.id}/export`,
    };
  }

  async listLegalHolds(tenantId: string) {
    return this.prisma.dataLegalHold.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
  }

  async createLegalHold(
    tenantId: string,
    input: CreateDataLegalHoldDto,
    actorId?: string,
  ) {
    await this.subjectRecord(tenantId, input.subjectType, input.subjectId);
    const existing = await this.prisma.dataLegalHold.findFirst({
      where: {
        tenantId,
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        releasedAt: null,
      },
    });
    if (existing)
      throw new BadRequestException(
        "An active legal hold already covers this subject",
      );
    return this.prisma.$transaction(async (tx) => {
      const hold = await tx.dataLegalHold.create({
        data: { tenantId, ...input, createdBy: actorId },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "data_legal_hold.create",
          object: "DataLegalHold",
          objectId: hold.id,
          outcome: "ACTIVE",
          newValue: {
            subjectType: input.subjectType,
            reasonLength: input.reason.length,
          },
        },
      });
      return hold;
    });
  }

  async releaseLegalHold(
    tenantId: string,
    holdId: string,
    reason: string,
    actorId?: string,
  ) {
    const hold = await this.prisma.dataLegalHold.findFirst({
      where: { id: holdId, tenantId, releasedAt: null },
    });
    if (!hold)
      throw new NotFoundException(
        "Active legal hold was not found for this tenant",
      );
    return this.prisma.$transaction(async (tx) => {
      const released = await tx.dataLegalHold.update({
        where: { id: hold.id },
        data: { releasedAt: new Date(), releasedBy: actorId },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "data_legal_hold.release",
          object: "DataLegalHold",
          objectId: hold.id,
          outcome: "RELEASED",
          newValue: {
            subjectType: hold.subjectType,
            reasonLength: reason.length,
          },
        },
      });
      return released;
    });
  }

  async listDataSubjectRequests(
    tenantId: string,
  ): Promise<DataSubjectRequestSummary[]> {
    const requests = await this.prisma.dataSubjectRequest.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
    return requests.map((value) => this.dataSubjectRequestSummary(value));
  }

  async createDataSubjectRequest(
    tenantId: string,
    input: CreateDataSubjectRequestDto,
    actorId?: string,
  ): Promise<DataSubjectRequestSummary> {
    const retentionUntil = input.retentionUntil
      ? new Date(input.retentionUntil)
      : null;
    if (retentionUntil && retentionUntil <= new Date())
      throw new BadRequestException(
        "Retention obligations must end in the future",
      );
    await this.subjectRecord(tenantId, input.subjectType, input.subjectId);
    const saved = await this.prisma.$transaction(async (tx) => {
      const request = await tx.dataSubjectRequest.create({
        data: {
          tenantId,
          requestType: input.requestType,
          subjectType: input.subjectType,
          subjectId: input.subjectId,
          reason: input.reason,
          retentionUntil,
          requestedBy: actorId,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "data_subject_request.create",
          object: "DataSubjectRequest",
          objectId: request.id,
          outcome: "PENDING",
          newValue: {
            requestType: input.requestType,
            subjectType: input.subjectType,
            retentionUntil,
            reasonLength: input.reason.length,
          },
        },
      });
      return request;
    });
    return this.dataSubjectRequestSummary(saved);
  }

  async decideDataSubjectRequest(
    tenantId: string,
    requestId: string,
    input: DecideDataSubjectRequestDto,
    actorId?: string,
  ): Promise<DataSubjectRequestSummary> {
    const request = await this.prisma.dataSubjectRequest.findFirst({
      where: { id: requestId, tenantId },
    });
    if (!request)
      throw new NotFoundException(
        "Data-subject request was not found for this tenant",
      );
    if (request.status !== "PENDING")
      throw new BadRequestException("Only pending requests can be decided");
    if (!actorId || actorId === request.requestedBy)
      throw new ForbiddenException(
        "A different authenticated administrator must decide this request",
      );
    if (input.decision === "REJECT") {
      const rejected = await this.prisma.$transaction(async (tx) => {
        const value = await tx.dataSubjectRequest.update({
          where: { id: request.id },
          data: {
            status: "REJECTED",
            approvedBy: actorId,
            approvedAt: new Date(),
            result: { decisionReason: input.reason },
          },
        });
        await tx.auditEvent.create({
          data: {
            tenantId,
            actorId,
            action: "data_subject_request.reject",
            object: "DataSubjectRequest",
            objectId: request.id,
            outcome: "REJECTED",
            newValue: {
              requestType: request.requestType,
              subjectType: request.subjectType,
              reasonLength: input.reason.length,
            },
          },
        });
        return value;
      });
      return this.dataSubjectRequestSummary(rejected);
    }
    const hold = await this.prisma.dataLegalHold.findFirst({
      where: {
        tenantId,
        subjectType: request.subjectType,
        subjectId: request.subjectId,
        releasedAt: null,
      },
    });
    const retentionActive =
      !!request.retentionUntil && request.retentionUntil > new Date();
    if (request.requestType === "DELETE" && (hold || retentionActive)) {
      const blockers = [
        hold ? "LEGAL_HOLD" : null,
        retentionActive ? "RETENTION" : null,
      ].filter(Boolean);
      const blocked = await this.finishDataSubjectRequest(
        request,
        actorId,
        "BLOCKED",
        {
          blockers,
          legalHoldId: hold?.id ?? null,
          retentionUntil: request.retentionUntil?.toISOString() ?? null,
        },
        input.reason,
      );
      return this.dataSubjectRequestSummary(blocked);
    }
    const subject = await this.subjectRecord(
      tenantId,
      request.subjectType,
      request.subjectId,
    );
    const acceptances = await this.prisma.privacyAcceptance.findMany({
      where: {
        tenantId,
        subjectId: {
          in: [
            request.subjectId,
            (subject as { auth0Subject?: string | null }).auth0Subject,
          ].filter(Boolean) as string[],
        },
      },
    });
    if (request.requestType === "EXPORT") {
      const artifact = JSON.parse(
        JSON.stringify({
          schemaVersion: 1,
          tenantId,
          requestId,
          subjectType: request.subjectType,
          subjectId: request.subjectId,
          generatedAt: new Date().toISOString(),
          subject,
          privacyAcceptances: acceptances,
        }),
      ) as Prisma.InputJsonValue;
      const checksum = createHash("sha256")
        .update(JSON.stringify(artifact))
        .digest("hex");
      const completed = await this.finishDataSubjectRequest(
        request,
        actorId,
        "COMPLETED",
        { exportedRecords: 1 + acceptances.length },
        input.reason,
        artifact,
        checksum,
      );
      return this.dataSubjectRequestSummary(completed);
    }
    const completed = await this.prisma.$transaction(async (tx) => {
      await tx.privacyAcceptance.deleteMany({
        where: {
          tenantId,
          subjectId: {
            in: [
              request.subjectId,
              (subject as { auth0Subject?: string | null }).auth0Subject,
            ].filter(Boolean) as string[],
          },
        },
      });
      const anonymous = `deleted-${request.id}`;
      if (request.subjectType === "STUDENT")
        await tx.student.update({
          where: { id: request.subjectId },
          data: {
            name: "Deleted subject",
            studentCode: anonymous,
            auth0Subject: null,
            status: "WITHDRAWN",
          },
        });
      if (request.subjectType === "GUARDIAN")
        await tx.guardian.update({
          where: { id: request.subjectId },
          data: {
            name: "Deleted subject",
            email: null,
            phone: null,
            language: null,
          },
        });
      if (request.subjectType === "USER")
        await tx.user.update({
          where: { id: request.subjectId },
          data: {
            name: "Deleted subject",
            email: `${anonymous}@invalid.local`,
            auth0Subject: null,
            status: "DEACTIVATED",
            forcedLogoutAt: new Date(),
            deactivatedAt: new Date(),
          },
        });
      const value = await tx.dataSubjectRequest.update({
        where: { id: request.id },
        data: {
          status: "COMPLETED",
          approvedBy: actorId,
          approvedAt: new Date(),
          completedAt: new Date(),
          result: {
            anonymizedRecords: 1,
            deletedAcceptanceRecords: acceptances.length,
          },
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "data_subject_request.complete",
          object: "DataSubjectRequest",
          objectId: request.id,
          outcome: "COMPLETED",
          newValue: {
            requestType: "DELETE",
            subjectType: request.subjectType,
            anonymizedRecords: 1,
            deletedAcceptanceRecords: acceptances.length,
            approvalReasonLength: input.reason.length,
          },
        },
      });
      return value;
    });
    return this.dataSubjectRequestSummary(completed);
  }

  async downloadDataSubjectExport(
    tenantId: string,
    requestId: string,
  ): Promise<unknown> {
    const request = await this.prisma.dataSubjectRequest.findFirst({
      where: {
        id: requestId,
        tenantId,
        requestType: "EXPORT",
        status: "COMPLETED",
      },
    });
    if (!request?.artifact)
      throw new NotFoundException(
        "Completed export was not found for this tenant",
      );
    return {
      checksumAlgorithm: "SHA-256",
      checksum: request.checksum,
      artifact: request.artifact,
    };
  }

  private async subjectRecord(
    tenantId: string,
    subjectType: string,
    subjectId: string,
  ): Promise<unknown> {
    const select = { id: true, tenantId: true, createdAt: true };
    const value =
      subjectType === "STUDENT"
        ? await this.prisma.student.findFirst({
            where: { id: subjectId, tenantId },
          })
        : subjectType === "GUARDIAN"
          ? await this.prisma.guardian.findFirst({
              where: { id: subjectId, tenantId },
            })
          : await this.prisma.user.findFirst({
              where: { id: subjectId, tenantId },
            });
    void select;
    if (!value)
      throw new NotFoundException("Subject was not found for this tenant");
    return value;
  }

  private async finishDataSubjectRequest(
    request: any,
    actorId: string,
    status: string,
    result: Prisma.InputJsonValue,
    approvalReason: string,
    artifact?: Prisma.InputJsonValue,
    checksum?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const value = await tx.dataSubjectRequest.update({
        where: { id: request.id },
        data: {
          status,
          approvedBy: actorId,
          approvedAt: new Date(),
          completedAt: new Date(),
          result,
          artifact,
          checksum,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId: request.tenantId,
          actorId,
          action:
            status === "BLOCKED"
              ? "data_subject_request.block"
              : "data_subject_request.complete",
          object: "DataSubjectRequest",
          objectId: request.id,
          outcome: status,
          newValue: {
            requestType: request.requestType,
            subjectType: request.subjectType,
            checksum: checksum ?? null,
            approvalReasonLength: approvalReason.length,
            result,
          },
        },
      });
      return value;
    });
  }

  private dataSubjectRequestSummary(value: any): DataSubjectRequestSummary {
    return {
      id: value.id,
      tenantId: value.tenantId,
      requestType: value.requestType,
      subjectType: value.subjectType,
      subjectId: value.subjectId,
      reason: value.reason,
      status: value.status,
      retentionUntil: value.retentionUntil?.toISOString() ?? null,
      requestedBy: value.requestedBy,
      approvedBy: value.approvedBy,
      approvedAt: value.approvedAt?.toISOString() ?? null,
      completedAt: value.completedAt?.toISOString() ?? null,
      result: value.result as Record<string, unknown> | null,
      checksum: value.checksum,
      createdAt: value.createdAt.toISOString(),
      downloadPath:
        value.requestType === "EXPORT" && value.status === "COMPLETED"
          ? `/api/v1/tenants/${value.tenantId}/privacy/data-subject-requests/${value.id}/download`
          : null,
    };
  }

  async listEvidencePacks(
    tenantId: string,
  ): Promise<ComplianceEvidencePackSummary[]> {
    const packs = await this.prisma.complianceEvidencePack.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
    });
    return packs.map((pack) => this.evidencePackSummary(pack));
  }

  async createEvidencePack(
    tenantId: string,
    input: CreateComplianceEvidencePackDto,
    actorId?: string,
  ): Promise<ComplianceEvidencePackSummary> {
    const windowFrom = new Date(input.windowFrom);
    const windowTo = new Date(input.windowTo);
    if (windowFrom >= windowTo)
      throw new BadRequestException(
        "Evidence window start must precede its end",
      );
    if (windowTo.getTime() - windowFrom.getTime() > 366 * 86_400_000)
      throw new BadRequestException("Evidence windows cannot exceed 366 days");
    if (windowTo.getTime() > Date.now() + 60_000)
      throw new BadRequestException(
        "Evidence windows cannot end in the future",
      );
    const sections = [...new Set(input.sections)];
    const range = { gte: windowFrom, lte: windowTo };
    const artifact: Record<string, unknown> = {
      schemaVersion: 1,
      tenantId,
      name: input.name,
      window: { from: windowFrom.toISOString(), to: windowTo.toISOString() },
      generatedAt: new Date().toISOString(),
      generatedBy: actorId ?? null,
      sections,
    };
    if (sections.includes("AUDIT_LOGS"))
      artifact.auditLogs = await this.prisma.auditEvent.findMany({
        where: { tenantId, createdAt: range },
        orderBy: { createdAt: "asc" },
      });
    if (sections.includes("ACCESS_REVIEWS"))
      artifact.accessReviews = await this.prisma.accessReview.findMany({
        where: {
          tenantId,
          createdAt: { lte: windowTo },
          updatedAt: { gte: windowFrom },
        },
        include: { items: true },
        orderBy: { createdAt: "asc" },
      });
    if (sections.includes("RETENTION"))
      artifact.retentionSettings =
        await this.prisma.retentionSettings.findUnique({ where: { tenantId } });
    if (sections.includes("CONTROLS"))
      artifact.controlsSummary = await this.securityCenter(tenantId);
    if (sections.includes("POLICIES"))
      artifact.policyExports = await this.prisma.policy.findMany({
        where: { tenantId },
        include: { versions: { orderBy: { version: "asc" } } },
        orderBy: { name: "asc" },
      });
    const immutableArtifact = JSON.parse(
      JSON.stringify(artifact),
    ) as Prisma.InputJsonValue;
    const checksum = createHash("sha256")
      .update(JSON.stringify(immutableArtifact))
      .digest("hex");
    const saved = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true },
      });
      if (!tenant) throw new NotFoundException("Tenant was not found");
      const pack = await tx.complianceEvidencePack.create({
        data: {
          tenantId,
          name: input.name,
          windowFrom,
          windowTo,
          sections,
          artifact: immutableArtifact,
          checksum,
          createdBy: actorId,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "compliance_evidence_pack.create",
          object: "ComplianceEvidencePack",
          objectId: pack.id,
          outcome: "CREATED",
          newValue: {
            name: input.name,
            windowFrom,
            windowTo,
            sections,
            checksum,
          },
        },
      });
      return pack;
    });
    return this.evidencePackSummary(saved);
  }

  async downloadEvidencePack(
    tenantId: string,
    packId: string,
  ): Promise<unknown> {
    const pack = await this.prisma.complianceEvidencePack.findFirst({
      where: { id: packId, tenantId },
    });
    if (!pack)
      throw new NotFoundException(
        "Evidence pack was not found for this tenant",
      );
    return {
      checksumAlgorithm: "SHA-256",
      checksum: pack.checksum,
      artifact: pack.artifact,
    };
  }

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
  private evidencePackSummary(value: any): ComplianceEvidencePackSummary {
    return {
      id: value.id,
      tenantId: value.tenantId,
      name: value.name,
      windowFrom: value.windowFrom.toISOString(),
      windowTo: value.windowTo.toISOString(),
      sections: value.sections,
      checksum: value.checksum,
      createdBy: value.createdBy,
      createdAt: value.createdAt.toISOString(),
      downloadPath: `/api/v1/tenants/${value.tenantId}/privacy/evidence-packs/${value.id}/download`,
    };
  }
}
