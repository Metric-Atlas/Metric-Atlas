import { z } from "zod";
import {
  AnalyticsProvider,
  BindingConfidence,
  ElementLocation,
  ProviderDetectionConfidence,
  ScanWarning,
  SourceLocation,
  TrackingEmitter,
} from "./common.js";

/** B produces, A serves, C/D consume. docs/08 §3, docs/20 §4. */
export const DetectedEvent = z.object({
  eventKey: z.string(),
  implementationKey: z.string(),
  eventName: z.string(),
  emitter: TrackingEmitter,
  analyticsProvider: AnalyticsProvider,
  providerDetectionConfidence: ProviderDetectionConfidence,
  parameters: z.array(z.string()),
  source: SourceLocation,
  overlaySupported: z.boolean(),
});
export type DetectedEvent = z.infer<typeof DetectedEvent>;

export const ElementBinding = z.object({
  atlasDomId: z.string(),
  eventKeys: z.array(z.string()).min(1),
  implementationKeys: z.array(z.string()).min(1),
  element: ElementLocation,
  bindingConfidence: BindingConfidence,
});
export type ElementBinding = z.infer<typeof ElementBinding>;

const NamedCount = z.object({
  name: z.string(),
  eventCount: z.number().int().nonnegative(),
});

export const ManifestSummaries = z.object({
  emitters: z.array(NamedCount),
  analyticsProviders: z.array(NamedCount),
});
export type ManifestSummaries = z.infer<typeof ManifestSummaries>;

export const ScanStats = z.object({
  filesScanned: z.number().int().nonnegative(),
  durationMs: z.number().nonnegative(),
  eventsDetected: z.number().int().nonnegative(),
});
export type ScanStats = z.infer<typeof ScanStats>;

export const EventManifest = z.object({
  version: z.string(),
  buildId: z.string(),
  generatedAt: z.string(),
  events: z.array(DetectedEvent),
  bindings: z.array(ElementBinding),
  warnings: z.array(ScanWarning),
  summaries: ManifestSummaries.optional(),
  scanStats: ScanStats.optional(),
});
export type EventManifest = z.infer<typeof EventManifest>;
