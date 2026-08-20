import type { Plugin } from "vite";

/**
 * Hand-maintained public type surface for the standalone distribution (issue #32,
 * docs/adr/ADR-008). The real multi-file `.d.ts` emitted by `tsc -b` cross-imports types
 * from `@metric-atlas/contracts`/`@metric-atlas/detector`, which are inlined at runtime for
 * this distribution and are not separately installable — so this file is a simplified,
 * self-contained substitute for the same public API, not a generated artifact.
 *
 * Keep in sync with `packages/vite/src/index.ts` whenever `MetricAtlasViteOptions` or the
 * plugin's exported shape changes.
 */

export type DetectorAdapterName =
  | "ga4"
  | "gtm"
  | "mixpanel"
  | "meta"
  | "posthog"
  | "amplitude";

export interface MetricAtlasViteOptions {
  enabled?: boolean;
  include?: string[];
  exclude?: string[];
  manifestFile?: string;
  manifestEndpoint?: string;
  buildId?: string;
  /** Defaults to ["ga4", "gtm"]. */
  detectors?: DetectorAdapterName[];
  overlay?: {
    enabled?: boolean;
  };
}

export interface MetricAtlasPluginApi {
  /** Shape matches the `EventManifest` Zod contract in `@metric-atlas/contracts`. */
  getManifest(): unknown;
}

export interface MetricAtlasPlugin extends Plugin {
  api: MetricAtlasPluginApi;
}

declare function metricAtlas(options?: MetricAtlasViteOptions): MetricAtlasPlugin;

export default metricAtlas;

export const VIRTUAL_OVERLAY_ID: string;
