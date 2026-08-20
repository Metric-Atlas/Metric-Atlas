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
GET  /__metric-atlas/api/runtime-health
GET  /__metric-atlas/api/manifest
GET  /__metric-atlas/api/health
POST /__metric-atlas/api/llm/generate
```

`/llm/generate` calls an openai-compatible `/chat/completions` endpoint when `METRIC_ATLAS_LLM_API_KEY` or `OPENAI_API_KEY` is configured in the Node Runtime environment. It fails closed with `missing_llm_api_key` when no runtime key is present.
