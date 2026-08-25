import { createReadStream } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createLiveHealthProvider,
  HealthLiveError,
  type LiveHealthProvider,
} from "./health-live.js";

/** ADR-009: Analytics Health Dashboard (packages/dashboard) default mount path. */
export const DEFAULT_DASHBOARD_PATH = "/__metric-atlas/dashboard";

export interface RuntimeOptions {
  root: string;
  envFile?: string;
  host?: string;
  port?: number;
  /** ADR-009: path the bundled Analytics Health Dashboard is served from. Defaults to "/__metric-atlas/dashboard". */
  dashboardPath?: string;
  /**
   * C-003: 라이브 GA4 Health provider. undefined면 process.env로 자동 구성
   * (GA4 미설정 시 자동으로 비활성), null이면 명시적으로 정적 파일만 서빙.
   */
  healthProvider?: LiveHealthProvider | null;
}

export interface RuntimeHealth {
  ok: true;
  mode: "local-node-runtime";
  root: string;
  credentials: {
    ga4PropertyId: boolean;
    googleApplicationCredentials: boolean;
    ga4ServiceAccountJsonBase64: boolean;
    llmApiKey: boolean;
  };
}

export interface RuntimeServer {
  close(): Promise<void>;
  port: number;
  host: string;
}

interface LoadedConfig {
  root: string;
  host: string;
  port: number;
  dashboardPath: string;
}

export async function serveRuntime(options: RuntimeOptions): Promise<RuntimeServer> {
  if (options.envFile) {
    await loadEnvFile(options.envFile);
  }
  const config = resolveConfig(options);
  const healthProvider =
    options.healthProvider !== undefined
      ? options.healthProvider
      : createLiveHealthProvider({
          env: process.env,
          loadManifest: () => loadManifestArtifact(config.root),
        });
  const server = createRuntimeServer(config.root, {
    healthProvider,
    dashboardPath: config.dashboardPath,
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, () => {
      server.off("error", reject);
      resolve();
    });
  });

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : config.port;
  return {
    host: config.host,
    port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

export interface RuntimeServerDeps {
  healthProvider?: LiveHealthProvider | null;
  /** ADR-009: defaults to DEFAULT_DASHBOARD_PATH. */
  dashboardPath?: string;
  /** Test-only seam; defaults to the dashboard assets bundled next to this compiled file. */
  dashboardAssetsDir?: string;
}

export function createRuntimeServer(root: string, deps: RuntimeServerDeps = {}) {
  const resolvedRoot = path.resolve(root);
  const dashboardPath = normalizeDashboardPath(deps.dashboardPath ?? DEFAULT_DASHBOARD_PATH);
  const dashboardAssetsDir = deps.dashboardAssetsDir ?? resolveDashboardAssetsDir();
  return createServer(async (request, response) => {
    try {
      await routeRequest(request, response, resolvedRoot, {
        ...deps,
        dashboardPath,
        dashboardAssetsDir,
      });
    } catch (error) {
      sendJson(response, 500, {
        error: {
          code: "runtime_error",
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  });
}

export async function loadEnvFile(file: string): Promise<void> {
  const contents = await readFile(path.resolve(file), "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const value = unquoteEnvValue(line.slice(separator + 1).trim());
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function routeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  root: string,
  deps: RuntimeServerDeps,
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://metric-atlas.local");
  if (url.pathname === "/__metric-atlas/api/runtime-health" && request.method === "GET") {
    sendJson(response, 200, runtimeHealth(root));
    return;
  }

  if (url.pathname === "/__metric-atlas/api/health" && request.method === "GET") {
    await sendHealth(response, root, deps.healthProvider ?? null);
    return;
  }

  if (url.pathname === "/__metric-atlas/api/manifest" && request.method === "GET") {
    await sendManifest(response, root);
    return;
  }

  if (url.pathname === "/__metric-atlas/api/llm/generate" && request.method === "POST") {
    await generateLlmResponse(request, response);
    return;
  }

  const dashboardPath = deps.dashboardPath ?? DEFAULT_DASHBOARD_PATH;
  if (
    (request.method === "GET" || request.method === "HEAD") &&
    url.pathname === dashboardPath
  ) {
    // The dashboard's own HTML references its JS/CSS assets with relative URLs
    // (e.g. "./assets/x.js") so the bundle works under any --dashboard-path.
    // A browser resolves "./assets/x.js" against the *directory* of the current
    // URL — without a trailing slash here, "/a/b" is treated as a file inside
    // directory "/a", so the request goes out as "/a/x.js" instead of
    // "/a/b/x.js" and 404s (or worse, falls through to the consumer's own
    // index.html, which is what a "MIME type text/html" module-script error
    // means). Redirect to the trailing-slash form so relative resolution works.
    response.writeHead(302, { location: `${url.pathname}/${url.search}` });
    response.end();
    return;
  }
  if (
    (request.method === "GET" || request.method === "HEAD") &&
    url.pathname.startsWith(`${dashboardPath}/`)
  ) {
    await sendDashboardAsset(
      response,
      deps.dashboardAssetsDir ?? resolveDashboardAssetsDir(),
      dashboardPath,
      url.pathname,
      request.method === "HEAD",
    );
    return;
  }

  if (request.method === "GET" || request.method === "HEAD") {
    await sendStaticAsset(response, root, url.pathname, request.method === "HEAD");
    return;
  }

  sendJson(response, 404, {
    error: { code: "not_found", message: `No runtime route for ${request.method} ${url.pathname}` },
  });
}

interface LlmCandidate {
  eventKey: string;
  eventName: string;
  provider: string;
  emitter?: string;
  parameters?: string[];
  sourceFile?: string;
  healthBucket?: string;
  codeState?: string;
  ga4ObservationState?: string;
  ga4ManagedState?: string;
  latestResultStatus?: string;
  latestValue?: number;
  qualityFlags?: string[];
  missingCustomDimensions?: string[];
  reviewReason?: string | null;
}

interface LlmGenerateRequest {
  question?: string;
  analysisType?: string;
  candidates?: LlmCandidate[];
}

async function generateLlmResponse(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  const apiKey = envValue("METRIC_ATLAS_LLM_API_KEY") ?? envValue("OPENAI_API_KEY");
  if (!apiKey) {
    sendJson(response, 400, {
      error: {
        code: "missing_llm_api_key",
        message: "Set METRIC_ATLAS_LLM_API_KEY or OPENAI_API_KEY in the Node Runtime environment.",
      },
    });
    return;
  }

  const body = await readJsonBody<LlmGenerateRequest>(request);
  const candidates = (body.candidates ?? []).slice(0, llmMaxCandidates());
  if (!body.question || candidates.length === 0) {
    sendJson(response, 400, {
      error: {
        code: "invalid_llm_request",
        message: "LLM generation requires a question and at least one candidate event.",
      },
    });
    return;
  }

  const provider = envValue("METRIC_ATLAS_LLM_PROVIDER") === "anthropic" ? "anthropic" : "openai";
  const defaults = LLM_PROVIDER_DEFAULTS[provider];
  const baseUrl = trimTrailingSlash(envValue("METRIC_ATLAS_LLM_BASE_URL") ?? defaults.baseUrl);
  const model = envValue("METRIC_ATLAS_LLM_MODEL") ?? defaults.model;
  const timeoutMs = parsePositiveInteger(process.env.METRIC_ATLAS_LLM_TIMEOUT_MS, 10_000);
  const question = {
    question: body.question,
    analysisType: body.analysisType ?? "unknown",
    candidates,
  };

  let upstream: Response;
  try {
    upstream =
      provider === "anthropic"
        ? await fetch(`${baseUrl}/messages`, {
            method: "POST",
            headers: {
              "x-api-key": apiKey,
              "anthropic-version": ANTHROPIC_API_VERSION,
              "content-type": "application/json",
            },
            body: JSON.stringify(buildAnthropicMessageBody(question, model)),
            signal: AbortSignal.timeout(timeoutMs),
          })
        : await fetch(`${baseUrl}/chat/completions`, {
            method: "POST",
            headers: {
              authorization: `Bearer ${apiKey}`,
              "content-type": "application/json",
            },
            body: JSON.stringify(buildOpenAiChatBody(question, model)),
            signal: AbortSignal.timeout(timeoutMs),
          });
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "";
    const timeout = errorName === "TimeoutError" || errorName === "AbortError";
    sendJson(response, timeout ? 504 : 502, {
      error: {
        code: timeout ? "llm_timeout" : "llm_network_error",
        message: timeout
          ? `LLM provider did not respond within ${timeoutMs}ms.`
          : error instanceof Error
            ? error.message
            : String(error),
      },
    });
    return;
  }

  const upstreamBody: unknown = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    sendJson(response, upstream.status, {
      error: {
        code: "llm_upstream_error",
        message: extractUpstreamError(upstreamBody) ?? `LLM provider returned ${upstream.status}`,
      },
    });
    return;
  }

  const content = provider === "anthropic" ? extractAnthropicContent(upstreamBody) : extractChatContent(upstreamBody);
  if (!content.trim()) {
    sendJson(response, 502, {
      error: {
        code: "llm_empty_response",
        message: "LLM provider returned a successful response without text content.",
      },
    });
    return;
  }

  sendJson(response, 200, {
    provider,
    model,
    content,
  });
}

const LLM_SYSTEM_PROMPT =
  [
    "You help marketers understand analytics events.",
    "Use only the supplied event metadata and Analytics Health fields.",
    "Do not ask for credentials or source code.",
    "Never claim that an event is collected, healthy, or needs no setup unless ga4ObservationState is observed and latestResultStatus is ok.",
    "If Health fields are missing, unknown, no_rows, unauthorized, unsupported, or error, say the result is not proven and explain the next check.",
    "If missingCustomDimensions is not empty, state that GA4 Custom Dimension registration is still needed for reporting.",
    "If missingCustomDimensions is empty, say only that no missing custom dimensions were reported in the supplied data; do not claim that no registration or setup is needed.",
    "Reply in Korean.",
  ].join(" ");

const ANTHROPIC_API_VERSION = "2023-06-01";

const LLM_PROVIDER_DEFAULTS = {
  openai: { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  anthropic: { baseUrl: "https://api.anthropic.com/v1", model: "claude-haiku-4-5-20251001" },
} as const;

function buildOpenAiChatBody(question: unknown, model: string) {
  return {
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: LLM_SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(question) },
    ],
  };
}

function buildAnthropicMessageBody(question: unknown, model: string) {
  return {
    model,
    max_tokens: 1024,
    system: LLM_SYSTEM_PROMPT,
    messages: [{ role: "user", content: JSON.stringify(question) }],
  };
}

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {} as T;
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}

function llmMaxCandidates(): number {
  return parsePositiveInteger(process.env.METRIC_ATLAS_LLM_MAX_CANDIDATES, 20);
}

function envValue(key: string): string | undefined {
  const value = process.env[key]?.trim();
  return value ? value : undefined;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return parsed;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function extractChatContent(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const choices = (value as { choices?: unknown }).choices;
  if (!Array.isArray(choices)) return "";
  const first = choices[0];
  if (!first || typeof first !== "object") return "";
  const message = (first as { message?: unknown }).message;
  const messageContent = message && typeof message === "object" ? textFromContent((message as { content?: unknown }).content) : "";
  if (messageContent) return messageContent;
  const reasoning = message && typeof message === "object" ? (message as { reasoning?: unknown }).reasoning : "";
  if (typeof reasoning === "string" && reasoning.trim()) return reasoning.trim();
  const text = (first as { text?: unknown }).text;
  return typeof text === "string" ? text.trim() : "";
}

function extractAnthropicContent(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const content = (value as { content?: unknown }).content;
  return textFromContent(content);
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

function extractUpstreamError(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const error = (value as { error?: unknown }).error;
  if (!error || typeof error !== "object") return null;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
}

function resolveConfig(options: RuntimeOptions): LoadedConfig {
  return {
    root: path.resolve(options.root),
    host: options.host ?? process.env.METRIC_ATLAS_RUNTIME_HOST ?? "127.0.0.1",
    port: options.port ?? parsePort(process.env.METRIC_ATLAS_RUNTIME_PORT) ?? 8787,
    dashboardPath: normalizeDashboardPath(
      options.dashboardPath ?? process.env.METRIC_ATLAS_DASHBOARD_PATH ?? DEFAULT_DASHBOARD_PATH,
    ),
  };
}

function normalizeDashboardPath(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, "");
  const withLeadingSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (withLeadingSlash === "") {
    throw new Error("--dashboard-path cannot be empty");
  }
  return withLeadingSlash;
}

/**
 * ADR-009: the Analytics Health Dashboard (packages/dashboard) ships bundled next to
 * this compiled file at build time (see scripts/embed-dashboard-in-runtime.mjs), the
 * same vendored-sibling-file pattern ADR-008 uses for the overlay module.
 */
function resolveDashboardAssetsDir(): string {
  return fileURLToPath(new URL("./dashboard", import.meta.url));
}

function runtimeHealth(root: string): RuntimeHealth {
  return {
    ok: true,
    mode: "local-node-runtime",
    root,
    credentials: {
      ga4PropertyId: Boolean(process.env.METRIC_ATLAS_GA4_PROPERTY_ID),
      googleApplicationCredentials: Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS),
      ga4ServiceAccountJsonBase64: Boolean(
        process.env.METRIC_ATLAS_GA4_SERVICE_ACCOUNT_JSON_BASE64,
      ),
      llmApiKey: Boolean(process.env.OPENAI_API_KEY || process.env.METRIC_ATLAS_LLM_API_KEY),
    },
  };
}

async function sendManifest(response: ServerResponse, root: string): Promise<void> {
  await sendJsonFile(response, [
    path.join(root, ".metric-atlas", "manifest.json"),
    path.join(root, "manifest.json"),
  ], "manifest_not_found", "Expected .metric-atlas/manifest.json or manifest.json under the served root.");
}

/**
 * C-003: GA4가 구성된 환경에서는 buildAnalyticsHealthReport 라이브 결과를 서빙한다.
 * 라이브 실패 시 정적 artifact가 있으면 fallback하고, 그것도 없으면 502로 실패
 * 원인을 드러낸다 (조용한 404보다 진단 가능해야 함 — AGENTS.md "미지원 패턴을
 * 조용히 무시" 금지 취지).
 */
async function sendHealth(
  response: ServerResponse,
  root: string,
  healthProvider: LiveHealthProvider | null,
): Promise<void> {
  const staticCandidates = [
    path.join(root, ".metric-atlas", "health.json"),
    path.join(root, "health.json"),
  ];

  if (healthProvider) {
    try {
      sendJson(response, 200, await healthProvider.getHealth());
      return;
    } catch (error) {
      if (await tryServeJsonFile(response, staticCandidates)) return;
      sendJson(response, 502, {
        error: {
          code: error instanceof HealthLiveError ? error.code : "ga4_health_failed",
          message: error instanceof Error ? error.message : String(error),
        },
      });
      return;
    }
  }

  await sendJsonFile(
    response,
    staticCandidates,
    "health_not_found",
    "Expected .metric-atlas/health.json or health.json under the served root.",
  );
}

async function loadManifestArtifact(root: string): Promise<unknown> {
  for (const file of [
    path.join(root, ".metric-atlas", "manifest.json"),
    path.join(root, "manifest.json"),
  ]) {
    try {
      return JSON.parse(await readFile(file, "utf8"));
    } catch {
      // Try the next conventional runtime artifact location.
    }
  }
  return undefined;
}

async function sendJsonFile(
  response: ServerResponse,
  candidates: string[],
  code: string,
  message: string,
): Promise<void> {
  if (await tryServeJsonFile(response, candidates)) return;
  sendJson(response, 404, { error: { code, message } });
}

async function tryServeJsonFile(response: ServerResponse, candidates: string[]): Promise<boolean> {
  for (const file of candidates) {
    try {
      const contents = await readFile(file, "utf8");
      sendJson(response, 200, JSON.parse(contents));
      return true;
    } catch {
      // Try the next conventional runtime artifact location.
    }
  }
  return false;
}

async function sendStaticAsset(
  response: ServerResponse,
  root: string,
  requestPath: string,
  headOnly: boolean,
): Promise<void> {
  const file = safeAssetPath(root, requestPath);
  const fallback = path.join(root, "index.html");
  const selectedFile = (await exists(file)) ? file : fallback;
  if (!(await exists(selectedFile))) {
    sendJson(response, 404, { error: { code: "asset_not_found", message: "Asset not found." } });
    return;
  }

  response.writeHead(200, { "content-type": contentType(selectedFile) });
  if (headOnly) {
    response.end();
    return;
  }
  createReadStream(selectedFile).pipe(response);
}

/** ADR-009: serves packages/dashboard's bundled static assets from under `dashboardPath`. */
async function sendDashboardAsset(
  response: ServerResponse,
  dashboardAssetsDir: string,
  dashboardPath: string,
  requestPath: string,
  headOnly: boolean,
): Promise<void> {
  if (!(await exists(dashboardAssetsDir))) {
    sendJson(response, 404, {
      error: {
        code: "dashboard_not_bundled",
        message:
          "Analytics Health Dashboard assets are not present in this @metric-atlas/runtime install. " +
          "Rebuild with the dashboard assets embedded (scripts/embed-dashboard-in-runtime.mjs) or " +
          "reinstall a version of @metric-atlas/runtime that includes them.",
      },
    });
    return;
  }
  const relativeRequest = requestPath.slice(dashboardPath.length) || "/";
  await sendStaticAsset(response, dashboardAssetsDir, relativeRequest, headOnly);
}

function safeAssetPath(root: string, requestPath: string): string {
  const relative = decodeURIComponent(requestPath).replace(/^\/+/, "") || "index.html";
  const resolved = path.resolve(root, relative);
  if (!resolved.startsWith(`${root}${path.sep}`) && resolved !== root) {
    return path.join(root, "index.html");
  }
  return resolved;
}

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  response.end(`${JSON.stringify(value, null, 2)}\n`);
}

function parsePort(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid METRIC_ATLAS_RUNTIME_PORT: ${value}`);
  }
  return port;
}

function unquoteEnvValue(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function contentType(file: string): string {
  const extension = path.extname(file);
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".js") return "text/javascript; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".json") return "application/json; charset=utf-8";
  if (extension === ".svg") return "image/svg+xml";
  if (extension === ".png") return "image/png";
  return "application/octet-stream";
}
