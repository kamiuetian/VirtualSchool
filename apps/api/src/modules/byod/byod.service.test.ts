import { describe, expect, it, vi } from "vitest";
import { ByodService } from "./byod.service";

const now = new Date();
const session = {
  id: "session-1",
  tenantId: "tenant-1",
  classId: "class-1",
  title: "Personal device study",
  status: "ACTIVE",
  startsAt: new Date(now.getTime() - 60_000),
  endsAt: new Date(now.getTime() + 60_000),
  allowedUrls: ["https://learn.example.edu/lesson"],
  class: { members: [{ studentId: "student-1" }] },
};

describe("ByodService", () => {
  it("denies joining until the student accepts the latest BYOD notice", async () => {
    const service = new ByodService({
      student: { findFirst: async () => ({ id: "student-1" }) },
      byodStudySession: { findFirst: async () => session },
      privacyNotice: {
        findFirst: async () => ({ id: "notice-2", version: 2 }),
      },
      privacyAcceptance: { findFirst: async () => null },
    } as never);
    await expect(
      service.join("tenant-1", "session-1", "auth0|student", "STUDENT"),
    ).rejects.toThrow("Accept the latest");
  });

  it("returns an explicitly session-only browser grant after current consent", async () => {
    const auditCreate = vi.fn();
    const service = new ByodService({
      student: { findFirst: async () => ({ id: "student-1" }) },
      byodStudySession: { findFirst: async () => session },
      privacyNotice: {
        findFirst: async () => ({ id: "notice-2", version: 2 }),
      },
      privacyAcceptance: { findFirst: async () => ({ acceptedAt: now }) },
      $transaction: async (callback: (tx: any) => Promise<unknown>) =>
        callback({
          byodSessionParticipant: {
            upsert: async () => ({ id: "participant-1", joinedAt: now }),
          },
          auditEvent: { create: auditCreate },
        }),
    } as never);
    const result = await service.join(
      "tenant-1",
      "session-1",
      "auth0|student",
      "STUDENT",
    );
    expect(result.secureBrowser).toMatchObject({
      scope: "SESSION_ONLY",
      wholeDeviceControl: false,
    });
    expect(result.secureBrowser.notice).toContain("does not control");
    expect(auditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "byod_session.join" }),
      }),
    );
  });

  it("rejects a student who is not enrolled in the session class", async () => {
    const service = new ByodService({
      student: { findFirst: async () => ({ id: "student-other" }) },
      byodStudySession: {
        findFirst: async () => ({ ...session, class: { members: [] } }),
      },
    } as never);
    await expect(
      service.join("tenant-1", "session-1", "auth0|other", "STUDENT"),
    ).rejects.toThrow("not enrolled");
  });

  it("does not let a non-student use the join endpoint", async () => {
    const service = new ByodService({} as never);
    await expect(
      service.join("tenant-1", "session-1", "auth0|teacher", "TEACHER"),
    ).rejects.toThrow("Only an authenticated student");
  });
});
