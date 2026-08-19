import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import metricAtlas from "@metric-atlas/vite";

const externalRuntime = process.env.METRIC_ATLAS_RUNTIME_ORIGIN;
const runtimeOrigin = externalRuntime ?? "http://127.0.0.1:8787";

// fixtures/ lives at the repo root, outside this app's root — allow reading it.
export default defineConfig({
  plugins: [
    metricAtlas({
      overlay: { enabled: true },
      // METRIC_ATLAS_RUNTIME_ORIGIN을 명시하면 /__metric-atlas/api/manifest가
      // dev 서버 자신의 showcase manifest에 가로채이지 않고 proxy를 타야 한다
      // (안 그러면 Dashboard의 manifest 카드와 health 목록이 서로 다른 소스를 봄).
      // showcase overlay용 자체 manifest는 proxy 매칭 밖의 dev 경로로 옮긴다.
      ...(externalRuntime ? { manifestEndpoint: "/__metric-atlas/dev/manifest" } : {}),
    }),
    react(),
  ],
  server: {
    host: "127.0.0.1",
    port: 5180,
    strictPort: true,
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
