import { describe, expect, it, vi } from "vitest";
import { ChangeApprovalsService } from "./change-approvals.service";

const pending = (overrides = {}) => ({
  id: "request-1",
  tenantId: "tenant-1",
  operation: "BROAD_UNLOCK",
  objectType: "Policy",
  objectId: "policy-1",
  status: "PENDING",
  summary: "Unlock all devices",
  reason: "Incident recovery",
  oldValue: { locked: true },
  newValue: { locked: false },
  requestedBy: "requester",
  decisions: [],
  outcome: null,
  expiresAt: new Date(Date.now() + 60_000),
  createdAt: new Date(),
  updatedAt: new Date(),
  decidedAt: null,
  ...overrides,
});
function harness(row = pending()) {
  const update = vi.fn().mockResolvedValue(row);
  const auditCreate = vi.fn().mockResolvedValue({});
  const tx = {
    highRiskChangeRequest: { create: vi.fn().mockResolvedValue(row), update },
    highRiskApprovalConfig: { findUnique: vi.fn(), upsert: vi.fn() },
    auditEvent: { create: auditCreate },
  };
  const prisma: any = {
    highRiskApprovalConfig: {
      findUnique: vi
        .fn()
        .mockResolvedValue({
          tenantId: "tenant-1",
          enabledOperations: ["BROAD_UNLOCK"],
          requiredApprovals: 2,
        }),
    },
    highRiskChangeRequest: {
      findFirst: vi.fn().mockResolvedValue(row),
      findMany: vi.fn(),
      update,
    },
    auditEvent: { create: auditCreate },
    $transaction: (fn: any) => fn(tx),
  };
  return { service: new ChangeApprovalsService(prisma), prisma, tx };
}
describe("ChangeApprovalsService", () => {
  it("rejects self approval", async () => {
    const { service } = harness();
    await expect(
      service.decide(
        "tenant-1",
        "request-1",
        { decision: "APPROVED", reason: "Looks safe" },
        "requester",
      ),
    ).rejects.toThrow("cannot approve their own");
  });
  it("requires the configured number of distinct approvers", async () => {
    const row = pending({
      decisions: [
        {
          actorId: "approver-1",
          decision: "APPROVED",
          reason: "Reviewed",
          decidedAt: new Date().toISOString(),
        },
      ],
    });
    const { service, tx } = harness(row);
    await service.decide(
      "tenant-1",
      "request-1",
      { decision: "APPROVED", reason: "Compared versions" },
      "approver-2",
    );
    expect(tx.highRiskChangeRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "APPROVED" }),
      }),
    );
    expect(tx.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: "approver-2",
          outcome: "APPROVED",
        }),
      }),
    );
  });
  it("records a rejection as the final outcome", async () => {
    const { service, tx } = harness();
    await service.decide(
      "tenant-1",
      "request-1",
      { decision: "REJECTED", reason: "Scope is too broad" },
      "auditor",
    );
    expect(tx.highRiskChangeRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "REJECTED",
          outcome: "Scope is too broad",
        }),
      }),
    );
  });
});
