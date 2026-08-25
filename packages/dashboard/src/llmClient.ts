import type { AnalysisType, JoinedRow } from "./types";

export interface LlmCandidatePayload {
  eventKey: string;
  eventName: string;
  provider: string;
  emitter?: string | undefined;
  parameters?: string[] | undefined;
  sourceFile?: string | undefined;
}

export interface LlmRequestPayload {
  question: string;
  analysisType: AnalysisType;
  candidates: LlmCandidatePayload[];
}

export interface LlmSuccess {
  provider: string;
  model: string;
  content: string;
}

export type LlmProvider = "openai" | "anthropic";

/**
 * BYOK 세션 키 (docs/contract-inputs/d-runtime-auth-deployment-options.md #7 허용 조건).
 * React state 등 메모리에만 존재해야 하며 localStorage/sessionStorage에 저장하지 않는다.
 */
export interface BrowserLlmKey {
  provider: LlmProvider;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export const LLM_PROVIDER_DEFAULTS: Record<LlmProvider, { baseUrl: string; model: string; label: string }> = {
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini", label: "OpenAI" },
  anthropic: { baseUrl: "https://api.anthropic.com/v1", model: "claude-haiku-4-5-20251001", label: "Anthropic (Claude)" }
};

const ANTHROPIC_API_VERSION = "2023-06-01";

const SYSTEM_PROMPT =
  "You help marketers understand analytics events. Use only the supplied event metadata. Do not ask for credentials or source code. Reply in Korean.";

export function toLlmCandidates(rows: JoinedRow[]): LlmCandidatePayload[] {
  return rows.map((row) => ({
    eventKey: row.eventKey,
    eventName: row.eventName,
    provider: row.event?.analyticsProvider ?? "unknown",
    emitter: row.event?.emitter,
    parameters: row.event?.parameters ?? [],
    sourceFile: row.event?.source.file
  }));
}

export class LlmRequestError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** Runtime relay path (기본값): 브라우저 -> 이 프로젝트의 Node Runtime -> LLM. 키는 서버 환경변수에만 있다. */
export async function callRuntimeLlm(
  payload: LlmRequestPayload,
  fetcher: typeof fetch = fetch
): Promise<LlmSuccess> {
  const response = await fetcher("/__metric-atlas/api/llm/generate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    throw new LlmRequestError(error?.code ?? `http_${response.status}`, error?.message ?? "LLM 요청이 실패했습니다.");
  }
  const parsed = body as { provider?: string; model?: string; content?: string } | null;
  return {
    provider: parsed?.provider ?? "openai-compatible",
    model: parsed?.model ?? "unknown",
    content: parsed?.content || "LLM이 빈 응답을 반환했습니다."
  };
}

/**
 * BYOK 직접 호출 경로. 서버(Runtime)를 거치지 않고 이 브라우저에서 곧바로 provider의
 * 엔드포인트로 요청을 보낸다 — 방문자의 개인 키가 우리 Runtime을 절대 거치지 않는다.
 * docs/contract-inputs/d-runtime-auth-deployment-options.md #7에서 허용한 형태 그대로:
 * 키는 호출자가 넘겨준 메모리 값일 뿐이며 이 함수는 그 값을 어디에도 저장하지 않는다.
 */
export async function callDirectLlm(
  payload: LlmRequestPayload,
  key: BrowserLlmKey,
  fetcher: typeof fetch = fetch
): Promise<LlmSuccess> {
  const defaults = LLM_PROVIDER_DEFAULTS[key.provider];
  const baseUrl = key.baseUrl.trim().replace(/\/+$/, "") || defaults.baseUrl;
  const model = key.model.trim() || defaults.model;

  return key.provider === "anthropic"
    ? callAnthropicDirect(payload, key.apiKey, baseUrl, model, fetcher)
    : callOpenAiDirect(payload, key.apiKey, baseUrl, model, fetcher);
}

async function callOpenAiDirect(
  payload: LlmRequestPayload,
  apiKey: string,
  baseUrl: string,
  model: string,
  fetcher: typeof fetch
): Promise<LlmSuccess> {
  let response: Response;
  try {
    response = await fetcher(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(buildOpenAiChatBody(payload, model))
    });
  } catch (error) {
    throw new LlmRequestError("browser_llm_unreachable", error instanceof Error ? error.message : String(error));
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new LlmRequestError(`llm_upstream_${response.status}`, extractUpstreamError(body) ?? `LLM provider returned ${response.status}`);
  }
  return { provider: "openai", model, content: extractChatContent(body) || "LLM이 빈 응답을 반환했습니다." };
}

async function callAnthropicDirect(
  payload: LlmRequestPayload,
  apiKey: string,
  baseUrl: string,
  model: string,
  fetcher: typeof fetch
): Promise<LlmSuccess> {
  let response: Response;
  try {
    response = await fetcher(`${baseUrl}/messages`, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_API_VERSION,
        "content-type": "application/json",
        // Anthropic's API refuses cross-origin requests unless this header opts in --
        // it exists specifically for client-side/BYOK use like this one.
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify(buildAnthropicMessageBody(payload, model))
    });
  } catch (error) {
    throw new LlmRequestError("browser_llm_unreachable", error instanceof Error ? error.message : String(error));
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new LlmRequestError(`llm_upstream_${response.status}`, extractUpstreamError(body) ?? `LLM provider returned ${response.status}`);
  }
  return { provider: "anthropic", model, content: extractAnthropicContent(body) || "LLM이 빈 응답을 반환했습니다." };
}

export function buildOpenAiChatBody(payload: LlmRequestPayload, model: string) {
  return {
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(payload) }
    ]
  };
}

export function buildAnthropicMessageBody(payload: LlmRequestPayload, model: string) {
  return {
    model,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: JSON.stringify(payload) }]
  };
}

export function extractChatContent(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const choices = (value as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) return "";
  const first = choices[0];
  if (!first || typeof first !== "object") return "";
  const message = (first as { message?: unknown }).message;
  if (!message || typeof message !== "object") return "";
  const content = (message as { content?: unknown }).content;
  return typeof content === "string" ? content : "";
}

export function extractAnthropicContent(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const content = (value as { content?: unknown }).content;
  if (!Array.isArray(content)) return "";
  const textBlock = content.find(
    (block): block is { type: "text"; text: string } =>
      Boolean(block) && typeof block === "object" && (block as { type?: unknown }).type === "text"
  );
  return textBlock ? textBlock.text : "";
}

export function extractUpstreamError(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const error = (value as { error?: unknown }).error;
  if (!error || typeof error !== "object") return null;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
}
