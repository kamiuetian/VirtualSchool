import type { NextFunction, Request, Response } from "express";

export type RateLimitOptions = {
  enabled?: boolean;
  maxRequests: number;
  windowMs: number;
  skipPaths?: string[];
};

type Bucket = {
  count: number;
  resetAt: number;
};

const defaultSkipPaths = ["/api/v1/health", "/api/docs"];

export function createRateLimitMiddleware(options: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();
  const skipPaths = options.skipPaths ?? defaultSkipPaths;

  return (request: Request, response: Response, next: NextFunction): void => {
    if (
      options.enabled === false ||
      skipPaths.some((path) => request.path.startsWith(path))
    ) {
      next();
      return;
    }

    const now = Date.now();
    const key = `${clientIp(request)}:${request.method}:${request.path}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, {
        count: 1,
        resetAt: now + options.windowMs,
      });
      next();
      return;
    }

    bucket.count += 1;

    if (bucket.count <= options.maxRequests) {
      next();
      return;
    }

    const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
    response.setHeader("Retry-After", String(retryAfterSeconds));
    response.status(429).json({
      error: "Too Many Requests",
      message: "Request rate limit exceeded",
      retryAfterSeconds,
      statusCode: 429,
    });

    cleanupExpiredBuckets(buckets, now);
  };
}

function clientIp(request: Request): string {
  const forwardedFor = request.header("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.ip || request.socket.remoteAddress || "unknown";
}

function cleanupExpiredBuckets(
  buckets: Map<string, Bucket>,
  now: number,
): void {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}
