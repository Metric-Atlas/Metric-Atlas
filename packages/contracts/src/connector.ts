import { z } from "zod";
import {
  AnalyticsProvider,
  DataQualityFlag,
  DateRange,
  MetricType,
  ResultStatus,
} from "./common.js";

/** docs/08 §5. Credential is resolved in the Node Runtime; only a reference name crosses the contract. */
export const ConnectorContext = z.object({
  provider: AnalyticsProvider,
  propertyId: z.string(),
  credentialRef: z.string(),
});
export type ConnectorContext = z.infer<typeof ConnectorContext>;

export const ConnectionResult = z.object({
  success: z.boolean(),
  provider: AnalyticsProvider,
  propertyId: z.string(),
  reportingTimezone: z.string().optional(),
  errorCode: z.string().optional(),
});
export type ConnectionResult = z.infer<typeof ConnectionResult>;

/** ADR-003: comparisonRange is required when metric="comparison" (mirrors QueryPlan.comparisonRange). */
export const ProviderAgnosticQuery = z
  .object({
    eventKey: z.string().optional(),
    eventName: z.string(),
    metric: MetricType,
    dateRange: DateRange,
    comparisonRange: DateRange.optional(),
    breakdowns: z.array(z.string()).optional(),
    filters: z.record(z.string()).optional(),
  })
  .refine(
    (query) => query.metric !== "comparison" || query.comparisonRange !== undefined,
    {
      message: 'comparisonRange is required when metric is "comparison"',
      path: ["comparisonRange"],
    },
  );
export type ProviderAgnosticQuery = z.infer<typeof ProviderAgnosticQuery>;

export const ConnectorCapabilities = z.object({
  supportedMetrics: z.array(MetricType),
  supportedDimensions: z.array(z.string()),
  comparisonSupport: z.boolean(),
  adminMetadataSupport: z.boolean(),
});
export type ConnectorCapabilities = z.infer<typeof ConnectorCapabilities>;

/**
 * Connector execution-level result (docs/08 §6). Distinct from `QueryResult` (docs/20 §6):
 * this is the Connector's raw output. C converts it into `QueryResult` for D's Query UI,
 * stripping `providerMetadata` and guaranteeing `eventKey` (ADR-003).
 * comparisonDateRange is required when metricType="comparison", mirroring QueryResult.
 */
export const NormalizedAnalyticsResult = z
  .object({
    provider: z.literal("ga4"),
    eventKey: z.string().optional(),
    metricType: MetricType,
    resultStatus: ResultStatus,
    value: z.number().optional(),
    previousValue: z.number().optional(),
    dateRange: DateRange,
    comparisonDateRange: DateRange.optional(),
    reportingTimezone: z.string(),
    fetchedAt: z.string(),
    qualityFlags: z.array(DataQualityFlag),
    providerMetadata: z.record(z.unknown()).optional(),
  })
  .refine(
    (result) =>
      result.metricType !== "comparison" ||
      result.resultStatus !== "ok" ||
      result.comparisonDateRange !== undefined,
    {
      message:
        'comparisonDateRange is required when metricType is "comparison" and resultStatus is "ok"',
      path: ["comparisonDateRange"],
    },
  );
export type NormalizedAnalyticsResult = z.infer<typeof NormalizedAnalyticsResult>;

export interface AnalyticsConnector {
  testConnection(context: ConnectorContext): Promise<ConnectionResult>;
  query(
    context: ConnectorContext,
    query: ProviderAgnosticQuery,
  ): Promise<NormalizedAnalyticsResult>;
  capabilities(): ConnectorCapabilities;
}
