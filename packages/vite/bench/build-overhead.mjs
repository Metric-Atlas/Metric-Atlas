import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { build } from "vite";
import metricAtlas from "../dist/index.js";

const FILE_COUNT = 200;
const root = await mkdtemp(path.join(os.tmpdir(), "metric-atlas-benchmark-"));
const sourceDirectory = path.join(root, "src");

try {
  await mkdir(sourceDirectory);
  await writeFile(
    path.join(root, "index.html"),
    '<script type="module" src="/src/main.tsx"></script>',
  );

  const imports = [];
  const componentNames = [];
  for (let index = 0; index < FILE_COUNT; index += 1) {
    const componentName = `Component${index}`;
    imports.push(`import { ${componentName} } from "./Component${index}";`);
    componentNames.push(componentName);
    await writeFile(
      path.join(sourceDirectory, `Component${index}.tsx`),
      `export const ${componentName} = () => <button onClick={() => gtag("event", "benchmark_${index}", { index: ${index} })}>${index}</button>;`,
    );
  }
  await writeFile(
    path.join(sourceDirectory, "main.tsx"),
    `${imports.join("\n")}\nglobalThis.__benchmarkComponents = [${componentNames.join(",")}];`,
  );

  const jsxRuntime = fileURLToPath(import.meta.resolve("react/jsx-runtime"));
  const jsxDevRuntime = fileURLToPath(import.meta.resolve("react/jsx-dev-runtime"));
  const commonConfig = {
    root,
    configFile: false,
    logLevel: "silent",
    resolve: {
      alias: {
        "react/jsx-runtime": jsxRuntime,
        "react/jsx-dev-runtime": jsxDevRuntime,
      },
    },
  };

  const baselineStartedAt = performance.now();
  await build({
    ...commonConfig,
    plugins: [react()],
    build: { outDir: "dist-baseline" },
  });
  const baselineMs = performance.now() - baselineStartedAt;

  const metricAtlasStartedAt = performance.now();
  await build({
    ...commonConfig,
    plugins: [metricAtlas({ buildId: "benchmark", overlay: { enabled: false } }), react()],
    build: { outDir: "dist-metric-atlas" },
  });
  const metricAtlasMs = performance.now() - metricAtlasStartedAt;
  const overheadMs = metricAtlasMs - baselineMs;
  const overheadPercent = baselineMs === 0 ? 0 : (overheadMs / baselineMs) * 100;
  const passed =
    baselineMs < 10_000 ? overheadMs <= 2_000 : overheadPercent <= 20;

  process.stdout.write(
    `${JSON.stringify(
      {
        files: FILE_COUNT,
        baselineMs: round(baselineMs),
        metricAtlasMs: round(metricAtlasMs),
        overheadMs: round(overheadMs),
        overheadPercent: round(overheadPercent),
        acceptance: baselineMs < 10_000 ? "absolute overhead <= 2000ms" : "overhead <= 20%",
        passed,
      },
      null,
      2,
    )}\n`,
  );
  if (!passed) process.exitCode = 1;
} finally {
  await rm(root, { recursive: true, force: true });
}

function round(value) {
  return Math.round(value * 100) / 100;
}
