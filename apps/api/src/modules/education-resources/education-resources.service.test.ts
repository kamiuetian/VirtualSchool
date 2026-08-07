import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { EducationResourcesService } from "./education-resources.service";

describe("EducationResourcesService", () => {
  it("rejects raw credentials and lookalike meeting hosts", async () => {
    const service = new EducationResourcesService({
      tenant: { findUnique: async () => ({ id: "tenant-1" }) },
      educationConnection: {
        findUnique: async () => ({ id: "connection-1", status: "ENABLED" }),
      },
      classSection: {
        findFirst: async () => ({ id: "11111111-1111-4111-8111-111111111111" }),
      },
    } as never);
    await expect(
      service.configure("tenant-1", {
        provider: "MICROSOFT_365",
        credentialReference: "password",
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.map("tenant-1", "ZOOM", {
        classId: "11111111-1111-4111-8111-111111111111",
        provider: "ZOOM",
        externalId: "meeting-1",
        displayName: "Science",
        launchUrl: "https://zoom.us.evil.test/j/1",
      }),
    ).rejects.toThrow("approved ZOOM host");
  });

  it("maps an approved Teams resource and writes an audit event", async () => {
    const calls: string[] = [];
    const service = new EducationResourcesService({
      educationConnection: {
        findUnique: async () => ({ id: "connection-1", status: "ENABLED" }),
      },
      classSection: {
        findFirst: async () => ({ id: "11111111-1111-4111-8111-111111111111" }),
      },
      $transaction: async (work: (tx: any) => unknown) =>
        work({
          educationResource: {
            upsert: async ({ create }: any) => {
              calls.push("resource.upsert");
              return { id: "resource-1", ...create };
            },
          },
          auditEvent: { create: async () => calls.push("audit.create") },
        }),
    } as never);
    await expect(
      service.map(
        "tenant-1",
        "MICROSOFT_365",
        {
          classId: "11111111-1111-4111-8111-111111111111",
          provider: "TEAMS",
          externalId: "team-1",
          displayName: "Class Team",
          launchUrl: "https://teams.microsoft.com/l/team-1",
        },
        "admin-1",
      ),
    ).resolves.toMatchObject({ provider: "TEAMS" });
    expect(calls).toEqual(["resource.upsert", "audit.create"]);
  });
});
