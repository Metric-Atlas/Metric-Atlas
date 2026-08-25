import { describe, expect, it } from "vitest";
import {
  callDirectLlm,
  callRuntimeLlm,
  DEFAULT_BROWSER_LLM_BASE_URL,
  DEFAULT_BROWSER_LLM_MODEL,
  extractChatContent,
  LlmRequestError,
  toLlmCandidates
} from "../src/llmClient";
import { joinRows } from "../src/data";

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

describe("toLlmCandidates", () => {
  it("maps a JoinedRow into the payload shape the LLM route expects", () => {
    const row = joinRows().find((r) => r.eventKey === "ga4:purchase_click")!;
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
    ).rejects.toMatchObject({ code: "missing_llm_api_key", message: "키가 없습니다." });
  });
});

describe("callDirectLlm (BYOK path, browser -> LLM directly)", () => {
  it("calls the given base URL directly with the visitor's key, bypassing the runtime route entirely", async () => {
    let capturedUrl: string | null = null;
    let capturedHeaders: HeadersInit | undefined;
    const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedHeaders = init?.headers;
      return jsonResponse({ choices: [{ message: { content: "직접 호출 응답" } }] });
    }) as typeof fetch;

    const result = await callDirectLlm(
      { question: "구매 클릭은?", analysisType: "event_count", candidates: [] },
      { apiKey: "sk-visitor", baseUrl: "https://llm.example.test/v1", model: "custom-model" },
      fetcher
    );

    expect(capturedUrl).toBe("https://llm.example.test/v1/chat/completions");
    expect(capturedHeaders).toMatchObject({ authorization: "Bearer sk-visitor" });
    expect(result).toEqual({ provider: "browser-byok", model: "custom-model", content: "직접 호출 응답" });
  });

  it("falls back to the default OpenAI base URL and model when left blank", async () => {
    let capturedUrl: string | null = null;
    let capturedBody: { model?: string } = {};
    const fetcher = (async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedBody = JSON.parse(String(init?.body));
      return jsonResponse({ choices: [{ message: { content: "ok" } }] });
    }) as typeof fetch;

    await callDirectLlm(
      { question: "q", analysisType: "event_count", candidates: [] },
      { apiKey: "sk-visitor", baseUrl: "", model: "" },
      fetcher
    );

    expect(capturedUrl).toBe(`${DEFAULT_BROWSER_LLM_BASE_URL}/chat/completions`);
    expect(capturedBody.model).toBe(DEFAULT_BROWSER_LLM_MODEL);
  });

  it("throws LlmRequestError when the upstream provider rejects the request", async () => {
    const fetcher = (async () => jsonResponse({ error: { message: "invalid api key" } }, 401)) as typeof fetch;

    await expect(
      callDirectLlm(
        { question: "q", analysisType: "event_count", candidates: [] },
        { apiKey: "sk-bad", baseUrl: "", model: "" },
        fetcher
      )
    ).rejects.toBeInstanceOf(LlmRequestError);
  });
});
