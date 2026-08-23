import type {
  AnalyticsHealthReport,
  DetectedEvent,
  ElementBinding,
  EventManifest,
  HealthItem as ContractHealthItem,
  ProviderDetectionConfidence as ContractProviderDetectionConfidence,
} from "@metric-atlas/contracts";

export type ProviderDetectionConfidence = ContractProviderDetectionConfidence;
export type ManifestEvent = DetectedEvent;
export type ManifestBinding = ElementBinding;
export type Manifest = EventManifest;
export type HealthItem = ContractHealthItem;
export type Ga4Health = AnalyticsHealthReport;

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
  gtmRoute: GtmRoute | null;
}

export interface GtmRoute {
  eventKey: string;
  gtmEventName: string;
  triggerName: string;
  tagName: string;
  destinationProvider: "ga4" | "unknown";
  destinationEventName: string;
  measurementId?: string;
  confidence: "exact" | "unresolved";
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
