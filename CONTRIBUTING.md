# Contributing to Metric Atlas

**English** · [한국어](./CONTRIBUTING.ko.md)

Thank you for helping make analytics implementation visible, verifiable, and trustworthy.

## Local quickstart

Requirements: Node.js 22.18 or later.

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm demo
```

Demo Mode uses fixtures and does not require real GA4 credentials.

## Before you begin

Read [AGENTS.md](./AGENTS.md), the project Source of Truth, the decision log, the relevant feature documentation, and the applicable Task Spec before starting a substantial change.

## Working principles

- Do not begin a substantial change without a Task Spec.
- Shared contract changes require an ADR.
- When adding a supported pattern, add the corresponding fixture and detector documentation.
- Changes that modify user source files are not accepted.
- A new connector must implement the `AnalyticsConnector` contract.
- Preserve original event names and keep GA4 and GTM semantics distinct.
- Never expose credentials through browser bundles, `VITE_*`, local storage, Git, or logs.

## Pull request completion checklist

- Unit, fixture, and contract tests pass.
- Relevant documentation is updated.
- Producer and consumer impact is documented for contract changes.
- Performance impact is recorded.
- Secret exposure has been checked.
- Known limitations are listed.
- A handoff is included.

## Areas for contribution

- Detector fixtures and support for additional direct SDK patterns
- Connector adapters that follow the shared contract
- Overlay, dashboard, search, accessibility, and developer-experience improvements
- Reproducible reports for unsupported or unresolved patterns
- Documentation, examples, and translations
- Contract, integration, end-to-end, security, and performance tests

## Public release

Licensed under [MIT](./LICENSE). Semantic Versioning policy, security disclosure path, maintainer list, and release cadence are still to be finalized before the public source release (`docs/18-positioning-and-open-source.md` §4).
