export type ProviderDetectionConfidence = "provider_exact" | "provider_unknown";

export interface ManifestEvent {
  eventKey: string;
  implementationKey: string;
  eventName: string;
  emitter: string;
  analyticsProvider: string;
  providerDetectionConfidence: ProviderDetectionConfidence;
  parameters: string[];
  source: { file: string; line: number; column: number };
  overlaySupported: boolean;
}

export interface ManifestBinding {
  atlasDomId: string;
  eventKeys: string[];
  implementationKeys?: string[];
  element: { type: string; file: string; line: number; column: number };
  bindingConfidence: string;
}

export interface Manifest {
  version: string;
  buildId: string;
  generatedAt: string;
  events: ManifestEvent[];
  bindings: ManifestBinding[];
  summaries?: unknown;
  warnings?: unknown[];
  scanStats: { filesScanned: number; durationMs: number; eventsDetected: number };
}

export interface ParameterRegistrationState {
  parameter: string;
  state: "builtin" | "registered_custom_dimension" | "not_registered" | "unknown";
}

export interface HealthItem {
  eventKey: string;
  eventName: string;
  codeState: "detected" | "not_detected";
  ga4ObservationState: "observed" | "not_observed";
  ga4ManagedState: "managed" | "not_managed";
  parameterRegistrationStates: ParameterRegistrationState[];
  latestMeasurement: {
    resultStatus: "ok" | "no_rows" | "unauthorized" | "unsupported" | "error";
    value?: number;
    qualityFlags: string[];
  };
  reviewReason: string | null;
}

export interface Ga4Health {
  generatedAt: string;
  provider: string;
  propertyId: string;
  reportingTimezone: string;
  summary: {
    healthy: number;
    codeOnly: number;
    ga4Only: number;
    ga4Managed: number;
    parameterRegistrationGap: number;
    unresolved: number;
  };
  items: HealthItem[];
}

export type HealthBucket =
  | "healthy"
  | "codeOnly"
  | "ga4Only"
  | "ga4Managed"
  | "parameterRegistrationGap"
  | "unresolved"
  | "noHealth";

/** Manifest event joined with its GA4 health item by eventKey. */
export interface JoinedRow {
  eventKey: string;
  eventName: string;
  event: ManifestEvent | null;
  health: HealthItem | null;
  bindings: ManifestBinding[];
  bucket: HealthBucket;
}

export type AnalysisType = "definition" | "event_count" | "comparison";

export interface QueryPlanDraft {
  version: "1";
  analysisType: AnalysisType;
  eventKeys: string[];
  dateRange?: { preset: string };
  comparisonRange?: { preset: string };
  filters: unknown[];
  breakdowns: unknown[];
  sourceRefs: string[];
  assumptions: unknown[];
}

export interface QueryOutcome {
  plan: QueryPlanDraft;
  blocked: boolean;
  /** "실행 가능" | "실행 차단" | "실행 불필요" */
  statusLabel: string;
  statusReason: string;
  result: null | {
    value: string;
    previousValue?: string;
    dateRange: string;
    comparisonDateRange?: string;
    deltaPercent?: number;
    resultStatus: string;
    reportingTimezone: string;
    fetchedAt: string;
  };
  noResultReason: string;
}
