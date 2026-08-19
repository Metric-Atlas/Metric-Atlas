import type {
  AnalyticsProvider,
  DetectedEvent,
  ElementBinding,
  EventManifest,
  ScanWarning,
  TrackingEmitter,
} from "@metric-atlas/contracts";

export type {
  AnalyticsProvider,
  BindingConfidence,
  DetectedEvent,
  ElementBinding,
  ElementLocation,
  EventManifest,
  ManifestSummaries,
  ProviderDetectionConfidence,
  ScanStats,
  ScanWarning,
  SourceLocation,
  TrackingEmitter,
} from "@metric-atlas/contracts";

export type ScanWarningCode =
  | "DYNAMIC_EVENT_NAME"
  | "POSSIBLE_WRAPPER_USAGE"
  | "CUSTOM_COMPONENT_OVERLAY_UNSUPPORTED"
  | "PARSE_ERROR"
  | "DYNAMIC_PARAMETER_KEY"
  | "UNRESOLVED_EVENT_BINDING"
  | "PORTAL_OVERLAY_UNSUPPORTED"
  | "ATLAS_ATTRIBUTE_CONFLICT";

export interface TrackingSummary {
  name: TrackingEmitter;
  eventCount: number;
}

export interface ProviderSummary {
  name: AnalyticsProvider;
  eventCount: number;
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
