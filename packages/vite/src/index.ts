import path from "node:path";
import { fileURLToPath } from "node:url";
import type { EventManifest } from "@metric-atlas/contracts";
import {
  analyzeSource,
  createBuildId,
  createManifest,
  DEFAULT_EXCLUDE,
  DEFAULT_INCLUDE,
  detectorAdaptersFor,
  toPosix,
  type DetectorAdapterName,
  type SourceAnalysis,
} from "@metric-atlas/detector";
import { minimatch } from "minimatch";
import { normalizePath, type Plugin, type ResolvedConfig } from "vite";

const VIRTUAL_OVERLAY_ID = "virtual:metric-atlas-overlay-entry";
const RESOLVED_VIRTUAL_OVERLAY_ID = `\0${VIRTUAL_OVERLAY_ID}`;
const DEFAULT_MANIFEST_ENDPOINT = "/__metric-atlas/api/manifest";

export interface MetricAtlasViteOptions {
  enabled?: boolean;
  include?: string[];
  exclude?: string[];
  manifestFile?: string;
  manifestEndpoint?: string;
  buildId?: string;
  /** DEC-037: defaults to ["ga4", "gtm"]. */
  detectors?: DetectorAdapterName[];
  overlay?: {
    enabled?: boolean;
  };
}

export interface MetricAtlasPluginApi {
  getManifest(): EventManifest;
}

export interface MetricAtlasPlugin extends Plugin {
  api: MetricAtlasPluginApi;
}

export default function metricAtlas(
  options: MetricAtlasViteOptions = {},
): MetricAtlasPlugin {
  const enabled = options.enabled ?? true;
  const include = options.include ?? DEFAULT_INCLUDE;
  const exclude = options.exclude ?? DEFAULT_EXCLUDE;
  const manifestFile = options.manifestFile ?? ".metric-atlas/manifest.json";
  const manifestEndpoint = options.manifestEndpoint ?? DEFAULT_MANIFEST_ENDPOINT;
  const overlayEnabled = options.overlay?.enabled ?? true;
  const adapters = options.detectors
    ? detectorAdaptersFor(options.detectors)
    : undefined;
  const overlayModuleId = normalizePath(
    fileURLToPath(import.meta.resolve("@metric-atlas/overlay")),
  );
  let config: ResolvedConfig | null = null;
  let generatedAt = new Date().toISOString();
  let buildId = options.buildId ?? createBuildId(generatedAt);
  let durationMs = 0;
  const analyses = new Map<string, SourceAnalysis>();
  const transformCache = new Map<
    string,
    { buildId: string; source: string; analysis: SourceAnalysis }
  >();

  const removeFile = (id: string): void => {
    if (!config) return;
    const file = sourceFile(id);
    if (!file) return;
    const relativeFile = toPosix(path.relative(config.root, file));
    analyses.delete(relativeFile);
    transformCache.delete(relativeFile);
  };

  const currentManifest = (): EventManifest => {
    const values = [...analyses.values()];
    const events = values.flatMap((analysis) => analysis.events);
    return createManifest(
      {
        events,
        bindings: values.flatMap((analysis) => analysis.bindings),
        warnings: values.flatMap((analysis) => analysis.warnings),
      },
      {
        buildId,
        generatedAt,
        scanStats: {
          filesScanned: values.length,
          durationMs: Math.round(durationMs * 100) / 100,
          eventsDetected: events.length,
        },
      },
    );
  };

  const plugin: MetricAtlasPlugin = {
    name: "metric-atlas",
    enforce: "pre",
    api: { getManifest: currentManifest },

    configResolved(resolvedConfig) {
      config = resolvedConfig;
    },

    buildStart() {
      analyses.clear();
      transformCache.clear();
      durationMs = 0;
      generatedAt = new Date().toISOString();
      buildId =
        options.buildId ??
        createBuildId(`${config?.root ?? process.cwd()}:${generatedAt}`);
    },

    resolveId(id) {
      if (id === VIRTUAL_OVERLAY_ID) return RESOLVED_VIRTUAL_OVERLAY_ID;
      return null;
    },

    load(id) {
      if (id !== RESOLVED_VIRTUAL_OVERLAY_ID) return null;
      return [
        `import { mountMetricAtlasOverlay } from ${JSON.stringify(overlayModuleId)};`,
        "const mount = () => mountMetricAtlasOverlay({",
        `  manifestUrl: ${JSON.stringify(manifestEndpoint)}`,
        "});",
        'if (document.readyState !== "complete") {',
        '  window.addEventListener("load", mount, { once: true });',
        "} else {",
        "  mount();",
        "}",
      ].join("\n");
    },

    transform(source, id, transformOptions) {
      if (!enabled || transformOptions?.ssr || !config) return null;
      const file = sourceFile(id);
      if (!file) return null;
      const relativeFile = toPosix(path.relative(config.root, file));
      if (!isIncluded(relativeFile, include, exclude)) return null;

      const cached = transformCache.get(relativeFile);
      let analysis: SourceAnalysis;
      if (cached?.buildId === buildId && cached.source === source) {
        analysis = cached.analysis;
      } else {
        const startedAt = performance.now();
        analysis = analyzeSource(source, {
          file: relativeFile,
          buildId,
          ...(adapters ? { adapters } : {}),
        });
        durationMs += performance.now() - startedAt;
        transformCache.set(relativeFile, { buildId, source, analysis });
      }
      analyses.set(relativeFile, analysis);
      if (!analysis.transform.changed) return null;
      return {
        code: analysis.transform.code,
        map: analysis.transform.map
          ? JSON.stringify(analysis.transform.map)
          : null,
      };
    },

    watchChange(id, change) {
      if (change.event === "delete") removeFile(id);
    },

    transformIndexHtml: {
      order: "pre",
      handler() {
        if (!enabled || !overlayEnabled) return [];
        return [
          {
            tag: "script",
            attrs: { type: "module" },
            children: `import ${JSON.stringify(VIRTUAL_OVERLAY_ID)};`,
            injectTo: "body",
          },
        ];
      },
    },

    configureServer(server) {
      if (!enabled) return;
      const onUnlink = (file: string): void => removeFile(file);
      server.watcher.on("unlink", onUnlink);
      server.httpServer?.once("close", () => {
        server.watcher.off("unlink", onUnlink);
      });
      server.middlewares.use((request, response, next) => {
        const requestPath = request.url?.split("?", 1)[0];
        if (requestPath !== manifestEndpoint) {
          next();
          return;
        }
        response.statusCode = 200;
        response.setHeader("Content-Type", "application/json; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.end(JSON.stringify(currentManifest()));
      });
    },

    generateBundle() {
      if (!enabled) return;
      const manifest = currentManifest();
      this.emitFile({
        type: "asset",
        fileName: manifestFile,
        source: `${JSON.stringify(manifest, null, 2)}\n`,
      });
      config?.logger.info(
        `[metric-atlas] scanned ${manifest.scanStats?.filesScanned ?? 0} files in ${manifest.scanStats?.durationMs ?? 0}ms; detected ${manifest.events.length} events`,
      );
    },
  };

  return plugin;
}

function sourceFile(id: string): string | null {
  if (id.startsWith("\0") || id.includes("node_modules")) return null;
  const file = id.split("?", 1)[0];
  return file ? path.resolve(file) : null;
}

function isIncluded(
  relativeFile: string,
  include: readonly string[],
  exclude: readonly string[],
): boolean {
  if (relativeFile.startsWith("../") || path.isAbsolute(relativeFile)) return false;
  return (
    include.some((pattern) => minimatch(relativeFile, pattern, { dot: false })) &&
    !exclude.some((pattern) => minimatch(relativeFile, pattern, { dot: true }))
  );
}

export { VIRTUAL_OVERLAY_ID };
