# AGENTS.md — Shared execution rules for AI agents and developers

**English (authoritative)** · [한국어](./AGENTS.ko.md)

Keep both language versions synchronized. If the translations differ, this English `AGENTS.md` is authoritative.

## 1. Required reading before work

1. `docs/00-project-source-of-truth.md`
2. `docs/15-decision-log.md`
3. `docs/04-system-architecture.md`
4. `docs/08-contracts-and-schema.md`
5. `docs/20-phase-0-common-fields.md` for Phase 0 contract work
6. The relevant feature document
7. `docs/12-team-rnr.md`
8. `docs/13-collaboration-workflow.md`
9. The applicable Task Spec

Do not implement an arbitrary interpretation when documents conflict. After implementation, the final Machine SoT for contracts is the Zod schema in `packages/contracts`.

## 2. Product principles

- Do not modify user source files directly.
- Perform JSX injection only on build output.
- Do not automatically translate original event names or permanently redefine their meaning.
- Use `data-atlas-id` only for DOM matching in the current build, never as a persistent link ID.
- Use `(analyticsProvider, eventName)` as the default logical event key.
- Treat `dataLayer.push(...)` as a GTM Emitter and do not infer its destination Provider arbitrarily.
- By default, inject only into native elements whose JSX tag names begin with a lowercase letter.
- Uppercase Custom Components, Fragments, and Portals are outside the MVP overlay-injection scope.
- Do not remove detection results for Custom Component events from the dashboard.
- Tracking calls made through wrappers are not officially supported in the MVP.
- Warn about possible wrapper usage when an SDK import exists but there are no direct calls.
- Distinguish GA4 automatically collected and Enhanced Measurement events from ordinary data-only events.
- Do not automatically combine metrics from multiple Providers.
- Keep GA4 Result Status separate from Data Quality Flags.
- Use the GA4 Property Reporting Time Zone as the default GA4 timezone.
- Do not store secrets in browser bundles, `VITE_*`, localStorage, Git, or logs.
- Do not add a database.
- Natural-language features must not block completion of the Core MVP.

## 3. Phase 0 parallel-development principles

During Pre-Phase 0, B, C, and D research and propose Contract Inputs for their own domains, and A resolves conflicts. A proposal is not a Shared Contract until A approves it.

Phase 0 is not intended to freeze detailed implementations. Its purpose is to establish **a baseline that lets B, C, and D start concurrently with mocks**.

Required baseline:

- Minimum Zod Contract
- `fixtures/mock-manifest.json`
- `fixtures/mock-ga4-health.json`
- `fixtures/mock-query-result.json`
- Runtime API Mock
- Demo App Shell
- Package Skeleton

Do not create a structure in which other owners wait for A to implement every core component.

## 4. Contract changes

Create an ADR from `templates/adr.md` before changing a shared contract.

It must include:

- Reason for the change
- Producer impact
- Consumer impact
- Compatibility
- Migration
- Contract tests

## 5. Prohibited actions

- Passing API secrets through `VITE_*`
- Treating GA4 and GTM as the same concept
- Allowing an LLM to invent and query an event that does not exist
- Concluding that no recent GA4 result automatically means an implementation error
- Silently ignoring unsupported patterns
- Allowing a feature owner to change a shared contract unilaterally
- Reporting completion while tests are failing

## 6. Completion report

- Implemented scope
- Incomplete scope
- Changed files
- Contract impact
- Producer/Consumer impact
- Test results
- Performance impact
- Security impact
- Known limitations
- Reproduction commands
- Handoff
