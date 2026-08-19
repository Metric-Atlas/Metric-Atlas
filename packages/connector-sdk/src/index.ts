/**
 * AnalyticsConnector 계약 (docs/08 §5, §6). Contract v0 Freeze(ADR-001/ADR-003) 이후
 * `@metric-atlas/contracts`의 Zod Schema/타입을 그대로 re-export한다.
 */
export type {
  AnalyticsConnector,
  AnalyticsProvider,
  ConnectionResult,
  ConnectorCapabilities,
  ConnectorContext,
  DataQualityFlag,
  DateRange,
  Ga4ObservedEventsResult,
  MetricType,
  NormalizedAnalyticsResult,
  ProviderAgnosticQuery,
  ResultStatus,
} from "@metric-atlas/contracts";

export {
  ConnectionResult as ConnectionResultSchema,
  ConnectorCapabilities as ConnectorCapabilitiesSchema,
  ConnectorContext as ConnectorContextSchema,
  Ga4ObservedEventsResult as Ga4ObservedEventsResultSchema,
  NormalizedAnalyticsResult as NormalizedAnalyticsResultSchema,
  ProviderAgnosticQuery as ProviderAgnosticQuerySchema,
} from "@metric-atlas/contracts";
