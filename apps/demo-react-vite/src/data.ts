import manifestJson from "../../../fixtures/mock-manifest.json";
import healthJson from "../../../fixtures/mock-ga4-health.json";
import queryResultJson from "../../../fixtures/mock-query-result.json";
import type { Ga4Health, HealthBucket, HealthItem, JoinedRow, Manifest, ManifestEvent } from "./types";

/** Fixture mode remains the offline fallback. No GA4 / LLM call, no credential input, no storage write. */
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

export type DataSource = "runtime" | "fixture";

export interface DashboardData {
  manifest: Manifest;
  health: Ga4Health;
  manifestSource: DataSource;
  healthSource: DataSource;
  runtimeAvailable: boolean;
  fallbackReasons: string[];
}

export const fixtureDashboardData: DashboardData = {
  manifest,
  health,
  manifestSource: "fixture",
  healthSource: "fixture",
  runtimeAvailable: false,
  fallbackReasons: []
};

export async function loadDashboardData(fetcher: typeof fetch = fetch): Promise<DashboardData> {
  const fallbackReasons: string[] = [];
  const manifestResult = await fetchRuntimeJson<Manifest>(
    "/__metric-atlas/api/manifest",
    isManifest,
    "manifest",
    fetcher
  );
  const healthResult = await fetchRuntimeJson<Ga4Health>(
    "/__metric-atlas/api/health",
    isGa4Health,
    "GA4 health",
    fetcher
  );

  if (manifestResult.reason) fallbackReasons.push(manifestResult.reason);
  if (healthResult.reason) fallbackReasons.push(healthResult.reason);

  return {
    manifest: manifestResult.value ?? manifest,
    health: healthResult.value ?? health,
    manifestSource: manifestResult.value ? "runtime" : "fixture",
    healthSource: healthResult.value ? "runtime" : "fixture",
    runtimeAvailable: Boolean(manifestResult.runtimeResponded || healthResult.runtimeResponded),
    fallbackReasons
  };
}

/** 상호배타 버킷 우선순위: unresolved > parameterRegistrationGap > codeOnly > ga4Managed > ga4Only > healthy */
export function bucketOf(event: ManifestEvent | null, item: HealthItem | null): HealthBucket {
  if (!item) return "noHealth";
  if (item.parameterRegistrationStates.some((p) => p.state === "not_registered")) return "parameterRegistrationGap";
  if (item.codeState === "detected" && item.ga4ObservationState !== "observed") return "codeOnly";
  if (item.ga4ManagedState === "managed") return "ga4Managed";
  if (item.codeState !== "detected" && item.ga4ObservationState === "observed") return "ga4Only";
  return "healthy";
}

/** Manifest + Health, joined by eventKey. Health-only events are kept as code-undetected rows. */
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

interface RuntimeFetchResult<T> {
  value: T | null;
  runtimeResponded: boolean;
  reason: string | null;
}

async function fetchRuntimeJson<T>(
  url: string,
  validate: (value: unknown) => value is T,
  label: string,
  fetcher: typeof fetch
): Promise<RuntimeFetchResult<T>> {
  try {
    const response = await fetcher(url, { headers: { accept: "application/json" } });
    if (!response.ok) {
      return { value: null, runtimeResponded: true, reason: `${label} runtime response ${response.status}` };
    }
    const value: unknown = await response.json();
    if (!validate(value)) {
      return { value: null, runtimeResponded: true, reason: `${label} runtime response shape mismatch` };
    }
    return { value, runtimeResponded: true, reason: null };
  } catch (error) {
    return {
      value: null,
      runtimeResponded: false,
      reason: `${label} runtime unavailable: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

function isManifest(value: unknown): value is Manifest {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Manifest>;
  return (
    typeof candidate.version === "string" &&
    typeof candidate.buildId === "string" &&
    typeof candidate.generatedAt === "string" &&
    Array.isArray(candidate.events) &&
    Array.isArray(candidate.bindings) &&
    typeof candidate.scanStats === "object" &&
    Boolean(candidate.scanStats)
  );
}

function isGa4Health(value: unknown): value is Ga4Health {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Ga4Health>;
  return (
    typeof candidate.generatedAt === "string" &&
    typeof candidate.provider === "string" &&
    typeof candidate.propertyId === "string" &&
    typeof candidate.reportingTimezone === "string" &&
    typeof candidate.summary === "object" &&
    Boolean(candidate.summary) &&
    Array.isArray(candidate.items)
  );
}
