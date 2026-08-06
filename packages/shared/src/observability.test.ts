import { afterEach, describe, expect, it, vi } from "vitest";
import { JsonLogger } from "./observability";

describe("JsonLogger", () => {
  afterEach(() => vi.restoreAllMocks());

  it("writes machine-readable service and context fields", () => {
    const output = vi.spyOn(console, "log").mockImplementation(() => undefined);
    new JsonLogger("api").log("ready", "Bootstrap");

    expect(JSON.parse(String(output.mock.calls[0]?.[0]))).toMatchObject({
      context: "Bootstrap",
      level: "info",
      message: "ready",
      service: "api",
    });
  });

  it("writes error details to stderr", () => {
    const output = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    new JsonLogger("worker").error(
      new Error("dispatch failed"),
      undefined,
      "Queue",
    );

    expect(JSON.parse(String(output.mock.calls[0]?.[0]))).toMatchObject({
      context: "Queue",
      error: { message: "dispatch failed" },
      level: "error",
      service: "worker",
    });
  });
});
