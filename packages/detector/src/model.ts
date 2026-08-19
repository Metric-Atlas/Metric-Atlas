export type AnalyticsProvider =
  | "ga4"
  | "mixpanel"
  | "meta"
  | "posthog"
  | "amplitude"
  | "unknown";

export type TrackingEmitter =
  | "ga4"
  | "gtm"
  | "mixpanel"
  | "meta"
  | "posthog"
  | "amplitude"
  | "custom"
  | "unknown";

export type ProviderDetectionConfidence =
  | "provider_exact"
  | "provider_configured"
  | "provider_unknown";

export type BindingConfidence =
  | "binding_exact"
  | "binding_inferred"
  | "binding_unresolved";

export type ScanWarningCode =
  | "DYNAMIC_EVENT_NAME"
  | "POSSIBLE_WRAPPER_USAGE"
  | "CUSTOM_COMPONENT_OVERLAY_UNSUPPORTED"
  | "PARSE_ERROR"
  | "DYNAMIC_PARAMETER_KEY"
  | "UNRESOLVED_EVENT_BINDING"
  | "PORTAL_OVERLAY_UNSUPPORTED"
  | "ATLAS_ATTRIBUTE_CONFLICT";

export interface SourceLocation {
  file: string;
  line: number;
  column?: number;
}

export interface ElementLocation {
  type: string;
  file: string;
  line: number;
  column?: number;
}

export interface DetectedEvent {
  eventKey: string;
  /** Proposed Phase 0 extension. Always emitted by this producer. */
  implementationKey?: string;
  eventName: string;
  emitter: TrackingEmitter;
  analyticsProvider: AnalyticsProvider;
  providerDetectionConfidence: ProviderDetectionConfidence;
  parameters: string[];
  source: SourceLocation;
  overlaySupported: boolean;
}

export interface ElementBinding {
  atlasDomId: string;
  eventKeys: string[];
  /** Proposed Phase 0 extension. Always emitted by this producer. */
  implementationKeys?: string[];
  element: ElementLocation;
  bindingConfidence: BindingConfidence;
}

export interface ScanWarning {
  code: ScanWarningCode | (string & {});
  file?: string;
  line?: number;
  message?: string;
  relatedImplementationKey?: string;
}

export interface TrackingSummary {
  name: TrackingEmitter;
  eventCount: number;
}

export interface ProviderSummary {
  name: AnalyticsProvider;
  eventCount: number;
}

export interface ManifestSummaries {
  emitters: TrackingSummary[];
  analyticsProviders: ProviderSummary[];
}

export interface ScanStats {
  filesScanned: number;
  durationMs: number;
  eventsDetected: number;
}

export interface EventManifest {
  version: string;
  buildId: string;
  generatedAt: string;
  events: DetectedEvent[];
  bindings: ElementBinding[];
  warnings: ScanWarning[];
  summaries?: ManifestSummaries;
  scanStats?: ScanStats;
}

export interface SourceTransformResult {
  code: string;
  map: object | null;
  changed: boolean;
}

export interface SourceAnalysis {
  events: DetectedEvent[];
  bindings: ElementBinding[];
  warnings: ScanWarning[];
  transform: SourceTransformResult;
}

export interface ManifestParts {
  events: DetectedEvent[];
  bindings: ElementBinding[];
  warnings: ScanWarning[];
}
