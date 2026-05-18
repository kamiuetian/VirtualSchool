import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { roles, type Role } from "@virtual-school/shared";
import { isAuth0Configured } from "./config";

const developmentSessionCookie = "vs_admin_session";

export type AdminPortalSession = {
  accessToken?: string;
  authMode: "auth0" | "development";
  email: string;
  name: string;
  role: Role;
  tenantIds: string[];
};

export async function getAdminSession(): Promise<AdminPortalSession | null> {
  if (process.env.ADMIN_AUTH_BYPASS === "true") {
    return developmentSession();
  }

  if (isAuth0Configured()) {
    return auth0Session();
  }

  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const cookieStore = await cookies();
  if (cookieStore.get(developmentSessionCookie)?.value !== "active") {
    return null;
  }

  return developmentSession();
}

export async function requireAdminSession(): Promise<AdminPortalSession> {
  const session = await getAdminSession();

  if (!session) {
    redirect("/login");
  }

  return session;
}

export async function signInDevelopmentSession(): Promise<void> {
  if (isAuth0Configured()) {
    redirect("/auth/login");
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("Auth0 must be configured before production sign-in");
  }

  const cookieStore = await cookies();
  cookieStore.set(developmentSessionCookie, "active", {
    httpOnly: true,
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
    name: stringClaim(user.name) ?? stringClaim(user.email) ?? "School administrator",
    role: roleClaim(user["https://virtualschool/role"] ?? user.role),
    tenantIds: tenantClaims(
      user["https://virtualschool/tenant_ids"] ?? user.tenant_ids,
    ),
  };
}

function developmentSession(): AdminPortalSession {
  return {
    authMode: "development",
    email: process.env.ADMIN_API_EMAIL ?? "admin@example.edu",
    name: process.env.ADMIN_API_NAME ?? "School administrator",
    role: roleClaim(process.env.ADMIN_API_ROLE ?? "PLATFORM_SUPER_ADMIN"),
    tenantIds: (process.env.ADMIN_API_TENANT_ID ?? "*")
      .split(",")
      .map((tenantId) => tenantId.trim())
      .filter(Boolean),
  };
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
