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
  eligibility: {
    scope: "CLASS",
    allowedPlatforms: ["WINDOWS"],
    allowedBrowsers: ["CHROME"],
    minimumBrowserMajorVersion: 120,
  },
  class: { grade: "8", members: [{ studentId: "student-1" }] },
};
const readyChecks = {
  platform: "Windows",
  browser: "Chrome",
  browserMajorVersion: 130,
  secureContext: true,
  cookiesEnabled: true,
  javascriptEnabled: true,
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
      service.join(
        "tenant-1",
        "session-1",
        "auth0|student",
        "STUDENT",
        readyChecks,
      ),
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
      readyChecks,
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
      service.join(
        "tenant-1",
        "session-1",
        "auth0|other",
        "STUDENT",
        readyChecks,
      ),
    ).rejects.toThrow("not enrolled");
  });

  it("does not let a non-student use the join endpoint", async () => {
    const service = new ByodService({} as never);
    await expect(
      service.join(
        "tenant-1",
        "session-1",
        "auth0|teacher",
        "TEACHER",
        readyChecks,
      ),
    ).rejects.toThrow("Only an authenticated student");
  });

  it("blocks entry when browser readiness fails without retaining raw device details", async () => {
    const service = new ByodService({
      student: { findFirst: async () => ({ id: "student-1" }) },
      byodStudySession: { findFirst: async () => session },
    } as never);
    await expect(
      service.join("tenant-1", "session-1", "auth0|student", "STUDENT", {
        ...readyChecks,
        browserMajorVersion: 100,
      }),
    ).rejects.toThrow("BROWSER_OUTDATED");
  });

  it("enforces an active exam assignment targeted to the student", async () => {
    const service = new ByodService({
      student: { findFirst: async () => ({ id: "student-1" }) },
      byodStudySession: {
        findFirst: async () => ({
          ...session,
          eligibility: {
            ...session.eligibility,
            scope: "EXAM",
            examAssignmentId: "exam-1",
          },
        }),
      },
      policyAssignment: {
        findFirst: async () => ({
          scope: "STUDENT",
          scopeId: "student-other",
          policy: { rules: { mode: "EXAM" } },
        }),
      },
    } as never);
    const result = await service.readiness(
      "tenant-1",
      "session-1",
      "auth0|student",
      "STUDENT",
      readyChecks,
    );
    expect(result).toMatchObject({ eligible: false, ready: false });
    expect(result.issues).toContain("EXAM_POLICY_INELIGIBLE");
  });

  it("reports only privacy-limited participation fields", async () => {
    const joinedAt = new Date(now.getTime() - 30_000);
    const service = new ByodService({
      byodStudySession: {
        findFirst: async () => ({
          ...session,
          participants: [
            {
              studentId: "student-1",
              authSubject: "private-subject",
              joinedAt,
              exitedAt: now,
              exitStatus: "COMPLETED",
            },
          ],
        }),
      },
    } as never);
    const report = await service.participationReport("tenant-1", "session-1");
    expect(report.participants[0]).toEqual({
      joinedAt: joinedAt.toISOString(),
      durationSeconds: 30,
      approvedAccess: session.allowedUrls,
      exitStatus: "COMPLETED",
    });
    expect(report.participants[0]).not.toHaveProperty("studentId");
    expect(report.participants[0]).not.toHaveProperty("authSubject");
  });
});
