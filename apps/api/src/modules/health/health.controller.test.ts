import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { HealthController } from "./health.controller";

describe("HealthController", () => {
  it("keeps liveness independent from dependencies", () => {
    const controller = new HealthController({} as never);
    expect(controller.getLiveness()).toMatchObject({
      service: "api",
      status: "ok",
    });
  });

  it("reports database readiness", async () => {
    const query = vi.fn().mockResolvedValue([{ result: 1 }]);
    const controller = new HealthController({ $queryRaw: query } as never);
    await expect(controller.getReadiness()).resolves.toMatchObject({
      checks: { database: "ok" },
      status: "ok",
    });
  });

  it("fails readiness when the database is unavailable", async () => {
    const controller = new HealthController({
      $queryRaw: vi.fn().mockRejectedValue(new Error("offline")),
    } as never);
    await expect(controller.getReadiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
