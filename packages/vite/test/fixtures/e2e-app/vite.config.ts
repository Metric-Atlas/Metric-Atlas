import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import metricAtlas from "../../../dist/index.js";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [
    metricAtlas({
      buildId: "browser-e2e",
      overlay: { enabled: true },
    }),
    react(),
  ],
  server: {
    host: "127.0.0.1",
    port: 4178,
    strictPort: true,
  },
});
