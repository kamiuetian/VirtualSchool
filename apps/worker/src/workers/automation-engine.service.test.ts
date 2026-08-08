import { describe, expect, it, vi } from "vitest";
import { AutomationEngineService } from "./automation-engine.service";

describe("AutomationEngineService", () => {
  it("creates one notification with execution and audit evidence", async () => {
    const alert = vi.fn().mockResolvedValue({ id: "alert-1" });
    const execution = vi.fn().mockResolvedValue({ id: "execution-1" });
    const prisma = {
      automationRule: {
        findMany: async () => [
          {
            id: "rule-1",
            tenantId: "tenant-1",
            name: "Offline help",
            trigger: "DEVICE_OFFLINE",
            conditions: { threshold: 1, windowMinutes: 60 },
            action: "NOTIFY",
            actionConfig: { title: "Device offline", severity: "WARNING" },
            enabled: true,
          },
        ],
      },
      device: { findMany: async () => [{ id: "device-1" }] },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          automationExecution: { create: execution, update: vi.fn() },
          deviceAlert: { create: alert },
          supportNote: { create: vi.fn() },
          auditEvent: { create: vi.fn() },
        }),
    };
    await expect(
      new AutomationEngineService(prisma as never).processTenant("tenant-1"),
    ).resolves.toMatchObject({ executed: 1, rulesEvaluated: 1 });
    expect(alert).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          source: "AUTOMATION",
          deviceId: "device-1",
        }),
      }),
    );
    expect(execution).toHaveBeenCalledOnce();
  });

  it("treats the unique execution fingerprint as a safe duplicate", async () => {
    const service = new AutomationEngineService({
      automationRule: {
        findMany: async () => [
          {
            id: "rule-1",
            tenantId: "tenant-1",
            name: "Offline",
            trigger: "DEVICE_OFFLINE",
            conditions: { threshold: 1, windowMinutes: 60 },
            action: "CREATE_TICKET",
            actionConfig: { title: "Offline", severity: "WARNING" },
            enabled: true,
          },
        ],
      },
      device: { findMany: async () => [{ id: "device-1" }] },
      $transaction: async () => {
        throw { code: "P2002" };
      },
    } as never);
    await expect(service.processTenant("tenant-1")).resolves.toMatchObject({
      executed: 0,
    });
  });
});
