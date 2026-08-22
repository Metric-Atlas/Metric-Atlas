# ADR

- ID: ADR-008
- Date: 2026-08-20
- Status: Accepted
- Author: Member A (가현)

## Problem

Issue #32: a consumer outside this monorepo (Metric-Atlas-homepage) tried to integrate `@metric-atlas/vite` and found there is no way to install it. `packages/vite` depends on `@metric-atlas/contracts`/`detector`/`overlay` via `workspace:*`, which only resolves inside this pnpm workspace. There is no npm/GitHub Packages publish (`npm view @metric-atlas/vite` → 404; formal registry publishing is intentionally deferred to a later OSS phase per `CONTRIBUTING.md`).

The issue proposed: add `bundledDependencies` to `packages/vite/package.json` listing the three internal packages, publish a build-output-only branch, and have consumers `npm install github:Metric-Atlas/Metric-Atlas#dist/vite-plugin`.

## Investigation — the proposed `bundledDependencies` approach does not work

Verified empirically before implementing anything:

1. `pnpm pack` refuses outright: `bundledDependencies does not work with "nodeLinker: isolated"` — pnpm's default linker doesn't support it without switching the whole workspace to `nodeLinker: hoisted` (a workspace-wide behavior change with real regression risk across all 10 packages, not something to take on for a packaging convenience).
2. `npm pack` "succeeds" but produces a broken tarball: because `packages/vite/node_modules/@metric-atlas/*` are symlinks pointing outside the package root (pnpm's isolated store), npm's tar writer emits entries with `../` path components. Both `tar -xzf` and npm's own installer reject these as unsafe (`TAR_ENTRY_ERROR path contains '..'`) and silently drop them.
3. Reproduced the real failure end-to-end: `npm install` of that tarball into a scratch project ends up missing `detector`'s `dist/` output entirely, and importing the plugin throws `Cannot find package '@babel/types'`.
4. Separately confirmed (with a minimal fake package) that **`npm install github:owner/repo#ref` strips any `node_modules` present at that ref regardless of symlinks** — npm's git-dependency installer packs the fetched tree the same way `npm pack` would, and `node_modules` is excluded from a pack unless declared via `bundledDependencies`. So even a "manually vendor real (non-symlink) copies into node_modules and commit them" variant of the proposal would not survive a git install either.

## Decision

Reject the `bundledDependencies` approach. Instead:

1. **Bundle (inline) the Node-side logic with esbuild.** `packages/vite`'s compiled `dist/index.js` is bundled together with `@metric-atlas/contracts` and `@metric-atlas/detector` (both real runtime dependencies — `detector` calls `EventManifest.parse()` from `contracts` at runtime, this isn't type-only) into a single self-contained `index.js`. Real npm packages (`vite`, `zod`, the Babel toolchain, `fast-glob`, `minimatch`) are left external — the consumer's own `npm install` resolves those normally from the public registry, so the distribution itself stays small (~32KB tarball vs. the ~4MB the broken `bundledDependencies` attempt produced by vendoring the entire transitive tree).
2. **`@metric-atlas/overlay` cannot be inlined the same way** — `packages/vite/src/index.ts` locates it via `import.meta.resolve("@metric-atlas/overlay")` specifically to get a real file path, which Vite then reads and bundles into the *consumer's browser build* (it's not just called as a function). So overlay (+ contracts, again a real runtime dependency there) is bundled separately into a plain sibling file, `dist/vendor/overlay.js`, shipped as an ordinary file next to `index.js` — not inside `node_modules`, so it survives a git install.
3. **`packages/vite/src/index.ts` changed**: `resolveOverlayModulePath()` now prefers `./vendor/overlay.js` next to the running file when present, falling back to `import.meta.resolve("@metric-atlas/overlay")` otherwise. This is additive and backward compatible — inside the monorepo, no vendored file exists, so behavior is unchanged (verified: the existing "bundles the overlay in a real Vite build" test still passes unmodified).
4. **A hand-maintained minimal `.d.ts`** (`packages/vite/dist-public/index.d.ts.template`) replaces the real multi-file `tsc` output for this distribution only, since the real `.d.ts` cross-imports types from the three bundled packages that a consumer never installs. It must be kept in sync with `MetricAtlasViteOptions` by hand; it is not generated.
5. **`dist/vite-plugin` branch**, rebuilt by `scripts/pack-vite-plugin.mjs` (`pnpm pack:vite-plugin`) and auto-published by `.github/workflows/publish-vite-plugin-dist.yml` on every `main` push touching `packages/{contracts,detector,overlay,vite}`. Consumers install via `npm install "github:Metric-Atlas/Metric-Atlas#dist/vite-plugin"`, matching the issue's original consumer-facing proposal (only the Metric-Atlas-side mechanism changed).

Verified end-to-end outside the monorepo (`npm pack` → `npm install` the tarball into a scratch project → real Vite `configResolved`/`transform`/`resolveId`/`load` hook calls): the plugin imports, detects a `gtag(...)` call in real JSX through the bundled Babel/detector code, and the overlay virtual module resolves to the vendored `vendor/overlay.js` file.

## Producers affected

- A: owns `scripts/pack-vite-plugin.mjs`, the publish workflow, and the `dist/vite-plugin` branch (CI/release integration, `docs/12`).
- B: `packages/vite/src/index.ts` gained the `resolveOverlayModulePath()` fallback (backward compatible, existing tests unchanged). Any future public option surface on `MetricAtlasViteOptions` needs a matching update to `dist-public/index.d.ts.template`.

## Consumers affected

- External consumers (Metric-Atlas-homepage and similar) — new install path documented in `README.md`/`README.ko.md`.
- C, D: no impact — this only concerns the Vite plugin's external distribution.

## Alternatives

- `bundledDependencies` + `pnpm`/`npm pack` (the issue's original proposal) — rejected, does not work, see Investigation above.
- Switch the whole workspace to `nodeLinker: hoisted` to make `bundledDependencies` work — rejected. Workspace-wide linker change for one package's distribution need is disproportionate risk; would require re-verifying all 10 packages' dependency resolution.
- Formal npm registry publish now — rejected for this issue. License/SemVer policy is explicitly deferred to a later OSS phase (`CONTRIBUTING.md`); this ADR does not change that, it only unblocks the immediate consumer need with a lower-commitment mechanism.
- Vendoring real (non-symlink) copies into `node_modules` and committing them — rejected, confirmed by the fake-package test that git installs strip `node_modules` regardless of how it got there.

## Compatibility

No breaking change to the monorepo build or any existing package's public contract. `packages/vite`'s own `package.json`/`dist/` (used by `apps/demo-react-vite` and CI) are unchanged; the standalone bundle is a separate build artifact (`dist-vite-plugin/`, gitignored) produced only when `scripts/pack-vite-plugin.mjs` runs.

## Migration

None — new capability, no existing consumers of the old (nonexistent) install path.

## Fixture updates

None.

## Contract tests

- Existing `packages/vite/test/plugin.test.ts` "bundles the overlay in a real Vite build" test continues to pass unmodified, covering the fallback branch of `resolveOverlayModulePath()`.
- End-to-end distribution verification was manual (see above) rather than an automated test, since it requires packing and installing outside the workspace; the publish workflow's own successful run against a real consumer (Metric-Atlas-homepage) is the practical acceptance check going forward.

## Decision

Accepted. `bundledDependencies` rejected as unworkable in this pnpm workspace; adopted esbuild-based inlining + a vendored sibling file for overlay + an auto-published `dist/vite-plugin` branch instead.
