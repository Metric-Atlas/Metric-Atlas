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
METRIC_ATLAS_GA4_PROPERTY_ID=550079255
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

For a deployed server, store the JSON as a server secret, not in Git or in
browser-facing `VITE_*` variables. If the host only supports string secrets:

```bash
base64 -i /secure/path/metric-atlas-reader.json | pbcopy
```

Configure:

```bash
METRIC_ATLAS_GA4_PROPERTY_ID=550079255
METRIC_ATLAS_GA4_SERVICE_ACCOUNT_JSON_BASE64=<PASTE_BASE64_VALUE>
```

Then restore the key in the server start command before running the Runtime:

```bash
echo "$METRIC_ATLAS_GA4_SERVICE_ACCOUNT_JSON_BASE64" | base64 -d > /tmp/metric-atlas-ga4.json
export GOOGLE_APPLICATION_CREDENTIALS=/tmp/metric-atlas-ga4.json
metric-atlas serve ./dist --host 0.0.0.0 --port "$PORT"
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
