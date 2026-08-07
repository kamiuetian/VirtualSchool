import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { LmsService } from "./lms.service";

describe("LmsService", () => {
  it("rejects credential values and cross-origin launcher links", async () => {
    const service = new LmsService({
      tenant: { findUnique: async () => ({ id: "tenant-1" }) },
      lmsConnection: {
        findUnique: async () => ({
          id: "lms-1",
          tenantId: "tenant-1",
          provider: "MOODLE",
          status: "ENABLED",
          baseUrl: "https://moodle.school.test",
        }),
      },
      classSection: {
        findFirst: async () => ({ id: "11111111-1111-4111-8111-111111111111" }),
      },
    } as never);
    await expect(
      service.configure("tenant-1", {
        provider: "MOODLE",
        baseUrl: "https://moodle.school.test",
        credentialReference: "actual-password",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.mapCourse("tenant-1", "moodle", {
        classId: "11111111-1111-4111-8111-111111111111",
        externalCourseId: "42",
        displayName: "Biology",
        launchUrl: "https://evil.test/course/42",
      }),
    ).rejects.toThrow("configured LMS origin");
  });

  it("disables a tenant provider without deleting its mappings", async () => {
    const calls: string[] = [];
    const service = new LmsService({
      lmsConnection: {
        findUnique: async () => ({
          id: "lms-1",
          tenantId: "tenant-1",
          provider: "CANVAS",
          status: "ENABLED",
        }),
        findMany: async () => [
          {
            id: "lms-1",
            provider: "CANVAS",
            baseUrl: "https://canvas.school.test",
            credentialReference: "secret://canvas",
            status: "DISABLED",
            lastTestedAt: null,
            lastTestOutcome: null,
            courseMappings: [
              {
                id: "map-1",
                classId: "class-1",
                externalCourseId: "9",
                displayName: "Math",
                launchUrl: "https://canvas.school.test/courses/9",
                enabled: true,
              },
            ],
          },
        ],
      },
      $transaction: async (work: (tx: any) => unknown) =>
        work({
          lmsConnection: {
            update: async () => calls.push("connection.update"),
          },
          auditEvent: { create: async () => calls.push("audit.create") },
        }),
    } as never);
    await expect(
      service.disable("tenant-1", "canvas", "admin-1"),
    ).resolves.toMatchObject({
      status: "DISABLED",
      courseMappings: [{ id: "map-1" }],
    });
    expect(calls).toEqual(["connection.update", "audit.create"]);
  });
});
