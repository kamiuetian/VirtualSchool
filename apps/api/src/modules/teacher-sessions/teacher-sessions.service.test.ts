import { describe, expect, it, vi } from "vitest";
import { TeacherSessionsService } from "./teacher-sessions.service";

const now = new Date("2026-08-07T09:00:00.000Z");
const teacher = { id: "teacher-1", tenantId: "tenant-1", role: "TEACHER", status: "ACTIVE" };

describe("TeacherSessionsService", () => {
  it("returns only explicitly assigned classes and their devices", async () => {
    const service = new TeacherSessionsService({
      user: { findFirst: async () => teacher },
      teacherClassAssignment: {
        findMany: async () => [{
          class: {
            id: "class-1", name: "Mathematics 4A", grade: "4", subject: "Math",
            devices: [{ id: "device-1", serialNumber: "VS-001", classId: "class-1", status: "ONLINE", compliance: "COMPLIANT", lastCheckInAt: now }],
          },
        }],
      },
      teacherSession: { findMany: async () => [] },
    } as never);

    await expect(service.dashboard("tenant-1", "auth0|teacher")).resolves.toMatchObject({
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
    await expect(service.start("tenant-1", "class-other", "auth0|teacher")).rejects.toThrow("not assigned");
  });

  it("starts one guarded session and durably records session and audit events", async () => {
    const eventCreate = vi.fn();
    const auditCreate = vi.fn();
    const session = { id: "session-1", tenantId: "tenant-1", classId: "class-1", teacherId: teacher.id, status: "ACTIVE", startedAt: now, endedAt: null, reason: null, class: { name: "Mathematics 4A" }, events: [{ id: "event-1", type: "SESSION_STARTED", deviceId: null, details: { classId: "class-1" }, createdAt: now }] };
    const service = new TeacherSessionsService({
      user: { findFirst: async () => teacher },
      teacherClassAssignment: { findUnique: async () => ({ tenantId: "tenant-1", class: { status: "ACTIVE" } }) },
      teacherSession: { findFirst: async () => null },
      $transaction: async (callback: (tx: any) => Promise<unknown>) => callback({
        teacherSession: { create: async () => session, findUniqueOrThrow: async () => session },
        teacherSessionEvent: { create: eventCreate },
        auditEvent: { create: auditCreate },
      }),
    } as never);

    await expect(service.start("tenant-1", "class-1", "auth0|teacher")).resolves.toMatchObject({ id: "session-1", status: "ACTIVE" });
    expect(eventCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: "SESSION_STARTED" }) }));
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "teacher_session.start" }) }));
  });

  it("allows device events only for a device assigned to the active class", async () => {
    const service = new TeacherSessionsService({
      user: { findFirst: async () => teacher },
      teacherSession: { findFirst: async () => ({ id: "session-1", classId: "class-1", status: "ACTIVE" }) },
      device: { findFirst: async () => null },
    } as never);
    await expect(service.recordDeviceEvent("tenant-1", "session-1", { deviceId: "device-other", type: "DEVICE_OFFLINE" }, "auth0|teacher")).rejects.toThrow("not assigned");
  });
});
