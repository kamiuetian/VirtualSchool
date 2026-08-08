import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { GuardianService } from "./guardian.service";

describe("GuardianService", () => {
  it("returns only children linked to the authenticated guardian email and limits device detail", async () => {
    let guardianQuery: unknown;
    const prisma = {
      guardian: {
        findFirst: async (query: unknown) => {
          guardianQuery = query;
          return {
            id: "guardian-1",
            name: "Parent One",
            email: "parent@example.com",
            phone: null,
            notificationPreference: null,
            supportRequests: [],
            tenant: {
              name: "Example School",
              timezone: "UTC",
              supportEmail: "help@example.com",
            },
            students: [
              {
                relationship: "mother",
                student: {
                  id: "student-1",
                  name: "Linked Child",
                  grade: "5",
                  section: "A",
                  devices: [
                    {
                      status: "ONLINE",
                      lastCheckInAt: new Date("2026-08-07T08:00:00Z"),
                    },
                  ],
                  classes: [{ classId: "class-1" }],
                  guardianAfterSchoolControls: [],
                },
              },
            ],
          };
        },
      },
      timetableBlock: {
        findMany: async () => [
          {
            classId: "class-1",
            grade: "5",
            dayOfWeek: 5,
            startMinute: 480,
            endMinute: 900,
            timezone: "UTC",
          },
        ],
      },
      teacherSession: { findMany: async () => [{ classId: "class-1" }] },
      teacherSessionEvent: {
        findMany: async () => [
          {
            type: "TEMPORARY_URL_APPROVED",
            details: { url: "https://private.example/path" },
            createdAt: new Date("2026-08-07T08:30:00Z"),
            session: { classId: "class-1" },
          },
        ],
      },
      appCatalogItem: {
        findMany: async () => [
          {
            id: "app-1",
            name: "Math",
            category: "Learning",
            approvedGrades: ["5"],
          },
        ],
      },
      privacyNotice: { findMany: async () => [] },
      privacyAcceptance: { findMany: async () => [] },
    };
    const result = await new GuardianService(prisma as never).dashboard(
      "tenant-1",
      "parent@example.com",
    );
    expect(result.children).toHaveLength(1);
    expect(result.tenantId).toBe("tenant-1");
    expect(result.locale).toBe("en");
    expect(result.children[0]!.availableAfterSchoolApps).toHaveLength(1);
    expect(result.children[0]).toMatchObject({
      id: "student-1",
      device: { availability: "ONLINE" },
      expectedMode: "CLASS_MODE",
    });
    expect(result.children[0]!.approvedLearningAccess[0]!.label).toBe(
      "Teacher-approved website",
    );
    expect(JSON.stringify(result)).not.toContain("private.example");
    expect(guardianQuery).toMatchObject({
      where: { tenantId: "tenant-1", email: { equals: "parent@example.com" } },
      select: { students: { where: { student: { tenantId: "tenant-1" } } } },
    });
  });

  it("persists a supported guardian language and audits the profile override", async () => {
    const writes: unknown[] = [];
    const prisma = {
      guardian: { findFirst: async () => ({ id: "guardian-1" }) },
      $transaction: async (work: (tx: any) => unknown) =>
        work({
          guardian: {
            update: async (input: unknown) => {
              writes.push(input);
              return { language: "ur" };
            },
          },
          auditEvent: { create: async (input: unknown) => writes.push(input) },
        }),
    };
    const result = await new GuardianService(prisma as never).updateLanguage(
      "tenant-1",
      "ur",
      "guardian-auth",
      "parent@example.com",
    );
    expect(result).toEqual({ language: "ur" });
    expect(writes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ data: { language: "ur" } }),
        expect.objectContaining({
          data: expect.objectContaining({
            action: "guardian.language.update",
            newValue: { language: "ur" },
          }),
        }),
      ]),
    );
  });

  it("creates a school alert and guarded lost workflow only for a linked child", async () => {
    const writes: string[] = [];
    const prisma = {
      guardian: {
        findFirst: async () => ({
          id: "guardian-1",
          students: [
            {
              student: {
                id: "student-1",
                name: "Linked Child",
                grade: "5",
                devices: [{ id: "device-1", status: "ONLINE" }],
              },
            },
          ],
        }),
      },
      $transaction: async (work: (tx: unknown) => unknown) =>
        work({
          deviceAlert: {
            create: async () => {
              writes.push("alert");
              return { id: "alert-1" };
            },
          },
          device: { update: async () => writes.push("device-lost") },
          deviceLifecycleEvent: {
            create: async () => writes.push("lifecycle"),
          },
          auditEvent: { create: async () => writes.push("audit") },
        }),
    };
    const result = await new GuardianService(prisma as never).reportLostDevice(
      "tenant-1",
      "student-1",
      { reason: "Missing after pickup", startLostWorkflow: true },
      "guardian-auth",
      "parent@example.com",
    );
    expect(result).toEqual({
      alertId: "alert-1",
      lostWorkflowStarted: true,
      status: "REPORTED",
    });
    expect(writes).toEqual(["alert", "device-lost", "lifecycle", "audit"]);
  });

  it("rejects after-school apps that are not school-approved for the linked child's grade", async () => {
    const prisma = {
      guardian: {
        findFirst: async () => ({
          id: "guardian-1",
          students: [
            {
              student: {
                id: "student-1",
                name: "Linked Child",
                grade: "5",
                devices: [],
              },
            },
          ],
        }),
      },
      appCatalogItem: { findMany: async () => [] },
    };
    await expect(
      new GuardianService(prisma as never).updateAfterSchoolControl(
        "tenant-1",
        "student-1",
        {
          enabled: true,
          dailyLimitMinutes: 60,
          allowedAppIds: ["foreign-app"],
        },
        "guardian-auth",
        "parent@example.com",
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("limits notification channels to contact methods on the tenant-scoped guardian", async () => {
    const writes: unknown[] = [];
    const prisma = {
      guardian: {
        findFirst: async () => ({
          id: "guardian-1",
          email: "parent@example.com",
          phone: null,
        }),
      },
      $transaction: async (work: (tx: any) => unknown) =>
        work({
          guardianNotificationPreference: {
            upsert: async ({ create }: any) => ({
              id: "preference-1",
              ...create,
            }),
          },
          auditEvent: { create: async (value: unknown) => writes.push(value) },
        }),
    };
    const service = new GuardianService(prisma as never);
    await expect(
      service.updateNotificationPreferences(
        "tenant-1",
        { channels: ["SMS"] },
        "guardian-auth",
        "parent@example.com",
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.updateNotificationPreferences(
        "tenant-1",
        { channels: ["EMAIL", "IN_APP"] },
        "guardian-auth",
        "parent@example.com",
      ),
    ).resolves.toEqual({ channels: ["EMAIL", "IN_APP"] });
    expect(writes).toHaveLength(1);
  });

  it("routes a support request only for the guardian's linked active device", async () => {
    const prisma = {
      guardian: {
        findFirst: async () => ({
          id: "guardian-1",
          students: [
            {
              student: {
                id: "student-1",
                name: "Child",
                grade: "5",
                devices: [{ id: "device-1", status: "ONLINE" }],
              },
            },
          ],
        }),
      },
      $transaction: async (work: (tx: any) => unknown) =>
        work({
          tenant: {
            findUnique: async () => ({ supportEmail: "help@school.test" }),
          },
          guardianSupportRequest: {
            create: async ({ data }: any) => ({
              id: "request-1",
              status: "OPEN",
              ...data,
            }),
          },
          supportTicket: {
            create: async ({ data }: any) => ({
              id: "ticket-1",
              status: "OPEN",
              ...data,
            }),
          },
          auditEvent: { create: async () => undefined },
        }),
    };
    await expect(
      new GuardianService(prisma as never).createSupportRequest(
        "tenant-1",
        "student-1",
        {
          category: "DEVICE",
          subject: "Screen issue",
          description: "The screen is not responding",
        },
        "guardian-auth",
        "parent@example.com",
      ),
    ).resolves.toEqual({
      id: "ticket-1",
      status: "OPEN",
      routedTo: "help@school.test",
    });
  });

  it("denies an account without a tenant-scoped guardian match", async () => {
    const prisma = { guardian: { findFirst: async () => null } };
    await expect(
      new GuardianService(prisma as never).dashboard(
        "tenant-1",
        "other@example.com",
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
