import { z } from "zod";
import {
  AnalyticsProvider,
  DataQualityFlag,
  DateRange,
  MetricType,
  ResultStatus,
} from "./common.js";

/**
 * ADR-001: Producer = C (GA4 Connector). D produces QueryPlan only, never QueryResult.
 * dateRange is always resolved to absolute dates; comparisonDateRange is required
 * when metricType is "comparison" and resultStatus is "ok" (ADR-003 refinement —
 * a failed/empty comparison query has no meaningful comparison range to report).
 */
export const QueryResult = z
  .object({
    provider: AnalyticsProvider,
    eventKey: z.string(),
    metricType: MetricType,
    resultStatus: ResultStatus,
    value: z.number().optional(),
    previousValue: z.number().optional(),
    dateRange: DateRange,
    comparisonDateRange: DateRange.optional(),
    reportingTimezone: z.string(),
    fetchedAt: z.string(),
    qualityFlags: z.array(DataQualityFlag),
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
export type QueryResult = z.infer<typeof QueryResult>;

/** Minimal QueryPlan for the Phase 0 fixture envelope. Full contract: docs/08 §8. */
export const QueryPlan = z.object({
  version: z.string(),
  analysisType: z.enum(["definition", "event_count", "comparison"]),
  eventKeys: z.array(z.string()),
  dateRange: DateRange,
  comparisonRange: DateRange.optional(),
  filters: z.array(z.unknown()),
  breakdowns: z.array(z.unknown()),
  sourceRefs: z.array(z.string()),
  assumptions: z.array(z.unknown()),
});
export type QueryPlan = z.infer<typeof QueryPlan>;

export const MockQueryFixture = z.object({
  queryPlan: QueryPlan,
  result: QueryResult,
});
export type MockQueryFixture = z.infer<typeof MockQueryFixture>;
