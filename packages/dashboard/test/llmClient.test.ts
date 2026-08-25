import { describe, expect, it } from "vitest";
import {
  callRuntimeLlm,
  extractAnthropicContent,
  extractChatContent,
  friendlyLlmError,
  LlmRequestError,
  toLlmCandidates
} from "../src/llmClient";
import type { JoinedRow } from "../src/types";

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

describe("extractChatContent", () => {
  it("reads choices[0].message.content from an openai-compatible response", () => {
    expect(extractChatContent({ choices: [{ message: { content: "hello" } }] })).toBe("hello");
  });

  it("returns an empty string for shapes it cannot parse", () => {
    expect(extractChatContent(null)).toBe("");
    expect(extractChatContent({})).toBe("");
    expect(extractChatContent({ choices: [] })).toBe("");
  });
});

describe("extractAnthropicContent", () => {
  it("reads the first text block from an Anthropic Messages response", () => {
    expect(extractAnthropicContent({ content: [{ type: "text", text: "hello" }] })).toBe("hello");
  });

  it("returns an empty string for shapes it cannot parse", () => {
    expect(extractAnthropicContent(null)).toBe("");
    expect(extractAnthropicContent({})).toBe("");
    expect(extractAnthropicContent({ content: [] })).toBe("");
    expect(extractAnthropicContent({ content: [{ type: "tool_use" }] })).toBe("");
  });
});

describe("toLlmCandidates", () => {
  it("maps a JoinedRow into the payload shape the LLM route expects", () => {
    const row: JoinedRow = {
      eventKey: "ga4:purchase_click",
      eventName: "purchase_click",
      event: {
        eventKey: "ga4:purchase_click",
        implementationKey: "impl_purchase",
        eventName: "purchase_click",
        emitter: "ga4",
        analyticsProvider: "ga4",
        providerDetectionConfidence: "provider_exact",
        parameters: ["location"],
        source: { file: "src/Button.tsx", line: 10, column: 5 },
        bindings: [],
        overlaySupported: true,
        warnings: []
      },
      health: null,
      bindings: [],
      bucket: "noHealth",
      gtmRoute: null
    };
    const [candidate] = toLlmCandidates([row]);
    if (!candidate) throw new Error("expected one candidate");
    expect(candidate.eventKey).toBe("ga4:purchase_click");
    expect(candidate.eventName).toBe(row.eventName);
    expect(candidate.provider).toBe(row.event?.analyticsProvider);
  });
});

describe("callRuntimeLlm (server relay path)", () => {
  it("posts to the runtime route and returns provider/model/content", async () => {
    let capturedUrl: string | null = null;
    let capturedBody: unknown = null;
    const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedBody = JSON.parse(String(init?.body));
      return jsonResponse({ provider: "openai-compatible", model: "gpt-4o-mini", content: "설명입니다." });
    }) as typeof fetch;

    const result = await callRuntimeLlm({ question: "구매 클릭은?", analysisType: "event_count", candidates: [] }, fetcher);

    expect(capturedUrl).toBe("/__metric-atlas/api/llm/generate");
    expect(capturedBody).toMatchObject({ question: "구매 클릭은?" });
    expect(result).toEqual({ provider: "openai-compatible", model: "gpt-4o-mini", content: "설명입니다." });
  });

  it("throws LlmRequestError with the server's error code on failure", async () => {
    const fetcher = (async () => jsonResponse({ error: { code: "missing_llm_api_key", message: "키가 없습니다." } }, 400)) as typeof fetch;

    await expect(
      callRuntimeLlm({ question: "q", analysisType: "event_count", candidates: [] }, fetcher)
    ).rejects.toMatchObject({
      code: "missing_llm_api_key",
      message: expect.stringContaining("Runtime에 LLM API 키가 설정되어 있지 않습니다")
    });
  });

  it("maps network failures to a Korean runtime unavailable message", async () => {
    const fetcher = (async () => {
      throw new Error("Failed to fetch");
    }) as typeof fetch;
    await expect(
      callRuntimeLlm({ question: "q", analysisType: "event_count", candidates: [] }, fetcher)
    ).rejects.toMatchObject({
      code: "runtime_unavailable",
      message: expect.stringContaining("Metric Atlas Runtime에 연결할 수 없습니다")
    });
  });
});

describe("friendlyLlmError", () => {
  it("maps upstream and timeout errors to user-facing Korean messages", () => {
    expect(friendlyLlmError("llm_timeout")).toContain("제한 시간");
    expect(friendlyLlmError("llm_upstream_error", "invalid api key")).toContain("API 키");
    expect(friendlyLlmError("llm_network_error", "ENOTFOUND")).toContain("연결하지 못했습니다");
  });
});
