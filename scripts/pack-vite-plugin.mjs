#!/usr/bin/env node
/**
 * Issue #32: build a standalone, installable `@metric-atlas/vite` package for consumers
 * outside this monorepo (e.g. Metric-Atlas-homepage), without a registry publish.
 *
 * `npm install github:owner/repo#ref` fetches the repo tree at that ref and does NOT
 * preserve any `node_modules` present there (confirmed empirically — npm's git-dependency
 * installer packs the fetched tree the same way `npm pack` would, and `node_modules` is
 * excluded from a pack unless every entry is declared in `bundledDependencies`, which in
 * turn does not work in this pnpm workspace: `packages/vite/node_modules/@metric-atlas/*`
 * are symlinks pointing outside the package root, and npm's tar writer preserves that as
 * `../` path components, which both `tar` and npm's own installer reject as unsafe
 * (`TAR_ENTRY_ERROR path contains '..'`) and silently drop).
 *
 * So this script bundles (inlines) `@metric-atlas/contracts` and `@metric-atlas/detector`
 * directly into the Node-side plugin file via esbuild, and separately bundles
 * `@metric-atlas/overlay` (+ contracts) into `dist/vendor/overlay.js`, a plain sibling file
 * that `packages/vite/src/index.ts` resolves via a relative `import.meta.url` path when
 * present (see `resolveOverlayModulePath`) instead of `import.meta.resolve("@metric-atlas/overlay")`.
 * Real npm packages (vite, zod, the Babel toolchain, fast-glob, minimatch) are left external
 * and installed normally by the consumer's `npm install` from the public registry.
 *
 * Prerequisite: `pnpm build` (so packages/{contracts,detector,overlay,vite}/dist exist).
 * Output: `dist-vite-plugin/` at the repo root — this becomes the root of the
 * `dist/vite-plugin` distribution branch (see docs/adr/ADR-008).
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(rootDir, "dist-vite-plugin");

const vitePkgDir = path.join(rootDir, "packages/vite");
const contractsPkgDir = path.join(rootDir, "packages/contracts");
const detectorPkgDir = path.join(rootDir, "packages/detector");
const overlayPkgDir = path.join(rootDir, "packages/overlay");

for (const dir of [vitePkgDir, contractsPkgDir, detectorPkgDir, overlayPkgDir]) {
  if (!existsSync(path.join(dir, "dist", "index.js"))) {
    console.error(`[pack-vite-plugin] Missing build output: ${dir}/dist/index.js — run "pnpm build" first.`);
    process.exit(1);
  }
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(path.join(outDir, "vendor"), { recursive: true });

const NODE_EXTERNAL = [
  "vite",
  "minimatch",
  "zod",
  "@babel/generator",
  "@babel/parser",
  "@babel/traverse",
  "@babel/types",
  "fast-glob",
];

// Node-side plugin: inline @metric-atlas/contracts + @metric-atlas/detector.
await esbuild.build({
  entryPoints: [path.join(vitePkgDir, "dist/index.js")],
  outfile: path.join(outDir, "index.js"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  external: NODE_EXTERNAL,
  sourcemap: true,
  logLevel: "info",
});

// Browser-side overlay: inline @metric-atlas/contracts. zod stays external so the
// consumer's own Vite build resolves one real copy from node_modules.
await esbuild.build({
  entryPoints: [path.join(overlayPkgDir, "dist/index.js")],
  outfile: path.join(outDir, "vendor/overlay.js"),
  bundle: true,
  platform: "neutral",
  format: "esm",
  target: "es2020",
  external: ["zod"],
  logLevel: "info",
});

// Minimal, self-contained .d.ts — the multi-file tsc output cross-imports types from the
// three inlined packages, which would not resolve for a consumer that never installs them.
writeFileSync(
  path.join(outDir, "index.d.ts"),
  readFileSync(path.join(vitePkgDir, "dist-public/index.d.ts.template"), "utf8"),
);

cpSync(path.join(vitePkgDir, "README.md"), path.join(outDir, "README.md"));

const mergedDependencies = mergeRealDependencies([
  contractsPkgDir,
  detectorPkgDir,
  overlayPkgDir,
  vitePkgDir,
]);

const vitePkg = readJson(path.join(vitePkgDir, "package.json"));
writeFileSync(
  path.join(outDir, "package.json"),
  `${JSON.stringify(
    {
      name: vitePkg.name,
      version: vitePkg.version,
      description: "Metric Atlas Vite plugin — standalone distribution (see docs/adr/ADR-008)",
      type: vitePkg.type,
      main: "./index.js",
      types: "./index.d.ts",
      exports: {
        ".": {
          types: "./index.d.ts",
          import: "./index.js",
        },
      },
      files: ["index.js", "index.js.map", "index.d.ts", "vendor/**", "README.md"],
      engines: vitePkg.engines,
      peerDependencies: vitePkg.peerDependencies,
      dependencies: mergedDependencies,
    },
    null,
    2,
  )}\n`,
);

const gitSha = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: rootDir }).toString().trim();
console.log(`\n[pack-vite-plugin] Built dist-vite-plugin/ from ${gitSha}.`);
console.log(`[pack-vite-plugin] Contents: index.js, index.d.ts, vendor/overlay.js, package.json, README.md`);

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

/** Union of every non-"@metric-atlas/*" dependency across the bundled packages. */
function mergeRealDependencies(pkgDirs) {
  const merged = {};
  for (const dir of pkgDirs) {
    const pkg = readJson(path.join(dir, "package.json"));
    for (const [name, range] of Object.entries(pkg.dependencies ?? {})) {
      if (name.startsWith("@metric-atlas/")) continue;
      if (merged[name] && merged[name] !== range) {
        throw new Error(`[pack-vite-plugin] Conflicting version range for ${name}: ${merged[name]} vs ${range}`);
      }
      merged[name] = range;
    }
  }
  return merged;
}
