import { describe, expect, test } from "vitest";
import type { ConnectorContext } from "@metric-atlas/connector-sdk";
import { Ga4Connector, type Ga4ApiClient, type Ga4RunReportResponse } from "../src/connector.js";

const CONTEXT: ConnectorContext = { provider: "ga4", propertyId: "550079255", credentialRef: "env" };
const NOW = new Date("2026-08-18T12:00:00Z");
const OLD_RANGE = { startDate: "2026-06-01", endDate: "2026-06-30" } as const;
const PREV_RANGE = { startDate: "2026-05-01", endDate: "2026-05-31" } as const;

function fakeClient(overrides: Partial<Ga4ApiClient> & { responses?: Ga4RunReportResponse[] } = {}) {
  const calls = { runReport: 0, getPropertyTimezone: 0 };
  const responses = overrides.responses ?? [];
  const client: Ga4ApiClient = {
    async runReport(request) {
      calls.runReport++;
      void request;
      return responses.shift() ?? { rowCount: 0, rows: [], metadata: {} };
    },
    async getPropertyTimezone(propertyId) {
      calls.getPropertyTimezone++;
      void propertyId;
      return "Asia/Seoul";
    },
    ...overrides,
  };
  return { client, calls };
}

function connector(client: Ga4ApiClient) {
  return new Ga4Connector(client, { recentWindowHours: 48, now: () => NOW });
}

describe("Ga4Connector.testConnection", () => {
  test("성공 시 reportingTimezone 반환", async () => {
    const { client } = fakeClient();
    const result = await connector(client).testConnection(CONTEXT);
    expect(result).toEqual({
      success: true,
      provider: "ga4",
      propertyId: "550079255",
      reportingTimezone: "Asia/Seoul",
    });
  });

  test("권한 오류(gRPC 7)는 throw하지 않고 errorCode=unauthorized", async () => {
    const { client } = fakeClient({
      async getPropertyTimezone() {
        throw Object.assign(new Error("PERMISSION_DENIED"), { code: 7 });
      },
    });
    const result = await connector(client).testConnection(CONTEXT);
    expect(result.success).toBe(false);
    expect(result.errorCode).toBe("unauthorized");
  });
});

describe("Ga4Connector.query — event_count", () => {
  test("rows가 있으면 ok + value", async () => {
    const { client } = fakeClient({
      responses: [{ rowCount: 1, rows: [{ metricValues: [{ value: "1240" }] }], metadata: {} }],
    });
    const result = await connector(client).query(CONTEXT, {
      eventKey: "ga4:purchase_click",
      eventName: "purchase_click",
      metric: "event_count",
      dateRange: OLD_RANGE,
    });
    expect(result.resultStatus).toBe("ok");
    expect(result.value).toBe(1240);
    expect(result.provider).toBe("ga4");
    expect(result.eventKey).toBe("ga4:purchase_click");
    expect(result.dateRange).toEqual(OLD_RANGE);
    expect(result.reportingTimezone).toBe("Asia/Seoul");
    expect(result.fetchedAt).toBe(NOW.toISOString());
  });

  test("rowCount=0이면 no_rows, value 없음 (Spike §3 실측)", async () => {
    const { client } = fakeClient({ responses: [{ rowCount: 0, rows: [], metadata: {} }] });
    const result = await connector(client).query(CONTEXT, {
      eventName: "signup_complete",
      metric: "event_count",
      dateRange: OLD_RANGE,
    });
    expect(result.resultStatus).toBe("no_rows");
    expect(result.value).toBeUndefined();
  });

  test("metadata의 thresholding 신호가 qualityFlags로 매핑됨", async () => {
    const { client } = fakeClient({
      responses: [
        {
          rowCount: 1,
          rows: [{ metricValues: [{ value: "10" }] }],
          metadata: { subjectToThresholding: true },
        },
      ],
    });
    const result = await connector(client).query(CONTEXT, {
      eventName: "purchase_click",
      metric: "event_count",
      dateRange: OLD_RANGE,
    });
    expect(result.qualityFlags).toContain("subject_to_thresholding");
  });
});

describe("Ga4Connector.query — comparison", () => {
  test("두 기간 조회로 value + previousValue 반환", async () => {
    const { client } = fakeClient({
      responses: [
        {
          rowCount: 2,
          rows: [
            { dimensionValues: [{ value: "date_range_0" }], metricValues: [{ value: "1240" }] },
            { dimensionValues: [{ value: "date_range_1" }], metricValues: [{ value: "1100" }] },
          ],
          metadata: {},
        },
      ],
    });
    const result = await connector(client).query(CONTEXT, {
      eventName: "purchase_click",
      metric: "comparison",
      dateRange: OLD_RANGE,
      comparisonRange: PREV_RANGE,
    });
    expect(result.resultStatus).toBe("ok");
    expect(result.value).toBe(1240);
    expect(result.previousValue).toBe(1100);
    expect(result.metricType).toBe("comparison");
    expect(result.comparisonDateRange).toEqual(PREV_RANGE);
  });

  test("comparisonRange 없이 comparison을 요청하면 unsupported", async () => {
    const { client } = fakeClient();
    const result = await connector(client).query(CONTEXT, {
      eventName: "purchase_click",
      metric: "comparison",
      dateRange: OLD_RANGE,
    });
    expect(result.resultStatus).toBe("unsupported");
  });
});

describe("Ga4Connector.query — 경계 동작", () => {
  test("preset dateRange는 이번 범위에서 unsupported (해석은 후속 태스크)", async () => {
    const { client, calls } = fakeClient();
    const result = await connector(client).query(CONTEXT, {
      eventName: "purchase_click",
      metric: "event_count",
      dateRange: { preset: "last_30_days" },
    });
    expect(result.resultStatus).toBe("unsupported");
    expect(calls.runReport).toBe(0);
  });

  test("API 오류는 throw하지 않고 resultStatus=error", async () => {
    const { client } = fakeClient({
      async runReport() {
        throw new Error("network boom");
      },
    });
    const result = await connector(client).query(CONTEXT, {
      eventName: "purchase_click",
      metric: "event_count",
      dateRange: OLD_RANGE,
    });
    expect(result.resultStatus).toBe("error");
  });

  test("timezone은 getProperty 1회 호출 후 캐시 (Spike §7 권장)", async () => {
    const { client, calls } = fakeClient({
      responses: [
        { rowCount: 1, rows: [{ metricValues: [{ value: "1" }] }], metadata: {} },
        { rowCount: 1, rows: [{ metricValues: [{ value: "2" }] }], metadata: {} },
      ],
    });
    const c = connector(client);
    await c.query(CONTEXT, { eventName: "a", metric: "event_count", dateRange: OLD_RANGE });
    await c.query(CONTEXT, { eventName: "b", metric: "event_count", dateRange: OLD_RANGE });
    expect(calls.getPropertyTimezone).toBe(1);
  });
});

describe("Ga4Connector.capabilities", () => {
  test("Core MVP 범위: event_count/comparison 지원, admin metadata 지원", () => {
    const { client } = fakeClient();
    const caps = connector(client).capabilities();
    expect(caps.supportedMetrics).toEqual(["event_count", "comparison"]);
    expect(caps.comparisonSupport).toBe(true);
    expect(caps.adminMetadataSupport).toBe(true);
  });
});
