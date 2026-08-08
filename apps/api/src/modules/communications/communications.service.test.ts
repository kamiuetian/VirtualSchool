import { describe, expect, it, vi } from "vitest";
import { CommunicationsService } from "./communications.service";

describe("CommunicationsService", () => {
  it("targets active announcements to the requesting role", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new CommunicationsService({
      announcement: { findMany },
    } as never);
    await service.listAnnouncements("tenant-1", "TEACHER");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: "tenant-1",
          targetRoles: { has: "TEACHER" },
          archivedAt: null,
        }),
      }),
    );
  });

  it("creates a scheduled announcement and audit together", async () => {
    const audit = vi.fn();
    const saved = {
      id: "a-1",
      title: "Pilot",
      targetRoles: ["TEACHER"],
      startsAt: new Date("2026-08-10T08:00:00Z"),
      endsAt: null,
    };
    const service = new CommunicationsService({
      $transaction: (fn: (tx: unknown) => unknown) =>
        fn({
          announcement: { create: vi.fn().mockResolvedValue(saved) },
          auditEvent: { create: audit },
        }),
    } as never);
    await service.createAnnouncement(
      "tenant-1",
      {
        title: "Pilot",
        message: "Try attendance",
        targetRoles: ["TEACHER"],
        startsAt: "2026-08-10T08:00:00Z",
      },
      "admin-1",
    );
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "announcement.create",
          tenantId: "tenant-1",
        }),
      }),
    );
  });

  it("drops privacy-sensitive feedback context keys", async () => {
    const create = vi
      .fn()
      .mockImplementation(({ data }) => ({
        id: "f-1",
        status: "NEW",
        ...data,
      }));
    const service = new CommunicationsService({
      $transaction: (fn: (tx: unknown) => unknown) =>
        fn({ pilotFeedback: { create }, auditEvent: { create: vi.fn() } }),
    } as never);
    await service.createFeedback(
      "tenant-1",
      "TEACHER",
      {
        module: "attendance",
        severity: "HIGH",
        summary: "Capture was confusing",
        context: {
          route: "/reports",
          studentName: "Private",
          browser: "Chrome",
        },
      },
      "teacher-1",
    );
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        role: "TEACHER",
        context: { route: "/reports", browser: "Chrome" },
      }),
    });
  });
});
