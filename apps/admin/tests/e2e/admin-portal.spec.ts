import { expect, test, type BrowserContext } from "@playwright/test";

const pages = [
  { heading: "Keep every school tablet ready for class.", path: "/" },
  { heading: "Tenant Directory", path: "/tenants" },
  { heading: "Roster And Classes", path: "/roster" },
  { heading: "Enrollment Batches", path: "/enrollment" },
  { heading: "Device Inventory", path: "/devices" },
  { heading: "Policies And Modes", path: "/policies" },
  { heading: "Timetable Blocks", path: "/timetable" },
  { heading: "Apps And Web Catalog", path: "/apps" },
  { heading: "Alerts And Diagnostics", path: "/alerts" },
  { heading: "Device Support", path: "/support" },
  { heading: "Operational Reports", path: "/reports" },
  { heading: "Plan Usage", path: "/billing" },
] as const;

test.describe("admin portal regression", () => {
  test.beforeEach(async ({ baseURL, context }) => {
    await signInAs(context, baseURL, "PLATFORM_SUPER_ADMIN");
  });

  for (const pageCase of pages) {
    test(`renders ${pageCase.path}`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") {
          consoleErrors.push(message.text());
        }
      });

      await page.goto(pageCase.path);

      await expect(
        page.getByRole("heading", { name: pageCase.heading }),
      ).toBeVisible();
      await expect(
        page.locator(".workspace-header").getByText("Northview Primary School"),
      ).toBeVisible();
      await expect(page.getByLabel("Sign out")).toBeVisible();
      await expect(page.locator(".app-shell")).toBeVisible();
      expect(consoleErrors).toEqual([]);
    });
  }

  test("exposes core action surfaces", async ({ page }) => {
    await page.goto("/devices");
    await expect(
      page.getByRole("heading", { name: "Command Center" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Queue command" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Queue wipe" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Command History" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Recent Diagnostics" }),
    ).toBeVisible();

    await page.goto("/roster?importId=import-preview-1");
    await expect(
      page.getByRole("heading", { name: "CSV Validation Result" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Download sample CSV" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Download classes sample CSV" }),
    ).toBeVisible();
    await expect(page.getByText("studentCode is required")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Download error CSV" }),
    ).toBeVisible();

    await page.goto("/tenants");
    await expect(
      page.getByRole("heading", { name: "School profile and branding" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save profile" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Download staff sample CSV" }),
    ).toBeVisible();

    await page.goto("/apps");
    await expect(
      page.getByRole("heading", { name: "Install Or Remove Apps" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Queue deployment" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Download app catalog sample CSV" }),
    ).toBeVisible();

    await page.goto("/devices");
    await expect(
      page.getByRole("link", { name: "Download device assignment sample CSV" }),
    ).toBeVisible();

    await page.goto("/alerts");
    await expect(
      page.getByRole("heading", { name: "Offline Detection" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Run scan" })).toBeVisible();

    await page.goto("/enrollment");
    await expect(
      page.getByRole("img", { name: "Enrollment QR for Pilot tablets" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Download QR" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Download kit" }),
    ).toBeVisible();
    await expect(
      page.getByText("Enrollment key", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("token-1")).toHaveCount(0);
    await expect(page.getByText("Payload")).toHaveCount(0);
    await expect(
      page.getByText('"connector":"android-management-api"'),
    ).toHaveCount(0);
  });

  test("downloads CSV exports through portal routes", async ({ page }) => {
    await page.goto("/reports");

    const inventoryDownload = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download inventory CSV" }).click();
    const inventory = await inventoryDownload;
    expect(inventory.suggestedFilename()).toBe("device-inventory.csv");

    await page.goto("/roster?importId=import-preview-1");
    const sampleDownload = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download sample CSV" }).click();
    const sample = await sampleDownload;
    expect(sample.suggestedFilename()).toBe("roster-import-sample.csv");

    const classesDownload = page.waitForEvent("download");
    await page
      .getByRole("link", { name: "Download classes sample CSV" })
      .click();
    const classes = await classesDownload;
    expect(classes.suggestedFilename()).toBe("classes-import-sample.csv");

    const errorDownload = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download error CSV" }).click();
    const errors = await errorDownload;
    expect(errors.suggestedFilename()).toBe("roster-import-errors.csv");

    await page.goto("/tenants");
    const staffDownload = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download staff sample CSV" }).click();
    const staff = await staffDownload;
    expect(staff.suggestedFilename()).toBe("staff-import-sample.csv");

    await page.goto("/apps");
    const appsDownload = page.waitForEvent("download");
    await page
      .getByRole("link", { name: "Download app catalog sample CSV" })
      .click();
    const apps = await appsDownload;
    expect(apps.suggestedFilename()).toBe("app-catalog-import-sample.csv");

    await page.goto("/devices");
    const assignmentDownload = page.waitForEvent("download");
    await page
      .getByRole("link", { name: "Download device assignment sample CSV" })
      .click();
    const assignment = await assignmentDownload;
    expect(assignment.suggestedFilename()).toBe(
      "device-assignment-import-sample.csv",
    );

    await page.goto("/enrollment");
    const kitDownload = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download kit" }).click();
    const kit = await kitDownload;
    expect(kit.suggestedFilename()).toBe("pilot-tablets-provisioning-kit.txt");
  });

  test("keeps mobile layout within viewport", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "mobile-only check");

    for (const pageCase of pages) {
      await page.goto(pageCase.path);
      await expect(
        page.getByRole("heading", { name: pageCase.heading }),
      ).toBeVisible();

      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth - window.innerWidth;
      });
      expect(overflow).toBeLessThanOrEqual(2);
    }
  });
});

test.describe("role-aware admin portal", () => {
  test("shows a read-only teacher navigation surface and redirects restricted pages", async ({
    baseURL,
    context,
    page,
  }) => {
    await signInAs(context, baseURL, "TEACHER");

    await page.goto("/");
    await expect(
      page.locator(".sidebar-nav").getByRole("link", { name: "Overview" }),
    ).toBeVisible();
    await expect(
      page.locator(".sidebar-nav").getByRole("link", { name: "Devices" }),
    ).toBeVisible();
    await expect(
      page.locator(".sidebar-nav").getByRole("link", { name: "Alerts" }),
    ).toBeVisible();
    await expect(
      page.locator(".sidebar-nav").getByRole("link", { name: "Support" }),
    ).toBeVisible();
    await expect(
      page.locator(".sidebar-nav").getByRole("link", { name: "Roster" }),
    ).toHaveCount(0);
    await expect(
      page.locator(".sidebar-nav").getByRole("link", { name: "Billing" }),
    ).toHaveCount(0);

    await page.goto("/roster");
    await expect(page).toHaveURL("/");
    await expect(
      page.getByRole("heading", {
        name: "Keep every school tablet ready for class.",
      }),
    ).toBeVisible();

    await page.goto("/devices");
    await expect(
      page.getByRole("heading", { name: "Device Inventory" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Queue command" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Queue wipe" })).toHaveCount(
      0,
    );
  });

  test("keeps billing admins limited to billing and overview", async ({
    baseURL,
    context,
    page,
  }) => {
    await signInAs(context, baseURL, "BILLING_ADMIN");

    await page.goto("/billing");
    await expect(
      page.getByRole("heading", { name: "Plan Usage" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Update subscription" }),
    ).toBeVisible();
    await expect(
      page.locator(".sidebar-nav").getByRole("link", { name: "Billing" }),
    ).toBeVisible();
    await expect(
      page.locator(".sidebar-nav").getByRole("link", { name: "Devices" }),
    ).toHaveCount(0);
    await expect(
      page.locator(".sidebar-nav").getByRole("link", { name: "Schools" }),
    ).toHaveCount(0);

    await page.goto("/devices");
    await expect(page).toHaveURL("/");
  });

  test("hides operational command controls from school admins", async ({
    baseURL,
    context,
    page,
  }) => {
    await signInAs(context, baseURL, "SCHOOL_ADMIN");

    await page.goto("/devices");
    await expect(
      page.getByRole("heading", { name: "Device Inventory" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Assign Tablet" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Queue command" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Queue wipe" })).toHaveCount(
      0,
    );

    await page.goto("/apps");
    await expect(
      page.getByRole("heading", { name: "Apps And Web Catalog" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Add Approved App" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Queue deployment" }),
    ).toHaveCount(0);

    await page.goto("/enrollment");
    await expect(page).toHaveURL("/");
  });
});

async function signInAs(
  context: BrowserContext,
  baseURL: string | undefined,
  role: string,
): Promise<void> {
  if (!baseURL) {
    throw new Error("Playwright baseURL is required");
  }

  const value = Buffer.from(
    JSON.stringify({
      email: `${role.toLowerCase()}@northview.edu`,
      name: roleName(role),
      role,
      tenantIds: ["tenant-northview"],
    }),
    "utf8",
  ).toString("base64url");

  await context.addCookies([
    {
      name: "vs_admin_session",
      url: baseURL,
      value,
    },
  ]);
}

function roleName(role: string): string {
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
