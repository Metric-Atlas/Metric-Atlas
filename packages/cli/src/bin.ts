#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
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
  command: "scan" | "diff" | "report" | "serve" | "help";
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

function parseArguments(argv: string[]): ParsedArguments {
  const commandValue = argv[0];
  if (!commandValue || commandValue === "help" || commandValue === "--help" || commandValue === "-h") {
    return { command: "help", positionals: [], values: new Map() };
  }
  if (
    commandValue !== "scan" &&
    commandValue !== "diff" &&
    commandValue !== "report" &&
    commandValue !== "serve"
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
    if (rawKey === "stdout" || rawKey === "fail-on-parse-error") {
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

function helpText(): string {
  return `Metric Atlas scanner and manifest diff

Usage:
  metric-atlas scan [--root DIR] [--include GLOB] [--exclude GLOB] [--detectors ga4,gtm,...] [--build-id ID] [--output FILE | --stdout]
  metric-atlas diff --base FILE --head FILE [--format markdown|json] [--output FILE]
  metric-atlas report --base-ref REF --head-ref REF [--root DIR] [--detectors ga4,gtm,...] [--format markdown|json] [--output FILE] [--manifest-dir DIR] [--fail-on-parse-error]
  metric-atlas serve [DIST_DIR] [--host HOST] [--port PORT] [--env FILE] [--dashboard-path PATH]

The scanner reads source files and writes only the requested manifest output. It never modifies source files.
The local runtime serves built assets, /__metric-atlas/api/*, and the bundled Analytics Health Dashboard
(default --dashboard-path /__metric-atlas/dashboard, ADR-009) without exposing credentials to the browser bundle.
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
