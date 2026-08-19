import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const runtimeOrigin = process.env.METRIC_ATLAS_RUNTIME_ORIGIN ?? "http://127.0.0.1:8787";

// fixtures/ lives at the repo root, outside this app's root — allow reading it.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    fs: { allow: ["../.."] },
    proxy: {
      "/__metric-atlas/api": {
        target: runtimeOrigin,
        changeOrigin: true
      }
    }
  },
  test: { environment: "node", include: ["src/**/*.test.ts"] }
});
