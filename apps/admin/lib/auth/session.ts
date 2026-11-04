import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { roles, type Role } from "@virtual-school/shared";
import { isAuth0Configured } from "./config";

const developmentSessionCookie = "vs_admin_session";
const developmentSessionMaxAgeSeconds = 60 * 60 * 8;

export type AdminPortalSession = {
  accessToken?: string;
  authMode: "auth0" | "development";
  email: string;
  name: string;
  role: Role;
  tenantIds: string[];
};

export type DevelopmentSessionInput = {
  email: string;
  name?: string;
  role?: string;
  tenantIds?: string | string[];
};

export async function getAdminSession(): Promise<AdminPortalSession | null> {
  if (process.env.ADMIN_AUTH_BYPASS === "true") {
    assertLocalTestAuthEnabled("ADMIN_AUTH_BYPASS");
    return developmentSession();
  }

  if (isAuth0Configured()) {
    return auth0Session();
  }

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const cookieStore = await cookies();
  return sessionFromDevelopmentCookie(
    cookieStore.get(developmentSessionCookie)?.value,
  );
}

export async function requireAdminSession(): Promise<AdminPortalSession> {
  const session = await getAdminSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function signInDevelopmentSession(
  input: DevelopmentSessionInput,
): Promise<void> {
  if (isAuth0Configured()) {
    redirect("/auth/login");
  }

  assertLocalTestAuthEnabled("Development persona sign-in");

  const session = normalizeDevelopmentSession(input);
  const cookieStore = await cookies();
  cookieStore.set(developmentSessionCookie, encodeDevelopmentSession(session), {
    httpOnly: true,
    maxAge: developmentSessionMaxAgeSeconds,
    sameSite: "lax",
    secure: false,
    path: "/",
  });
}

export async function signOutDevelopmentSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(developmentSessionCookie);
}

export function loginHref(): string {
  return isAuth0Configured() ? "/auth/login" : "/login";
}

export function logoutHref(): string {
  return isAuth0Configured() ? "/auth/logout" : "/logout";
}

export function isLocalTestAuthEnabled(): boolean {
  return (
    process.env.ADMIN_LOCAL_TEST_AUTH === "true" &&
    (process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test")
  );
}

function assertLocalTestAuthEnabled(feature: string): void {
  if (!isLocalTestAuthEnabled()) {
    throw new Error(
      `${feature} is restricted to an explicit local development or test runtime`,
    );
  }
}

export async function adminSessionHeaders(): Promise<HeadersInit> {
  const session = await requireAdminSession();

  if (session.accessToken) {
    return {
      Authorization: `Bearer ${session.accessToken}`,
    };
  }

  return {
    "x-dev-email": session.email,
    "x-dev-role": session.role,
    "x-dev-subject": session.email,
    "x-dev-tenant-id": session.tenantIds.join(","),
  };
}

async function auth0Session(): Promise<AdminPortalSession | null> {
  const { auth0 } = await import("./auth0");

  if (!auth0) {
    return null;
  }

  const session = await auth0.getSession();
  if (!session) {
    return null;
  }

  const { token } = await auth0.getAccessToken();
  const user = session.user;

  return {
    accessToken: token,
    authMode: "auth0",
    email: stringClaim(user.email) ?? "unknown@virtualschool.local",
    name:
      stringClaim(user.name) ??
      stringClaim(user.email) ??
      "School administrator",
    role: roleClaim(user["https://virtualschool/role"] ?? user.role),
    tenantIds: tenantClaims(
      user["https://virtualschool/tenant_ids"] ?? user.tenant_ids,
    ),
  };
}

function developmentSession(): AdminPortalSession {
  const role = roleClaim(process.env.ADMIN_API_ROLE ?? "PLATFORM_SUPER_ADMIN");
  return {
    authMode: "development",
    email: process.env.ADMIN_API_EMAIL ?? "admin@example.edu",
    name: process.env.ADMIN_API_NAME ?? "School administrator",
    role,
    tenantIds: scopedTenantClaims(role, process.env.ADMIN_API_TENANT_ID),
  };
}

function sessionFromDevelopmentCookie(
  value: string | undefined,
): AdminPortalSession | null {
  if (!value) {
    return null;
  }

  try {
    const decoded = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Partial<DevelopmentSessionInput>;
    return normalizeDevelopmentSession(decoded);
  } catch {
    return null;
  }
}

function encodeDevelopmentSession(session: AdminPortalSession): string {
  return Buffer.from(
    JSON.stringify({
      email: session.email,
      name: session.name,
      role: session.role,
      tenantIds: session.tenantIds,
    }),
    "utf8",
  ).toString("base64url");
}

function normalizeDevelopmentSession(
  input: Partial<DevelopmentSessionInput>,
): AdminPortalSession {
  const email = stringClaim(input.email) ?? "admin@example.edu";
  const role = roleClaim(input.role ?? "PLATFORM_SUPER_ADMIN");
  return {
    authMode: "development",
    email,
    name: stringClaim(input.name) ?? email,
    role,
    tenantIds: scopedTenantClaims(role, input.tenantIds),
  };
}

function scopedTenantClaims(role: Role, value: unknown): string[] {
  if (role === "PLATFORM_SUPER_ADMIN") {
    return ["*"];
  }

  const tenantIds = tenantClaims(value);
  if (tenantIds.length === 0 || tenantIds.includes("*")) {
    throw new Error("Non-platform roles require a specific school tenant ID");
  }

  return tenantIds;
}

function roleClaim(value: unknown): Role {
  const role = typeof value === "string" ? value : "TEACHER";
  return roles.includes(role as Role) ? (role as Role) : "TEACHER";
}

function tenantClaims(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string");
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((tenantId) => tenantId.trim())
      .filter(Boolean);
  }

  return [];
}

function stringClaim(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}
