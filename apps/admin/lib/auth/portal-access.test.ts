import { describe, expect, it } from "vitest";
import {
  canAccessPortalRoute,
  firstAccessiblePortalHref,
  visiblePortalNavigation,
} from "./portal-access";

describe("portal access", () => {
  it("shows platform operators every admin area", () => {
    expect(visiblePortalNavigation("PLATFORM_SUPER_ADMIN").map((item) => item.href)).toEqual([
      "/",
      "/tenants",
      "/roster",
      "/enrollment",
      "/devices",
      "/policies",
      "/timetable",
      "/apps",
      "/alerts",
      "/support",
      "/reports",
      "/billing",
    ]);
  });

  it("lets school admins manage school operations without platform tenant creation being required", () => {
    const visibleRoutes = visiblePortalNavigation("SCHOOL_ADMIN").map((item) => item.href);

    expect(visibleRoutes).toContain("/tenants");
    expect(visibleRoutes).toContain("/roster");
    expect(visibleRoutes).toContain("/devices");
    expect(visibleRoutes).toContain("/policies");
    expect(visibleRoutes).toContain("/reports");
    expect(visibleRoutes).toContain("/billing");
    expect(visibleRoutes).not.toContain("/enrollment");
  });

  it("keeps classroom teachers in read-only fleet support areas", () => {
    expect(visiblePortalNavigation("TEACHER").map((item) => item.href)).toEqual([
      "/",
      "/devices",
      "/alerts",
      "/support",
    ]);
    expect(canAccessPortalRoute("TEACHER", "/roster")).toBe(false);
    expect(canAccessPortalRoute("TEACHER", "/billing")).toBe(false);
  });

  it("keeps billing admins out of fleet and roster operations", () => {
    expect(visiblePortalNavigation("BILLING_ADMIN").map((item) => item.href)).toEqual([
      "/",
      "/billing",
    ]);
    expect(canAccessPortalRoute("BILLING_ADMIN", "/devices")).toBe(false);
  });

  it("falls back to logout when a non-admin role has no portal area", () => {
    expect(firstAccessiblePortalHref("STUDENT")).toBe("/logout");
    expect(canAccessPortalRoute("GUARDIAN", "/")).toBe(false);
  });
});
