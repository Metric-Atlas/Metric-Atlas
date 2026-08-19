import { z } from "zod";

export const AnalyticsProvider = z.enum([
  "ga4",
  "mixpanel",
  "meta",
  "posthog",
  "amplitude",
  "unknown",
]);
export type AnalyticsProvider = z.infer<typeof AnalyticsProvider>;

export const TrackingEmitter = z.enum([
  "ga4",
  "gtm",
  "mixpanel",
  "meta",
  "posthog",
  "amplitude",
  "custom",
  "unknown",
]);
export type TrackingEmitter = z.infer<typeof TrackingEmitter>;

export const ProviderDetectionConfidence = z.enum([
  "provider_exact",
  "provider_configured",
  "provider_unknown",
]);
export type ProviderDetectionConfidence = z.infer<
  typeof ProviderDetectionConfidence
>;

export const BindingConfidence = z.enum([
  "binding_exact",
  "binding_inferred",
  "binding_unresolved",
]);
export type BindingConfidence = z.infer<typeof BindingConfidence>;

export const CodeState = z.enum(["detected", "not_detected", "unknown"]);
export type CodeState = z.infer<typeof CodeState>;

export const Ga4ObservationState = z.enum([
  "observed",
  "not_observed",
  "unknown",
]);
export type Ga4ObservationState = z.infer<typeof Ga4ObservationState>;

export const Ga4ManagedState = z.enum(["managed", "not_managed", "unknown"]);
export type Ga4ManagedState = z.infer<typeof Ga4ManagedState>;

export const ParameterState = z.enum([
  "builtin",
  "registered_custom_dimension",
  "not_registered",
  "unknown",
]);
export type ParameterState = z.infer<typeof ParameterState>;

export const ResultStatus = z.enum([
  "ok",
  "no_rows",
  "unauthorized",
  "unsupported",
  "error",
]);
export type ResultStatus = z.infer<typeof ResultStatus>;

export const DataQualityFlag = z.enum([
  "subject_to_thresholding",
  "other_row_data_loss",
  "recent_data_may_change",
]);
export type DataQualityFlag = z.infer<typeof DataQualityFlag>;

export const MetricType = z.enum(["event_count", "comparison", "custom"]);
export type MetricType = z.infer<typeof MetricType>;

const PresetDateRange = z.object({
  preset: z.string(),
  startDate: z.never().optional(),
  endDate: z.never().optional(),
});
const AbsoluteDateRange = z.object({
  preset: z.never().optional(),
  startDate: z.string(),
  endDate: z.string(),
});

/**
 * docs/20 §6. The `never`-typed optional siblings let consumers read `.startDate`/`.endDate`
 * across the union without narrowing first (ADR-003 fix — the original z.union() lacked these,
 * which didn't match the documented type and broke direct property access in connector-ga4).
 * ADR-001: QueryResult/AnalyticsHealthReport dateRange is always resolved to absolute dates.
 */
export const DateRange = z.union([PresetDateRange, AbsoluteDateRange]);
export type DateRange = z.infer<typeof DateRange>;

export const SourceLocation = z.object({
  file: z.string(),
  line: z.number().int().positive(),
  column: z.number().int().positive().optional(),
});
export type SourceLocation = z.infer<typeof SourceLocation>;

export const ElementLocation = z.object({
  type: z.string(),
  file: z.string(),
  line: z.number().int().positive(),
  column: z.number().int().positive().optional(),
});
export type ElementLocation = z.infer<typeof ElementLocation>;

/** Phase 0 warning codes (docs/20 §4, ADR-001/ADR-002). Not exhaustive — new codes may be added via ADR. */
export const KNOWN_SCAN_WARNING_CODES = [
  "DYNAMIC_EVENT_NAME",
  "POSSIBLE_WRAPPER_USAGE",
  "CUSTOM_COMPONENT_OVERLAY_UNSUPPORTED",
  "PARSE_ERROR",
  "DYNAMIC_PARAMETER_KEY",
  "UNRESOLVED_EVENT_BINDING",
  "PORTAL_OVERLAY_UNSUPPORTED",
  "ATLAS_ATTRIBUTE_CONFLICT",
] as const;

export const ScanWarning = z.object({
  code: z.string(),
  file: z.string().optional(),
  line: z.number().int().positive().optional(),
  message: z.string().optional(),
  relatedImplementationKey: z.string().optional(),
});
export type ScanWarning = z.infer<typeof ScanWarning>;
