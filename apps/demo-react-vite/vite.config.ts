import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import metricAtlas from "@metric-atlas/vite";

// fixtures/ lives at the repo root, outside this app's root — allow reading it.
export default defineConfig({
  plugins: [
    metricAtlas({
      overlay: { enabled: true },
    }),
    react(),
  ],
  server: { host: "127.0.0.1", port: 5180, strictPort: true, fs: { allow: ["../.."] } },
  test: { environment: "node", include: ["src/**/*.test.ts"] }
});
