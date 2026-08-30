import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: [["line"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `WRANGLER_LOG_PATH=.wrangler/playwright.log "${process.execPath}" node_modules/vinext/dist/cli.js dev`,
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
