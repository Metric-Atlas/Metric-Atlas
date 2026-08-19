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
    sendJson(response, 501, {
      error: {
        code: "llm_adapter_not_implemented",
        message:
          "LLM generation is reserved for a runtime adapter PR. Keep API keys in the Node Runtime, not in the browser.",
      },
    });
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
