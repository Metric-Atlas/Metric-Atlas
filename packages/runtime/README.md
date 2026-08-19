# @metric-atlas/runtime

Local Node Runtime for Metric Atlas dashboard and API proxy boundaries.

```bash
metric-atlas serve ./dist --env ./.env.metric-atlas --port 8787
```

Runtime responsibilities:

- serve built dashboard assets
- expose `/__metric-atlas/api/*`
- read GA4/LLM credentials from Node environment or `--env`
- keep credentials out of the browser bundle, manifest, fixture, and localStorage

Implemented endpoints:

```text
GET  /__metric-atlas/api/health
GET  /__metric-atlas/api/manifest
POST /__metric-atlas/api/llm/generate
```

`/llm/generate` intentionally returns `501 llm_adapter_not_implemented` until a provider adapter PR adds real LLM calls.
