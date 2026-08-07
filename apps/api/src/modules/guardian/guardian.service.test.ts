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
            name: "Parent One",
            tenant: { name: "Example School", timezone: "UTC" },
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
    };
    const result = await new GuardianService(prisma as never).dashboard(
      "tenant-1",
      "parent@example.com",
    );
    expect(result.children).toHaveLength(1);
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
