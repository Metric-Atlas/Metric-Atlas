import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import react from "@vitejs/plugin-react";
import { build } from "vite";
import metricAtlas from "../dist/index.js";

const workspaceRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
const demoRoot = path.join(workspaceRoot, "apps", "demo-react-vite");
const temporaryRoot = await mkdtemp(
  path.join(os.tmpdir(), "metric-atlas-demo-benchmark-"),
);

try {
  const baselineDirectory = path.join(temporaryRoot, "baseline");
  const atlasDirectory = path.join(temporaryRoot, "metric-atlas");
  const baselineSamples = [];
  const atlasSamples = [];
  for (let index = 0; index < 5; index += 1) {
    if (index % 2 === 0) {
      baselineSamples.push(await timedBuild(baselineDirectory, false));
      atlasSamples.push(await timedBuild(atlasDirectory, true));
    } else {
      atlasSamples.push(await timedBuild(atlasDirectory, true));
      baselineSamples.push(await timedBuild(baselineDirectory, false));
    }
  }
  const baselineMs = median(baselineSamples);
  const metricAtlasMs = median(atlasSamples);
  const overheadMs = metricAtlasMs - baselineMs;
  const overheadPercent = baselineMs === 0 ? 0 : (overheadMs / baselineMs) * 100;
  const manifest = JSON.parse(
    await readFile(
      path.join(atlasDirectory, ".metric-atlas", "manifest.json"),
      "utf8",
    ),
  );
  const baselineBrowserSource = await bundledJavaScript(baselineDirectory);
  const browserSource = await bundledJavaScript(atlasDirectory);
  const forbiddenSecretMarkers = [
    "GOOGLE_APPLICATION_CREDENTIALS",
    "METRIC_ATLAS_GA4_SERVICE_ACCOUNT_JSON_BASE64",
    "OPENAI_API_KEY",
    "private_key",
  ].filter((marker) => browserSource.includes(marker));
  const passed =
    (baselineMs < 10_000 ? overheadMs <= 2_000 : overheadPercent <= 20) &&
    forbiddenSecretMarkers.length === 0;

  process.stdout.write(
    `${JSON.stringify(
      {
        baselineMs: round(baselineMs),
        metricAtlasMs: round(metricAtlasMs),
        baselineSamplesMs: baselineSamples.map(round),
        metricAtlasSamplesMs: atlasSamples.map(round),
        overheadMs: round(overheadMs),
        overheadPercent: round(overheadPercent),
        scanStats: manifest.scanStats,
        detectedEvents: manifest.events.length,
        bundleBytes: {
          baseline: Buffer.byteLength(baselineBrowserSource),
          metricAtlas: Buffer.byteLength(browserSource),
          delta: Buffer.byteLength(browserSource) - Buffer.byteLength(baselineBrowserSource),
        },
        bundleGzipBytes: {
          baseline: gzipSync(baselineBrowserSource).byteLength,
          metricAtlas: gzipSync(browserSource).byteLength,
          delta:
            gzipSync(browserSource).byteLength -
            gzipSync(baselineBrowserSource).byteLength,
        },
        forbiddenSecretMarkers,
        acceptance:
          baselineMs < 10_000
            ? "absolute overhead <= 2000ms"
            : "relative overhead <= 20%",
        passed,
      },
      null,
      2,
    )}\n`,
  );
  if (!passed) process.exitCode = 1;
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}

async function timedBuild(outDir, withMetricAtlas) {
  const startedAt = performance.now();
  await build({
    root: demoRoot,
    configFile: false,
    logLevel: "silent",
    plugins: [
      ...(withMetricAtlas
        ? [metricAtlas({ buildId: "demo-benchmark", overlay: { enabled: true } })]
        : []),
      react(),
    ],
    build: { outDir, emptyOutDir: true },
  });
  return performance.now() - startedAt;
}

async function bundledJavaScript(directory) {
  const assetsDirectory = path.join(directory, "assets");
  return (
    await Promise.all(
      (await readdir(assetsDirectory))
        .filter((file) => file.endsWith(".js"))
        .map((file) => readFile(path.join(assetsDirectory, file), "utf8")),
    )
  ).join("\n");
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
}
