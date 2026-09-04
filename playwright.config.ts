import { defineConfig, devices } from "@playwright/test";

// Dedicated port so e2e never collides with a dev server on 3001.
const E2E_PORT = process.env.E2E_PORT ?? "5012";
const E2E_URL = `http://localhost:${E2E_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "html" : "list",
  timeout: 30_000,

  use: {
    baseURL: E2E_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
  },

  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["setup"],
    },
    ...(process.env.CI
      ? []
      : [
          {
            name: "firefox",
            use: { ...devices["Desktop Firefox"] },
            dependencies: ["setup"],
          },
        ]),
  ],

  webServer: {
    command: `PORT=${E2E_PORT} npm run dev`,
    url: E2E_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
