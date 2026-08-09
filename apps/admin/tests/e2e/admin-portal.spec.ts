import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
} from "@playwright/test";

const pages = [
  { heading: "Keep every school tablet ready for class.", path: "/" },
  { heading: "Tenant Directory", path: "/tenants" },
  { heading: "Roster And Classes", path: "/roster" },
  { heading: "Enrollment Batches", path: "/enrollment" },
  { heading: "Device Inventory", path: "/devices" },
  { heading: "Policies And Modes", path: "/policies" },
  { heading: "Privacy notices and consent", path: "/privacy" },
  { heading: "Timetable Blocks", path: "/timetable" },
  { heading: "Apps And Web Catalog", path: "/apps" },
  { heading: "Integration marketplace", path: "/integrations" },
  { heading: "Alerts And Diagnostics", path: "/alerts" },
  { heading: "Device Support", path: "/support" },
  { heading: "Operational Reports", path: "/reports" },
  { heading: "Plan Usage", path: "/billing" },
] as const;
const mockApiURL = `http://127.0.0.1:${process.env.ADMIN_E2E_API_PORT ?? "4100"}`;

test.describe("admin portal regression", () => {
  test.beforeEach(async ({ baseURL, context }) => {
    await context.route("https://assets.example.edu/**", async (route) => {
      await route.fulfill({
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
          "base64",
        ),
        contentType: "image/png",
        status: 200,
      });
    });
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
        page.getByRole("heading", { name: pageCase.heading, exact: true }),
      ).toBeVisible();
      await expect(
        page.locator(".workspace-header").getByText("Northview Primary School"),
      ).toBeVisible();
      await expect(page.getByLabel("Sign out")).toBeVisible();
      await expect(page.locator(".app-shell")).toBeVisible();
      await expect(page.getByText("Managed tablet fleet")).toBeVisible();
      await expect(page.locator(".brand-mark img")).toHaveAttribute(
        "src",
        "https://assets.example.edu/northview-logo.png",
      );
      expect(consoleErrors).toEqual([]);
    });
  }

  test("exposes core action surfaces", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Ready for first enrollment")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Review step" }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Finish onboarding" }),
    ).toBeEnabled();

    await page.goto("/devices");
    await expect(
      page.getByRole("heading", { name: "Procurement and replacement" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create batch" }),
    ).toBeVisible();
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
      page.getByRole("heading", { name: "Device lifecycle" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Apply lifecycle change" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Assignment and Lifecycle History" }),
    ).toBeVisible();
    await expect(page.getByText("Pilot allocation")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Recent Diagnostics" }),
    ).toBeVisible();
    await expect(page.getByLabel("OS lifecycle")).toBeVisible();
    await expect(page.getByText("100/100 · Good").first()).toBeVisible();
    await expect(
      page.getByText("No OS lifecycle update is currently required."),
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
      page.getByRole("heading", { name: "Data residency and regions" }),
    ).toBeVisible();
    await expect(page.getByLabel("Data residency").first()).toHaveValue("US");
    await expect(
      page.getByRole("button", { name: "Save data governance" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Download staff sample CSV" }),
    ).toBeVisible();

    await page.goto("/alerts");
    await expect(
      page.getByRole("heading", { name: "Announcements And Feedback" }),
    ).toBeVisible();
    await expect(page.getByText("Teacher pilot briefing")).toBeVisible();
    await expect(
      page.getByText("Attendance: Daily capture is easy to find."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Schedule announcement" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Submit pilot feedback" }),
    ).toBeVisible();

    await page.goto("/apps");
    await expect(
      page.getByRole("heading", { name: "Categorized Content Library" }),
    ).toBeVisible();
    await expect(page.getByText("Fractions practice")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Add resource" }),
    ).toBeVisible();
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
    await expect(
      page.getByRole("heading", { name: "Notification Preferences" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save notification preferences" }),
    ).toBeVisible();

    await page.goto("/support");
    await expect(
      page.getByRole("heading", { name: "Support Tickets" }),
    ).toBeVisible();
    await expect(page.getByText("Tablet cannot launch lesson")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Open routed ticket" }),
    ).toBeVisible();
    await expect(page.getByText(/HELPDESK/)).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Remote Assistance" }),
    ).toBeVisible();
    await expect(page.getByText(/never enables hidden camera/)).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: /explicitly consented/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Troubleshooting Playbooks" }),
    ).toBeVisible();
    await expect(page.getByText("Stuck kiosk mode")).toBeVisible();

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

    await page.goto("/privacy");
    await expect(
      page.getByRole("heading", { name: "Security and privacy center" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Service status and recovery evidence",
      }),
    ).toBeVisible();
    await expect(page.getByText("Annual recovery exercise")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Backup and controlled restore" }),
    ).toBeVisible();
    await expect(
      page.getByRole("strong").filter({ hasText: "snapshot-2026-08-09" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Record verification" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Publish DR evidence" }),
    ).toBeVisible();
    await expect(
      page.getByText("No covert monitoring of children"),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Publish notice" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Accept this version" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Immutable evidence packs" }),
    ).toBeVisible();
    await expect(page.getByText("2026 access review evidence")).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Download JSON" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Generate evidence pack" }),
    ).toBeVisible();
  });

  test("downloads CSV exports through portal routes", async ({ page }) => {
    await page.goto("/reports");

    await expect(
      page.getByRole("heading", { name: "Learning Access And Device Usage" }),
    ).toBeVisible();
    await expect(
      page.getByLabel("Learning usage totals").getByText("Approved launches"),
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "Grade 4 Blue" }),
    ).toBeVisible();

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

  test("completes the school setup and managed-device critical path", async ({
    page,
    request,
  }) => {
    await page.goto("/tenants");
    const createSchool = page
      .locator("form")
      .filter({ hasText: "Create school" });
    await createSchool.getByLabel("School name").fill("Lakeside Academy");
    await createSchool.getByLabel("Country").fill("PK");
    await createSchool.getByLabel("Timezone").fill("Asia/Karachi");
    await createSchool.getByLabel("Plan").selectOption("growth");
    await createSchool.getByLabel("Status").selectOption("ACTIVE");
    await createSchool.getByLabel("Billing contact").fill("admin@lakeside.edu");
    await createSchool.getByRole("button", { name: "Create school" }).click();
    await expectMutation(request, "POST", "/tenants", {
      country: "PK",
      name: "Lakeside Academy",
      planKey: "growth",
      status: "ACTIVE",
      timezone: "Asia/Karachi",
    });

    await page.goto("/roster");
    const student = page.locator("form").filter({ hasText: "Create student" });
    await student.getByLabel("Student code").fill("S-2002");
    await student.getByLabel("Student name").fill("Omar Ali");
    await student.getByLabel("Grade").fill("5");
    await student.getByLabel("Section").fill("Green");
    await student.getByRole("button", { name: "Create student" }).click();
    await expectMutation(
      request,
      "POST",
      "/tenants/tenant-northview/students",
      { grade: "5", name: "Omar Ali", studentCode: "S-2002" },
    );

    const roster = page.locator("form").filter({ hasText: "Validate import" });
    await roster.getByLabel("Filename").fill("grade-5.csv");
    await roster
      .getByLabel("CSV rows")
      .fill("studentCode,name,grade,section\nS-2003,Mina Noor,5,Green");
    await roster.getByRole("button", { name: "Validate import" }).click();
    await expect(page).toHaveURL(/\/roster\?importId=import-preview-1/);
    await expect(
      page.getByRole("heading", { name: "CSV Validation Result" }),
    ).toBeVisible();
    await expectMutation(
      request,
      "POST",
      "/tenants/tenant-northview/roster-imports/preview",
      { filename: "grade-5.csv" },
    );

    await page.goto("/enrollment");
    const enrollment = page.locator("form").filter({ hasText: "Create batch" });
    await enrollment.getByLabel("Batch name").fill("Grade 5 rollout");
    await enrollment.getByLabel("Device cap").fill("40");
    await enrollment.getByRole("button", { name: "Create batch" }).click();
    await expectMutation(
      request,
      "POST",
      "/tenants/tenant-northview/enrollment-batches",
      { maxDevices: 40, name: "Grade 5 rollout" },
    );

    await page.goto("/policies");
    const simulator = page
      .locator("form")
      .filter({ hasText: "Simulate access" });
    await simulator.getByLabel("URL").fill("https://blocked.example/lesson");
    await simulator.getByRole("button", { name: "Simulate access" }).click();
    await expect(page.getByText("BLOCKED (DENY) — BLOCKLIST")).toBeVisible();
    await expectMutation(
      request,
      "POST",
      "/tenants/tenant-northview/policies/policy-supervised/simulate-url",
      { url: "https://blocked.example/lesson" },
    );

    const androidControls = page
      .locator("form")
      .filter({ hasText: "Save Android controls" });
    await androidControls
      .getByLabel("System update behavior")
      .selectOption("WINDOWED");
    await androidControls.getByLabel("Window starts").fill("02:00");
    await androidControls.getByLabel("Window ends").fill("04:30");
    await androidControls
      .getByLabel("System navigation")
      .selectOption("HOME_BUTTON_ONLY");
    await androidControls
      .getByRole("button", { name: "Save Android controls" })
      .click();
    await expectMutation(
      request,
      "PATCH",
      "/tenants/tenant-northview/policies/policy-draft/android-controls",
      {
        blockFactoryReset: true,
        kioskCustomization: {
          powerButtonActions: "POWER_BUTTON_BLOCKED",
          statusBar: "NOTIFICATIONS_AND_SYSTEM_INFO_DISABLED",
          systemNavigation: "HOME_BUTTON_ONLY",
        },
        systemUpdate: {
          endMinutes: 270,
          startMinutes: 120,
          type: "WINDOWED",
        },
      },
    );

    const assign = page.locator("form").filter({ hasText: "Assign" });
    await assign.getByLabel("Scope").selectOption("CLASS");
    await assign.getByLabel("Target ID").fill("class-4-blue");
    await assign.getByLabel("Reason").fill("Grade 4 baseline");
    await assign.getByRole("button", { name: "Assign" }).click();
    await expectMutation(
      request,
      "POST",
      "/tenants/tenant-northview/policies/policy-supervised/assignments",
      { reason: "Grade 4 baseline", scope: "CLASS", scopeId: "class-4-blue" },
    );

    await page.goto("/devices");
    const command = page.locator("form").filter({ hasText: "Queue command" });
    await command.getByLabel("Command").selectOption("POLICY_REFRESH");
    await command.getByLabel("Reason").fill("Apply assigned baseline");
    await command.getByRole("button", { name: "Queue command" }).click();
    await expectMutation(
      request,
      "POST",
      "/tenants/tenant-northview/devices/device-tab-001/commands",
      { reason: "Apply assigned baseline", type: "POLICY_REFRESH" },
    );

    await page.goto("/reports");
    await expect(page.getByText("TAB001")).toBeVisible();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download inventory CSV" }).click();
    expect((await downloadPromise).suggestedFilename()).toBe(
      "device-inventory.csv",
    );
  });

  test("keeps mobile layout within viewport", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "mobile-only check");

    for (const pageCase of pages) {
      await page.goto(pageCase.path);
      await expect(
        page.getByRole("heading", { name: pageCase.heading, exact: true }),
      ).toBeVisible();

      const overflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth - window.innerWidth;
      });
      expect(overflow).toBeLessThanOrEqual(2);
    }
  });
});

test.describe("role-aware admin portal", () => {
  test("shows scoped and reusable teacher class modes and redirects tenant-wide fleet pages", async ({
    baseURL,
    context,
    page,
    request,
  }) => {
    await signInAs(context, baseURL, "TEACHER");

    await page.goto("/");
    await expect(
      page.locator(".sidebar-nav").getByRole("link", { name: "Overview" }),
    ).toBeVisible();
    await expect(
      page.locator(".sidebar-nav").getByRole("link", { name: "Class Mode" }),
    ).toBeVisible();
    await expect(
      page.locator(".sidebar-nav").getByRole("link", { name: "Alerts" }),
    ).toHaveCount(0);
    await expect(
      page.locator(".sidebar-nav").getByRole("link", { name: "Support" }),
    ).toHaveCount(0);
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
    await expect(page).toHaveURL("/");

    await page.goto("/teacher");
    await expect(
      page.getByRole("heading", { name: "Live Class Mode" }),
    ).toBeVisible();
    await expect(page.getByText("TAB001")).toBeVisible();
    await page.getByLabel("Template name").fill("Daily math warmup");
    await page
      .getByLabel("Focus message (optional)")
      .fill("Open your math notebooks");
    await page.getByLabel("Focus minutes").fill("2");
    await page.getByRole("button", { name: "Save template" }).click();
    await expectMutation(
      request,
      "POST",
      "/tenants/tenant-northview/teacher/templates",
      {
        name: "Daily math warmup",
        focusMessage: "Open your math notebooks",
        focusDurationMinutes: 2,
      },
    );
    const startButton = page.getByRole("button", { name: "Start class mode" });
    if (await startButton.isVisible()) await startButton.click();
    await expect(
      page.getByRole("button", { name: "Push resource" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Display focus screen" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Approve temporarily" }),
    ).toBeVisible();
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
      page.getByRole("heading", { name: "Device Inventory", exact: true }),
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

async function expectMutation(
  request: APIRequestContext,
  method: string,
  path: string,
  expectedBody: Record<string, unknown>,
): Promise<void> {
  await expect
    .poll(async () => {
      const response = await request.get(`${mockApiURL}/__test/mutations`);
      const mutations = (await response.json()) as Array<{
        body: Record<string, unknown>;
        method: string;
        path: string;
      }>;
      return mutations.find(
        (mutation) => mutation.method === method && mutation.path === path,
      );
    })
    .toMatchObject({ body: expectedBody, method, path });
}
