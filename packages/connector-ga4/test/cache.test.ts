import { describe, expect, test, vi } from "vitest";
import type { AnalyticsConnector, ConnectorContext, NormalizedAnalyticsResult } from "@metric-atlas/connector-sdk";
import { withCache } from "../src/cache.js";

const CONTEXT: ConnectorContext = { provider: "ga4", propertyId: "550079255", credentialRef: "env" };
const QUERY = {
  eventName: "purchase_click",
  metric: "event_count" as const,
  dateRange: { startDate: "2026-08-01", endDate: "2026-08-18" },
};

function okResult(value: number): NormalizedAnalyticsResult {
  return {
    provider: "ga4",
    metricType: "event_count",
    resultStatus: "ok",
    value,
    dateRange: QUERY.dateRange,
    reportingTimezone: "Asia/Seoul",
    fetchedAt: "2026-08-18T12:00:00Z",
    qualityFlags: [],
  };
}

function fakeConnector(queryImpl: AnalyticsConnector["query"]): { connector: AnalyticsConnector } {
  const connector: AnalyticsConnector = {
    testConnection: async (context) => ({ success: true, provider: "ga4", propertyId: context.propertyId }),
    capabilities: () => ({
      supportedMetrics: ["event_count"],
      supportedDimensions: [],
      comparisonSupport: false,
      adminMetadataSupport: false,
    }),
    query: queryImpl,
  };
  return { connector };
}

describe("withCache", () => {
  test("TTL 안에서는 두 번째 호출이 upstream을 다시 부르지 않는다", async () => {
    let calls = 0;
    const { connector } = fakeConnector(async () => {
      calls++;
      return okResult(1240);
    });
    let now = 0;
    const cached = withCache(connector, { ttlSeconds: 300, now: () => new Date(now) });

    await cached.query(CONTEXT, QUERY);
    now += 100_000;
    const second = await cached.query(CONTEXT, QUERY);

    expect(calls).toBe(1);
    expect(second.value).toBe(1240);
  });

  test("TTL이 지나면 upstream을 다시 부른다", async () => {
    let calls = 0;
    const { connector } = fakeConnector(async () => {
      calls++;
      return okResult(1240 + calls);
    });
    let now = 0;
    const cached = withCache(connector, { ttlSeconds: 300, now: () => new Date(now) });

    await cached.query(CONTEXT, QUERY);
    now += 300_001;
    await cached.query(CONTEXT, QUERY);

    expect(calls).toBe(2);
  });

  test("동시 요청은 upstream을 한 번만 호출한다 (in-flight dedup)", async () => {
    let calls = 0;
    let resolve!: (r: NormalizedAnalyticsResult) => void;
    const pending = new Promise<NormalizedAnalyticsResult>((r) => (resolve = r));
    const { connector } = fakeConnector(async () => {
      calls++;
      return pending;
    });
    const cached = withCache(connector, { ttlSeconds: 300 });

    const p1 = cached.query(CONTEXT, QUERY);
    const p2 = cached.query(CONTEXT, QUERY);
    resolve(okResult(42));
    const [r1, r2] = await Promise.all([p1, p2]);

    expect(calls).toBe(1);
    expect(r1.value).toBe(42);
    expect(r2.value).toBe(42);
  });

  test("resultStatus=error는 캐시하지 않는다 — 매번 재시도", async () => {
    let calls = 0;
    const { connector } = fakeConnector(async () => {
      calls++;
      return {
        provider: "ga4",
        metricType: "event_count",
        resultStatus: "error",
        dateRange: QUERY.dateRange,
        reportingTimezone: "",
        fetchedAt: "2026-08-18T12:00:00Z",
        qualityFlags: [],
      };
    });
    const cached = withCache(connector, { ttlSeconds: 300 });

    await cached.query(CONTEXT, QUERY);
    await cached.query(CONTEXT, QUERY);

    expect(calls).toBe(2);
  });

  test("다른 eventName/dateRange는 다른 캐시 키를 쓴다", async () => {
    let calls = 0;
    const { connector } = fakeConnector(async () => {
      calls++;
      return okResult(calls);
    });
    const cached = withCache(connector, { ttlSeconds: 300 });

    await cached.query(CONTEXT, QUERY);
    await cached.query(CONTEXT, { ...QUERY, eventName: "signup_complete" });
    await cached.query(CONTEXT, { ...QUERY, dateRange: { startDate: "2026-07-01", endDate: "2026-07-31" } });

    expect(calls).toBe(3);
  });

  test("invalidate 이후에는 다시 upstream을 부른다", async () => {
    let calls = 0;
    const { connector } = fakeConnector(async () => {
      calls++;
      return okResult(calls);
    });
    const cached = withCache(connector, { ttlSeconds: 300 });

    await cached.query(CONTEXT, QUERY);
    cached.invalidate(CONTEXT, QUERY);
    await cached.query(CONTEXT, QUERY);

    expect(calls).toBe(2);
  });

  test("clear는 모든 캐시를 비운다", async () => {
    let calls = 0;
    const { connector } = fakeConnector(async () => {
      calls++;
      return okResult(calls);
    });
    const cached = withCache(connector, { ttlSeconds: 300 });

    await cached.query(CONTEXT, QUERY);
    await cached.query(CONTEXT, { ...QUERY, eventName: "signup_complete" });
    cached.clear();
    await cached.query(CONTEXT, QUERY);

    expect(calls).toBe(3);
  });

  test("testConnection/capabilities는 그대로 위임한다", async () => {
    const spy = vi.fn(async (context: ConnectorContext) => ({
      success: true,
      provider: "ga4" as const,
      propertyId: context.propertyId,
    }));
    const connector: AnalyticsConnector = {
      testConnection: spy,
      capabilities: () => ({
        supportedMetrics: ["event_count"],
        supportedDimensions: [],
        comparisonSupport: false,
        adminMetadataSupport: false,
      }),
      query: async () => okResult(1),
    };
    const cached = withCache(connector, { ttlSeconds: 300 });

    await cached.testConnection(CONTEXT);
    expect(spy).toHaveBeenCalledWith(CONTEXT);
    expect(cached.capabilities().supportedMetrics).toEqual(["event_count"]);
  });
});
