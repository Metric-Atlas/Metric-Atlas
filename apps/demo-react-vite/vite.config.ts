import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// fixtures/ lives at the repo root, outside this app's root — allow reading it.
export default defineConfig({
  plugins: [react()],
  server: { port: 5180, fs: { allow: ["../.."] } },
  test: { environment: "node", include: ["src/**/*.test.ts"] }
});
