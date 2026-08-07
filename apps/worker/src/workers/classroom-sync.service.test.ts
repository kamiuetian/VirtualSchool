import { afterEach, describe, expect, it, vi } from "vitest";
import { ClassroomSyncService } from "./classroom-sync.service";

describe("ClassroomSyncService", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.CLASSROOM_SYNC_PROVIDER_URL;
  });
  it("dispatches only the queued tenant selection and records a successful outcome", async () => {
    process.env.CLASSROOM_SYNC_PROVIDER_URL =
      "https://classroom-provider.test/sync";
    const fetchMock = vi.fn<
      (input: string | URL, init?: RequestInit) => Promise<Response>
    >(
      async () =>
        new Response(
          JSON.stringify({ rosterImported: 3, materialsImported: 0 }),
          { status: 200 },
        ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const updates: any[] = [];
    const audits: any[] = [];
    const prisma = {
      classroomSyncRun: {
        findMany: async () => [
          {
            id: "run-1",
            tenantId: "tenant-1",
            connectionId: "connection-1",
            requestedCourseIds: ["mapping-1"],
            syncRoster: true,
            syncMaterials: false,
            connection: {
              credentialReference: "secret://classroom",
              delegatedAdminEmail: "admin@school.test",
            },
          },
        ],
        update: async ({ data }: any) => updates.push(data),
      },
      classroomCourseMapping: {
        findMany: async () => [
          { id: "mapping-1", classId: "class-1", externalCourseId: "course-1" },
        ],
      },
      classroomIdentityMapping: {
        findMany: async () => [
          {
            localType: "STUDENT",
            localId: "student-1",
            externalUserId: "user-1",
          },
        ],
      },
      $transaction: async (callback: any) =>
        callback({
          classroomSyncRun: {
            update: async ({ data }: any) => updates.push(data),
          },
          auditEvent: { create: async ({ data }: any) => audits.push(data) },
        }),
    };
    await expect(
      new ClassroomSyncService(prisma as never).processTenant("tenant-1"),
    ).resolves.toMatchObject({ evaluated: 1, succeeded: 1, failed: 0 });
    const payload = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(payload).toMatchObject({
      tenantId: "tenant-1",
      syncRoster: true,
      syncMaterials: false,
      courses: [{ localClassId: "class-1", externalCourseId: "course-1" }],
    });
    expect(updates.at(-1)).toMatchObject({
      status: "SUCCEEDED",
      outcome: { rosterImported: 3 },
    });
    expect(audits[0]).toMatchObject({
      tenantId: "tenant-1",
      outcome: "SUCCEEDED",
    });
  });

  it("records a retryable failed outcome when the provider is unavailable", async () => {
    const updates: any[] = [];
    const prisma = {
      classroomSyncRun: {
        findMany: async () => [
          {
            id: "run-1",
            tenantId: "tenant-1",
            connectionId: "connection-1",
            requestedCourseIds: ["mapping-1"],
            syncRoster: true,
            syncMaterials: false,
            connection: {
              credentialReference: "secret://classroom",
              delegatedAdminEmail: "admin@school.test",
            },
          },
        ],
        update: vi.fn(),
      },
      classroomCourseMapping: {
        findMany: async () => [
          { id: "mapping-1", classId: "class-1", externalCourseId: "course-1" },
        ],
      },
      classroomIdentityMapping: { findMany: async () => [] },
      $transaction: async (callback: any) =>
        callback({
          classroomSyncRun: {
            update: async ({ data }: any) => updates.push(data),
          },
          auditEvent: { create: vi.fn() },
        }),
    };
    await expect(
      new ClassroomSyncService(prisma as never).processTenant("tenant-1"),
    ).resolves.toMatchObject({ failed: 1 });
    expect(updates[0]).toMatchObject({
      status: "FAILED",
      errorCode: "PROVIDER_UNAVAILABLE",
    });
  });
});
