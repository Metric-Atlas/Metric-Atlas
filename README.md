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

The first view at `/event-dashboard` is **Code ↔ GA4 Health**, not a raw event-count table.

- Events present in code but not observed in GA4
- Events observed in GA4 but not discovered in code
- GA4 automatically collected and Enhanced Measurement events
- Custom parameters sent by code but not registered as GA4 Custom Dimensions
- Events connected successfully between code and GA4
- Results that require caution because of Data Quality Flags

Event Detail provides event counts and period comparisons.

### 3. Natural Language Query

Connect an internal LLM or an OpenAI-compatible LLM to query events and GA4 results in natural language.

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

```bash
corepack pnpm add -D @metric-atlas/vite
corepack pnpm add @metric-atlas/runtime
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
      dashboard: { enabled: true, path: "/event-dashboard" },
    }),
    react(),
  ],
});
```

## GA4 authentication

Use environment variables or a Secret Manager in production.

Recommended precedence:

1. `GOOGLE_APPLICATION_CREDENTIALS`
2. `METRIC_ATLAS_GA4_SERVICE_ACCOUNT_JSON_BASE64`
3. Runtime memory input only when `METRIC_ATLAS_MODE=internal` and temporary input is explicitly allowed

Add the service account to the target GA4 Property with the minimum required read permissions.

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

[MIT](./LICENSE). Semantic Versioning policy, security disclosure path, maintainer list, and release cadence are still to be finalized before the public source release (`docs/18-positioning-and-open-source.md` §4).
