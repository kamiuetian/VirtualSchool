import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { createRateLimitMiddleware } from "./rate-limit.middleware";

describe("createRateLimitMiddleware", () => {
  it("allows requests within the configured bucket", () => {
    const middleware = createRateLimitMiddleware({
      maxRequests: 2,
      windowMs: 60_000,
    });
    const next = vi.fn();

    middleware(request(), response(), next);
    middleware(request(), response(), next);

    expect(next).toHaveBeenCalledTimes(2);
  });

  it("returns 429 once the bucket is exhausted", () => {
    const middleware = createRateLimitMiddleware({
      maxRequests: 1,
      windowMs: 60_000,
    });
    const next = vi.fn();
    const blockedResponse = response();

    middleware(request(), response(), next);
    middleware(request(), blockedResponse, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(blockedResponse.status).toHaveBeenCalledWith(429);
    expect(blockedResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "Too Many Requests",
        statusCode: 429,
      }),
    );
  });

  it("uses forwarded client IPs as separate buckets", () => {
    const middleware = createRateLimitMiddleware({
      maxRequests: 1,
      windowMs: 60_000,
    });
    const next = vi.fn();

    middleware(request("203.0.113.10"), response(), next);
    middleware(request("203.0.113.11"), response(), next);

    expect(next).toHaveBeenCalledTimes(2);
  });
});

function request(forwardedFor = "203.0.113.10"): Request {
  return {
    header: (name: string) =>
      name.toLowerCase() === "x-forwarded-for" ? forwardedFor : undefined,
    ip: "10.0.0.5",
    method: "GET",
    path: "/api/v1/tenants",
    socket: { remoteAddress: "10.0.0.5" },
  } as Request;
}

function response(): Response {
  const responseStub = {
    json: vi.fn(),
    setHeader: vi.fn(),
    status: vi.fn(),
  };
  responseStub.status.mockReturnValue(responseStub);
  return responseStub as unknown as Response;
}
