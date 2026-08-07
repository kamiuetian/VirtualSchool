import { redirect } from "next/navigation";
import { roleAllows, type Permission, type Role } from "@virtual-school/shared";
import { requireAdminSession } from "./session";

export type PortalHref =
  | "/"
  | "/tenants"
  | "/roster"
  | "/enrollment"
  | "/devices"
  | "/policies"
  | "/privacy"
  | "/timetable"
  | "/teacher"
  | "/guardian"
  | "/apps"
  | "/alerts"
  | "/support"
  | "/reports"
  | "/billing";

export type PortalNavigationItem = {
  href: PortalHref;
  label: string;
};

type PortalRoute = PortalNavigationItem & {
  anyPermissions: Permission[];
  roles?: Role[];
};

export const portalRoutes: PortalRoute[] = [
  {
    href: "/guardian",
    label: "My children",
    anyPermissions: ["guardian:read"],
    roles: ["GUARDIAN"],
  },
  { href: "/", label: "Overview", anyPermissions: ["tenant:read"] },
  {
    href: "/tenants",
    label: "Schools",
    anyPermissions: [
      "tenant:create",
      "tenant:update",
      "user:invite",
      "user:suspend",
    ],
  },
  {
    href: "/roster",
    label: "Roster",
    anyPermissions: ["roster:manage", "class:manage"],
  },
  {
    href: "/enrollment",
    label: "Enrollment",
    anyPermissions: ["device:enroll"],
  },
  { href: "/devices", label: "Devices", anyPermissions: ["device:read"] },
  {
    href: "/teacher",
    label: "Class Mode",
    anyPermissions: ["session:manage"],
    roles: ["TEACHER"],
  },
  { href: "/policies", label: "Policies", anyPermissions: ["policy:manage"] },
  { href: "/privacy", label: "Privacy", anyPermissions: ["tenant:update"] },
  { href: "/timetable", label: "Timetable", anyPermissions: ["policy:manage"] },
  { href: "/apps", label: "Apps & Web", anyPermissions: ["policy:manage"] },
  { href: "/alerts", label: "Alerts", anyPermissions: ["device:read"] },
  { href: "/support", label: "Support", anyPermissions: ["device:read"] },
  { href: "/reports", label: "Reports", anyPermissions: ["report:export"] },
  { href: "/billing", label: "Billing", anyPermissions: ["billing:read"] },
];

export function roleCan(role: Role, permission: Permission): boolean {
  return roleAllows(role, permission);
}

export function canAccessPortalRoute(role: Role, href: PortalHref): boolean {
  const route = portalRoutes.find((item) => item.href === href);
  return route
    ? (!route.roles || route.roles.includes(role)) &&
        route.anyPermissions.some((permission) => roleCan(role, permission))
    : false;
}

export function visiblePortalNavigation(role: Role): PortalNavigationItem[] {
  return portalRoutes
    .filter((route) => canAccessPortalRoute(role, route.href))
    .map(({ href, label }) => ({ href, label }));
}

export function firstAccessiblePortalHref(role: Role): string {
  return visiblePortalNavigation(role)[0]?.href ?? "/logout";
}

export async function requirePortalRouteAccess(href: PortalHref) {
  const session = await requireAdminSession();

  if (!canAccessPortalRoute(session.role, href)) {
    redirect(firstAccessiblePortalHref(session.role));
  }

  return session;
}
