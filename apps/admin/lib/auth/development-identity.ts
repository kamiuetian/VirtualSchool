import { timingSafeEqual } from "node:crypto";
import type { Role, TenantSummary, UserSummary } from "@virtual-school/shared";
import type { DevelopmentSessionInput } from "./session";

const platformRole: Role = "PLATFORM_SUPER_ADMIN";

export async function authenticateDevelopmentCredentials(
  email: string,
  password: string,
): Promise<DevelopmentSessionInput> {
  assertLocalIdentityLookupEnabled();
  verifyLocalPassword(password);

  const normalizedEmail = email.trim().toLowerCase();
  const platformEmail = (
    process.env.ADMIN_API_EMAIL ?? "admin@example.edu"
  ).toLowerCase();

  if (normalizedEmail === platformEmail) {
    return {
      email: normalizedEmail,
      name: process.env.ADMIN_API_NAME ?? "Platform administrator",
      role: platformRole,
      tenantIds: ["*"],
    };
  }

  const apiUrl = localApiBaseUrl();
  const headers = localPlatformHeaders();
  const tenants = await localApiGet<TenantSummary[]>(
    `${apiUrl}/tenants`,
    headers,
  );
  const activeTenants = tenants.filter(
    (tenant) => tenant.status === "ACTIVE" || tenant.status === "PILOT",
  );
  const usersByTenant = await Promise.all(
    activeTenants.map((tenant) =>
      localApiGet<UserSummary[]>(
        `${apiUrl}/tenants/${encodeURIComponent(tenant.id)}/users`,
        headers,
      ),
    ),
  );
  const matches = usersByTenant
    .flat()
    .filter(
      (user) =>
        user.email.trim().toLowerCase() === normalizedEmail &&
        user.status !== "SUSPENDED" &&
        user.status !== "DEACTIVATED",
    );

  const primaryMatch = matches[0];
  if (!primaryMatch) {
    throw new Error("Invalid email or password");
  }

  const role = primaryMatch.role;
  if (matches.some((match) => match.role !== role)) {
    throw new Error(
      "This local account has conflicting roles across schools and cannot be resolved automatically",
    );
  }

  return {
    email: normalizedEmail,
    name: primaryMatch.name,
    role,
    tenantIds: [...new Set(matches.map((match) => match.tenantId))],
  };
}

function assertLocalIdentityLookupEnabled(): void {
  const isLocalRuntime =
    process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
  if (process.env.ADMIN_LOCAL_TEST_AUTH !== "true" || !isLocalRuntime) {
    throw new Error("Local identity lookup is disabled");
  }
}

function verifyLocalPassword(password: string): void {
  const expected = process.env.ADMIN_LOCAL_TEST_PASSWORD;
  if (!expected || !secureEqual(password, expected)) {
    throw new Error("Invalid email or password");
  }
}

function secureEqual(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function localApiBaseUrl(): string {
  const value =
    process.env.ADMIN_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!value) {
    throw new Error("The local admin API URL is not configured");
  }

  return value.replace(/\/$/, "");
}

function localPlatformHeaders(): HeadersInit {
  const platformEmail = process.env.ADMIN_API_EMAIL ?? "admin@example.edu";
  return {
    "x-dev-email": platformEmail,
    "x-dev-role": platformRole,
    "x-dev-subject": platformEmail,
    "x-dev-tenant-id": "*",
  };
}

async function localApiGet<T>(url: string, headers: HeadersInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    headers,
  });
  if (!response.ok) {
    throw new Error(`Local identity lookup failed with ${response.status}`);
  }

  return (await response.json()) as T;
}
