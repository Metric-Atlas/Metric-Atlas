import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const externalRuntime = process.env.METRIC_ATLAS_RUNTIME_ORIGIN;
const runtimeOrigin = externalRuntime ?? "http://127.0.0.1:8787";

// base: "./" — this bundle is served by @metric-atlas/runtime at a configurable
// sub-path (default /__metric-atlas/dashboard, see --dashboard-path), never at
// the site root, so asset references must be relative rather than absolute.
// fixtures/ lives at the repo root, outside this package's root — allow reading it.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5190,
    strictPort: true,
    fs: { allow: ["../.."] },
    proxy: {
      "/__metric-atlas/api": {
        target: runtimeOrigin,
        changeOrigin: true,
      },
    },
  },
  test: { environment: "node", include: ["test/**/*.test.ts"] },
});
