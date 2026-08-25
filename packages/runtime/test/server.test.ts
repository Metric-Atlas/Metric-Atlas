import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadEnvFile, serveRuntime } from "../src/index.js";

const temporaryDirectories: string[] = [];

const originalFetch = globalThis.fetch;

afterEach(async () => {
  globalThis.fetch = originalFetch;
  delete process.env.METRIC_ATLAS_GA4_PROPERTY_ID;
  delete process.env.OPENAI_API_KEY;
  delete process.env.METRIC_ATLAS_LLM_API_KEY;
  delete process.env.METRIC_ATLAS_LLM_BASE_URL;
  delete process.env.METRIC_ATLAS_LLM_MODEL;
  delete process.env.METRIC_ATLAS_LLM_MAX_CANDIDATES;
  delete process.env.METRIC_ATLAS_LLM_PROVIDER;
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

  it("fails closed for LLM generation when no runtime API key is configured", async () => {
    const root = await temporaryRoot();
    const runtime = await serveRuntime({ root, port: 0 });
    try {
      const response = await fetch(`http://${runtime.host}:${runtime.port}/__metric-atlas/api/llm/generate`, {
        method: "POST",
        body: JSON.stringify({ question: "구매 클릭은?", candidates: [{ eventKey: "ga4:purchase_click", eventName: "purchase_click", provider: "ga4" }] }),
      });
      const body = await response.json();
      expect(response.status).toBe(400);
      expect(body.error.code).toBe("missing_llm_api_key");
    } finally {
      await runtime.close();
    }
  });

  it("uses the runtime API key to call an openai-compatible chat completion endpoint", async () => {
    const root = await temporaryRoot();
    process.env.METRIC_ATLAS_LLM_API_KEY = "sk-runtime";
    process.env.METRIC_ATLAS_LLM_BASE_URL = "https://llm.example.test/v1";
    process.env.METRIC_ATLAS_LLM_MODEL = "demo-model";
    process.env.METRIC_ATLAS_LLM_MAX_CANDIDATES = "1";
    let upstreamRequest: { url: string; init?: RequestInit } | null = null;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = String(url);
      if (requestUrl.startsWith("http://")) {
        return originalFetch(url, init);
      }
      upstreamRequest = { url: requestUrl, init };
      return jsonResponse({ choices: [{ message: { content: "구매 클릭 이벤트를 우선 확인하세요." } }] });
    }) as typeof fetch;

    const runtime = await serveRuntime({ root, port: 0 });
    try {
      const response = await fetch(`http://${runtime.host}:${runtime.port}/__metric-atlas/api/llm/generate`, {
        method: "POST",
        body: JSON.stringify({
          question: "구매 클릭이 늘었나요?",
          analysisType: "comparison",
          candidates: [
            { eventKey: "ga4:purchase_click", eventName: "purchase_click", provider: "ga4", sourceFile: "src/Button.tsx" },
            { eventKey: "ga4:signup_complete", eventName: "signup_complete", provider: "ga4", sourceFile: "src/Form.tsx" },
          ],
        }),
      });
      const body = await response.json();
      const sent = JSON.parse(String(upstreamRequest?.init?.body));
      const prompt = JSON.parse(sent.messages[1].content);

      expect(response.status).toBe(200);
      expect(body.content).toBe("구매 클릭 이벤트를 우선 확인하세요.");
      expect(upstreamRequest?.url).toBe("https://llm.example.test/v1/chat/completions");
      expect(upstreamRequest?.init?.headers).toMatchObject({ authorization: "Bearer sk-runtime" });
      expect(sent.model).toBe("demo-model");
      expect(sent.messages[0].content).toContain("Never claim that an event is collected");
      expect(sent.messages[0].content).toContain("latestResultStatus is ok");
      expect(sent.messages[0].content).toContain("do not claim that no registration or setup is needed");
      expect(prompt.candidates).toHaveLength(1);
      expect(prompt.candidates[0]).toMatchObject({
        eventKey: "ga4:purchase_click",
        sourceFile: "src/Button.tsx",
      });
      expect(JSON.stringify(prompt)).not.toContain("sk-runtime");
    } finally {
      await runtime.close();
    }
  });

  it("extracts text from OpenAI-compatible array content responses", async () => {
    const root = await temporaryRoot();
    process.env.METRIC_ATLAS_LLM_API_KEY = "sk-runtime";
    process.env.METRIC_ATLAS_LLM_BASE_URL = "https://llm.example.test/v1";
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = String(url);
      if (requestUrl.startsWith("http://")) {
        return originalFetch(url, init);
      }
      return jsonResponse({ choices: [{ message: { content: [{ type: "text", text: "배열 content 응답입니다." }] } }] });
    }) as typeof fetch;

    const runtime = await serveRuntime({ root, port: 0 });
    try {
      const response = await fetch(`http://${runtime.host}:${runtime.port}/__metric-atlas/api/llm/generate`, {
        method: "POST",
        body: JSON.stringify({
          question: "구매 클릭은?",
          candidates: [{ eventKey: "ga4:purchase_click", eventName: "purchase_click", provider: "ga4" }],
        }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.content).toBe("배열 content 응답입니다.");
    } finally {
      await runtime.close();
    }
  });

  it("falls back to reasoning text for OpenAI-compatible responses with empty content", async () => {
    const root = await temporaryRoot();
    process.env.METRIC_ATLAS_LLM_API_KEY = "sk-runtime";
    process.env.METRIC_ATLAS_LLM_BASE_URL = "https://llm.example.test/v1";
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = String(url);
      if (requestUrl.startsWith("http://")) {
        return originalFetch(url, init);
      }
      return jsonResponse({ choices: [{ message: { content: "", reasoning: "reasoning 응답입니다." } }] });
    }) as typeof fetch;

    const runtime = await serveRuntime({ root, port: 0 });
    try {
      const response = await fetch(`http://${runtime.host}:${runtime.port}/__metric-atlas/api/llm/generate`, {
        method: "POST",
        body: JSON.stringify({
          question: "구매 클릭은?",
          candidates: [{ eventKey: "ga4:purchase_click", eventName: "purchase_click", provider: "ga4" }],
        }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.content).toBe("reasoning 응답입니다.");
    } finally {
      await runtime.close();
    }
  });

  it("returns llm_empty_response when the LLM provider returns no text", async () => {
    const root = await temporaryRoot();
    process.env.METRIC_ATLAS_LLM_API_KEY = "sk-runtime";
    process.env.METRIC_ATLAS_LLM_BASE_URL = "https://llm.example.test/v1";
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = String(url);
      if (requestUrl.startsWith("http://")) {
        return originalFetch(url, init);
      }
      return jsonResponse({ choices: [{ message: { content: "" } }] });
    }) as typeof fetch;

    const runtime = await serveRuntime({ root, port: 0 });
    try {
      const response = await fetch(`http://${runtime.host}:${runtime.port}/__metric-atlas/api/llm/generate`, {
        method: "POST",
        body: JSON.stringify({
          question: "구매 클릭은?",
          candidates: [{ eventKey: "ga4:purchase_click", eventName: "purchase_click", provider: "ga4" }],
        }),
      });
      const body = await response.json();

      expect(response.status).toBe(502);
      expect(body.error.code).toBe("llm_empty_response");
    } finally {
      await runtime.close();
    }
  });

  it("calls Anthropic's Messages API when METRIC_ATLAS_LLM_PROVIDER=anthropic", async () => {
    const root = await temporaryRoot();
    process.env.METRIC_ATLAS_LLM_PROVIDER = "anthropic";
    process.env.METRIC_ATLAS_LLM_API_KEY = "sk-ant-runtime";
    process.env.METRIC_ATLAS_LLM_MAX_CANDIDATES = "1";
    let upstreamRequest: { url: string; init?: RequestInit } | null = null;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = String(url);
      if (requestUrl.startsWith("http://")) {
        return originalFetch(url, init);
      }
      upstreamRequest = { url: requestUrl, init };
      return jsonResponse({ content: [{ type: "text", text: "Claude가 답한 설명입니다." }] });
    }) as typeof fetch;

    const runtime = await serveRuntime({ root, port: 0 });
    try {
      const response = await fetch(`http://${runtime.host}:${runtime.port}/__metric-atlas/api/llm/generate`, {
        method: "POST",
        body: JSON.stringify({
          question: "구매 클릭이 늘었나요?",
          analysisType: "comparison",
          candidates: [{ eventKey: "ga4:purchase_click", eventName: "purchase_click", provider: "ga4" }],
        }),
      });
      const body = await response.json();
      const sent = JSON.parse(String(upstreamRequest?.init?.body));

      expect(response.status).toBe(200);
      expect(body.provider).toBe("anthropic");
      expect(body.content).toBe("Claude가 답한 설명입니다.");
      expect(upstreamRequest?.url).toBe("https://api.anthropic.com/v1/messages");
      expect(upstreamRequest?.init?.headers).toMatchObject({
        "x-api-key": "sk-ant-runtime",
        "anthropic-version": "2023-06-01",
      });
      expect(sent.model).toBe("claude-haiku-4-5-20251001");
      expect(sent.system).toBeTypeOf("string");
      expect(JSON.stringify(sent)).not.toContain("sk-ant-runtime");
    } finally {
      await runtime.close();
    }
  });

  it("uses the default LLM base URL when env value is blank", async () => {
    const root = await temporaryRoot();
    process.env.METRIC_ATLAS_LLM_API_KEY = "sk-runtime";
    process.env.METRIC_ATLAS_LLM_BASE_URL = "";
    let upstreamRequest: { url: string; init?: RequestInit } | null = null;
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = String(url);
      if (requestUrl.startsWith("http://")) {
        return originalFetch(url, init);
      }
      upstreamRequest = { url: requestUrl, init };
      return jsonResponse({ choices: [{ message: { content: "기본 URL 호출 성공" } }] });
    }) as typeof fetch;

    const runtime = await serveRuntime({ root, port: 0 });
    try {
      const response = await fetch(`http://${runtime.host}:${runtime.port}/__metric-atlas/api/llm/generate`, {
        method: "POST",
        body: JSON.stringify({
          question: "구매 클릭은?",
          candidates: [{ eventKey: "ga4:purchase_click", eventName: "purchase_click", provider: "ga4" }],
        }),
      });
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.content).toBe("기본 URL 호출 성공");
      expect(upstreamRequest?.url).toBe("https://api.openai.com/v1/chat/completions");
    } finally {
      await runtime.close();
    }
  });

  it("returns llm_network_error when the runtime cannot reach the LLM provider", async () => {
    const root = await temporaryRoot();
    process.env.METRIC_ATLAS_LLM_API_KEY = "sk-runtime";
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = String(url);
      if (requestUrl.startsWith("http://")) {
        return originalFetch(url, init);
      }
      throw new Error("ENOTFOUND llm.example.test");
    }) as typeof fetch;

    const runtime = await serveRuntime({ root, port: 0 });
    try {
      const response = await fetch(`http://${runtime.host}:${runtime.port}/__metric-atlas/api/llm/generate`, {
        method: "POST",
        body: JSON.stringify({
          question: "구매 클릭은?",
          candidates: [{ eventKey: "ga4:purchase_click", eventName: "purchase_click", provider: "ga4" }],
        }),
      });
      const body = await response.json();

      expect(response.status).toBe(502);
      expect(body.error.code).toBe("llm_network_error");
      expect(body.error.message).toContain("ENOTFOUND");
    } finally {
      await runtime.close();
    }
  });

  it("returns llm_timeout when the LLM provider request is aborted", async () => {
    const root = await temporaryRoot();
    process.env.METRIC_ATLAS_LLM_API_KEY = "sk-runtime";
    globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const requestUrl = String(url);
      if (requestUrl.startsWith("http://")) {
        return originalFetch(url, init);
      }
      const error = new Error("operation timed out");
      error.name = "TimeoutError";
      throw error;
    }) as typeof fetch;

    const runtime = await serveRuntime({ root, port: 0 });
    try {
      const response = await fetch(`http://${runtime.host}:${runtime.port}/__metric-atlas/api/llm/generate`, {
        method: "POST",
        body: JSON.stringify({
          question: "구매 클릭은?",
          candidates: [{ eventKey: "ga4:purchase_click", eventName: "purchase_click", provider: "ga4" }],
        }),
      });
      const body = await response.json();

      expect(response.status).toBe(504);
      expect(body.error.code).toBe("llm_timeout");
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

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}
