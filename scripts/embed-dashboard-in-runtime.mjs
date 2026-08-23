#!/usr/bin/env node
/**
 * ADR-009: embeds packages/dashboard's built static assets into packages/runtime's
 * compiled output, so `metric-atlas serve` can serve the Analytics Health Dashboard
 * without the consumer installing or building anything separately.
 *
 * `tsc -b` (TypeScript project references) only understands `.ts` compilation, so it
 * cannot run packages/dashboard's `vite build` or copy its output — this script is the
 * explicit step that does both, same pattern as scripts/pack-vite-plugin.mjs.
 *
 * Prerequisite: none — this script builds packages/dashboard itself.
 * Output: packages/runtime/dist/dashboard/ (gitignored, produced on every build).
 */
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const dashboardDir = path.join(repoRoot, "packages", "dashboard");
const dashboardDist = path.join(dashboardDir, "dist");
const runtimeDist = path.join(repoRoot, "packages", "runtime", "dist");
const target = path.join(runtimeDist, "dashboard");

execFileSync("pnpm", ["--filter", "@metric-atlas/dashboard", "build"], {
  cwd: repoRoot,
  stdio: "inherit",
});

if (!existsSync(dashboardDist)) {
  throw new Error(`Expected ${dashboardDist} after building packages/dashboard`);
}
if (!existsSync(runtimeDist)) {
  throw new Error(`Expected ${runtimeDist} — run tsc -b for packages/runtime first`);
}

rmSync(target, { recursive: true, force: true });
cpSync(dashboardDist, target, { recursive: true });

process.stderr.write(`[embed-dashboard-in-runtime] copied ${dashboardDist} -> ${target}\n`);
