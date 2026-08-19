import { describe, expect, test } from "vitest";
import type {
  AnalyticsConnector,
  ConnectorContext,
  NormalizedAnalyticsResult,
} from "@metric-atlas/connector-sdk";
import type { DetectedEvent, EventManifest } from "@metric-atlas/contracts";
import { buildAnalyticsHealthReport } from "../src/health-engine.js";

const CONTEXT: ConnectorContext = { provider: "ga4", propertyId: "550079255", credentialRef: "env" };
const DATE_RANGE = { startDate: "2026-08-01", endDate: "2026-08-18" } as const;

function detectedEvent(overrides: Partial<DetectedEvent>): DetectedEvent {
  return {
    eventKey: "ga4:nav_click",
    implementationKey: "ga4:nav_click@src/Header.tsx#a",
    eventName: "nav_click",
    emitter: "ga4",
    analyticsProvider: "ga4",
    providerDetectionConfidence: "provider_exact",
    parameters: [],
    source: { file: "src/Header.tsx", line: 9 },
    overlaySupported: true,
    ...overrides,
  };
}

/** 홈페이지 실측에서 발견된 상황: 같은 eventKey가 코드 4곳에 구현됨. */
function manifestWithDuplicateImplementations(): EventManifest {
  return {
    version: "0.1.0",
    buildId: "b1",
    generatedAt: "2026-08-19T00:00:00.000Z",
    events: [
      detectedEvent({ implementationKey: "impl-a", parameters: ["section"], source: { file: "src/Header.tsx", line: 9 } }),
      detectedEvent({ implementationKey: "impl-b", parameters: ["section", "area"], source: { file: "src/Header.tsx", line: 15 } }),
      detectedEvent({
        eventKey: "ga4:issue_click",
        eventName: "issue_click",
        implementationKey: "impl-c",
        parameters: ["repo"],
        source: { file: "src/IssueButton.tsx", line: 8 },
      }),
    ],
    bindings: [],
    warnings: [],
  };
}

function countingConnector() {
  const queriedEventNames: string[] = [];
  const connector: AnalyticsConnector = {
    async testConnection(context) {
      return { success: true, provider: "ga4", propertyId: context.propertyId };
    },
    capabilities() {
      return {
        supportedMetrics: ["event_count"],
        supportedDimensions: [],
        comparisonSupport: true,
        adminMetadataSupport: true,
        eventListingSupport: true,
      };
    },
    async query(_context, query): Promise<NormalizedAnalyticsResult> {
      queriedEventNames.push(query.eventName);
      return {
        provider: "ga4",
        eventKey: query.eventKey,
        metricType: "event_count",
        resultStatus: "ok",
        value: 6,
        dateRange: query.dateRange,
        reportingTimezone: "Asia/Seoul",
        fetchedAt: "2026-08-19T12:00:00.000Z",
        qualityFlags: [],
      };
    },
    async listObservedEventNames() {
      return { resultStatus: "ok", eventNames: [], qualityFlags: [] };
    },
  };
  return { connector, queriedEventNames };
}

async function buildReport() {
  const { connector, queriedEventNames } = countingConnector();
  const report = await buildAnalyticsHealthReport({
    connector,
    context: CONTEXT,
    manifest: manifestWithDuplicateImplementations(),
    dateRange: DATE_RANGE,
    customDimensions: { status: "ok", registeredParameterNames: new Set(["section"]) },
    reportingTimezone: "Asia/Seoul",
    now: () => new Date("2026-08-19T12:00:00Z"),
  });
  return { report, queriedEventNames };
}

describe("buildAnalyticsHealthReport — eventKey 논리 이벤트 집계 (docs/20 §3)", () => {
  test("같은 eventKey의 구현 여러 개는 HealthItem 1개로 집계된다", async () => {
    const { report } = await buildReport();
    const navItems = report.items.filter((item) => item.eventKey === "ga4:nav_click");
    expect(navItems).toHaveLength(1);
    expect(report.items).toHaveLength(2); // nav_click + issue_click
  });

  test("파라미터는 구현들의 합집합으로 판정된다", async () => {
    const { report } = await buildReport();
    const navItem = report.items.find((item) => item.eventKey === "ga4:nav_click")!;
    expect(navItem.parameterRegistrationStates.map((p) => p.parameter)).toEqual(["section", "area"]);
  });

  test("같은 eventName을 GA4에 중복 조회하지 않는다", async () => {
    const { queriedEventNames } = await buildReport();
    expect(queriedEventNames.sort()).toEqual(["issue_click", "nav_click"]);
  });

  test("summary도 논리 이벤트 단위로 계산된다", async () => {
    const { report } = await buildReport();
    const total = Object.values(report.summary).reduce((sum, count) => sum + count, 0);
    expect(total).toBe(2);
  });
});
