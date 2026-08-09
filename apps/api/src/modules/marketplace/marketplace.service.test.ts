import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { MarketplaceService } from "./marketplace.service";

describe("MarketplaceService", () => {
  it("rejects unsafe partner manifests", async () => {
    const service = new MarketplaceService({
      tenant: { findUnique: async () => ({ id: "tenant-1" }) },
    } as never);
    await expect(
      service.createSubmission("tenant-1", {
        slug: "unsafe-app",
        name: "Unsafe",
        description: "Unsafe integration manifest",
        category: "LMS",
        manifest: { testUrl: "http://internal", scopes: ["roster.read"] },
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("enforces tenant isolation when submitting a version", async () => {
    const service = new MarketplaceService({
      integrationSubmission: { findFirst: async () => null },
    } as never);
    await expect(
      service.submit("tenant-2", "submission-1", "partner-1"),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("enforces review state transitions and rejection evidence", async () => {
    const service = new MarketplaceService({
      integrationSubmission: {
        findFirst: async () => ({
          id: "submission-1",
          tenantId: "tenant-1",
          status: "SUBMITTED",
        }),
      },
    } as never);
    await expect(
      service.review(
        "tenant-1",
        "submission-1",
        { status: "APPROVED" },
        "reviewer-1",
      ),
    ).rejects.toThrow("Cannot move SUBMITTED to APPROVED");
    const inReview = new MarketplaceService({
      integrationSubmission: {
        findFirst: async () => ({
          id: "submission-1",
          tenantId: "tenant-1",
          status: "IN_REVIEW",
        }),
      },
    } as never);
    await expect(
      inReview.review(
        "tenant-1",
        "submission-1",
        { status: "REJECTED" },
        "reviewer-1",
      ),
    ).rejects.toThrow("Rejection notes are required");
  });

  it("enables only published catalog versions and audits the installation", async () => {
    const events: any[] = [];
    const tx = {
      integrationInstallation: {
        upsert: async (args: any) => {
          events.push(args);
          return { id: "install-1" };
        },
      },
      auditEvent: { create: async (args: any) => events.push(args) },
    };
    const service = new MarketplaceService({
      integrationSubmission: {
        findFirst: async () => ({
          id: "submission-1",
          slug: "library-sync",
          version: 2,
          status: "PUBLISHED",
        }),
      },
      tenant: { findUnique: async () => ({ id: "tenant-1" }) },
      $transaction: async (work: (value: typeof tx) => unknown) => work(tx),
    } as never);
    await service.enable(
      "tenant-1",
      "submission-1",
      { course: "grade-7" },
      "admin-1",
    );
    expect(events[0].create).toMatchObject({
      tenantId: "tenant-1",
      submissionId: "submission-1",
      status: "ENABLED",
    });
    expect(events[1].data).toMatchObject({
      action: "marketplace.integration.enable",
      outcome: "ENABLED",
    });
  });
});
