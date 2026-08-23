import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import fg from "fast-glob";
import { minimatch } from "minimatch";
import {
  detectorAdaptersFor,
  type DetectorAdapterName,
} from "./adapters.js";
import { analyzeSource } from "./analyze.js";
import { createBuildId, createManifest } from "./manifest.js";
import type { EventManifest, SourceAnalysis } from "./model.js";

const execFileAsync = promisify(execFile);

export const DEFAULT_INCLUDE = ["src/**/*.{js,jsx,ts,tsx,mjs,mjsx,mts,mtsx,cjs,cjsx,cts,ctsx}"];
export const DEFAULT_EXCLUDE = [
  "**/node_modules/**",
  "**/dist/**",
  "**/*.test.*",
  "**/*.spec.*",
  "**/*.stories.*",
];

export interface ScanProjectOptions {
  root?: string;
  include?: string[];
  exclude?: string[];
  buildId?: string;
  generatedAt?: string;
  /** DEC-037/DEC-060: defaults to GA4/GTM/Mixpanel; meta/posthog/amplitude require explicit opt-in. */
  detectors?: DetectorAdapterName[];
}

export interface ScannedFile {
  file: string;
  analysis: SourceAnalysis;
}

export interface ScanProjectResult {
  manifest: EventManifest;
  files: ScannedFile[];
}

export interface ScanGitRefOptions extends ScanProjectOptions {
  ref: string;
}

export async function scanProject(
  options: ScanProjectOptions = {},
): Promise<ScanProjectResult> {
  const startedAt = performance.now();
  const root = path.resolve(options.root ?? process.cwd());
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const buildId = options.buildId ?? createBuildId(`${root}:${generatedAt}`);
  const adapters = options.detectors
    ? detectorAdaptersFor(options.detectors)
    : undefined;
  const relativeFiles = await fg(options.include ?? DEFAULT_INCLUDE, {
    cwd: root,
    ignore: options.exclude ?? DEFAULT_EXCLUDE,
    onlyFiles: true,
    unique: true,
    dot: false,
    followSymbolicLinks: false,
  });

  const files = await Promise.all(
    relativeFiles.sort().map(async (relativeFile): Promise<ScannedFile> => {
      const normalizedFile = toPosix(relativeFile);
      const source = await readFile(path.join(root, relativeFile), "utf8");
      return {
        file: normalizedFile,
        analysis: analyzeSource(source, {
          file: normalizedFile,
          buildId,
          ...(adapters ? { adapters } : {}),
        }),
      };
    }),
  );

  const events = files.flatMap((file) => file.analysis.events);
  const bindings = files.flatMap((file) => file.analysis.bindings);
  const warnings = files.flatMap((file) => file.analysis.warnings);
  const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;
  return {
    manifest: createManifest(
      { events, bindings, warnings },
      {
        buildId,
        generatedAt,
        scanStats: {
          filesScanned: files.length,
          durationMs,
          eventsDetected: events.length,
        },
      },
    ),
    files,
  };
}

/**
 * Scans files directly from a Git tree without checking out or mutating either
 * the caller's worktree or the referenced commit.
 */
export async function scanGitRef(
  options: ScanGitRefOptions,
): Promise<ScanProjectResult> {
  const startedAt = performance.now();
  const root = path.resolve(options.root ?? process.cwd());
  const commit = await resolveGitCommit(root, options.ref);
  const { stdout } = await execFileAsync(
    "git",
    ["-C", root, "ls-tree", "-r", "-z", "--name-only", commit],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const include = options.include ?? DEFAULT_INCLUDE;
  const exclude = options.exclude ?? DEFAULT_EXCLUDE;
  const relativeFiles = stdout
    .split("\0")
    .filter(Boolean)
    .map(toPosix)
    .filter((file) => isIncluded(file, include, exclude))
    .sort();
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const buildId = options.buildId ?? createBuildId(`${root}:${commit}`);
  const adapters = options.detectors
    ? detectorAdaptersFor(options.detectors)
    : undefined;

  const files = await mapWithConcurrency(
    relativeFiles,
    8,
    async (relativeFile): Promise<ScannedFile> => {
      const { stdout: source } = await execFileAsync(
        "git",
        ["-C", root, "show", `${commit}:${relativeFile}`],
        { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
      );
      return {
        file: relativeFile,
        analysis: analyzeSource(source, {
          file: relativeFile,
          buildId,
          ...(adapters ? { adapters } : {}),
        }),
      };
    },
  );

  return scanResult(files, {
    buildId,
    generatedAt,
    startedAt,
  });
}

async function resolveGitCommit(root: string, ref: string): Promise<string> {
  const { stdout } = await execFileAsync(
    "git",
    ["-C", root, "rev-parse", "--verify", `${ref}^{commit}`],
    { encoding: "utf8" },
  );
  return stdout.trim();
}

function isIncluded(
  relativeFile: string,
  include: readonly string[],
  exclude: readonly string[],
): boolean {
  return (
    include.some((pattern) => minimatch(relativeFile, pattern, { dot: false })) &&
    !exclude.some((pattern) => minimatch(relativeFile, pattern, { dot: true }))
  );
}

function scanResult(
  files: ScannedFile[],
  options: { buildId: string; generatedAt: string; startedAt: number },
): ScanProjectResult {
  const events = files.flatMap((file) => file.analysis.events);
  const bindings = files.flatMap((file) => file.analysis.bindings);
  const warnings = files.flatMap((file) => file.analysis.warnings);
  const durationMs = Math.round((performance.now() - options.startedAt) * 100) / 100;
  return {
    manifest: createManifest(
      { events, bindings, warnings },
      {
        buildId: options.buildId,
        generatedAt: options.generatedAt,
        scanStats: {
          filesScanned: files.length,
          durationMs,
          eventsDetected: events.length,
        },
      },
    ),
    files,
  };
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await worker(items[index]!);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

export function toPosix(file: string): string {
  return file.split(path.sep).join("/");
}
