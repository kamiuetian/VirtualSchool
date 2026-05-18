import { expect, test } from "@playwright/test";

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
    await expect(page.getByRole("heading", { name: "Command Center" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Queue command" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Queue wipe" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Command History" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent Diagnostics" })).toBeVisible();

    await page.goto("/roster?importId=import-preview-1");
    await expect(page.getByRole("heading", { name: "CSV Validation Result" })).toBeVisible();
    await expect(page.getByText("studentCode is required")).toBeVisible();
    await expect(page.getByRole("link", { name: "Download error CSV" })).toBeVisible();

    await page.goto("/apps");
    await expect(page.getByRole("heading", { name: "Install Or Remove Apps" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Queue deployment" })).toBeVisible();

    await page.goto("/alerts");
    await expect(page.getByRole("heading", { name: "Offline Detection" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Run scan" })).toBeVisible();

    await page.goto("/enrollment");
    await expect(
      page.getByRole("img", { name: "Enrollment QR for Pilot tablets" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Download QR" })).toBeVisible();
    await expect(page.getByText("Payload")).toHaveCount(0);
    await expect(page.getByText('"connector":"android-management-api"')).toHaveCount(0);
  });

  test("downloads CSV exports through portal routes", async ({ page }) => {
    await page.goto("/reports");

    const inventoryDownload = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download inventory CSV" }).click();
    const inventory = await inventoryDownload;
    expect(inventory.suggestedFilename()).toBe("device-inventory.csv");

    await page.goto("/roster?importId=import-preview-1");
    const errorDownload = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download error CSV" }).click();
    const errors = await errorDownload;
    expect(errors.suggestedFilename()).toBe("roster-import-errors.csv");
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
