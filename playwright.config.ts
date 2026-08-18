import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./packages/vite/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4178",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "vite --config packages/vite/test/fixtures/e2e-app/vite.config.ts",
    url: "http://127.0.0.1:4178",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
