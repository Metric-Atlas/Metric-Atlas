import type { AnalysisType, JoinedRow } from "./types";

export interface LlmCandidatePayload {
  eventKey: string;
  eventName: string;
  provider: string;
  emitter?: string | undefined;
  parameters?: string[] | undefined;
  sourceFile?: string | undefined;
  healthBucket?: string | undefined;
  codeState?: string | undefined;
  ga4ObservationState?: string | undefined;
  ga4ManagedState?: string | undefined;
  latestResultStatus?: string | undefined;
  latestValue?: number | undefined;
  qualityFlags?: string[] | undefined;
  missingCustomDimensions?: string[] | undefined;
  reviewReason?: string | null | undefined;
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

const SYSTEM_PROMPT =
  "You help marketers understand analytics events. Use only the supplied event metadata and Analytics Health fields. Do not ask for credentials or source code. Never claim that an event is collected, healthy, or needs no setup unless ga4ObservationState is observed and latestResultStatus is ok. If Health fields are missing, unknown, no_rows, unauthorized, unsupported, or error, say the result is not proven and explain the next check. Reply in Korean.";

export function toLlmCandidates(rows: JoinedRow[]): LlmCandidatePayload[] {
  return rows.map((row) => ({
    eventKey: row.eventKey,
    eventName: row.eventName,
    provider: row.event?.analyticsProvider ?? "unknown",
    emitter: row.event?.emitter,
    parameters: row.event?.parameters ?? [],
    sourceFile: row.event?.source.file,
    healthBucket: row.bucket,
    codeState: row.health?.codeState,
    ga4ObservationState: row.health?.ga4ObservationState,
    ga4ManagedState: row.health?.ga4ManagedState,
    latestResultStatus: row.health?.latestMeasurement?.resultStatus,
    latestValue: row.health?.latestMeasurement?.value,
    qualityFlags: row.health?.latestMeasurement?.qualityFlags ?? [],
    missingCustomDimensions: row.health?.parameterRegistrationStates
      .filter((parameter) => parameter.state === "not_registered")
      .map((parameter) => parameter.parameter),
    reviewReason: row.health?.reviewReason
  }));
}

export class LlmRequestError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/** Runtime relay path: 브라우저 -> 이 프로젝트의 Node Runtime -> LLM. 키는 서버 환경변수에만 있다. */
export async function callRuntimeLlm(
  payload: LlmRequestPayload,
  fetcher: typeof fetch = fetch
): Promise<LlmSuccess> {
  let response: Response;
  try {
    response = await fetcher("/__metric-atlas/api/llm/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (error) {
    throw new LlmRequestError("runtime_unavailable", friendlyLlmError("runtime_unavailable", error));
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
    const code = error?.code ?? `http_${response.status}`;
    throw new LlmRequestError(code, friendlyLlmError(code, error?.message));
  }
  const parsed = body as { provider?: string; model?: string; content?: string } | null;
  const content = parsed?.content?.trim() ?? "";
  if (!content) {
    throw new LlmRequestError("llm_empty_response", friendlyLlmError("llm_empty_response"));
  }
  return {
    provider: parsed?.provider ?? "openai-compatible",
    model: parsed?.model ?? "unknown",
    content
  };
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
  for (const choice of choices) {
    if (!choice || typeof choice !== "object") continue;
    const message = (choice as { message?: unknown }).message;
    const delta = (choice as { delta?: unknown }).delta;
    const messageContent = message && typeof message === "object" ? textFromContent((message as { content?: unknown }).content) : "";
    if (messageContent) return messageContent;
    const deltaContent = delta && typeof delta === "object" ? textFromContent((delta as { content?: unknown }).content) : "";
    if (deltaContent) return deltaContent;
    const reasoning = message && typeof message === "object" ? (message as { reasoning?: unknown }).reasoning : "";
    if (typeof reasoning === "string" && reasoning.trim()) return reasoning.trim();
    const text = (choice as { text?: unknown }).text;
    if (typeof text === "string" && text.trim()) return text.trim();
  }
  return "";
}

export function extractAnthropicContent(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const content = (value as { content?: unknown }).content;
  return textFromContent(content);
}

export function extractUpstreamError(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const error = (value as { error?: unknown }).error;
  if (!error || typeof error !== "object") return null;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
}

export function friendlyLlmError(code: string, detail?: unknown): string {
  const suffix = typeof detail === "string" && detail.trim() ? `\n\n원문: ${detail.trim()}` : "";
  if (code === "missing_llm_api_key") {
    return "서버 Runtime에 LLM API 키가 설정되어 있지 않습니다. 배포 환경의 Secret에 METRIC_ATLAS_LLM_API_KEY를 추가한 뒤 다시 배포해주세요.";
  }
  if (code === "invalid_llm_request") {
    return "질문 또는 이벤트 후보가 비어 있어 AI 설명을 만들 수 없습니다. 이벤트 후보를 선택한 뒤 다시 요청해주세요.";
  }
  if (code === "llm_timeout") {
    return "LLM 제공자가 제한 시간 안에 응답하지 않았습니다. 잠시 후 다시 시도하거나 서버의 METRIC_ATLAS_LLM_TIMEOUT_MS 값을 늘려주세요.";
  }
  if (code === "llm_network_error") {
    return `Runtime 서버가 LLM 제공자에 연결하지 못했습니다. 서버 네트워크, BASE URL, provider 설정을 확인해주세요.${suffix}`;
  }
  if (code === "llm_upstream_error" || code.startsWith("llm_upstream_")) {
    return `LLM 제공자가 요청을 거부했습니다. API 키, 모델명, 결제/쿼터 상태를 확인해주세요.${suffix}`;
  }
  if (code === "llm_empty_response") {
    return `AI가 답변 없이 빈 응답을 보냈습니다. 잠시 후 다시 시도하거나, 서버에 설정한 모델 이름과 API 키 상태를 확인해주세요.${suffix}`;
  }
  if (code === "runtime_unavailable") {
    return `Metric Atlas Runtime에 연결할 수 없습니다. Runtime 배포 상태와 /__metric-atlas/api/llm/generate 경로를 확인해주세요.${suffix}`;
  }
  if (code.startsWith("http_")) {
    return `Runtime LLM 요청이 실패했습니다. 상태 코드: ${code.replace("http_", "")}.${suffix}`;
  }
  return `LLM 요청이 실패했습니다.${suffix}`;
}

function textFromContent(content: unknown): string {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      const text = (block as { text?: unknown }).text;
      return typeof text === "string" ? text.trim() : "";
    })
    .filter(Boolean)
    .join("\n");
}
