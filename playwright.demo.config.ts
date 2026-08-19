import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./apps/demo-react-vite/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5180",
    trace: "retain-on-failure",
  },
  webServer: {
    command:
      "corepack pnpm --filter @metric-atlas/demo-react-vite dev -- --host 127.0.0.1",
    url: "http://127.0.0.1:5180",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
