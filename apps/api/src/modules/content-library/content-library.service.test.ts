import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ContentLibraryService } from "./content-library.service";

const now = new Date();
const future = new Date(now.getTime() + 7 * 86_400_000);

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    tenantId: "tenant-1",
    title: "Fractions",
    description: null,
    type: "LINK",
    category: "Mathematics",
    locator: "https://learn.example/fractions",
    grades: ["5"],
    subjects: ["Mathematics"],
    classIds: ["class-1"],
    status: "ACTIVE",
    expiresAt: future,
    offlineEnabled: false,
    offlineVersion: null,
    offlineSha256: null,
    offlineSizeBytes: null,
    offlinePolicyIds: [],
    createdBy: "admin-1",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("ContentLibraryService", () => {
  it("creates a scoped resource and records an audit", async () => {
    const audit = vi.fn();
    const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) =>
      item(data),
    );
    const service = new ContentLibraryService({
      tenant: { findUnique: async () => ({ id: "tenant-1" }) },
      classSection: { count: async () => 1 },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          contentLibraryItem: { create },
          auditEvent: { create: audit },
        }),
    } as never);
    await expect(
      service.create(
        "tenant-1",
        {
          title: "Fractions",
          type: "LINK",
          category: "Mathematics",
          locator: "https://learn.example/fractions",
          grades: ["5", "5"],
          subjects: ["Mathematics"],
          classIds: ["class-1"],
          expiresAt: future.toISOString(),
        },
        "admin-1",
      ),
    ).resolves.toMatchObject({ title: "Fractions", grades: ["5"] });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "content_library.create",
          tenantId: "tenant-1",
        }),
      }),
    );
  });

  it("rejects class IDs outside the tenant", async () => {
    const service = new ContentLibraryService({
      tenant: { findUnique: async () => ({ id: "tenant-1" }) },
      classSection: { count: async () => 0 },
    } as never);
    await expect(
      service.create("tenant-1", {
        title: "Exam",
        type: "EXAM",
        category: "Assessment",
        locator: "https://exam.example/start",
        classIds: ["00000000-0000-4000-8000-000000000001"],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("requires integrity metadata and a tenant-published policy for offline content", async () => {
    const service = new ContentLibraryService({
      tenant: { findUnique: async () => ({ id: "tenant-1" }) },
      classSection: { count: async () => 0 },
      policy: { count: async () => 0 },
    } as never);
    await expect(
      service.create("tenant-1", {
        title: "Fractions pack",
        type: "PDF",
        category: "Mathematics",
        locator: "https://cdn.example/fractions.pdf",
        offlineEnabled: true,
        offlineVersion: 1,
        offlineSha256: "a".repeat(64),
        offlineSizeBytes: 2048,
        offlinePolicyIds: ["00000000-0000-4000-8000-000000000001"],
      }),
    ).rejects.toThrow("published and belong to the tenant");
  });

  it("excludes expired and archived resources from the available list", async () => {
    const findMany = vi.fn(async () => [item()]);
    const service = new ContentLibraryService({
      tenant: { findUnique: async () => ({ id: "tenant-1" }) },
      contentLibraryItem: { findMany },
    } as never);
    await service.list("tenant-1");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
          status: "ACTIVE",
          OR: expect.any(Array),
        }),
      }),
    );
  });

  it("reports expired resources without returning them as available", async () => {
    const service = new ContentLibraryService({
      tenant: { findUnique: async () => ({ id: "tenant-1" }) },
      contentLibraryItem: {
        findMany: async () => [
          item(),
          item({ id: "expired", expiresAt: new Date(now.getTime() - 1000) }),
          item({ id: "archived", status: "ARCHIVED", expiresAt: null }),
        ],
      },
    } as never);
    await expect(service.report("tenant-1")).resolves.toMatchObject({
      active: 1,
      archived: 1,
      expired: 1,
      expiredItems: [expect.objectContaining({ id: "expired" })],
    });
  });
});
