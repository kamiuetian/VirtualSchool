import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { AcademicCalendarService } from "./calendar-exceptions.service";

describe("AcademicCalendarService", () => {
  it("creates an audited tenant closure", async () => {
    const now = new Date("2026-08-07T10:00:00.000Z");
    const audit = vi.fn();
    const service = new AcademicCalendarService({
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          academicCalendarException: {
            create: async ({ data }: { data: Record<string, unknown> }) => ({
              ...data,
              active: true,
              createdAt: now,
              id: "exception-1",
              policy: null,
              policyId: null,
              scopeId: null,
              startMinute: null,
              endMinute: null,
              timezone: null,
              updatedAt: now,
            }),
          },
          auditEvent: { create: audit },
        }),
      tenant: { findUnique: async () => ({ id: "tenant-1" }) },
    } as never);

    await expect(
      service.create("tenant-1", {
        actorId: "admin-1",
        kind: "CLOSED",
        localDate: "2026-12-25",
        name: "Holiday",
        reason: "Public holiday",
      }),
    ).resolves.toMatchObject({
      id: "exception-1",
      kind: "CLOSED",
      localDate: "2026-12-25",
    });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "academic_calendar_exception.create",
          tenantId: "tenant-1",
        }),
      }),
    );
  });

  it("rejects impossible local dates", async () => {
    const service = new AcademicCalendarService({
      tenant: { findUnique: async () => ({ id: "tenant-1" }) },
    } as never);
    await expect(
      service.create("tenant-1", {
        kind: "CLOSED",
        localDate: "2026-02-30",
        name: "Invalid",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
