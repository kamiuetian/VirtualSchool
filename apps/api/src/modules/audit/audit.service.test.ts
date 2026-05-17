import { describe, expect, it, vi } from "vitest";
import { AuditService } from "./audit.service";

const now = new Date("2026-05-17T10:00:00.000Z");

describe("AuditService", () => {
  it("lists tenant-scoped audit events with filters and pagination", async () => {
    const count = vi.fn().mockResolvedValue(1);
    const findMany = vi.fn().mockResolvedValue([
      {
        action: "remote_command.queue",
        actorId: "admin-1",
        createdAt: now,
        id: "audit-1",
        ipAddress: "127.0.0.1",
        newValue: {
          status: "QUEUED",
        },
        object: "RemoteCommand",
        objectId: "command-1",
        oldValue: null,
        outcome: "QUEUED",
        reason: "Class start",
        tenantId: "tenant-1",
      },
    ]);
    const service = new AuditService({
      auditEvent: {
        count,
        findMany,
      },
      tenant: {
        findUnique: async () => ({ id: "tenant-1" }),
      },
    } as never);

    await expect(
      service.listAuditEvents("tenant-1", {
        action: "remote_command.queue",
        limit: "25" as never,
        offset: "10" as never,
      }),
    ).resolves.toMatchObject({
      items: [
        {
          action: "remote_command.queue",
          newValue: {
            status: "QUEUED",
          },
          tenantId: "tenant-1",
        },
      ],
      page: {
        limit: 25,
        offset: 10,
        total: 1,
      },
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 25,
        where: expect.objectContaining({
          action: "remote_command.queue",
          tenantId: "tenant-1",
        }),
      }),
    );
  });
});
