import type { AnalyticsHealthReport } from "@metric-atlas/contracts";
import { EventManifest } from "@metric-atlas/contracts";
import type { AnalyticsConnector, ConnectorContext } from "@metric-atlas/connector-sdk";
import type { CustomDimensionLookup } from "@metric-atlas/connector-ga4";
import {
  buildAnalyticsHealthReport,
  createGoogleGa4Client,
  Ga4Connector,
  resolveGa4Credentials,
  resolveHealthDateRange,
} from "@metric-atlas/connector-ga4";

/** buildAnalyticsHealthReport가 요구하는 connector + Custom Dimension 조회 (Ga4Connector가 충족). */
export interface Ga4HealthBackend extends AnalyticsConnector {
  getCustomDimensionLookup(context: ConnectorContext): Promise<CustomDimensionLookup>;
}

export class HealthLiveError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface LiveHealthProviderOptions {
  env: Record<string, string | undefined>;
  /** `.metric-atlas/manifest.json` 로더. 파일이 없으면 undefined. */
  loadManifest(): Promise<unknown>;
  /** 테스트 주입용. 기본은 createGoogleGa4Client + Ga4Connector 실 연결. */
  createBackend?: (env: Record<string, string | undefined>) => Ga4HealthBackend;
  now?: () => Date;
}

export interface LiveHealthProvider {
  getHealth(): Promise<AnalyticsHealthReport>;
}

const DEFAULT_TTL_SECONDS = 300;
const DEFAULT_HEALTH_WINDOW_DAYS = 30;
const DEFAULT_RECENT_WINDOW_HOURS = 48;

/** GA4 미구성(env 부재) 시 null — 호출자는 기존 정적 파일 경로로 fallback. */
export function createLiveHealthProvider(
  options: LiveHealthProviderOptions,
): LiveHealthProvider | null {
  const { env } = options;
  const propertyId = env.METRIC_ATLAS_GA4_PROPERTY_ID;
  const hasCredential = Boolean(
    env.GOOGLE_APPLICATION_CREDENTIALS || env.METRIC_ATLAS_GA4_SERVICE_ACCOUNT_JSON_BASE64,
  );
  if (!propertyId || !hasCredential) return null;

  const now = options.now ?? (() => new Date());
  const ttlMs = positiveNumber(env.METRIC_ATLAS_CACHE_TTL_SECONDS, DEFAULT_TTL_SECONDS) * 1000;
  const windowDays = positiveNumber(
    env.METRIC_ATLAS_GA4_HEALTH_WINDOW_DAYS,
    DEFAULT_HEALTH_WINDOW_DAYS,
  );
  const context: ConnectorContext = { provider: "ga4", propertyId, credentialRef: "env" };
  const createBackend = options.createBackend ?? defaultBackend;

  let backend: Ga4HealthBackend | undefined;
  let cached: { report: AnalyticsHealthReport; atMs: number } | undefined;
  let inFlight: Promise<AnalyticsHealthReport> | undefined;

  async function build(): Promise<AnalyticsHealthReport> {
    const manifestRaw = await options.loadManifest();
    if (manifestRaw === undefined) {
      throw new HealthLiveError(
        "manifest_not_found",
        "Expected .metric-atlas/manifest.json under the served root for live GA4 health.",
      );
    }
    const parsed = EventManifest.safeParse(manifestRaw);
    if (!parsed.success) {
      throw new HealthLiveError("manifest_invalid", "manifest.json violates the EventManifest contract.");
    }

    backend ??= createBackend(env);
    let connection;
    try {
      connection = await backend.testConnection(context);
    } catch (error) {
      throw new HealthLiveError("ga4_error", errorMessage(error));
    }
    if (!connection.success) {
      throw new HealthLiveError(
        `ga4_${connection.errorCode ?? "error"}`,
        "GA4 connection failed. Check property id and service account access.",
      );
    }

    const reportingTimezone = connection.reportingTimezone || "UTC";
    const dateRange = resolveHealthDateRange({ timezone: reportingTimezone, windowDays, now: now() });
    const customDimensions = await backend.getCustomDimensionLookup(context);

    return buildAnalyticsHealthReport({
      connector: backend,
      context,
      manifest: parsed.data,
      dateRange,
      customDimensions,
      reportingTimezone,
      now,
    });
  }

  return {
    async getHealth(): Promise<AnalyticsHealthReport> {
      if (cached && now().getTime() - cached.atMs < ttlMs) return cached.report;
      if (inFlight) return inFlight;
      inFlight = build()
        .then((report) => {
          cached = { report, atMs: now().getTime() };
          return report;
        })
        .finally(() => {
          inFlight = undefined;
        });
      return inFlight;
    },
  };
}

function defaultBackend(env: Record<string, string | undefined>): Ga4HealthBackend {
  const credentials = resolveGa4Credentials(env);
  const client = createGoogleGa4Client(credentials);
  return new Ga4Connector(client, {
    recentWindowHours: positiveNumber(
      env.METRIC_ATLAS_GA4_RECENT_WINDOW_HOURS,
      DEFAULT_RECENT_WINDOW_HOURS,
    ),
  });
}

function positiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
