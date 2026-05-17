import { describe, expect, it, vi } from "vitest";
import { AuditController } from "./audit.controller";

describe("AuditController", () => {
  it("delegates tenant audit search to the service", async () => {
    const listAuditEvents = vi.fn().mockResolvedValue({
      items: [],
      page: {
        limit: 50,
        offset: 0,
        total: 0,
      },
    });
    const controller = new AuditController({
      listAuditEvents,
    } as never);

    await expect(
      controller.listAuditEvents("tenant-1", {
        object: "Device",
      }),
    ).resolves.toMatchObject({
      page: {
        total: 0,
      },
    });
    expect(listAuditEvents).toHaveBeenCalledWith("tenant-1", {
      object: "Device",
    });
  });
});
