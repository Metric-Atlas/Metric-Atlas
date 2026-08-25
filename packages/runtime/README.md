# @metric-atlas/runtime

Local Node Runtime for Metric Atlas dashboard and API proxy boundaries.

```bash
metric-atlas serve ./dist --env ./.env.metric-atlas --port 8787
```

## GA4 Health setup

Create a Runtime env file. The service account JSON path must point to a file on
the machine running the Runtime.

```bash
cat > .env.metric-atlas <<'EOF'
METRIC_ATLAS_GA4_PROPERTY_ID=123456789
GOOGLE_APPLICATION_CREDENTIALS=/secure/path/metric-atlas-reader.json
METRIC_ATLAS_GA4_HEALTH_WINDOW_DAYS=30
METRIC_ATLAS_GA4_RECENT_WINDOW_HOURS=48
METRIC_ATLAS_CACHE_TTL_SECONDS=300
EOF
```

Run the Runtime:

```bash
metric-atlas serve ./dist --env ./.env.metric-atlas --host 127.0.0.1 --port 8787
```

Verify:

```bash
curl http://127.0.0.1:8787/__metric-atlas/api/runtime-health
curl http://127.0.0.1:8787/__metric-atlas/api/health
```

Then open the Analytics Health Dashboard in a browser (`packages/dashboard`, ADR-009 — bundled with this package, not a separate install):

```text
http://127.0.0.1:8787/__metric-atlas/dashboard
```

Move it with `--dashboard-path` if that route collides with something on your own site:

```bash
metric-atlas serve ./dist --dashboard-path /my-dashboard
```

For a deployed server, store the JSON as a server secret, not in Git or in
browser-facing `VITE_*` variables. If the host only supports string secrets:

```bash
base64 -i /secure/path/metric-atlas-reader.json | pbcopy
```

Configure:

```bash
METRIC_ATLAS_GA4_PROPERTY_ID=123456789
METRIC_ATLAS_GA4_SERVICE_ACCOUNT_JSON_BASE64=<PASTE_BASE64_VALUE>
```

Then restore the key in the server start command before running the Runtime:

```bash
echo "$METRIC_ATLAS_GA4_SERVICE_ACCOUNT_JSON_BASE64" | base64 -d > /tmp/metric-atlas-ga4.json
export GOOGLE_APPLICATION_CREDENTIALS=/tmp/metric-atlas-ga4.json
metric-atlas serve ./dist --host 0.0.0.0 --port "$PORT"
```

Runtime responsibilities:

- serve the consumer's built site (`DIST_DIR` argument)
- serve the bundled Analytics Health Dashboard (`packages/dashboard`) at a configurable path
- expose `/__metric-atlas/api/*`
- read GA4/LLM credentials from Node environment or `--env`
- keep credentials out of the browser bundle, manifest, fixture, and localStorage

Implemented endpoints:

```text
GET  /__metric-atlas/api/runtime-health
GET  /__metric-atlas/api/manifest
GET  /__metric-atlas/api/health
POST /__metric-atlas/api/llm/generate
GET  /__metric-atlas/dashboard/*   (default path, see --dashboard-path)
```

`/llm/generate` calls an LLM provider when `METRIC_ATLAS_LLM_API_KEY` or `OPENAI_API_KEY` is configured in the Node Runtime environment. It fails closed with `missing_llm_api_key` when no runtime key is present.

Provider env vars:

| Variable | Default | Notes |
|---|---|---|
| `METRIC_ATLAS_LLM_API_KEY` / `OPENAI_API_KEY` | (required) | API key for the configured provider |
| `METRIC_ATLAS_LLM_PROVIDER` | `openai` | `openai` or `anthropic`; anything else falls back to `openai` |
| `METRIC_ATLAS_LLM_BASE_URL` | `https://api.openai.com/v1` (openai) / `https://api.anthropic.com/v1` (anthropic) | any endpoint that speaks the same request/response shape as the selected provider works, e.g. an OpenAI-compatible gateway |
| `METRIC_ATLAS_LLM_MODEL` | `gpt-4o-mini` (openai) / `claude-haiku-4-5-20251001` (anthropic) | |

`openai` calls `{baseUrl}/chat/completions` (Chat Completions shape); `anthropic` calls `{baseUrl}/messages` (Messages API shape, `x-api-key` auth). The dashboard's own BYOK panel (when no runtime key is configured) mirrors this same provider split and calls the provider directly from the browser instead of relaying through this route.
