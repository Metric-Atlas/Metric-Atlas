import { z } from "zod";
import {
  AnalyticsProvider,
  CodeState,
  DataQualityFlag,
  Ga4ManagedState,
  Ga4ObservationState,
  ParameterState,
  ResultStatus,
} from "./common.js";

export const ParameterRegistrationState = z.object({
  parameter: z.string(),
  state: ParameterState,
});
export type ParameterRegistrationState = z.infer<
  typeof ParameterRegistrationState
>;

export const LatestMeasurement = z.object({
  resultStatus: ResultStatus,
  value: z.number().optional(),
  qualityFlags: z.array(DataQualityFlag),
});
export type LatestMeasurement = z.infer<typeof LatestMeasurement>;

/** ADR-001: parameterRegistrationStates must include every Manifest parameter for the same eventKey. */
export const HealthItem = z.object({
  eventKey: z.string(),
  eventName: z.string(),
  codeState: CodeState,
  ga4ObservationState: Ga4ObservationState,
  ga4ManagedState: Ga4ManagedState,
  parameterRegistrationStates: z.array(ParameterRegistrationState),
  latestMeasurement: LatestMeasurement.optional(),
  reviewReason: z.string().nullable().optional(),
});
export type HealthItem = z.infer<typeof HealthItem>;

export const HealthSummary = z.object({
  healthy: z.number().int().nonnegative(),
  codeOnly: z.number().int().nonnegative(),
  ga4Only: z.number().int().nonnegative(),
  ga4Managed: z.number().int().nonnegative(),
  parameterRegistrationGap: z.number().int().nonnegative(),
  unresolved: z.number().int().nonnegative(),
});
export type HealthSummary = z.infer<typeof HealthSummary>;

/**
 * ADR-001 bucket priority for classifying a HealthItem into exactly one HealthSummary bucket:
 * unresolved > parameterRegistrationGap > codeOnly > ga4Managed > ga4Only > healthy.
 * `unresolved` in HealthSummary additionally counts Manifest DYNAMIC_EVENT_NAME warnings,
 * which never appear in `items[]` and so are not covered by this classifier alone.
 */
export function classifyHealthItemBucket(
  item: HealthItem,
): keyof HealthSummary {
  if (item.codeState === "unknown" || item.ga4ObservationState === "unknown") {
    return "unresolved";
  }
  if (
    item.parameterRegistrationStates.some((p) => p.state === "not_registered")
  ) {
    return "parameterRegistrationGap";
  }
  if (item.codeState === "detected" && item.ga4ObservationState === "not_observed") {
    return "codeOnly";
  }
  if (item.ga4ManagedState === "managed") {
    return "ga4Managed";
  }
  if (item.codeState === "not_detected" && item.ga4ObservationState === "observed") {
    return "ga4Only";
  }
  return "healthy";
}

export const AnalyticsHealthReport = z.object({
  generatedAt: z.string(),
  provider: AnalyticsProvider,
  propertyId: z.string(),
  reportingTimezone: z.string(),
  summary: HealthSummary,
  items: z.array(HealthItem),
});
export type AnalyticsHealthReport = z.infer<typeof AnalyticsHealthReport>;
