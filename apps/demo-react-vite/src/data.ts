import manifestJson from "../../../fixtures/mock-manifest.json";
import healthJson from "../../../fixtures/mock-ga4-health.json";
import queryResultJson from "../../../fixtures/mock-query-result.json";
import type { Ga4Health, HealthBucket, HealthItem, JoinedRow, Manifest, ManifestEvent } from "./types";

/** Fixture mode only. No GA4 / LLM call, no credential input, no storage write. */
export const FIXTURE_MODE = true;

export const manifest = manifestJson as unknown as Manifest;
export const health = healthJson as unknown as Ga4Health;
export const queryFixture = queryResultJson as unknown as {
  queryPlan: unknown;
  result: {
    provider: string; eventKey: string; metricType: string; resultStatus: string;
    value: number; previousValue: number;
    dateRange: { startDate: string; endDate: string };
    comparisonDateRange: { startDate: string; endDate: string };
    reportingTimezone: string; qualityFlags: string[]; fetchedAt: string;
  };
};

/** 상호배타 버킷 우선순위: unresolved > parameterRegistrationGap > codeOnly > ga4Managed > ga4Only > healthy */
export function bucketOf(event: ManifestEvent | null, item: HealthItem | null): HealthBucket {
  if (!item) return "noHealth";
  if (item.parameterRegistrationStates.some((p) => p.state === "not_registered")) return "parameterRegistrationGap";
  if (item.codeState === "detected" && item.ga4ObservationState !== "observed") return "codeOnly";
  if (item.ga4ManagedState === "managed") return "ga4Managed";
  if (item.codeState !== "detected" && item.ga4ObservationState === "observed") return "ga4Only";
  return "healthy";
}

/** Manifest ⨝ Health, joined by eventKey. Health-only events are kept as code-undetected rows. */
export function joinRows(m: Manifest = manifest, h: Ga4Health = health): JoinedRow[] {
  const byKey = new Map(h.items.map((i) => [i.eventKey, i]));
  const rows: JoinedRow[] = m.events.map((event) => {
    const item = byKey.get(event.eventKey) ?? null;
    return {
      eventKey: event.eventKey,
      eventName: event.eventName,
      event,
      health: item,
      bindings: m.bindings.filter((b) => b.eventKeys.includes(event.eventKey)),
      bucket: bucketOf(event, item)
    };
  });
  for (const item of h.items) {
    if (!m.events.some((e) => e.eventKey === item.eventKey)) {
      rows.push({
        eventKey: item.eventKey,
        eventName: item.eventName,
        event: null,
        health: item,
        bindings: [],
        bucket: bucketOf(null, item)
      });
    }
  }
  return rows;
}
