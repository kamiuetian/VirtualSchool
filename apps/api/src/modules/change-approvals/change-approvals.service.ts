import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import type {
  HighRiskChangeRequestSummary,
  HighRiskDecision,
} from "@virtual-school/shared";
import type {
  CreateChangeRequestDto,
  DecideChangeRequestDto,
  UpdateApprovalConfigDto,
} from "./change-approvals.dto";

@Injectable()
export class ChangeApprovalsService {
  constructor(private readonly prisma: PrismaService) {}
  async dashboard(tenantId: string) {
    const [config, requests] = await Promise.all([
      this.prisma.highRiskApprovalConfig.findUnique({ where: { tenantId } }),
      this.prisma.highRiskChangeRequest.findMany({
        where: { tenantId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);
    return {
      config: config ?? {
        tenantId,
        enabledOperations: [],
        requiredApprovals: 1,
      },
      requests: requests.map((r) => this.summary(r)),
    };
  }
  async configure(
    tenantId: string,
    input: UpdateApprovalConfigDto,
    actorId?: string,
  ) {
    const enabledOperations = [...new Set(input.enabledOperations)];
    const saved = await this.prisma.$transaction(async (tx) => {
      const old = await tx.highRiskApprovalConfig.findUnique({
        where: { tenantId },
      });
      const row = await tx.highRiskApprovalConfig.upsert({
        where: { tenantId },
        create: {
          tenantId,
          enabledOperations,
          requiredApprovals: input.requiredApprovals,
          updatedBy: actorId,
        },
        update: {
          enabledOperations,
          requiredApprovals: input.requiredApprovals,
          updatedBy: actorId,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "change-approval.configure",
          object: "HighRiskApprovalConfig",
          objectId: row.id,
          oldValue: old
            ? {
                enabledOperations: old.enabledOperations,
                requiredApprovals: old.requiredApprovals,
              }
            : Prisma.JsonNull,
          newValue: {
            enabledOperations,
            requiredApprovals: input.requiredApprovals,
          },
          outcome: "SUCCESS",
        },
      });
      return row;
    });
    return saved;
  }
  async create(
    tenantId: string,
    input: CreateChangeRequestDto,
    actorId?: string,
  ): Promise<HighRiskChangeRequestSummary> {
    if (!actorId)
      throw new BadRequestException("Authenticated requester is required");
    const config = await this.prisma.highRiskApprovalConfig.findUnique({
      where: { tenantId },
    });
    if (
      !config ||
      !(config.enabledOperations as string[]).includes(input.operation)
    )
      throw new BadRequestException(
        "Approval is not configured for this operation",
      );
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const row = await this.prisma.$transaction(async (tx) => {
      const oldValue = input.oldValue
        ? (input.oldValue as Prisma.InputJsonValue)
        : Prisma.JsonNull;
      const created = await tx.highRiskChangeRequest.create({
        data: {
          tenantId,
          ...input,
          oldValue,
          newValue: input.newValue as Prisma.InputJsonValue,
          decisions: [],
          requestedBy: actorId,
          expiresAt,
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: "change-approval.request",
          object: input.objectType,
          objectId: input.objectId,
          oldValue,
          newValue: input.newValue as Prisma.InputJsonValue,
          reason: input.reason,
          outcome: "PENDING",
        },
      });
      return created;
    });
    return this.summary(row);
  }
  async decide(
    tenantId: string,
    id: string,
    input: DecideChangeRequestDto,
    actorId?: string,
  ): Promise<HighRiskChangeRequestSummary> {
    if (!actorId)
      throw new BadRequestException("Authenticated approver is required");
    const config = await this.prisma.highRiskApprovalConfig.findUnique({
      where: { tenantId },
    });
    const row = await this.prisma.highRiskChangeRequest.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException("Change request not found");
    if (row.status !== "PENDING")
      throw new ConflictException("Change request is no longer pending");
    if (row.requestedBy === actorId)
      throw new ConflictException(
        "Requesters cannot approve their own high-risk change",
      );
    if (row.expiresAt <= new Date()) return this.expire(row, actorId);
    const decisions = row.decisions as unknown as HighRiskDecision[];
    if (decisions.some((d) => d.actorId === actorId))
      throw new ConflictException("Approver has already decided this request");
    decisions.push({
      actorId,
      decision: input.decision,
      reason: input.reason,
      decidedAt: new Date().toISOString(),
    });
    const approvals = decisions.filter((d) => d.decision === "APPROVED").length;
    const status =
      input.decision === "REJECTED"
        ? "REJECTED"
        : approvals >= (config?.requiredApprovals ?? 1)
          ? "APPROVED"
          : "PENDING";
    const saved = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.highRiskChangeRequest.update({
        where: { id },
        data: {
          decisions: decisions as unknown as Prisma.InputJsonValue,
          status,
          outcome: status === "PENDING" ? null : input.reason,
          decidedAt: status === "PENDING" ? null : new Date(),
        },
      });
      await tx.auditEvent.create({
        data: {
          tenantId,
          actorId,
          action: `change-approval.${input.decision.toLowerCase()}`,
          object: row.objectType,
          objectId: row.objectId,
          oldValue:
            row.oldValue === null
              ? Prisma.JsonNull
              : (row.oldValue as Prisma.InputJsonValue),
          newValue: row.newValue as Prisma.InputJsonValue,
          reason: input.reason,
          outcome: status,
        },
      });
      return updated;
    });
    return this.summary(saved);
  }
  private async expire(row: any, actorId: string) {
    const updated = await this.prisma.highRiskChangeRequest.update({
      where: { id: row.id },
      data: {
        status: "EXPIRED",
        outcome: "Approval window expired",
        decidedAt: new Date(),
      },
    });
    await this.prisma.auditEvent.create({
      data: {
        tenantId: row.tenantId,
        actorId,
        action: "change-approval.expire",
        object: row.objectType,
        objectId: row.objectId,
        outcome: "EXPIRED",
      },
    });
    return this.summary(updated);
  }
  private summary(row: any): HighRiskChangeRequestSummary {
    return {
      ...row,
      oldValue: row.oldValue,
      newValue: row.newValue,
      operation: row.operation,
      status: row.status,
      decisions: row.decisions,
      expiresAt: row.expiresAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
    };
  }
}
