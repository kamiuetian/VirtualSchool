import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { IntegrationMarketplaceItem } from "@virtual-school/shared";
import { Prisma } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import type {
  CreateIntegrationSubmissionDto,
  ReviewIntegrationSubmissionDto,
} from "./marketplace.dto";

@Injectable()
export class MarketplaceService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(tenantId: string): Promise<IntegrationMarketplaceItem[]> {
    const rows = await this.prisma.integrationSubmission.findMany({
      where: { status: "PUBLISHED" },
      include: { installations: { where: { tenantId }, take: 1 } },
      orderBy: [{ name: "asc" }, { version: "desc" }],
    });
    const latest = new Map<string, (typeof rows)[number]>();
    rows.forEach((row) => {
      if (!latest.has(row.slug)) latest.set(row.slug, row);
    });
    return [...latest.values()].map((row) => this.summary(row));
  }

  async listSubmissions(
    tenantId: string,
  ): Promise<IntegrationMarketplaceItem[]> {
    const rows = await this.prisma.integrationSubmission.findMany({
      where: { tenantId },
      include: { installations: { where: { tenantId }, take: 1 } },
      orderBy: [{ slug: "asc" }, { version: "desc" }],
    });
    return rows.map((row) => this.summary(row));
  }

  async createSubmission(
    tenantId: string,
    input: CreateIntegrationSubmissionDto,
    actorId?: string,
  ) {
    await this.requireTenant(tenantId);
    this.validateManifest(input.manifest);
    const previous = await this.prisma.integrationSubmission.findFirst({
      where: { tenantId, slug: input.slug },
      orderBy: { version: "desc" },
    });
    if (previous && !["REJECTED", "PUBLISHED"].includes(previous.status))
      throw new BadRequestException(
        "Finish the current version before creating another",
      );
    const version = (previous?.version ?? 0) + 1;
    return this.prisma.$transaction(async (tx) => {
      const saved = await tx.integrationSubmission.create({
        data: {
          tenantId,
          ...input,
          manifest: input.manifest as Prisma.InputJsonValue,
          version,
          submittedBy: actorId,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "marketplace.submission.create",
          object: "IntegrationSubmission",
          objectId: saved.id,
          outcome: "DRAFT",
          newValue: { slug: input.slug, version },
        },
      });
      return saved;
    });
  }

  async submit(tenantId: string, id: string, actorId?: string) {
    const value = await this.requireSubmission(tenantId, id);
    if (value.status !== "DRAFT")
      throw new BadRequestException("Only draft versions can be submitted");
    return this.transition(tenantId, value, "SUBMITTED", actorId);
  }

  async review(
    tenantId: string,
    id: string,
    input: ReviewIntegrationSubmissionDto,
    actorId?: string,
  ) {
    const value = await this.requireSubmission(tenantId, id);
    if (actorId && actorId === value.submittedBy)
      throw new BadRequestException(
        "Submitters cannot review their own integration version",
      );
    const allowed: Record<string, string[]> = {
      SUBMITTED: ["IN_REVIEW"],
      IN_REVIEW: ["APPROVED", "REJECTED"],
      APPROVED: ["PUBLISHED"],
    };
    if (!allowed[value.status]?.includes(input.status))
      throw new BadRequestException(
        `Cannot move ${value.status} to ${input.status}`,
      );
    if (input.status === "REJECTED" && !input.notes?.trim())
      throw new BadRequestException("Rejection notes are required");
    return this.transition(tenantId, value, input.status, actorId, input.notes);
  }

  async enable(
    tenantId: string,
    id: string,
    configuration?: Record<string, unknown>,
    actorId?: string,
  ) {
    const submission = await this.prisma.integrationSubmission.findFirst({
      where: { id, status: "PUBLISHED" },
    });
    if (!submission)
      throw new NotFoundException("Published integration was not found");
    await this.requireTenant(tenantId);
    return this.prisma.$transaction(async (tx) => {
      const saved = await tx.integrationInstallation.upsert({
        where: { tenantId_submissionId: { tenantId, submissionId: id } },
        create: {
          tenantId,
          submissionId: id,
          status: "ENABLED",
          configuration: (configuration ?? {}) as Prisma.InputJsonValue,
          enabledBy: actorId,
        },
        update: {
          status: "ENABLED",
          configuration: (configuration ?? {}) as Prisma.InputJsonValue,
          enabledBy: actorId,
          disabledAt: null,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "marketplace.integration.enable",
          object: "IntegrationInstallation",
          objectId: saved.id,
          outcome: "ENABLED",
          newValue: {
            submissionId: id,
            slug: submission.slug,
            version: submission.version,
          },
        },
      });
      return saved;
    });
  }

  async test(tenantId: string, id: string, actorId?: string) {
    const installation = await this.prisma.integrationInstallation.findFirst({
      where: { tenantId, submissionId: id },
      include: { submission: true },
    });
    if (!installation || installation.status !== "ENABLED")
      throw new BadRequestException(
        "Enable this integration before testing it",
      );
    const manifest = installation.submission.manifest as Record<
      string,
      unknown
    >;
    const succeeded =
      typeof manifest.testUrl === "string" &&
      manifest.testUrl.startsWith("https://");
    const testedAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      const saved = await tx.integrationInstallation.update({
        where: { id: installation.id },
        data: {
          lastTestStatus: succeeded ? "SUCCEEDED" : "FAILED",
          lastTestedAt: testedAt,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "marketplace.integration.test",
          object: "IntegrationInstallation",
          objectId: saved.id,
          outcome: succeeded ? "SUCCEEDED" : "FAILED",
          newValue: { testedAt: testedAt.toISOString() },
        },
      });
      return saved;
    });
  }

  async disable(tenantId: string, id: string, actorId?: string) {
    const installation = await this.prisma.integrationInstallation.findFirst({
      where: { tenantId, submissionId: id },
    });
    if (!installation)
      throw new NotFoundException(
        "Tenant integration installation was not found",
      );
    return this.prisma.$transaction(async (tx) => {
      const saved = await tx.integrationInstallation.update({
        where: { id: installation.id },
        data: { status: "DISABLED", disabledAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "marketplace.integration.disable",
          object: "IntegrationInstallation",
          objectId: saved.id,
          outcome: "DISABLED",
        },
      });
      return saved;
    });
  }

  private async transition(
    tenantId: string,
    value: any,
    status: string,
    actorId?: string,
    notes?: string,
  ) {
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const saved = await tx.integrationSubmission.update({
        where: { id: value.id },
        data: {
          status,
          reviewNotes: notes,
          submittedAt: status === "SUBMITTED" ? now : value.submittedAt,
          reviewedAt: ["APPROVED", "REJECTED"].includes(status)
            ? now
            : value.reviewedAt,
          reviewedBy: status === "SUBMITTED" ? value.reviewedBy : actorId,
          publishedAt: status === "PUBLISHED" ? now : value.publishedAt,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: `marketplace.submission.${status.toLowerCase()}`,
          object: "IntegrationSubmission",
          objectId: value.id,
          oldValue: { status: value.status },
          newValue: { status, notes },
          outcome: status,
        },
      });
      return saved;
    });
  }

  private validateManifest(manifest: Record<string, unknown>) {
    if (
      typeof manifest.testUrl !== "string" ||
      !manifest.testUrl.startsWith("https://")
    )
      throw new BadRequestException("Manifest testUrl must use HTTPS");
    if (!Array.isArray(manifest.scopes) || manifest.scopes.length === 0)
      throw new BadRequestException("Manifest must declare at least one scope");
    const allowedScopes = new Set([
      "tenant.read",
      "roster.read",
      "roster.write",
      "devices.read",
      "reports.read",
      "audit.read",
    ]);
    if (
      manifest.scopes.some(
        (scope) => typeof scope !== "string" || !allowedScopes.has(scope),
      )
    )
      throw new BadRequestException("Manifest contains an unsupported scope");
  }
  private async requireTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) throw new NotFoundException("Tenant was not found");
  }
  private async requireSubmission(tenantId: string, id: string) {
    const value = await this.prisma.integrationSubmission.findFirst({
      where: { id, tenantId },
    });
    if (!value)
      throw new NotFoundException(
        "Integration submission was not found for this tenant",
      );
    return value;
  }
  private summary(row: any): IntegrationMarketplaceItem {
    const installation = row.installations?.[0];
    return {
      id: row.id,
      slug: row.slug,
      version: row.version,
      name: row.name,
      description: row.description,
      category: row.category,
      status: row.status,
      reviewNotes: row.reviewNotes ?? null,
      publishedAt: row.publishedAt?.toISOString() ?? null,
      installation: installation
        ? {
            id: installation.id,
            status: installation.status,
            lastTestStatus: installation.lastTestStatus ?? null,
            lastTestedAt: installation.lastTestedAt?.toISOString() ?? null,
          }
        : null,
    };
  }
}
