import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  AccessAssignmentSummary,
  AccessReviewSummary,
  AccessRoleTemplateSummary,
  Permission,
} from "@virtual-school/shared";
import { apiPermissions } from "../auth/rbac";
import { PrismaService } from "../prisma/prisma.service";
import type {
  AssignAccessRoleDto,
  CreateAccessReviewDto,
  CreateAccessRoleTemplateDto,
  DecideAccessReviewDto,
} from "./access-governance.dto";

@Injectable()
export class AccessGovernanceService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async dashboard(tenantId: string) {
    const [templates, assignments, reviews] = await Promise.all([
      this.prisma.accessRoleTemplate.findMany({
        where: { tenantId },
        orderBy: { name: "asc" },
      }),
      this.prisma.accessAssignment.findMany({
        where: { tenantId },
        include: { template: true, user: true },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.accessReview.findMany({
        where: { tenantId },
        include: {
          items: {
            include: {
              assignment: { include: { template: true } },
              user: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return {
      templates: templates.map((v) => this.template(v)),
      assignments: assignments.map((v) => this.assignment(v)),
      reviews: reviews.map((v) => this.review(v)),
    };
  }

  async createTemplate(
    tenantId: string,
    input: CreateAccessRoleTemplateDto,
    actorId?: string,
  ): Promise<AccessRoleTemplateSummary> {
    const allowed = new Set(apiPermissions);
    const selected = [...new Set(input.permissions)] as Permission[];
    if (selected.some((p) => !allowed.has(p)))
      throw new BadRequestException(
        "Template contains an unsupported permission",
      );
    // Custom roles may delegate tenant operations but never platform tenant creation.
    if (selected.includes("tenant:create"))
      throw new BadRequestException(
        "Custom roles cannot include tenant:create",
      );
    const value = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.accessRoleTemplate.create({
        data: {
          tenantId,
          name: input.name.trim(),
          description: input.description?.trim(),
          permissions: selected,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "access.role_template.create",
          object: "AccessRoleTemplate",
          objectId: saved.id,
          outcome: "CREATED",
          newValue: { name: saved.name, permissions: selected },
        },
      });
      return saved;
    });
    return this.template(value);
  }

  async assign(
    tenantId: string,
    input: AssignAccessRoleDto,
    actorId?: string,
  ): Promise<AccessAssignmentSummary> {
    const [user, template, branch] = await Promise.all([
      this.prisma.user.findFirst({
        where: {
          id: input.userId,
          tenantId,
          status: { in: ["ACTIVE", "INVITED"] },
        },
      }),
      this.prisma.accessRoleTemplate.findFirst({
        where: { id: input.templateId, tenantId, active: true },
      }),
      input.branchId
        ? this.prisma.branch.findFirst({
            where: { id: input.branchId, tenantId },
          })
        : Promise.resolve(null),
    ]);
    if (!user || !template)
      throw new NotFoundException("User or active role template was not found");
    const regions = [
      ...new Set(
        (input.regionCodes ?? [])
          .map((v) => v.trim().toUpperCase())
          .filter(Boolean),
      ),
    ];
    if (input.scopeType === "BRANCH" && (!branch || regions.length))
      throw new BadRequestException(
        "BRANCH scope requires one tenant branch and no regions",
      );
    if (input.scopeType === "REGION" && (!regions.length || input.branchId))
      throw new BadRequestException(
        "REGION scope requires region codes and no branch",
      );
    if (input.scopeType === "TENANT" && (regions.length || input.branchId))
      throw new BadRequestException(
        "TENANT scope cannot include branch or region restrictions",
      );
    if (input.expiresAt && new Date(input.expiresAt) <= new Date())
      throw new BadRequestException("Assignment expiry must be in the future");
    const value = await this.prisma.$transaction(async (tx) => {
      await tx.accessAssignment.updateMany({
        where: { tenantId, userId: user.id, revokedAt: null },
        data: {
          revokedAt: new Date(),
          revokedReason: "Superseded by a new delegated assignment",
        },
      });
      const saved = await tx.accessAssignment.create({
        data: {
          tenantId,
          userId: user.id,
          templateId: template.id,
          scopeType: input.scopeType,
          regionCodes: regions,
          branchId: input.branchId,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        },
        include: { template: true, user: true },
      });
      await tx.user.update({
        where: { id: user.id },
        data: { forcedLogoutAt: new Date() },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "access.assignment.create",
          object: "AccessAssignment",
          objectId: saved.id,
          outcome: "ASSIGNED",
          newValue: {
            userId: user.id,
            templateId: template.id,
            scopeType: input.scopeType,
            regionCodes: regions,
            branchId: input.branchId,
            expiresAt: input.expiresAt,
          },
        },
      });
      return saved;
    });
    return this.assignment(value);
  }

  async createReview(
    tenantId: string,
    input: CreateAccessReviewDto,
    actorId?: string,
  ): Promise<AccessReviewSummary> {
    const dueAt = new Date(input.dueAt);
    if (dueAt <= new Date())
      throw new BadRequestException("Review due date must be in the future");
    const active = await this.prisma.accessAssignment.findMany({
      where: {
        tenantId,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      select: { id: true, userId: true },
    });
    const value = await this.prisma.$transaction(async (tx) => {
      const saved = await tx.accessReview.create({
        data: {
          tenantId,
          name: input.name.trim(),
          dueAt,
          items: {
            create: active.map((a) => ({
              assignmentId: a.id,
              userId: a.userId,
            })),
          },
        },
        include: {
          items: {
            include: {
              assignment: { include: { template: true } },
              user: true,
            },
          },
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "access.review.create",
          object: "AccessReview",
          objectId: saved.id,
          outcome: "OPEN",
          newValue: { dueAt, assignments: active.length },
        },
      });
      return saved;
    });
    return this.review(value);
  }

  async decide(
    tenantId: string,
    reviewId: string,
    itemId: string,
    input: DecideAccessReviewDto,
    actorId?: string,
  ): Promise<AccessReviewSummary> {
    const item = await this.prisma.accessReviewItem.findFirst({
      where: { id: itemId, reviewId, review: { tenantId, status: "OPEN" } },
      include: { assignment: true },
    });
    if (!item) throw new NotFoundException("Open review item was not found");
    await this.prisma.$transaction(async (tx) => {
      await tx.accessReviewItem.update({
        where: { id: item.id },
        data: {
          decision: input.decision,
          reason: input.reason,
          decidedBy: actorId,
          decidedAt: new Date(),
        },
      });
      if (input.decision === "REVOKED") {
        await tx.accessAssignment.update({
          where: { id: item.assignmentId },
          data: { revokedAt: new Date(), revokedReason: input.reason },
        });
        await tx.user.update({
          where: { id: item.userId },
          data: { forcedLogoutAt: new Date() },
        });
      }
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: `access.review.${input.decision.toLowerCase()}`,
          object: "AccessReviewItem",
          objectId: item.id,
          outcome: input.decision,
          reason: input.reason,
          newValue: { assignmentId: item.assignmentId, userId: item.userId },
        },
      });
      const pending = await tx.accessReviewItem.count({
        where: { reviewId, decision: "PENDING", id: { not: item.id } },
      });
      if (pending === 0)
        await tx.accessReview.update({
          where: { id: reviewId },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
    });
    const review = await this.prisma.accessReview.findFirst({
      where: { id: reviewId, tenantId },
      include: {
        items: {
          include: { assignment: { include: { template: true } }, user: true },
        },
      },
    });
    if (!review) throw new NotFoundException();
    return this.review(review);
  }

  async exportReview(tenantId: string, reviewId: string): Promise<string> {
    const review = await this.prisma.accessReview.findFirst({
      where: { id: reviewId, tenantId },
      include: {
        items: {
          include: { assignment: { include: { template: true } }, user: true },
        },
      },
    });
    if (!review) throw new NotFoundException("Access review was not found");
    const rows = [
      [
        "review",
        "status",
        "dueAt",
        "user",
        "email",
        "roleTemplate",
        "scope",
        "decision",
        "reason",
        "decidedBy",
        "decidedAt",
      ],
      ...review.items.map((i) => [
        review.name,
        review.status,
        review.dueAt.toISOString(),
        i.user.name,
        i.user.email,
        i.assignment.template.name,
        this.scope(i.assignment),
        i.decision,
        i.reason ?? "",
        i.decidedBy ?? "",
        i.decidedAt?.toISOString() ?? "",
      ]),
    ];
    return rows
      .map((r) =>
        r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(","),
      )
      .join("\n");
  }

  private template(v: any): AccessRoleTemplateSummary {
    return {
      id: v.id,
      name: v.name,
      description: v.description,
      permissions: v.permissions as Permission[],
      active: v.active,
    };
  }
  private assignment(v: any): AccessAssignmentSummary {
    return {
      id: v.id,
      userId: v.userId,
      userName: v.user.name,
      userEmail: v.user.email,
      templateId: v.templateId,
      templateName: v.template.name,
      permissions: v.template.permissions as Permission[],
      scopeType: v.scopeType,
      regionCodes: v.regionCodes as string[],
      branchId: v.branchId,
      expiresAt: v.expiresAt?.toISOString() ?? null,
      revokedAt: v.revokedAt?.toISOString() ?? null,
    };
  }
  private scope(v: any) {
    return v.scopeType === "BRANCH"
      ? `BRANCH:${v.branchId}`
      : v.scopeType === "REGION"
        ? `REGION:${(v.regionCodes as string[]).join("|")}`
        : "TENANT";
  }
  private review(v: any): AccessReviewSummary {
    return {
      id: v.id,
      name: v.name,
      status: v.status,
      dueAt: v.dueAt.toISOString(),
      completedAt: v.completedAt?.toISOString() ?? null,
      items: v.items.map((i: any) => ({
        id: i.id,
        assignmentId: i.assignmentId,
        userId: i.userId,
        userName: i.user.name,
        templateName: i.assignment.template.name,
        scope: this.scope(i.assignment),
        decision: i.decision,
        reason: i.reason,
        decidedBy: i.decidedBy,
        decidedAt: i.decidedAt?.toISOString() ?? null,
      })),
    };
  }
}
