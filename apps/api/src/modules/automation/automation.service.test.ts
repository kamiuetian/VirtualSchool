import { describe, expect, it, vi } from "vitest";
import { AutomationService } from "./automation.service";

describe("AutomationService", () => {
  it("creates bounded rules disabled by default and audits them", async () => {
    const created = {
      id: "rule-1",
      tenantId: "tenant-1",
      name: "Offline help",
      trigger: "DEVICE_OFFLINE",
      conditions: { threshold: 1, windowMinutes: 60 },
      action: "NOTIFY",
      actionConfig: { title: "Device offline", severity: "WARNING" },
      enabled: false,
      createdBy: "admin-1",
      updatedBy: "admin-1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const audit = vi.fn();
    const service = new AutomationService({
      tenant: { findUnique: async () => ({ id: "tenant-1" }) },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          automationRule: { create: vi.fn().mockResolvedValue(created) },
          auditEvent: { create: audit },
        }),
    } as never);
    await expect(
      service.create(
        "tenant-1",
        {
          name: "Offline help",
          trigger: "DEVICE_OFFLINE",
          threshold: 1,
          windowMinutes: 60,
          action: "NOTIFY",
          title: "Device offline",
          severity: "WARNING",
        },
        "admin-1",
      ),
    ).resolves.toMatchObject({ enabled: false, trigger: "DEVICE_OFFLINE" });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "automation_rule.create",
          tenantId: "tenant-1",
        }),
      }),
    );
  });

  it("tests a rule without side effects", async () => {
    const audit = vi.fn();
    const service = new AutomationService({
      automationRule: {
        findFirst: async () => ({
          id: "rule-1",
          tenantId: "tenant-1",
          trigger: "DEVICE_OFFLINE",
          conditions: { threshold: 1, windowMinutes: 60 },
          action: "NOTIFY",
          actionConfig: {},
          enabled: true,
        }),
      },
      device: {
        findMany: async () => [{ id: "device-1", serialNumber: "VS-1" }],
      },
      auditEvent: { create: audit },
    } as never);
    await expect(service.test("tenant-1", "rule-1")).resolves.toEqual({
      matched: true,
      matchCount: 1,
      sampledTargets: [{ id: "device-1", label: "VS-1", evidenceCount: 1 }],
      sideEffects: false,
    });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "automation_rule.test",
          newValue: { matchCount: 1, sideEffects: false },
        }),
      }),
    );
  });
});
