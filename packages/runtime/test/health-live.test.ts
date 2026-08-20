import { describe, expect, it } from "vitest";
import type { Ga4HealthBackend } from "../src/health-live.js";
import { createLiveHealthProvider, HealthLiveError } from "../src/health-live.js";

const GA4_ENV = {
  METRIC_ATLAS_GA4_PROPERTY_ID: "550079255",
  GOOGLE_APPLICATION_CREDENTIALS: "/secure/sa.json",
};

const MANIFEST = {
  version: "0.1.0",
  buildId: "build-1",
  generatedAt: "2026-08-19T00:00:00.000Z",
  events: [
    {
      eventKey: "ga4:purchase_click",
      implementationKey: "ga4:purchase_click@src/A.tsx#h",
      eventName: "purchase_click",
      emitter: "ga4",
      analyticsProvider: "ga4",
      providerDetectionConfidence: "provider_exact",
      parameters: ["value"],
      source: { file: "src/A.tsx", line: 1 },
      overlaySupported: true,
    },
  ],
  bindings: [],
  warnings: [],
};

function fakeBackend(overrides: Partial<Ga4HealthBackend> = {}) {
  const calls = { testConnection: 0, query: 0, listObservedEventNames: 0, customDimensions: 0 };
  const backend: Ga4HealthBackend = {
    async testConnection(context) {
      calls.testConnection++;
      return {
        success: true,
        provider: "ga4",
        propertyId: context.propertyId,
        reportingTimezone: "Asia/Seoul",
      };
    },
    async query(_context, query) {
      calls.query++;
      return {
        provider: "ga4",
        eventKey: query.eventKey,
        metricType: "event_count",
        resultStatus: "ok",
        value: 42,
        dateRange: query.dateRange,
        reportingTimezone: "Asia/Seoul",
        fetchedAt: "2026-08-19T12:00:00.000Z",
        qualityFlags: [],
      };
    },
    async listObservedEventNames() {
      calls.listObservedEventNames++;
      return { resultStatus: "ok", eventNames: ["purchase_click", "page_view"], qualityFlags: [] };
    },
    capabilities() {
      return {
        supportedMetrics: ["event_count", "comparison"],
        supportedDimensions: [],
        comparisonSupport: true,
        adminMetadataSupport: true,
        eventListingSupport: true,
      };
    },
    async getCustomDimensionLookup() {
      calls.customDimensions++;
      return { status: "ok", registeredParameterNames: new Set(["value"]) };
    },
    ...overrides,
  };
  return { backend, calls };
}

function provider(options: {
  env?: Record<string, string | undefined>;
  backend: Ga4HealthBackend;
  manifest?: unknown;
  now?: () => Date;
}) {
  return createLiveHealthProvider({
    env: options.env ?? GA4_ENV,
    loadManifest: async () => options.manifest ?? MANIFEST,
    createBackend: () => options.backend,
    now: options.now ?? (() => new Date("2026-08-19T12:00:00Z")),
  });
}

describe("createLiveHealthProvider — 구성 판정", () => {
  it("GA4 env가 없으면 null (demo 모드는 정적 파일 경로 유지)", () => {
    const { backend } = fakeBackend();
    expect(provider({ env: {}, backend })).toBeNull();
  });

  it("propertyId만 있고 credential이 없으면 null", () => {
    const { backend } = fakeBackend();
    expect(
      provider({ env: { METRIC_ATLAS_GA4_PROPERTY_ID: "1" }, backend }),
    ).toBeNull();
  });
});

describe("createLiveHealthProvider — 라이브 리포트", () => {
  it("detected + GA4-only 항목을 포함한 AnalyticsHealthReport를 반환", async () => {
    const { backend } = fakeBackend();
    const live = provider({ backend })!;
    const report = await live.getHealth();

    expect(report.provider).toBe("ga4");
    expect(report.propertyId).toBe("550079255");
    expect(report.reportingTimezone).toBe("Asia/Seoul");
    const keys = report.items.map((item) => item.eventKey).sort();
    expect(keys).toEqual(["ga4:page_view", "ga4:purchase_click"]);
  });

  it("dateRange는 Property timezone 기준 최근 N일 절대 날짜로 조회된다", async () => {
    const ranges: unknown[] = [];
    const { backend } = fakeBackend({
      async query(_context, query) {
        ranges.push(query.dateRange);
        return {
          provider: "ga4",
          metricType: "event_count",
          resultStatus: "ok",
          value: 1,
          dateRange: query.dateRange,
          reportingTimezone: "Asia/Seoul",
          fetchedAt: "2026-08-19T12:00:00.000Z",
          qualityFlags: [],
        };
      },
    });
    // UTC 8/19 20시 = KST 8/20 새벽 → endDate가 8/20이어야 timezone 반영 증명
    const live = provider({ backend, now: () => new Date("2026-08-19T20:00:00Z") })!;
    await live.getHealth();
    expect(ranges[0]).toEqual({ startDate: "2026-07-22", endDate: "2026-08-20" });
  });

  it("TTL 안의 연속 호출은 GA4를 재조회하지 않는다", async () => {
    const { backend, calls } = fakeBackend();
    const live = provider({ backend })!;
    await live.getHealth();
    await live.getHealth();
    expect(calls.query).toBe(1);
    expect(calls.testConnection).toBe(1);
  });

  it("TTL이 지나면 재조회한다", async () => {
    const { backend, calls } = fakeBackend();
    let nowMs = Date.parse("2026-08-19T12:00:00Z");
    const live = createLiveHealthProvider({
      env: { ...GA4_ENV, METRIC_ATLAS_CACHE_TTL_SECONDS: "300" },
      loadManifest: async () => MANIFEST,
      createBackend: () => backend,
      now: () => new Date(nowMs),
    })!;
    await live.getHealth();
    nowMs += 301_000;
    await live.getHealth();
    expect(calls.query).toBe(2);
  });

  it("동시 호출은 in-flight를 공유한다 (dedup)", async () => {
    const { backend, calls } = fakeBackend();
    const live = provider({ backend })!;
    await Promise.all([live.getHealth(), live.getHealth(), live.getHealth()]);
    expect(calls.query).toBe(1);
  });
});

describe("createLiveHealthProvider — 오류", () => {
  it("manifest가 없으면 manifest_not_found", async () => {
    const { backend } = fakeBackend();
    const live = createLiveHealthProvider({
      env: GA4_ENV,
      loadManifest: async () => undefined,
      createBackend: () => backend,
    })!;
    await expect(live.getHealth()).rejects.toMatchObject({ code: "manifest_not_found" });
  });

  it("manifest가 계약 위반이면 manifest_invalid", async () => {
    const { backend } = fakeBackend();
    const live = provider({ backend, manifest: { version: "0.1.0" } })!;
    await expect(live.getHealth()).rejects.toMatchObject({ code: "manifest_invalid" });
  });

  it("GA4 연결 실패는 ga4_<errorCode>로 전달", async () => {
    const { backend } = fakeBackend({
      async testConnection(context) {
        return { success: false, provider: "ga4", propertyId: context.propertyId, errorCode: "unauthorized" };
      },
    });
    const live = provider({ backend })!;
    await expect(live.getHealth()).rejects.toMatchObject({ code: "ga4_unauthorized" });
    await expect(live.getHealth()).rejects.toBeInstanceOf(HealthLiveError);
  });

  it("실패는 캐시되지 않는다 — 다음 호출에서 재시도", async () => {
    let fail = true;
    const { backend, calls } = fakeBackend({
      async testConnection(context) {
        calls.testConnection++;
        if (fail) throw Object.assign(new Error("boom"), { code: 14 });
        return { success: true, provider: "ga4", propertyId: context.propertyId, reportingTimezone: "Asia/Seoul" };
      },
    });
    const live = provider({ backend })!;
    await expect(live.getHealth()).rejects.toBeInstanceOf(HealthLiveError);
    fail = false;
    const report = await live.getHealth();
    expect(report.provider).toBe("ga4");
  });
});
