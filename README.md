# Metric Atlas

**English** · [한국어](./README.ko.md)

Metric Atlas is an open-source developer tool that connects analytics events in React and Vite projects to **source locations, rendered UI elements, and observed GA4 data**.

Its core value is not rebuilding the GA4 dashboard. Metric Atlas automatically compares **what is implemented in code with what is observed in analytics** and surfaces the result as Analytics Health.

## Core capabilities

### 1. Event Overlay

During a build, Metric Atlas analyzes the AST for supported patterns such as `gtag(...)`, `sendGAEvent(...)`, and `dataLayer.push(...)`. It injects `data-atlas-id` only into build output for native JSX elements bound to detected events.

Turn on the Metric Atlas launcher in the deployed application and hover over a button or link to inspect:

- the original event name;
- Tracking Emitter and Analytics Provider;
- source file and location;
- event parameters; and
- binding status.

`dataLayer.push(...)` is detected as a GTM call and is not assumed to target GA4.

### 2. Analytics Health Dashboard

The first view, served by the Node Runtime at `/__metric-atlas/dashboard` (configurable), is **Code ↔ GA4 Health**, not a raw event-count table.

- Events present in code but not observed in GA4
- Events observed in GA4 but not discovered in code
- GA4 automatically collected and Enhanced Measurement events
- Custom parameters sent by code but not registered as GA4 Custom Dimensions
- Events connected successfully between code and GA4
- Results that require caution because of Data Quality Flags

Event Detail provides event counts and period comparisons. The dashboard ships embedded in `@metric-atlas/runtime` — see [Analytics Health Dashboard](#analytics-health-dashboard).

### 3. Natural Language Query

Set an OpenRouter API key on the Runtime server to query events and GA4 results in natural language.

This feature is **not a Core MVP release blocker**. Event search, provider filters, source-location lookup, and Analytics Health work without an LLM.

### 4. PR Analytics Change Report

GitHub Actions scans the base and head commits and reports analytics changes in the pull request.

- Added events
- Removed events
- Tracking Emitter or Provider changes
- Dynamic events
- Possible unsupported wrapper usage
- Increases in `unresolved` results

Git commits provide the baseline, so no database or previous-manifest store is required.

## Product positioning

Unlike tools that begin with a manually authored tracking plan and validate code against it, Metric Atlas starts from **the implementation that already exists**.

```text
Existing Code
→ Event Detection
→ UI Binding
→ GA4 Observation
→ Analytics Health
→ Search / Query
```

Metric Atlas is not an event-approval or governance SaaS, a BI tool, or a replacement for GA4.

## Technical direction

- Node.js and TypeScript
- React and Vite first
- pnpm workspace
- Vite Plugin API
- Babel AST
- TypeScript Compiler API when deeper analysis is required
- Web Component and Shadow DOM overlay
- GA4 Data API and Admin API connector
- Single Node Runtime
- No database
- In-memory cache
- Internal self-hosting
- Official Local Demo Mode for evaluation and open-source contribution

## Quick demo

Requirements: Node.js 22.18 or later. Demo fixtures let you explore Event Overlay and Analytics Health without an API key.

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm demo
```

The demo application shows supported and unsupported patterns together:

- inline `gtag`;
- same-file handlers;
- `dataLayer.push`;
- calls through wrappers — unsupported in the MVP;
- Custom Components — events remain detected, but overlay injection is unsupported; and
- dynamic event names — reported as `unresolved`.

## Install in a user project

`@metric-atlas/vite` is published to npm.

```bash
npm install -D @metric-atlas/vite
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import metricAtlas from "@metric-atlas/vite";

export default defineConfig({
  plugins: [
    metricAtlas({
      enabled: process.env.METRIC_ATLAS_ENABLED === "true",
      include: ["src/**/*.{js,jsx,ts,tsx}"],
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/*.test.*",
        "**/*.spec.*",
        "**/*.stories.*",
      ],
      overlay: { enabled: true },
    }),
    react(),
  ],
});
```

```bash
METRIC_ATLAS_ENABLED=true npm run build
```

On a host like Vercel, set `METRIC_ATLAS_ENABLED=true` only on the Preview environment so production builds are unaffected.

`@metric-atlas/vite` only ever controls Event Overlay (code-side badges). It has no `dashboard` option — Analytics Health Dashboard is a separate concern, served by the Node Runtime; see [Analytics Health Dashboard](#analytics-health-dashboard) below.

### Tracking `main` directly (advanced)

Before the npm publish above existed, this repo maintained a `dist/vite-plugin` branch with a self-contained, bundled build for installing straight off Git (see `docs/adr/ADR-008-standalone-vite-plugin-distribution.md`). It's still rebuilt automatically on every push to `main` and still works, if you specifically want unreleased changes ahead of the next npm version:

```bash
npm install "github:Metric-Atlas/Metric-Atlas#dist/vite-plugin"
```

For normal use, prefer the npm install above — it gets you a real released version instead of whatever happens to be on `main`.

## GA4 authentication

Analytics Health requires the Node Runtime. The browser never calls GA4 directly.
Set GA4 credentials in the Runtime environment, then start the CLI server.

### Local Runtime

Keep the service account JSON outside the repository.

```bash
mkdir -p ~/secure
mv ~/Downloads/service-account.json ~/secure/metric-atlas-reader.json
chmod 600 ~/secure/metric-atlas-reader.json
```

Create a local Runtime env file:

```bash
cat > .env.metric-atlas <<'EOF'
METRIC_ATLAS_GA4_PROPERTY_ID=123456789
GOOGLE_APPLICATION_CREDENTIALS=/Users/YOUR_NAME/secure/metric-atlas-reader.json
METRIC_ATLAS_GA4_HEALTH_WINDOW_DAYS=30
METRIC_ATLAS_GA4_RECENT_WINDOW_HOURS=48
METRIC_ATLAS_CACHE_TTL_SECONDS=300
EOF
```

Or generate the same Runtime env file with the CLI. Do not pass the LLM key as a
literal command argument; read it from an existing shell environment variable.

```bash
export OPENROUTER_API_KEY=<YOUR_LLM_KEY>

npx metric-atlas init-env \
  --output ./.env.metric-atlas \
  --ga4-property-id 123456789 \
  --google-application-credentials /Users/YOUR_NAME/secure/metric-atlas-reader.json \
  --llm-provider openrouter \
  --llm-base-url https://openrouter.ai/api/v1 \
  --llm-model openrouter/free \
  --llm-api-key-env OPENROUTER_API_KEY
```

You can also register or rotate only the LLM key in an existing Runtime env file:

```bash
npx metric-atlas set-llm-key \
  --env ./.env.metric-atlas \
  --key <YOUR_LLM_KEY> \
  --provider openrouter \
  --base-url https://openrouter.ai/api/v1 \
  --model openrouter/free
```

To avoid leaving the key in shell history, use stdin or an environment variable instead:

```bash
printf '%s' "$OPENROUTER_API_KEY" | npx metric-atlas set-llm-key \
  --env ./.env.metric-atlas \
  --key-stdin \
  --provider openrouter \
  --base-url https://openrouter.ai/api/v1 \
  --model openrouter/free
```

Install the Runtime CLI, then build and serve the instrumented app:

```bash
npm install -D @metric-atlas/cli
METRIC_ATLAS_ENABLED=true npm run build
npx metric-atlas serve ./dist --env ./.env.metric-atlas --host 127.0.0.1 --port 8787
```

Check the Runtime APIs:

```bash
curl http://127.0.0.1:8787/__metric-atlas/api/runtime-health
curl http://127.0.0.1:8787/__metric-atlas/api/manifest
curl http://127.0.0.1:8787/__metric-atlas/api/health
```

### Deployed Runtime

In production, configure the same values with the hosting provider's Secret or Environment Variable CLI.
Do not commit `.env.metric-atlas`.

If the host supports secret files, set:

```bash
METRIC_ATLAS_GA4_PROPERTY_ID=123456789
GOOGLE_APPLICATION_CREDENTIALS=/secure/path/metric-atlas-reader.json
```

If the host supports only environment variables, store the JSON as base64:

```bash
base64 -i ~/secure/metric-atlas-reader.json | pbcopy
```

Then add these secrets in the deployment platform:

```bash
METRIC_ATLAS_GA4_PROPERTY_ID=123456789
METRIC_ATLAS_GA4_SERVICE_ACCOUNT_JSON_BASE64=<PASTE_BASE64_VALUE>
```

The server start command should restore the key before running the Runtime:

```bash
echo "$METRIC_ATLAS_GA4_SERVICE_ACCOUNT_JSON_BASE64" | base64 -d > /tmp/metric-atlas-ga4.json
export GOOGLE_APPLICATION_CREDENTIALS=/tmp/metric-atlas-ga4.json
npx metric-atlas serve ./dist --host 0.0.0.0 --port "$PORT"
```

Add the service account to the target GA4 Property with the minimum required read permissions.
Never put GA4/LLM credentials in `VITE_*`, browser storage, source code, build output, or logs.

## Analytics Health Dashboard

The Dashboard is not a separate package to install and not a Vite plugin option — it ships embedded in `@metric-atlas/runtime` and is served by `metric-atlas serve` once the Runtime is deployed with GA4 credentials configured (previous section). This is deliberate: GA4 queries need a live server holding credentials, so a static `vite build` output can never host a working dashboard on its own (see `docs/adr/ADR-009-runtime-embedded-analytics-health-dashboard.md`).

```bash
npx metric-atlas serve ./dist --env ./.env.metric-atlas --host 127.0.0.1 --port 8787
```

Open `http://127.0.0.1:8787/__metric-atlas/api/runtime-health` to confirm credentials are loaded, then visit the dashboard:

```text
http://127.0.0.1:8787/__metric-atlas/dashboard
```

If that path collides with something on your own site, move it:

```bash
npx metric-atlas serve ./dist --env ./.env.metric-atlas --dashboard-path /my-dashboard
```

There is no separate installation step and no shared Metric-Atlas-hosted dashboard service — each deployment is self-hosted with its own GA4 credentials, matching the rest of this project's security model (`docs/09-security-and-secrets.md`). If you deploy the Runtime to a public URL, the dashboard is reachable by anyone who has that URL (it exposes event names/counts/GA4 observation state, not credentials) — restrict access at the network or hosting-platform layer if that matters for your deployment.

## Documentation reading order

1. `AGENTS.md`
2. `docs/00-project-source-of-truth.md`
3. `docs/15-decision-log.md`
4. `docs/04-system-architecture.md`
5. `docs/08-contracts-and-schema.md`
6. `docs/20-phase-0-common-fields.md` for Phase 0 contract work
7. The relevant feature document
8. `docs/12-team-rnr.md`
9. `docs/13-collaboration-workflow.md`
10. `docs/14-testing-and-acceptance.md`

## Source of Truth

- Human-readable product SoT: `docs/00-project-source-of-truth.md`
- Accepted decision SoT: `docs/15-decision-log.md`
- Machine contract SoT after implementation: Zod schemas in `packages/contracts`
- Aggregated Markdown files are convenience documents, not a Source of Truth.

## Contributing

Contributions are welcome. Read the [Contributing Guide](./CONTRIBUTING.md) or its [한국어 번역](./CONTRIBUTING.ko.md) before starting a change.

## License

[MIT](./LICENSE). Published `@metric-atlas/*` packages follow [Semantic Versioning](./docs/18-positioning-and-open-source.md#4-public-release-gate) (pre-1.0: breaking changes may land in minor releases). See [`SECURITY.md`](./SECURITY.md) to report a vulnerability, [`MAINTAINERS.md`](./MAINTAINERS.md) for the maintainer list, and [`THIRD-PARTY-NOTICES.md`](./THIRD-PARTY-NOTICES.md) for the licenses of open-source dependencies used in this project.
