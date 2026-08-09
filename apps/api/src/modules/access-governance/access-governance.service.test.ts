import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AccessGovernanceService } from "./access-governance.service";

describe("AccessGovernanceService", () => {
  it("rejects platform permissions in tenant custom roles", async () => {
    const service = new AccessGovernanceService({} as never);
    await expect(
      service.createTemplate("tenant-1", {
        name: "Unsafe",
        permissions: ["tenant:create"],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("prevents assigning a branch from another tenant", async () => {
    const prisma = {
      user: { findFirst: vi.fn().mockResolvedValue({ id: "user-1" }) },
      accessRoleTemplate: {
        findFirst: vi.fn().mockResolvedValue({ id: "template-1" }),
      },
      branch: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const service = new AccessGovernanceService(prisma as never);
    await expect(
      service.assign("tenant-1", {
        userId: "user-1",
        templateId: "template-1",
        scopeType: "BRANCH",
        branchId: "branch-other",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.branch.findFirst).toHaveBeenCalledWith({
      where: { id: "branch-other", tenantId: "tenant-1" },
    });
  });

  it("revokes reviewed access, forces logout, audits, and closes the review", async () => {
    const calls: Array<{ model: string; value: unknown }> = [];
    const tx = {
      accessReviewItem: {
        update: vi.fn(async (value) => calls.push({ model: "item", value })),
        count: vi.fn().mockResolvedValue(0),
      },
      accessAssignment: {
        update: vi.fn(async (value) =>
          calls.push({ model: "assignment", value }),
        ),
      },
      user: {
        update: vi.fn(async (value) => calls.push({ model: "user", value })),
      },
      auditEvent: {
        create: vi.fn(async (value) => calls.push({ model: "audit", value })),
      },
      accessReview: {
        update: vi.fn(async (value) => calls.push({ model: "review", value })),
      },
    };
    const prisma = {
      accessReviewItem: {
        findFirst: vi
          .fn()
          .mockResolvedValue({
            id: "item-1",
            assignmentId: "assignment-1",
            userId: "user-1",
            assignment: {},
          }),
      },
      accessReview: {
        findFirst: vi
          .fn()
          .mockResolvedValue({
            id: "review-1",
            name: "Q3",
            status: "COMPLETED",
            dueAt: new Date(),
            completedAt: new Date(),
            items: [],
          }),
      },
      $transaction: vi.fn(async (work) => work(tx)),
    };
    const service = new AccessGovernanceService(prisma as never);
    const result = await service.decide(
      "tenant-1",
      "review-1",
      "item-1",
      { decision: "REVOKED", reason: "No longer required" },
      "reviewer-1",
    );
    expect(result.status).toBe("COMPLETED");
    expect(calls.map((call) => call.model)).toEqual([
      "item",
      "assignment",
      "user",
      "audit",
      "review",
    ]);
    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "access.review.revoked",
        actorId: "reviewer-1",
        outcome: "REVOKED",
      }),
    });
  });

  it("does not permit decisions against another tenant's review", async () => {
    const service = new AccessGovernanceService({
      accessReviewItem: { findFirst: vi.fn().mockResolvedValue(null) },
    } as never);
    await expect(
      service.decide("tenant-1", "review-2", "item-1", {
        decision: "CONFIRMED",
        reason: "Still required",
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
