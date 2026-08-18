import { readFile } from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import { analyzeSource } from "./analyze.js";
import { createBuildId, createManifest } from "./manifest.js";
import type { EventManifest, SourceAnalysis } from "./model.js";

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
}

export interface ScannedFile {
  file: string;
  analysis: SourceAnalysis;
}

export interface ScanProjectResult {
  manifest: EventManifest;
  files: ScannedFile[];
}

export async function scanProject(
  options: ScanProjectOptions = {},
): Promise<ScanProjectResult> {
  const startedAt = performance.now();
  const root = path.resolve(options.root ?? process.cwd());
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const buildId = options.buildId ?? createBuildId(`${root}:${generatedAt}`);
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
        analysis: analyzeSource(source, { file: normalizedFile, buildId }),
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

export function toPosix(file: string): string {
  return file.split(path.sep).join("/");
}
