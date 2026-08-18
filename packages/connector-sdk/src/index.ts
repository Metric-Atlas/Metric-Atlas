/**
 * AnalyticsConnector 계약 (docs/08 §5, §6 기반)
 *
 * NOTE: 이 타입들은 packages/contracts Zod Schema가 Freeze되면 그쪽으로
 * 이관하고 여기서는 re-export만 남깁니다 (C-IMPL-001 Handoff 참조).
 * docs/20이 Proposed인 동안 docs/08 현행 기준선만 표현합니다.
 */

export type AnalyticsProvider =
  | "ga4"
  | "mixpanel"
  | "meta"
  | "posthog"
  | "amplitude"
  | "unknown";

export type ResultStatus = "ok" | "no_rows" | "unauthorized" | "unsupported" | "error";

export type DataQualityFlag =
  | "subject_to_thresholding"
  | "other_row_data_loss"
  | "recent_data_may_change";

export type MetricType = "event_count" | "comparison" | "custom";

export type DateRange =
  | { preset: string; startDate?: never; endDate?: never }
  | { preset?: never; startDate: string; endDate: string };

export interface NormalizedAnalyticsResult {
  provider: "ga4";
  eventKey?: string;
  metricType: MetricType;
  resultStatus: ResultStatus;
  value?: number;
  previousValue?: number;
  dateRange: DateRange;
  reportingTimezone: string;
  fetchedAt: string;
  qualityFlags: DataQualityFlag[];
  providerMetadata?: Record<string, unknown>;
}

/** credential은 Node Runtime에서만 해석 — 참조 이름만 계약에 노출 (docs/08 §5) */
export interface ConnectorContext {
  provider: AnalyticsProvider;
  propertyId: string;
  credentialRef: string;
}

export interface ConnectionResult {
  success: boolean;
  provider: AnalyticsProvider;
  propertyId: string;
  reportingTimezone?: string;
  errorCode?: string;
}

export interface ProviderAgnosticQuery {
  eventKey?: string;
  eventName: string;
  metric: MetricType;
  dateRange: DateRange;
  /** metric="comparison"일 때 필수 — docs/08 QueryPlan.comparisonRange와 대응 */
  comparisonRange?: DateRange;
  breakdowns?: string[];
  filters?: Record<string, string>;
}

export interface ConnectorCapabilities {
  supportedMetrics: MetricType[];
  supportedDimensions: string[];
  comparisonSupport: boolean;
  adminMetadataSupport: boolean;
}

export interface AnalyticsConnector {
  testConnection(context: ConnectorContext): Promise<ConnectionResult>;
  query(
    context: ConnectorContext,
    query: ProviderAgnosticQuery,
  ): Promise<NormalizedAnalyticsResult>;
  capabilities(): ConnectorCapabilities;
}
