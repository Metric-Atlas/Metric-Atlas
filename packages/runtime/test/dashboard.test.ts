import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createRuntimeServer, serveRuntime, DEFAULT_DASHBOARD_PATH } from "../src/index.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("Analytics Health Dashboard route (ADR-009)", () => {
  it("redirects the bare path (no trailing slash) so the browser resolves relative asset URLs correctly", async () => {
    // Regression: the dashboard's built index.html references its JS bundle with a
    // relative URL ("./assets/x.js") so it works under any --dashboard-path. Without
    // a trailing slash on the page URL itself, a browser resolves that relative to
    // the *parent* directory, requesting ".../assets/x.js" instead of
    // ".../dashboard/assets/x.js" — which used to fall through to the consumer's own
    // index.html (text/html) instead of the JS module, breaking the page silently.
    const root = await temporaryRoot();
    const dashboardAssetsDir = await temporaryRoot();
    await writeFile(path.join(dashboardAssetsDir, "index.html"), "<h1>Dashboard</h1>");

    const server = createRuntimeServer(root, { dashboardAssetsDir });
    const { host, port } = await listen(server);
    try {
      const response = await fetch(`http://${host}:${port}${DEFAULT_DASHBOARD_PATH}`, {
        redirect: "manual",
      });
      expect(response.status).toBe(302);
      expect(response.headers.get("location")).toBe(`${DEFAULT_DASHBOARD_PATH}/`);
    } finally {
      await close(server);
    }
  });

  it("serves the bundled dashboard at the default path", async () => {
    const root = await temporaryRoot();
    const dashboardAssetsDir = await temporaryRoot();
    await writeFile(path.join(dashboardAssetsDir, "index.html"), "<h1>Dashboard</h1>");
    await mkdir(path.join(dashboardAssetsDir, "assets"), { recursive: true });
    await writeFile(path.join(dashboardAssetsDir, "assets", "app.js"), "console.log('dashboard')");

    const server = createRuntimeServer(root, { dashboardAssetsDir });
    const { host, port } = await listen(server);
    try {
      const index = await fetch(`http://${host}:${port}${DEFAULT_DASHBOARD_PATH}`);
      expect(index.status).toBe(200);
      expect(await index.text()).toContain("Dashboard");

      const asset = await fetch(`http://${host}:${port}${DEFAULT_DASHBOARD_PATH}/assets/app.js`);
      expect(asset.status).toBe(200);
      expect(await asset.text()).toContain("console.log");
    } finally {
      await close(server);
    }
  });

  it("moves to a custom path via --dashboard-path / dashboardPath", async () => {
    const root = await temporaryRoot();
    const dashboardAssetsDir = await temporaryRoot();
    await writeFile(path.join(dashboardAssetsDir, "index.html"), "<h1>Dashboard</h1>");

    const server = createRuntimeServer(root, {
      dashboardAssetsDir,
      dashboardPath: "/my-dashboard",
    });
    const { host, port } = await listen(server);
    try {
      const moved = await fetch(`http://${host}:${port}/my-dashboard`);
      expect(moved.status).toBe(200);

      const defaultPath = await fetch(`http://${host}:${port}${DEFAULT_DASHBOARD_PATH}`);
      expect(defaultPath.status).toBe(404);
    } finally {
      await close(server);
    }
  });

  it("reports a diagnosable error instead of a bare 404 when the dashboard was not bundled", async () => {
    const root = await temporaryRoot();
    const missingDashboardDir = path.join(root, "does-not-exist");

    const server = createRuntimeServer(root, { dashboardAssetsDir: missingDashboardDir });
    const { host, port } = await listen(server);
    try {
      const response = await fetch(`http://${host}:${port}${DEFAULT_DASHBOARD_PATH}`);
      expect(response.status).toBe(404);
      const body = await response.json();
      expect(body.error.code).toBe("dashboard_not_bundled");
    } finally {
      await close(server);
    }
  });

  it("does not intercept the consumer's own site outside the dashboard path", async () => {
    const root = await temporaryRoot();
    await writeFile(path.join(root, "index.html"), "<h1>Consumer site</h1>");

    const runtime = await serveRuntime({ root, port: 0 });
    try {
      const page = await fetch(`http://${runtime.host}:${runtime.port}/`);
      expect(await page.text()).toContain("Consumer site");
    } finally {
      await runtime.close();
    }
  });
});

async function temporaryRoot(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "metric-atlas-dashboard-"));
  temporaryDirectories.push(directory);
  return directory;
}

function listen(server: ReturnType<typeof createRuntimeServer>): Promise<{ host: string; port: number }> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      resolve({ host: "127.0.0.1", port });
    });
  });
}

function close(server: ReturnType<typeof createRuntimeServer>): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}
