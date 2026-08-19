import { createReadStream } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import path from "node:path";

export interface RuntimeOptions {
  root: string;
  envFile?: string;
  host?: string;
  port?: number;
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
}

export async function serveRuntime(options: RuntimeOptions): Promise<RuntimeServer> {
  if (options.envFile) {
    await loadEnvFile(options.envFile);
  }
  const config = resolveConfig(options);
  const server = createRuntimeServer(config.root);

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

export function createRuntimeServer(root: string) {
  const resolvedRoot = path.resolve(root);
  return createServer(async (request, response) => {
    try {
      await routeRequest(request, response, resolvedRoot);
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
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://metric-atlas.local");
  if (url.pathname === "/__metric-atlas/api/runtime-health" && request.method === "GET") {
    sendJson(response, 200, runtimeHealth(root));
    return;
  }

  if (url.pathname === "/__metric-atlas/api/health" && request.method === "GET") {
    await sendHealth(response, root);
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

  const baseUrl = trimTrailingSlash(envValue("METRIC_ATLAS_LLM_BASE_URL") ?? "https://api.openai.com/v1");
  const model = envValue("METRIC_ATLAS_LLM_MODEL") ?? "gpt-4o-mini";
  const timeoutMs = parsePositiveInteger(process.env.METRIC_ATLAS_LLM_TIMEOUT_MS, 10_000);
  const upstream = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You help marketers understand analytics events. Use only the supplied event metadata. Do not ask for credentials or source code. Reply in Korean.",
        },
        {
          role: "user",
          content: JSON.stringify({
            question: body.question,
            analysisType: body.analysisType ?? "unknown",
            candidates,
          }),
        },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

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

  sendJson(response, 200, {
    provider: envValue("METRIC_ATLAS_LLM_PROVIDER") ?? "openai-compatible",
    model,
    content: extractChatContent(upstreamBody),
  });
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
  if (!message || typeof message !== "object") return "";
  const content = (message as { content?: unknown }).content;
  return typeof content === "string" ? content : "";
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
  };
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

async function sendHealth(response: ServerResponse, root: string): Promise<void> {
  await sendJsonFile(response, [
    path.join(root, ".metric-atlas", "health.json"),
    path.join(root, "health.json"),
  ], "health_not_found", "Expected .metric-atlas/health.json or health.json under the served root.");
}

async function sendJsonFile(
  response: ServerResponse,
  candidates: string[],
  code: string,
  message: string,
): Promise<void> {
  for (const file of candidates) {
    try {
      const contents = await readFile(file, "utf8");
      sendJson(response, 200, JSON.parse(contents));
      return;
    } catch {
      // Try the next conventional runtime artifact location.
    }
  }
  sendJson(response, 404, { error: { code, message } });
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
