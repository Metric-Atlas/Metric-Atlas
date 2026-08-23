# Builds the Metric Atlas demo app (apps/demo-react-vite) with the Vite plugin
# enabled, then serves it via the Single Node Runtime (packages/runtime,
# `metric-atlas serve`). Runtime and static assets share one origin, so the
# demo app's runtime->fixture fallback fetches (`/__metric-atlas/api/manifest`,
# `/__metric-atlas/api/health`) work without CORS/proxy configuration.
#
# GA4 credentials are provided at container start via environment variables
# (METRIC_ATLAS_GA4_PROPERTY_ID + METRIC_ATLAS_GA4_SERVICE_ACCOUNT_JSON_BASE64),
# never baked into the image. See packages/runtime/README.md.

FROM node:22-bookworm-slim AS build

RUN corepack enable

WORKDIR /app
COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm build
RUN pnpm --filter @metric-atlas/demo-react-vite build

FROM node:22-bookworm-slim

RUN corepack enable
ENV NODE_ENV=production

WORKDIR /app
COPY --from=build /app /app

EXPOSE 8080

CMD ["node", "packages/cli/dist/bin.js", "serve", "apps/demo-react-vite/dist", "--host", "0.0.0.0", "--port", "8080"]
