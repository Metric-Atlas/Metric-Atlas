import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadEnvFile, serveRuntime } from "../src/index.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  delete process.env.METRIC_ATLAS_GA4_PROPERTY_ID;
  delete process.env.OPENAI_API_KEY;
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("Metric Atlas Local Node Runtime", () => {
  it("serves static assets and redacts credential values from health", async () => {
    const root = await temporaryRoot();
    await writeFile(path.join(root, "index.html"), "<h1>Metric Atlas</h1>");
    process.env.OPENAI_API_KEY = "sk-secret";

    const runtime = await serveRuntime({ root, port: 0 });
    try {
      const page = await fetch(`http://${runtime.host}:${runtime.port}/`);
      expect(await page.text()).toContain("Metric Atlas");

      const health = await fetchJson(`http://${runtime.host}:${runtime.port}/__metric-atlas/api/runtime-health`);
      expect(health.credentials.llmApiKey).toBe(true);
      expect(JSON.stringify(health)).not.toContain("sk-secret");
    } finally {
      await runtime.close();
    }
  });

  it("loads env files only into the Node Runtime process", async () => {
    const root = await temporaryRoot();
    const envFile = path.join(root, ".env.metric-atlas");
    await writeFile(envFile, "METRIC_ATLAS_GA4_PROPERTY_ID=123456789\nOPENAI_API_KEY='sk-env'\n");

    await loadEnvFile(envFile);

    expect(process.env.METRIC_ATLAS_GA4_PROPERTY_ID).toBe("123456789");
    expect(process.env.OPENAI_API_KEY).toBe("sk-env");
  });

  it("fails closed for LLM generation until an adapter is implemented", async () => {
    const root = await temporaryRoot();
    const runtime = await serveRuntime({ root, port: 0 });
    try {
      const response = await fetch(`http://${runtime.host}:${runtime.port}/__metric-atlas/api/llm/generate`, {
        method: "POST",
      });
      const body = await response.json();
      expect(response.status).toBe(501);
      expect(body.error.code).toBe("llm_adapter_not_implemented");
    } finally {
      await runtime.close();
    }
  });

  it("serves generated manifest and health artifacts from conventional runtime locations", async () => {
    const root = await temporaryRoot();
    await mkdir(path.join(root, ".metric-atlas"));
    await writeFile(
      path.join(root, ".metric-atlas", "manifest.json"),
      JSON.stringify({ version: "0.1.0", events: [] }),
    );
    await writeFile(
      path.join(root, ".metric-atlas", "health.json"),
      JSON.stringify({ generatedAt: "2026-08-19T00:00:00.000Z", provider: "ga4", items: [] }),
    );

    const runtime = await serveRuntime({ root, port: 0 });
    try {
      const manifest = await fetchJson(`http://${runtime.host}:${runtime.port}/__metric-atlas/api/manifest`);
      const health = await fetchJson(`http://${runtime.host}:${runtime.port}/__metric-atlas/api/health`);
      expect(manifest.version).toBe("0.1.0");
      expect(health.provider).toBe("ga4");
    } finally {
      await runtime.close();
    }
  });
});

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "metric-atlas-runtime-"));
  temporaryDirectories.push(root);
  return root;
}

async function fetchJson(url: string): Promise<any> {
  const response = await fetch(url);
  expect(response.ok).toBe(true);
  return response.json();
}
