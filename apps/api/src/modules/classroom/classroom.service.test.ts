import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { ClassroomService } from "./classroom.service";

const now = new Date("2026-08-08T09:00:00.000Z");
describe("ClassroomService", () => {
  it("rejects credential values and accepts secret references with an audit event", async () => {
    const audit = vi.fn();
    const service = new ClassroomService({
      tenant: { findUnique: async () => ({ id: "tenant-1" }) },
      $transaction: async (callback: any) =>
        callback({
          classroomConnection: {
            upsert: async ({ create }: any) => ({
              ...create,
              id: "connection-1",
            }),
          },
          auditEvent: { create: audit },
        }),
      classroomConnection: {
        findUnique: async () => ({
          id: "connection-1",
          status: "AUTHORIZED",
          delegatedAdminEmail: "admin@school.test",
          credentialReference: "secret://classroom",
          lastValidatedAt: now,
          courseMappings: [],
          identityMappings: [],
          syncRuns: [],
        }),
      },
    } as never);
    await expect(
      service.authorize("tenant-1", {
        credentialReference: "{client_secret:value}",
        delegatedAdminEmail: "admin@school.test",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.authorize(
        "tenant-1",
        {
          credentialReference: "secret://classroom",
          delegatedAdminEmail: "admin@school.test",
        },
        "admin-1",
      ),
    ).resolves.toMatchObject({ status: "AUTHORIZED" });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "classroom.authorize",
          tenantId: "tenant-1",
        }),
      }),
    );
  });

  it("enforces tenant isolation while mapping a course", async () => {
    const service = new ClassroomService({
      classroomConnection: {
        findUnique: async () => ({ id: "connection-1", status: "AUTHORIZED" }),
      },
      classSection: { findFirst: async () => null },
    } as never);
    await expect(
      service.mapCourse("tenant-1", {
        classId: "11111111-1111-4111-8111-111111111111",
        externalCourseId: "course-2",
        syncRoster: true,
        syncMaterials: false,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("queues only enabled selected mappings and records the requested data types", async () => {
    const audit = vi.fn();
    const service = new ClassroomService({
      classroomConnection: {
        findUnique: async () => ({ id: "connection-1", status: "AUTHORIZED" }),
      },
      classroomCourseMapping: {
        findMany: async () => [
          {
            id: "11111111-1111-4111-8111-111111111111",
            syncRoster: true,
            syncMaterials: false,
          },
        ],
      },
      $transaction: async (callback: any) =>
        callback({
          classroomSyncRun: {
            create: async ({ data }: any) => ({
              ...data,
              id: "run-1",
              status: "QUEUED",
              attempt: 1,
              retryOfId: null,
              outcome: null,
              errorCode: null,
              errorMessage: null,
              createdAt: now,
              completedAt: null,
            }),
          },
          auditEvent: { create: audit },
        }),
    } as never);
    await expect(
      service.startSync(
        "tenant-1",
        {
          courseMappingIds: ["11111111-1111-4111-8111-111111111111"],
          syncRoster: true,
          syncMaterials: false,
        },
        "admin-1",
      ),
    ).resolves.toMatchObject({
      requestedCourseIds: ["11111111-1111-4111-8111-111111111111"],
      status: "QUEUED",
      syncRoster: true,
      syncMaterials: false,
    });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "classroom.sync.queue",
          outcome: "QUEUED",
        }),
      }),
    );
  });

  it("allows retries only for a failed run in the same tenant", async () => {
    const create = vi.fn(async ({ data }: any) => ({
      ...data,
      id: "run-2",
      status: "QUEUED",
      outcome: null,
      errorCode: null,
      errorMessage: null,
      createdAt: now,
      completedAt: null,
    }));
    const service = new ClassroomService({
      classroomSyncRun: {
        findFirst: async () => ({
          id: "run-1",
          tenantId: "tenant-1",
          connectionId: "connection-1",
          requestedCourseIds: ["map-1"],
          syncRoster: true,
          syncMaterials: false,
          status: "FAILED",
          attempt: 1,
        }),
        create,
      },
      auditEvent: { create: vi.fn() },
    } as never);
    await expect(
      service.retry("tenant-1", "run-1", "admin-1"),
    ).resolves.toMatchObject({ attempt: 2, retryOfId: "run-1" });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenantId: "tenant-1", attempt: 2 }),
      }),
    );
  });
});
