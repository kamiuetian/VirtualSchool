import { ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AppCatalogService } from "./app-catalog.service";

const now = new Date("2026-05-17T10:00:00.000Z");

describe("AppCatalogService", () => {
  it("creates an app catalog item and audit event", async () => {
    const auditEvents: unknown[] = [];
    const service = new AppCatalogService({
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          appCatalogItem: {
            create: async ({ data }: { data: Record<string, unknown> }) => ({
              ...data,
              createdAt: now,
              id: "app-1",
              updatedAt: now,
            }),
          },
          auditEvent: {
            create: async ({ data }: { data: unknown }) => {
              auditEvents.push(data);
              return data;
            },
          },
        }),
      appCatalogItem: {
        findUnique: async () => null,
      },
      tenant: {
        findUnique: async () => ({ id: "tenant-1" }),
      },
    } as never);

    await expect(
      service.createApp("tenant-1", {
        approvedGrades: ["5", "6"],
        installRules: {
          installType: "FORCE_INSTALLED",
        },
        name: "Google Classroom",
        packageId: "com.google.android.apps.classroom",
      }),
    ).resolves.toMatchObject({
      approvalStatus: "APPROVED",
      approvedGrades: ["5", "6"],
      id: "app-1",
      packageId: "com.google.android.apps.classroom",
    });

    expect(auditEvents[0]).toMatchObject({
      action: "app_catalog.create",
      object: "AppCatalogItem",
      outcome: "SUCCESS",
      tenantId: "tenant-1",
    });
  });

  it("rejects duplicate package IDs within a tenant", async () => {
    const service = new AppCatalogService({
      appCatalogItem: {
        findUnique: async () => ({ id: "app-1" }),
      },
      tenant: {
        findUnique: async () => ({ id: "tenant-1" }),
      },
    } as never);

    await expect(
      service.createApp("tenant-1", {
        name: "Google Classroom",
        packageId: "com.google.android.apps.classroom",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("updates catalog approval metadata and records old/new values", async () => {
    const audit = vi.fn();
    const existing = {
      approvalStatus: "APPROVED",
      approvedGrades: ["5"],
      category: "Learning",
      createdAt: now,
      description: null,
      iconUrl: null,
      id: "app-1",
      installRules: {
        installType: "AVAILABLE",
      },
      name: "Google Classroom",
      packageId: "com.google.android.apps.classroom",
      tenantId: "tenant-1",
      updatedAt: now,
    };
    const service = new AppCatalogService({
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          appCatalogItem: {
            update: async ({ data }: { data: Record<string, unknown> }) => ({
              ...existing,
              ...data,
              updatedAt: now,
            }),
          },
          auditEvent: {
            create: audit,
          },
        }),
      appCatalogItem: {
        findFirst: async () => existing,
      },
    } as never);

    await expect(
      service.updateApp("tenant-1", "app-1", {
        approvalStatus: "DEPRECATED",
        approvedGrades: ["5", "6"],
      }),
    ).resolves.toMatchObject({
      approvalStatus: "DEPRECATED",
      approvedGrades: ["5", "6"],
    });

    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "app_catalog.update",
          oldValue: expect.objectContaining({
            approvalStatus: "APPROVED",
          }),
        }),
      }),
    );
  });
});
