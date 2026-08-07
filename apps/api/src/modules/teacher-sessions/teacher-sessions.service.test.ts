import { describe, expect, it, vi } from "vitest";
import { TeacherSessionsService } from "./teacher-sessions.service";

const now = new Date("2026-08-07T09:00:00.000Z");
const teacher = {
  id: "teacher-1",
  tenantId: "tenant-1",
  role: "TEACHER",
  status: "ACTIVE",
};

describe("TeacherSessionsService", () => {
  it("returns only explicitly assigned classes and their devices", async () => {
    const service = new TeacherSessionsService({
      user: { findFirst: async () => teacher },
      teacherClassAssignment: {
        findMany: async () => [
          {
            class: {
              id: "class-1",
              name: "Mathematics 4A",
              grade: "4",
              subject: "Math",
              devices: [
                {
                  id: "device-1",
                  serialNumber: "VS-001",
                  classId: "class-1",
                  status: "ONLINE",
                  compliance: "COMPLIANT",
                  lastCheckInAt: now,
                },
              ],
            },
          },
        ],
      },
      teacherSession: { findMany: async () => [] },
      teacherSessionTemplate: { findMany: async () => [] },
      appCatalogItem: { findMany: async () => [] },
    } as never);

    await expect(
      service.dashboard("tenant-1", "auth0|teacher"),
    ).resolves.toMatchObject({
      classes: [{ id: "class-1", deviceCount: 1 }],
      devices: [{ id: "device-1", serialNumber: "VS-001" }],
      activeSession: null,
    });
  });

  it("rejects starting class mode for an unassigned class", async () => {
    const service = new TeacherSessionsService({
      user: { findFirst: async () => teacher },
      teacherClassAssignment: { findUnique: async () => null },
    } as never);
    await expect(
      service.start("tenant-1", "class-other", "auth0|teacher"),
    ).rejects.toThrow("not assigned");
  });

  it("starts one guarded session and durably records session and audit events", async () => {
    const eventCreate = vi.fn();
    const auditCreate = vi.fn();
    const session = {
      id: "session-1",
      tenantId: "tenant-1",
      classId: "class-1",
      teacherId: teacher.id,
      status: "ACTIVE",
      startedAt: now,
      endedAt: null,
      reason: null,
      class: { name: "Mathematics 4A" },
      events: [
        {
          id: "event-1",
          type: "SESSION_STARTED",
          deviceId: null,
          details: { classId: "class-1" },
          createdAt: now,
        },
      ],
    };
    const service = new TeacherSessionsService({
      user: { findFirst: async () => teacher },
      teacherClassAssignment: {
        findUnique: async () => ({
          tenantId: "tenant-1",
          class: { status: "ACTIVE" },
        }),
      },
      teacherSession: { findFirst: async () => null },
      $transaction: async (callback: (tx: any) => Promise<unknown>) =>
        callback({
          teacherSession: {
            create: async () => session,
            findUniqueOrThrow: async () => session,
          },
          teacherSessionEvent: { create: eventCreate },
          auditEvent: { create: auditCreate },
        }),
    } as never);

    await expect(
      service.start("tenant-1", "class-1", "auth0|teacher"),
    ).resolves.toMatchObject({ id: "session-1", status: "ACTIVE" });
    expect(eventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "SESSION_STARTED" }),
      }),
    );
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "teacher_session.start" }),
      }),
    );
  });

  it("allows device events only for a device assigned to the active class", async () => {
    const service = new TeacherSessionsService({
      user: { findFirst: async () => teacher },
      teacherSession: {
        findFirst: async () => ({
          id: "session-1",
          classId: "class-1",
          status: "ACTIVE",
        }),
      },
      device: { findFirst: async () => null },
    } as never);
    await expect(
      service.recordDeviceEvent(
        "tenant-1",
        "session-1",
        { deviceId: "device-other", type: "DEVICE_OFFLINE" },
        "auth0|teacher",
      ),
    ).rejects.toThrow("not assigned");
  });

  it("rejects resources that are not approved for the active class grade", async () => {
    const service = new TeacherSessionsService({
      user: { findFirst: async () => teacher },
      teacherSession: {
        findFirst: async () => ({
          id: "session-1",
          classId: "class-1",
          status: "ACTIVE",
        }),
      },
      classSection: { findFirst: async () => ({ id: "class-1", grade: "4" }) },
      appCatalogItem: {
        findFirst: async () => ({
          id: "app-1",
          approvalStatus: "APPROVED",
          approvedGrades: ["5"],
        }),
      },
    } as never);
    await expect(
      service.pushResource("tenant-1", "session-1", "app-1", "auth0|teacher"),
    ).rejects.toThrow("not approved");
  });

  it("pushes only a class-scoped enabled education resource and audits the dispatch", async () => {
    const auditCreate = vi.fn();
    const createMany = vi.fn();
    const event = {
      id: "event-education",
      type: "EDUCATION_RESOURCE_PUSHED",
      deviceId: null,
      details: {},
      createdAt: now,
    };
    const service = new TeacherSessionsService({
      user: { findFirst: async () => teacher },
      teacherSession: {
        findFirst: async () => ({
          id: "session-1",
          classId: "class-1",
          status: "ACTIVE",
        }),
      },
      educationResource: {
        findFirst: async () => ({
          id: "resource-1",
          provider: "TEAMS",
          displayName: "Biology Team",
          launchUrl: "https://teams.microsoft.com/l/team-1",
        }),
      },
      device: { findMany: async () => [{ id: "device-1" }] },
      $transaction: async (callback: (tx: any) => Promise<unknown>) =>
        callback({
          teacherSessionEvent: { create: async () => event },
          remoteCommand: { createMany },
          auditEvent: { create: auditCreate },
        }),
    } as never);
    await service.pushEducationResource(
      "tenant-1",
      "session-1",
      "resource-1",
      "auth0|teacher",
    );
    expect(createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          payload: expect.objectContaining({
            kind: "TEACHER_EDUCATION_RESOURCE",
            provider: "TEAMS",
          }),
        }),
      ],
    });
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "teacher_session.education_resource_pushed",
        }),
      }),
    );
  });

  it("queues a bounded focus screen for every non-retired class device and audits it", async () => {
    const createMany = vi.fn();
    const auditCreate = vi.fn();
    const event = {
      id: "event-focus",
      type: "FOCUS_SCREEN_SHOWN",
      deviceId: null,
      details: {},
      createdAt: now,
    };
    const service = new TeacherSessionsService({
      user: { findFirst: async () => teacher },
      teacherSession: {
        findFirst: async () => ({
          id: "session-1",
          classId: "class-1",
          status: "ACTIVE",
        }),
      },
      device: {
        findMany: async () => [{ id: "device-1" }, { id: "device-2" }],
      },
      $transaction: async (callback: (tx: any) => Promise<unknown>) =>
        callback({
          teacherSessionEvent: { create: async () => event },
          remoteCommand: { createMany },
          auditEvent: { create: auditCreate },
        }),
    } as never);
    await service.showFocusScreen(
      "tenant-1",
      "session-1",
      "Eyes to the board",
      3,
      "auth0|teacher",
    );
    expect(createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          type: "SEND_MESSAGE",
          payload: expect.objectContaining({ kind: "TEACHER_FOCUS_SCREEN" }),
        }),
      ]),
    });
    expect(auditCreate).toHaveBeenCalled();
  });

  it("does not allow temporary URL approval to bypass an active block rule", async () => {
    const service = new TeacherSessionsService({
      user: { findFirst: async () => teacher },
      teacherSession: {
        findFirst: async () => ({
          id: "session-1",
          classId: "class-1",
          status: "ACTIVE",
        }),
      },
      policyAssignment: {
        findMany: async () => [
          {
            policy: {
              version: 1,
              rules: {
                mode: "DEFAULT_SCHOOL",
                defaultWebAccess: "DENY",
                urlAllowlist: [],
                urlBlocklist: [],
              },
            },
          },
        ],
      },
      tenant: {
        findUnique: async () => ({
          webFilterSettings: {
            neverAllowedUrls: ["https://games.example/*"],
          },
        }),
      },
    } as never);
    await expect(
      service.approveTemporaryUrl(
        "tenant-1",
        "session-1",
        "https://games.example/play",
        10,
        "auth0|teacher",
      ),
    ).rejects.toThrow("cannot bypass");
  });

  it("rejects a template for a class the teacher is not assigned", async () => {
    const service = new TeacherSessionsService({
      user: { findFirst: async () => teacher },
      teacherClassAssignment: { findUnique: async () => null },
    } as never);
    await expect(
      service.createTemplate(
        "tenant-1",
        {
          name: "Math warmup",
          classId: "class-other",
          focusMessage: "Open notebooks",
          focusDurationMinutes: 2,
        },
        "auth0|teacher",
      ),
    ).rejects.toThrow("assigned active class");
  });

  it("creates an owned, validated template and records an audit event", async () => {
    const auditCreate = vi.fn();
    const template = {
      id: "template-1",
      tenantId: "tenant-1",
      teacherId: teacher.id,
      classId: "class-1",
      name: "Math warmup",
      resourceId: null,
      focusMessage: "Open notebooks",
      focusDurationMinutes: 2,
      temporaryUrl: null,
      temporaryUrlMinutes: null,
      createdAt: now,
      updatedAt: now,
      class: { name: "Mathematics 4A" },
    };
    const service = new TeacherSessionsService({
      user: { findFirst: async () => teacher },
      teacherClassAssignment: {
        findUnique: async () => ({
          tenantId: "tenant-1",
          class: { status: "ACTIVE", grade: "4" },
        }),
      },
      $transaction: async (callback: (tx: any) => Promise<unknown>) =>
        callback({
          teacherSessionTemplate: { create: async () => template },
          auditEvent: { create: auditCreate },
        }),
    } as never);
    await expect(
      service.createTemplate(
        "tenant-1",
        {
          name: "Math warmup",
          classId: "class-1",
          focusMessage: "Open notebooks",
          focusDurationMinutes: 2,
        },
        "auth0|teacher",
      ),
    ).resolves.toMatchObject({ id: "template-1", className: "Mathematics 4A" });
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "teacher_session_template.create",
          actorId: teacher.id,
        }),
      }),
    );
  });

  it("does not let a teacher reuse another teacher's template", async () => {
    const service = new TeacherSessionsService({
      user: { findFirst: async () => teacher },
      teacherSessionTemplate: { findFirst: async () => null },
    } as never);
    await expect(
      service.startFromTemplate("tenant-1", "template-other", "auth0|teacher"),
    ).rejects.toThrow("not found");
  });
});
