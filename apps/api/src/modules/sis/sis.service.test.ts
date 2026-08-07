import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { SisService } from "./sis.service";

function prisma() {
  const auditCreate = vi.fn();
  const runCreate = vi.fn(async ({ data }) => ({
    id: "run-1",
    retryOfId: null,
    requestedBy: "actor",
    startedAt: new Date("2026-08-08T00:00:00Z"),
    ...data,
  }));
  return {
    tenant: {
      findUnique: vi.fn(async ({ where }) =>
        where.id === "tenant-1" ? { id: where.id } : null,
      ),
    },
    student: {
      findFirst: vi.fn(async ({ where }) =>
        where.id === "student-1" ? { id: where.id } : null,
      ),
    },
    classSection: { findFirst: vi.fn() },
    user: { findFirst: vi.fn() },
    guardian: { findFirst: vi.fn() },
    classMembership: { findFirst: vi.fn() },
    sisMapping: { upsert: vi.fn(async () => ({ id: "mapping-1" })) },
    sisSyncRun: { findMany: vi.fn(async () => []), findFirst: vi.fn() },
    $transaction: vi.fn(async (callback) =>
      callback({
        sisSyncRun: { create: runCreate },
        auditEvent: { create: auditCreate },
      }),
    ),
    auditCreate,
    runCreate,
  };
}

describe("SisService", () => {
  it("reconciles a tenant-owned record and records an audited successful run", async () => {
    const db = prisma();
    const service = new SisService(db as never);
    const result = await service.reconcile(
      "tenant-1",
      {
        source: "powerschool",
        records: [
          { objectType: "STUDENT", localId: "student-1", externalId: "S-10" },
        ],
      },
      "actor",
    );
    expect(result.status).toBe("SUCCEEDED");
    expect(result.affectedRecords).toBe(1);
    expect(db.sisMapping.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          tenantId: "tenant-1",
          source: "POWERSCHOOL",
        }),
      }),
    );
    expect(db.auditCreate).toHaveBeenCalled();
  });
  it("records a failed outcome without mapping an unrelated local record", async () => {
    const db = prisma();
    const service = new SisService(db as never);
    const result = await service.reconcile("tenant-1", {
      source: "sis",
      records: [
        { objectType: "STUDENT", localId: "other", externalId: "S-20" },
      ],
    });
    expect(result.status).toBe("FAILED");
    expect(result.records[0]?.error).toContain("not found");
    expect(db.sisMapping.upsert).not.toHaveBeenCalled();
  });
  it("rejects operations for an unknown tenant", async () => {
    const service = new SisService(prisma() as never);
    await expect(service.operations("other")).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
