# ADR

- ID: ADR-009
- Date: 2026-08-24
- Status: Accepted
- Author: Member A (가현)

## Problem

`@metric-atlas/vite` gives external consumers the Event Overlay (code-side badges) but nothing shows GA4-observed data or Analytics Health — the product's core value proposition ("Code ↔ GA4 상태 대조", `docs/00` 기능 2). The only working Analytics Health UI anywhere in this codebase is hand-built inside `apps/demo-react-vite` (this monorepo's own internal demo app) and is not packaged for reuse. A real external consumer (e.g. Metric-Atlas-homepage) who installs `@metric-atlas/vite` and self-hosts `@metric-atlas/runtime` gets a working `/__metric-atlas/api/health` JSON endpoint but no page to view it — they would have to build their own dashboard UI from scratch.

Two shapes were considered for closing this gap:

1. A shared, Metric-Atlas-hosted service (e.g. `dashboard.metric-atlas.site`) where consumers log in or supply a key and see their data on a page we operate.
2. A `METRIC_ATLAS_DASHBOARD_ENABLED=true`-style Vite plugin option that, on `vite build`, adds a dashboard route to the consumer's own production site.

## Investigation — why neither shape works as originally proposed

**(1) Shared hosted dashboard** would require Metric-Atlas to hold third-party GA4 service-account credentials (or scoped tokens) centrally, plus an authentication/authorization system to keep each consumer's data isolated. This directly reverses the project's self-hosted security model (`docs/00` "Internal self-hosting", `docs/09` credential rules, Risk Register R-11 "공개 인터넷 배포 비지원") and requires building an auth system explicitly excluded from MVP scope (`DEC-011`). It turns Metric Atlas from a self-hosted tool into a multi-tenant SaaS handling other organizations' analytics credentials — a materially larger and differently-shaped project, not attempted here.

**(2) A Vite-plugin build-time dashboard option** cannot work for production deployments. GA4 querying needs a live process that holds credentials and calls the Google API per-request (`docs/09`: credentials never reach the browser bundle). `vite build` produces static files with no server component — there is nothing running after the build finishes to answer a dashboard's data requests. A dev-only version (inside `configureServer`) is technically feasible, but a production dashboard fundamentally requires a live server regardless of how the option is spelled — the same requirement `@metric-atlas/runtime` already exists to satisfy.

## Decision

Ship the Analytics Health Dashboard **embedded in `@metric-atlas/runtime`** (served by `metric-atlas serve`), not as a separately installable consumer package and not as a Vite-plugin build option.

1. Extract the dashboard UI (Overview/Events/Query views, Event Card/Detail, GTM route display, Custom Dimension gap warnings — currently hand-built only inside `apps/demo-react-vite`) into a standalone, brand-agnostic package, `packages/dashboard`. It builds to a static Vite bundle exactly like any SPA.
2. `packages/runtime`'s build copies `packages/dashboard`'s built assets into its own `dist/` and `packages/runtime/src/server.ts` serves them (with SPA history-mode fallback) at a configurable path. Default: `/__metric-atlas/dashboard`.
3. The dashboard bundle fetches `/__metric-atlas/api/manifest` and `/__metric-atlas/api/health` at runtime (relative URLs, same-origin as the Runtime serving it) — reusing the existing runtime→fixture fallback pattern from `apps/demo-react-vite/src/data.ts` so the page never crashes or shows blank before credentials are configured.
4. `packages/cli`'s `serve` command gains a `--dashboard-path` flag (and `RuntimeOptions.dashboardPath`) so a consumer can move the route if it collides with an existing path on their own site.
5. `apps/demo-react-vite` is refactored to consume `packages/dashboard` as a workspace dependency instead of duplicating the view/component code, so there is exactly one implementation.

This keeps the self-hosted security model intact — a consumer still deploys their own `@metric-atlas/runtime` instance with their own GA4 credentials, same as before this ADR — but they no longer have to write or copy any dashboard UI code themselves. Deploying the Runtime is unavoidable (GA4 needs a live server); building the dashboard by hand is what this removes.

## Producers affected

- Dashboard UI extraction/packaging: primarily C's ownership area (`docs/12`: "GA4 Connector & Analytics Health Dashboard"), implemented here as part of closing this ADR ahead of the contest submission deadline.
- `packages/runtime`, `packages/cli`: A+D ownership (`DEC-047`).
- `apps/demo-react-vite`: refactored to depend on the new `packages/dashboard` package; no behavior change from a user's perspective.

## Consumers affected

- Any `@metric-atlas/runtime` deployment now serves a dashboard page in addition to the JSON API, at no extra installation step.
- External consumers who deployed `@metric-atlas/runtime` before this change get the dashboard automatically on their next deploy/upgrade — no config required unless they want a non-default path.

## Alternatives

- Shared hosted `dashboard.metric-atlas.site` — rejected, see Investigation above (SaaS-scale scope change, breaks credential/security model, needs auth explicitly out of MVP scope).
- Vite-plugin build-time dashboard route — rejected, cannot serve live GA4 data from a static production build.
- Publish `packages/dashboard` as its own separately-installable npm package for consumers to wire up themselves — rejected as the primary path: it would still leave most consumers with an extra manual integration step for no real benefit, since the Runtime already needs to be deployed and is a natural place to serve static assets from. Nothing prevents `packages/dashboard` from also being independently useful later (e.g. for a consumer embedding it into an existing internal admin panel); this ADR does not preclude that.

## Compatibility

No breaking change to `@metric-atlas/vite` (Event Overlay) or the existing Runtime API routes (`/__metric-atlas/api/*`). Adds a new route; does not remove or rename anything.

## Security note

A publicly reachable Runtime deployment with the dashboard enabled exposes Analytics Health data (event names, counts, GA4 observation state — not credentials) to anyone who can reach the URL. This mitigation responsibility is unchanged from the existing Runtime API surface (Risk Register R-11: restrict at the network/deployment layer, e.g. internal network, VPN, or the hosting platform's own access control). Not solved by an in-product auth system, which remains explicitly out of MVP scope (`DEC-011`).

## Migration

None — additive. Existing Runtime deployments gain the dashboard route on their next upgrade.

## Fixture updates

`packages/dashboard` reuses the existing `fixtures/mock-manifest.json` / `fixtures/mock-ga4-health.json` / `fixtures/mock-gtm-container-export.json` fallbacks already used by `apps/demo-react-vite`.

## Contract tests

- `packages/dashboard` build output is verified in CI the same way `apps/demo-react-vite`'s is (typecheck + component tests).
- `packages/runtime` gains a test asserting the dashboard route serves the bundled `index.html` and respects `dashboardPath`/`--dashboard-path`.

## Decision

Accepted. Dashboard ships inside `@metric-atlas/runtime`, path-configurable, no shared hosted service, no Vite-plugin build-time route.
