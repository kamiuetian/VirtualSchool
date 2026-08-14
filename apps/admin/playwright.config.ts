import { defineConfig, devices } from "@playwright/test";

const appPort = Number(process.env.ADMIN_E2E_PORT ?? 3200);
const apiPort = Number(process.env.ADMIN_E2E_API_PORT ?? 4100);
const baseURL = `http://127.0.0.1:${appPort}`;
const apiURL = `http://127.0.0.1:${apiPort}`;

export default defineConfig({
  expect: {
    timeout: process.env.CI ? 15_000 : 8_000,
  },
  fullyParallel: false,
  outputDir: "test-results",
  projects: [
    {
      name: "desktop-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { height: 900, width: 1440 },
      },
    },
    {
      name: "mobile-chromium",
      use: {
        ...devices["Pixel 7"],
      },
    },
  ],
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  retries: process.env.CI ? 1 : 0,
  testDir: "./tests/e2e",
  timeout: process.env.CI ? 90_000 : 60_000,
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  workers: 1,
  webServer: [
    {
      command: "node tests/mock-api.mjs",
      env: {
        ADMIN_E2E_API_PORT: String(apiPort),
      },
      reuseExistingServer: false,
      timeout: 120_000,
      url: `${apiURL}/tenants`,
    },
    {
      command: `pnpm exec next dev -H 127.0.0.1 -p ${appPort}`,
      env: {
        ADMIN_API_BASE_URL: apiURL,
        NEXT_PUBLIC_API_BASE_URL: apiURL,
      },
      reuseExistingServer: false,
      timeout: 120_000,
      url: baseURL,
    },
  ],
});
