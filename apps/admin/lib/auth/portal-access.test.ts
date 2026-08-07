import { describe, expect, it } from "vitest";
import {
  canAccessPortalRoute,
  firstAccessiblePortalHref,
  visiblePortalNavigation,
} from "./portal-access";

describe("portal access", () => {
  it("shows platform operators every admin area", () => {
    expect(
      visiblePortalNavigation("PLATFORM_SUPER_ADMIN").map((item) => item.href),
    ).toEqual([
      "/",
      "/tenants",
      "/roster",
      "/enrollment",
      "/devices",
      "/policies",
      "/privacy",
      "/timetable",
      "/apps",
      "/alerts",
      "/support",
      "/reports",
      "/billing",
    ]);
  });

  it("lets school admins manage school operations without platform tenant creation being required", () => {
    const visibleRoutes = visiblePortalNavigation("SCHOOL_ADMIN").map(
      (item) => item.href,
    );

    expect(visibleRoutes).toContain("/tenants");
    expect(visibleRoutes).toContain("/roster");
    expect(visibleRoutes).toContain("/devices");
    expect(visibleRoutes).toContain("/policies");
    expect(visibleRoutes).toContain("/reports");
    expect(visibleRoutes).toContain("/billing");
    expect(visibleRoutes).not.toContain("/enrollment");
  });

  it("keeps classroom teachers inside their scoped class-mode workspace", () => {
    expect(visiblePortalNavigation("TEACHER").map((item) => item.href)).toEqual(
      ["/", "/teacher"],
    );
    expect(canAccessPortalRoute("TEACHER", "/devices")).toBe(false);
    expect(canAccessPortalRoute("TEACHER", "/roster")).toBe(false);
    expect(canAccessPortalRoute("TEACHER", "/billing")).toBe(false);
  });

  it("keeps billing admins out of fleet and roster operations", () => {
    expect(
      visiblePortalNavigation("BILLING_ADMIN").map((item) => item.href),
    ).toEqual(["/", "/billing"]);
    expect(canAccessPortalRoute("BILLING_ADMIN", "/devices")).toBe(false);
  });

  it("gives guardians only their family portal and keeps students out", () => {
    expect(firstAccessiblePortalHref("STUDENT")).toBe("/logout");
    expect(visiblePortalNavigation("GUARDIAN")).toEqual([
      { href: "/guardian", label: "My children" },
    ]);
    expect(firstAccessiblePortalHref("GUARDIAN")).toBe("/guardian");
    expect(canAccessPortalRoute("GUARDIAN", "/")).toBe(false);
    expect(canAccessPortalRoute("GUARDIAN", "/devices")).toBe(false);
  });
});
