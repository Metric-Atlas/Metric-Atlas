#!/usr/bin/env node
/**
 * DEC-055: published @metric-atlas/* packages move in lockstep — one version number
 * across all of them, bumped together, so consumers never have to figure out which
 * versions of contracts/detector/overlay/vite/runtime/cli/connector-sdk/connector-ga4
 * are compatible with each other.
 *
 * Usage: node scripts/bump-published-packages.mjs <new-version>
 * Example: node scripts/bump-published-packages.mjs 0.1.1
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PUBLISHED_PACKAGES = [
  "contracts",
  "detector",
  "overlay",
  "vite",
  "runtime",
  "cli",
  "connector-sdk",
  "connector-ga4",
];

const repoRoot = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const newVersion = process.argv[2];

if (!newVersion || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(newVersion)) {
  throw new Error(
    "Usage: node scripts/bump-published-packages.mjs <new-version>\n" +
      "  <new-version> must be a plain semver like 0.1.1 (or 0.2.0-beta.1).",
  );
}

for (const name of PUBLISHED_PACKAGES) {
  const file = path.join(repoRoot, "packages", name, "package.json");
  const pkg = JSON.parse(readFileSync(file, "utf8"));
  const previousVersion = pkg.version;
  pkg.version = newVersion;

  // Keep intra-workspace deps on workspace:* — `pnpm publish` rewrites those to the
  // real published version range at publish time. Nothing to touch here.

  writeFileSync(file, `${JSON.stringify(pkg, null, 2)}\n`);
  process.stderr.write(`[bump] @metric-atlas/${name}: ${previousVersion} -> ${newVersion}\n`);
}

process.stderr.write(
  `\nDone. Review the diff, commit, and open a PR before publishing.\n`,
);
