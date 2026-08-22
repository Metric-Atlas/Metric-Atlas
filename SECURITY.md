# Security Policy

**English** · [한국어](./SECURITY.ko.md)

## Supported versions

Metric Atlas is pre-1.0 and has not yet had a public release. Only the latest `0.x` line receives security fixes.

| Version | Supported |
| --- | --- |
| latest `0.x` | Yes |
| older `0.x` | No |

## Reporting a vulnerability

Email **limgh2002@gmail.com** with details. Do not open a public GitHub issue for a suspected vulnerability.

Please include, if known:

- Affected package(s) and version/commit
- Reproduction steps or proof of concept
- Impact (e.g. credential exposure, code execution, data exposure)

We aim to acknowledge reports within **5 business days** and to share a remediation timeline once the report is triaged. Coordinated disclosure is preferred: please give us a reasonable window to ship a fix before any public disclosure.

## Scope notes

- Credential handling design (GA4/LLM service account resolution, why credentials never reach the browser bundle) is documented in `docs/09-security-and-secrets.md`.
- This policy covers the packages in this monorepo (`packages/*`) and the `@metric-atlas/vite` distribution described in `docs/adr/ADR-008-standalone-vite-plugin-distribution.md`. It does not cover third-party dependencies — please report those upstream.
