#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  scanProject,
  type EventManifest,
  type ScanProjectOptions,
} from "@metric-atlas/detector";
import { diffManifests, formatMarkdownReport } from "./diff.js";

interface ParsedArguments {
  command: "scan" | "diff" | "help";
  values: Map<string, string[]>;
}

export async function runCli(argv: string[]): Promise<number> {
  const args = parseArguments(argv);
  if (args.command === "help") {
    process.stdout.write(helpText());
    return 0;
  }
  if (args.command === "scan") return runScan(args.values);
  return runDiff(args.values);
}

async function runScan(values: Map<string, string[]>): Promise<number> {
  const root = first(values, "root") ?? process.cwd();
  const options: ScanProjectOptions = { root };
  const include = list(values, "include");
  const exclude = list(values, "exclude");
  const buildId = first(values, "build-id");
  if (include.length) options.include = include;
  if (exclude.length) options.exclude = exclude;
  if (buildId) options.buildId = buildId;
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

function parseArguments(argv: string[]): ParsedArguments {
  const commandValue = argv[0];
  if (!commandValue || commandValue === "help" || commandValue === "--help" || commandValue === "-h") {
    return { command: "help", values: new Map() };
  }
  if (commandValue !== "scan" && commandValue !== "diff") {
    throw new Error(`Unknown command: ${commandValue}`);
  }
  const values = new Map<string, string[]>();
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index]!;
    if (!token.startsWith("--")) throw new Error(`Unexpected argument: ${token}`);
    const [rawKey, inlineValue] = token.slice(2).split("=", 2);
    if (!rawKey) throw new Error(`Invalid option: ${token}`);
    if (rawKey === "stdout") {
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
  return { command: commandValue, values };
}

function list(values: Map<string, string[]>, key: string): string[] {
  return (values.get(key) ?? []).flatMap((value) =>
    value.split(",").map((item) => item.trim()).filter(Boolean),
  );
}

function first(values: Map<string, string[]>, key: string): string | undefined {
  return values.get(key)?.[0];
}

function required(values: Map<string, string[]>, key: string): string {
  const value = first(values, key);
  if (!value) throw new Error(`Missing required --${key}`);
  return value;
}

async function readManifest(file: string): Promise<EventManifest> {
  const value: unknown = JSON.parse(await readFile(path.resolve(file), "utf8"));
  if (!isManifest(value)) throw new Error(`Invalid Event Manifest: ${file}`);
  return value;
}

function isManifest(value: unknown): value is EventManifest {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.version === "string" &&
    typeof candidate.buildId === "string" &&
    Array.isArray(candidate.events) &&
    Array.isArray(candidate.bindings) &&
    Array.isArray(candidate.warnings)
  );
}

async function writeOutput(file: string, contents: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, contents, "utf8");
}

function helpText(): string {
  return `Metric Atlas scanner and manifest diff

Usage:
  metric-atlas scan [--root DIR] [--include GLOB] [--exclude GLOB] [--build-id ID] [--output FILE | --stdout]
  metric-atlas diff --base FILE --head FILE [--format markdown|json] [--output FILE]

The scanner reads source files and writes only the requested manifest output. It never modifies source files.
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
