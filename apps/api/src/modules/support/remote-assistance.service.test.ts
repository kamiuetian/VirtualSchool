import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { SupportService } from "./support.service";

const actor = { subject: "support-1", role: "SUPPORT_AGENT" } as any;

describe("SupportService remote assistance", () => {
  it("requires visible notice consent before a session can start", async () => {
    const service = new SupportService({} as never);
    await expect(
      service.startAssistanceSession(
        "tenant-1",
        {
          deviceId: "device-1",
          purpose: "Diagnose connectivity",
          consentedBy: "Guardian",
          noticeAcknowledged: false,
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("starts and audits a consented, non-covert assistance session", async () => {
    const create = vi.fn(async ({ data }: any) => ({
      id: "assist-1",
      status: "ACTIVE",
      ticketId: null,
      endedBy: null,
      endedAt: null,
      resolution: null,
      startedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    }));
    const audit = vi.fn();
    const prisma = {
      device: { findFirst: async () => ({ id: "device-1" }) },
      remoteAssistanceSession: { findFirst: async () => null, create },
      auditEvent: { create: audit },
      $transaction: async (work: (tx: any) => unknown) =>
        work({
          remoteAssistanceSession: { create },
          auditEvent: { create: audit },
        }),
    };
    const result = await new SupportService(
      prisma as never,
    ).startAssistanceSession(
      "tenant-1",
      {
        deviceId: "device-1",
        purpose: "Diagnose connectivity",
        consentedBy: "A Parent",
        noticeAcknowledged: true,
      },
      actor,
    );
    expect(result.visibleNotice).toContain("does not enable camera");
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "remote_assistance.start",
          outcome: "CONSENTED",
          newValue: expect.objectContaining({
            noticeDisplayed: true,
            prohibitedMonitoring: true,
          }),
        }),
      }),
    );
  });

  it("ends exactly one tenant-scoped active session with audit evidence", async () => {
    const now = new Date();
    const current = {
      id: "assist-1",
      tenantId: "tenant-1",
      deviceId: "device-1",
      status: "ACTIVE",
      purpose: "Help",
      visibleNotice: "Visible",
      consentedBy: "User",
      consentedAt: now,
      startedAt: now,
    };
    const update = vi.fn(async ({ data }: any) => ({ ...current, ...data }));
    const audit = vi.fn();
    const prisma = {
      remoteAssistanceSession: { findFirst: async () => current, update },
      auditEvent: { create: audit },
      $transaction: async (work: (tx: any) => unknown) =>
        work({
          remoteAssistanceSession: { update },
          auditEvent: { create: audit },
        }),
    };
    const result = await new SupportService(
      prisma as never,
    ).endAssistanceSession(
      "tenant-1",
      "assist-1",
      { resolution: "Connectivity restored" },
      actor,
    );
    expect(result.status).toBe("ENDED");
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "remote_assistance.end" }),
      }),
    );
  });

  it("rejects foreign and already-ended sessions", async () => {
    await expect(
      new SupportService({
        remoteAssistanceSession: { findFirst: async () => null },
      } as never).endAssistanceSession(
        "tenant-1",
        "foreign",
        { resolution: "Done" },
        actor,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      new SupportService({
        remoteAssistanceSession: {
          findFirst: async () => ({ status: "ENDED" }),
        },
      } as never).endAssistanceSession(
        "tenant-1",
        "ended",
        { resolution: "Done" },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("provides the four required guided playbooks", () => {
    expect(
      new SupportService({} as never)
        .getTroubleshootingPlaybooks()
        .map((x) => x.id),
    ).toEqual([
      "OFFLINE_DEVICE",
      "FAILED_APP_INSTALL",
      "BLOCKED_WEBSITE",
      "STUCK_KIOSK_MODE",
    ]);
  });
});
