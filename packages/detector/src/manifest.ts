import { createHash } from "node:crypto";
import type {
  AnalyticsProvider,
  EventManifest,
  ManifestParts,
  ManifestSummaries,
  ScanStats,
  TrackingEmitter,
} from "./model.js";

export const MANIFEST_VERSION = "0.1";

export function shortHash(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 12);
}

export function createBuildId(seed: string): string {
  return `build_${shortHash(seed)}`;
}

export function createManifest(
  parts: ManifestParts,
  options: {
    buildId: string;
    generatedAt?: string;
    scanStats?: ScanStats;
    version?: string;
  },
): EventManifest {
  const manifest: EventManifest = {
    version: options.version ?? MANIFEST_VERSION,
    buildId: options.buildId,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    events: parts.events,
    bindings: parts.bindings,
    warnings: parts.warnings,
    summaries: summarize(parts),
  };
  if (options.scanStats) manifest.scanStats = options.scanStats;
  return manifest;
}

function summarize(parts: ManifestParts): ManifestSummaries {
  const emitters = new Map<TrackingEmitter, number>();
  const providers = new Map<AnalyticsProvider, number>();
  for (const event of parts.events) {
    emitters.set(event.emitter, (emitters.get(event.emitter) ?? 0) + 1);
    providers.set(
      event.analyticsProvider,
      (providers.get(event.analyticsProvider) ?? 0) + 1,
    );
  }
  return {
    emitters: [...emitters]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, eventCount]) => ({ name, eventCount })),
    analyticsProviders: [...providers]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, eventCount]) => ({ name, eventCount })),
  };
}
