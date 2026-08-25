#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import path from "node:path";
import {
  EventManifest as EventManifestSchema,
  type EventManifest,
} from "@metric-atlas/contracts";
import {
  isDetectorAdapterName,
  scanGitRef,
  scanProject,
  type DetectorAdapterName,
  type ScanProjectOptions,
} from "@metric-atlas/detector";
import { serveRuntime } from "@metric-atlas/runtime";
import { diffManifests, formatMarkdownReport } from "./diff.js";

interface ParsedArguments {
  command: "scan" | "diff" | "report" | "serve" | "init-env" | "set-llm-key" | "help";
  positionals: string[];
  values: Map<string, string[]>;
}

export async function runCli(argv: string[]): Promise<number> {
  const args = parseArguments(argv);
  if (args.command === "help") {
    process.stdout.write(helpText());
    return 0;
  }
  if (args.command === "scan") return runScan(args.values);
  if (args.command === "diff") return runDiff(args.values);
  if (args.command === "report") return runReport(args.values);
  if (args.command === "init-env") return runInitEnv(args.values);
  if (args.command === "set-llm-key") return runSetLlmKey(args.values);
  return runServe(args.positionals, args.values);
}

async function runScan(values: Map<string, string[]>): Promise<number> {
  const root = first(values, "root") ?? process.cwd();
  const options: ScanProjectOptions = { root };
  const include = all(values, "include");
  const exclude = all(values, "exclude");
  const buildId = first(values, "build-id");
  const detectors = parseDetectors(commaList(values, "detectors"));
  if (include.length) options.include = include;
  if (exclude.length) options.exclude = exclude;
  if (buildId) options.buildId = buildId;
  if (detectors.length) options.detectors = detectors;
  const result = await scanProject(options);
  const output = `${JSON.stringify(result.manifest, null, 2)}\n`;
  const outputFile = first(values, "output") ?? ".metric-atlas/manifest.json";
  if (values.has("stdout")) {
    process.stdout.write(output);
  } else {
    await writeOutput(path.resolve(root, outputFile), output);
    process.stderr.write(
      `[metric-atlas] wrote ${result.manifest.events.length} events to ${outputFile}\n`,
    );
  }
  return result.manifest.warnings.some((warning) => warning.code === "PARSE_ERROR")
    ? 2
    : 0;
}

async function runDiff(values: Map<string, string[]>): Promise<number> {
  const baseFile = required(values, "base");
  const headFile = required(values, "head");
  const [base, head] = await Promise.all([
    readManifest(baseFile),
    readManifest(headFile),
  ]);
  const diff = diffManifests(base, head);
  const format = first(values, "format") ?? "markdown";
  if (format !== "markdown" && format !== "json") {
    throw new Error(`Unsupported diff format: ${format}`);
  }
  const output =
    format === "json"
      ? `${JSON.stringify(diff, null, 2)}\n`
      : formatMarkdownReport(diff);
  const outputFile = first(values, "output");
  if (outputFile) await writeOutput(path.resolve(outputFile), output);
  else process.stdout.write(output);
  return 0;
}

async function runReport(values: Map<string, string[]>): Promise<number> {
  const root = path.resolve(first(values, "root") ?? process.cwd());
  const baseRef = required(values, "base-ref");
  const headRef = required(values, "head-ref");
  const detectors = parseDetectors(commaList(values, "detectors"));
  const include = all(values, "include");
  const exclude = all(values, "exclude");
  const sharedOptions = {
    root,
    ...(detectors.length ? { detectors } : {}),
    ...(include.length ? { include } : {}),
    ...(exclude.length ? { exclude } : {}),
  };
  const [base, head] = await Promise.all([
    scanGitRef({ ...sharedOptions, ref: baseRef }),
    scanGitRef({ ...sharedOptions, ref: headRef }),
  ]);
  const diff = diffManifests(base.manifest, head.manifest);
  const format = first(values, "format") ?? "markdown";
  if (format !== "markdown" && format !== "json") {
    throw new Error(`Unsupported report format: ${format}`);
  }
  const output =
    format === "json"
      ? `${JSON.stringify(diff, null, 2)}\n`
      : formatMarkdownReport(diff);
  const outputFile = first(values, "output");
  if (outputFile) await writeOutput(path.resolve(outputFile), output);
  else process.stdout.write(output);

  const manifestDirectory = first(values, "manifest-dir");
  if (manifestDirectory) {
    const directory = path.resolve(manifestDirectory);
    await Promise.all([
      writeOutput(
        path.join(directory, "base-manifest.json"),
        `${JSON.stringify(base.manifest, null, 2)}\n`,
      ),
      writeOutput(
        path.join(directory, "head-manifest.json"),
        `${JSON.stringify(head.manifest, null, 2)}\n`,
      ),
    ]);
  }

  const hasParseError = [...base.manifest.warnings, ...head.manifest.warnings].some(
    (warning) => warning.code === "PARSE_ERROR",
  );
  return values.has("fail-on-parse-error") && hasParseError ? 2 : 0;
}

async function runServe(positionals: string[], values: Map<string, string[]>): Promise<number> {
  const root = path.resolve(positionals[0] ?? first(values, "root") ?? process.cwd());
  const envFile = first(values, "env");
  const host = first(values, "host");
  const port = optionalPort(first(values, "port"));
  const dashboardPath = first(values, "dashboard-path");
  const options = {
    root,
    ...(envFile ? { envFile } : {}),
    ...(host ? { host } : {}),
    ...(port ? { port } : {}),
    ...(dashboardPath ? { dashboardPath } : {}),
  };
  const runtime = await serveRuntime(options);
  process.stderr.write(
    `[metric-atlas] serving ${root} at http://${runtime.host}:${runtime.port}\n`,
  );
  await new Promise<void>(() => {});
  return 0;
}

async function runInitEnv(values: Map<string, string[]>): Promise<number> {
  const outputFile = path.resolve(first(values, "output") ?? ".env.metric-atlas");
  if (!values.has("force") && await fileExists(outputFile)) {
    throw new Error(`Refusing to overwrite ${outputFile}. Pass --force to replace it.`);
  }

  const llmApiKeyEnv = first(values, "llm-api-key-env");
  const llmApiKey = llmApiKeyEnv ? process.env[llmApiKeyEnv] : "";
  if (llmApiKeyEnv && !llmApiKey) {
    throw new Error(`Environment variable ${llmApiKeyEnv} is empty or not set.`);
  }

  const lines = [
    "# Metric Atlas Runtime env",
    "# Keep this file out of Git. It is read by: metric-atlas serve --env ./.env.metric-atlas",
    "",
    "# GA4 Health",
    `METRIC_ATLAS_GA4_PROPERTY_ID=${first(values, "ga4-property-id") ?? ""}`,
    `GOOGLE_APPLICATION_CREDENTIALS=${first(values, "google-application-credentials") ?? ""}`,
    "METRIC_ATLAS_GA4_HEALTH_WINDOW_DAYS=30",
    "METRIC_ATLAS_GA4_RECENT_WINDOW_HOURS=48",
    "METRIC_ATLAS_CACHE_TTL_SECONDS=300",
    "",
    "# LLM",
    `METRIC_ATLAS_LLM_PROVIDER=${first(values, "llm-provider") ?? "openrouter"}`,
    `METRIC_ATLAS_LLM_BASE_URL=${first(values, "llm-base-url") ?? "https://openrouter.ai/api/v1"}`,
    `METRIC_ATLAS_LLM_API_KEY=${llmApiKey ?? ""}`,
    `METRIC_ATLAS_LLM_MODEL=${first(values, "llm-model") ?? "openrouter/free"}`,
    "METRIC_ATLAS_LLM_MAX_CANDIDATES=20",
    "METRIC_ATLAS_LLM_TIMEOUT_MS=10000",
    "",
  ];

  await writeOutput(outputFile, `${lines.join("\n")}`);
  process.stderr.write(
    `[metric-atlas] wrote Runtime env template to ${outputFile}\n`,
  );
  if (llmApiKeyEnv) {
    process.stderr.write(
      `[metric-atlas] copied METRIC_ATLAS_LLM_API_KEY from ${llmApiKeyEnv}; key value was not printed\n`,
    );
  }
  return 0;
}

async function runSetLlmKey(values: Map<string, string[]>): Promise<number> {
  const envFile = path.resolve(first(values, "env") ?? ".env.metric-atlas");
  const key = await resolveSecretValue(values, {
    direct: "key",
    env: "key-env",
    stdin: "key-stdin",
    label: "LLM key",
  });
  const updates = new Map<string, string>([
    ["METRIC_ATLAS_LLM_API_KEY", key],
    ["METRIC_ATLAS_LLM_PROVIDER", first(values, "provider") ?? "openrouter"],
    ["METRIC_ATLAS_LLM_BASE_URL", first(values, "base-url") ?? "https://openrouter.ai/api/v1"],
    ["METRIC_ATLAS_LLM_MODEL", first(values, "model") ?? "openrouter/free"],
  ]);

  const existing = await readOptionalText(envFile);
  const next = upsertEnvValues(existing, updates);
  await writeOutput(envFile, next);
  process.stderr.write(
    `[metric-atlas] registered LLM key in ${envFile}; key value was not printed\n`,
  );
  return 0;
}

function parseArguments(argv: string[]): ParsedArguments {
  const commandValue = argv[0];
  if (!commandValue || commandValue === "help" || commandValue === "--help" || commandValue === "-h") {
    return { command: "help", positionals: [], values: new Map() };
  }
  if (
    commandValue !== "scan" &&
    commandValue !== "diff" &&
    commandValue !== "report" &&
    commandValue !== "serve" &&
    commandValue !== "init-env" &&
    commandValue !== "set-llm-key"
  ) {
    throw new Error(`Unknown command: ${commandValue}`);
  }
  const positionals: string[] = [];
  const values = new Map<string, string[]>();
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index]!;
    if (!token.startsWith("--")) {
      if (commandValue !== "serve") throw new Error(`Unexpected argument: ${token}`);
      positionals.push(token);
      continue;
    }
    const [rawKey, inlineValue] = token.slice(2).split("=", 2);
    if (!rawKey) throw new Error(`Invalid option: ${token}`);
    if (
      rawKey === "stdout" ||
      rawKey === "fail-on-parse-error" ||
      rawKey === "force" ||
      rawKey === "key-stdin"
    ) {
      values.set(rawKey, []);
      continue;
    }
    const value = inlineValue ?? argv[++index];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${rawKey}`);
    }
    const existing = values.get(rawKey) ?? [];
    existing.push(value);
    values.set(rawKey, existing);
  }
  return { command: commandValue, positionals, values };
}

function commaList(values: Map<string, string[]>, key: string): string[] {
  return (values.get(key) ?? []).flatMap((value) =>
    value.split(",").map((item) => item.trim()).filter(Boolean),
  );
}

function all(values: Map<string, string[]>, key: string): string[] {
  return values.get(key) ?? [];
}

function parseDetectors(values: string[]): DetectorAdapterName[] {
  return values.map((value) => {
    if (!isDetectorAdapterName(value)) {
      throw new Error(`Unsupported detector: ${value}`);
    }
    return value;
  });
}

function first(values: Map<string, string[]>, key: string): string | undefined {
  return values.get(key)?.[0];
}

function required(values: Map<string, string[]>, key: string): string {
  const value = first(values, key);
  if (!value) throw new Error(`Missing required --${key}`);
  return value;
}

function optionalPort(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid --port: ${value}`);
  }
  return port;
}

async function readManifest(file: string): Promise<EventManifest> {
  const value: unknown = JSON.parse(await readFile(path.resolve(file), "utf8"));
  const parsed = EventManifestSchema.safeParse(value);
  if (!parsed.success) throw new Error(`Invalid Event Manifest: ${file}`);
  return parsed.data;
}

async function writeOutput(file: string, contents: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, contents, "utf8");
}

async function readOptionalText(file: string): Promise<string> {
  try {
    return await readFile(file, "utf8");
  } catch {
    return "";
  }
}

async function fileExists(file: string): Promise<boolean> {
  try {
    await readFile(file);
    return true;
  } catch {
    return false;
  }
}

async function resolveSecretValue(
  values: Map<string, string[]>,
  keys: { direct: string; env: string; stdin: string; label: string },
): Promise<string> {
  const sources = [values.has(keys.direct), values.has(keys.env), values.has(keys.stdin)].filter(Boolean).length;
  if (sources !== 1) {
    throw new Error(`Pass exactly one of --${keys.direct}, --${keys.env}, or --${keys.stdin}.`);
  }
  const value = values.has(keys.direct)
    ? first(values, keys.direct)
    : values.has(keys.env)
      ? process.env[required(values, keys.env)]
      : await readStdin();
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`${keys.label} is empty.`);
  return trimmed;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function upsertEnvValues(contents: string, updates: Map<string, string>): string {
  const seen = new Set<string>();
  const lines = contents ? contents.split(/\r?\n/) : [];
  const next = lines.map((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=/);
    const key = match?.[1];
    if (!key || !updates.has(key)) return line;
    seen.add(key);
    return `${key}=${updates.get(key) ?? ""}`;
  });
  for (const [key, value] of updates) {
    if (!seen.has(key)) next.push(`${key}=${value}`);
  }
  return `${next.filter((line, index) => line !== "" || index < next.length - 1).join("\n")}\n`;
}

function helpText(): string {
  return `Metric Atlas scanner and manifest diff

Usage:
  metric-atlas scan [--root DIR] [--include GLOB] [--exclude GLOB] [--detectors ga4,gtm,...] [--build-id ID] [--output FILE | --stdout]
  metric-atlas diff --base FILE --head FILE [--format markdown|json] [--output FILE]
  metric-atlas report --base-ref REF --head-ref REF [--root DIR] [--detectors ga4,gtm,...] [--format markdown|json] [--output FILE] [--manifest-dir DIR] [--fail-on-parse-error]
  metric-atlas init-env [--output FILE] [--force] [--ga4-property-id ID] [--google-application-credentials FILE] [--llm-provider openrouter] [--llm-base-url URL] [--llm-model MODEL] [--llm-api-key-env ENV_VAR]
  metric-atlas set-llm-key [--env FILE] (--key VALUE | --key-env ENV_VAR | --key-stdin) [--provider openrouter] [--base-url URL] [--model MODEL]
  metric-atlas serve [DIST_DIR] [--host HOST] [--port PORT] [--env FILE] [--dashboard-path PATH]

The scanner reads source files and writes only the requested manifest output. It never modifies source files.
The local runtime serves built assets, /__metric-atlas/api/*, and the bundled Analytics Health Dashboard
(default --dashboard-path /__metric-atlas/dashboard, ADR-009) without exposing credentials to the browser bundle.
Use init-env to create a local Runtime env file. Prefer --llm-api-key-env over passing secrets directly in shell history.
Use set-llm-key to register or rotate the Runtime LLM key in a local env file. Prefer --key-stdin or --key-env when possible.
`;
}

runCli(process.argv.slice(2)).then(
  (exitCode) => {
    process.exitCode = exitCode;
  },
  (error: unknown) => {
    process.stderr.write(
      `[metric-atlas] ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  },
);
