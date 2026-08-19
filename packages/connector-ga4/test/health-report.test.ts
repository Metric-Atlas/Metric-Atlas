import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import type {
  AnalyticsConnector,
  ConnectorContext,
  Ga4ObservedEventsResult,
  NormalizedAnalyticsResult,
  ProviderAgnosticQuery,
} from "@metric-atlas/connector-sdk";
import type { EventManifest } from "@metric-atlas/contracts";
import { classifyHealthItemBucket } from "@metric-atlas/contracts";
import { buildAnalyticsHealthReport } from "../src/health-engine.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function loadManifest(): EventManifest {
  return JSON.parse(readFileSync(path.join(rootDir, "fixtures/mock-manifest.json"), "utf-8"));
}

const CONTEXT: ConnectorContext = { provider: "ga4", propertyId: "550079255", credentialRef: "env" };
const DATE_RANGE = { startDate: "2026-08-01", endDate: "2026-08-18" } as const;
const NOW = new Date("2026-08-18T12:00:00Z");

function baseResult(overrides: Partial<NormalizedAnalyticsResult>): NormalizedAnalyticsResult {
  return {
    provider: "ga4",
    metricType: "event_count",
    resultStatus: "ok",
    dateRange: DATE_RANGE,
    reportingTimezone: "Asia/Seoul",
    fetchedAt: NOW.toISOString(),
    qualityFlags: [],
    ...overrides,
  };
}

function fakeConnector(
  queryByEventName: Record<string, NormalizedAnalyticsResult>,
  observedEvents: Ga4ObservedEventsResult,
): AnalyticsConnector {
  return {
    async testConnection(context) {
      return { success: true, provider: "ga4", propertyId: context.propertyId };
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
    async query(_context, query: ProviderAgnosticQuery) {
      return queryByEventName[query.eventName] ?? baseResult({ resultStatus: "error" });
    },
    async listObservedEventNames() {
      return observedEvents;
    },
  };
}

describe("buildAnalyticsHealthReport — fixtures/mock-manifest.json 전체 재현", () => {
  test("purchase_click/custom_card_click/signup_complete(detected) + page_view(GA4-only, managed) 조합", async () => {
    const manifest = loadManifest();
    const connector = fakeConnector(
      {
        purchase_click: baseResult({ resultStatus: "ok", value: 1240 }),
        custom_card_click: baseResult({ resultStatus: "ok", value: 500 }),
        signup_complete: baseResult({ resultStatus: "no_rows", qualityFlags: ["recent_data_may_change"] }),
      },
      { resultStatus: "ok", eventNames: ["purchase_click", "page_view"], qualityFlags: [] },
    );

    const report = await buildAnalyticsHealthReport({
      connector,
      context: CONTEXT,
      manifest,
      dateRange: DATE_RANGE,
      customDimensions: { status: "ok", registeredParameterNames: new Set() },
      reportingTimezone: "Asia/Seoul",
      now: () => NOW,
    });

    expect(report.provider).toBe("ga4");
    expect(report.propertyId).toBe("550079255");
    expect(report.reportingTimezone).toBe("Asia/Seoul");
    expect(report.generatedAt).toBe(NOW.toISOString());

    // gtm:lead_submit(analyticsProvider=unknown)은 DEC-033에 따라 제외되고,
    // GA4 이벤트 3개(purchase_click/custom_card_click/signup_complete) + GA4-only 1개(page_view) = 4건.
    expect(report.items).toHaveLength(4);

    const byKey = new Map(report.items.map((item) => [item.eventKey, item]));

    expect(byKey.get("ga4:purchase_click")).toEqual({
      eventKey: "ga4:purchase_click",
      eventName: "purchase_click",
      codeState: "detected",
      ga4ObservationState: "observed",
      ga4ManagedState: "not_managed",
      parameterRegistrationStates: [
        { parameter: "value", state: "builtin" },
        { parameter: "currency", state: "builtin" },
        { parameter: "campaign_slot", state: "not_registered" },
      ],
      latestMeasurement: { resultStatus: "ok", value: 1240, qualityFlags: [] },
      reviewReason: "parameter_registration_gap",
    });

    expect(byKey.get("ga4:custom_card_click")).toEqual({
      eventKey: "ga4:custom_card_click",
      eventName: "custom_card_click",
      codeState: "detected",
      ga4ObservationState: "observed",
      ga4ManagedState: "not_managed",
      parameterRegistrationStates: [],
      latestMeasurement: { resultStatus: "ok", value: 500, qualityFlags: [] },
      reviewReason: null,
    });

    expect(byKey.get("ga4:signup_complete")).toEqual({
      eventKey: "ga4:signup_complete",
      eventName: "signup_complete",
      codeState: "detected",
      ga4ObservationState: "not_observed",
      ga4ManagedState: "not_managed",
      parameterRegistrationStates: [],
      latestMeasurement: { resultStatus: "no_rows", value: undefined, qualityFlags: ["recent_data_may_change"] },
      reviewReason: "code_only_recent_data",
    });

    // page_view는 Manifest에 없어 GA4-only 경로로 들어오고, Managed Event Registry에 있어 managed로 판정된다.
    expect(byKey.get("ga4:page_view")).toEqual({
      eventKey: "ga4:page_view",
      eventName: "page_view",
      codeState: "not_detected",
      ga4ObservationState: "observed",
      ga4ManagedState: "managed",
      parameterRegistrationStates: [],
      latestMeasurement: { resultStatus: "ok", qualityFlags: [] },
      reviewReason: null,
    });

    // 버킷 우선순위상 managed 이벤트는 not_detected+observed라도 ga4Managed로 분류된다 (ga4Only 아님).
    expect(report.summary).toEqual({
      healthy: 1, // custom_card_click
      codeOnly: 1, // signup_complete
      ga4Only: 0,
      ga4Managed: 1, // page_view
      parameterRegistrationGap: 1, // purchase_click
      unresolved: 0, // mock-manifest.json에 DYNAMIC_EVENT_NAME 경고 없음
    });

    // summary가 실제로 classifyHealthItemBucket 규칙과 일치하는지 이중 검증.
    const recomputed = { healthy: 0, codeOnly: 0, ga4Only: 0, ga4Managed: 0, parameterRegistrationGap: 0, unresolved: 0 };
    for (const item of report.items) recomputed[classifyHealthItemBucket(item)] += 1;
    expect(recomputed).toEqual(report.summary);
  });

  test("DYNAMIC_EVENT_NAME 경고가 있으면 unresolved에 합산된다 (docs/20 §5)", async () => {
    const manifest = loadManifest();
    manifest.warnings = [
      ...manifest.warnings,
      { code: "DYNAMIC_EVENT_NAME", file: "src/Dynamic.tsx" },
      { code: "DYNAMIC_EVENT_NAME", file: "src/Dynamic2.tsx" },
    ];
    const connector = fakeConnector(
      {
        purchase_click: baseResult({ resultStatus: "ok", value: 1 }),
        custom_card_click: baseResult({ resultStatus: "ok", value: 1 }),
        signup_complete: baseResult({ resultStatus: "ok", value: 1 }),
      },
      { resultStatus: "ok", eventNames: [], qualityFlags: [] },
    );

    const report = await buildAnalyticsHealthReport({
      connector,
      context: CONTEXT,
      manifest,
      dateRange: DATE_RANGE,
      customDimensions: { status: "ok", registeredParameterNames: new Set(["campaign_slot"]) },
      reportingTimezone: "Asia/Seoul",
      now: () => NOW,
    });

    expect(report.summary.unresolved).toBe(2);
  });
});
