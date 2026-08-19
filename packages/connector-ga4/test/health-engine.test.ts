import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import type { DetectedEvent, EventManifest } from "@metric-atlas/contracts";
import type { NormalizedAnalyticsResult } from "@metric-atlas/connector-sdk";
import type { Ga4ObservedEventsResult } from "@metric-atlas/connector-sdk";
import {
  buildHealthItemForDetectedEvent,
  buildHealthItemsForGa4OnlyEvents,
  computeReviewReason,
  resolveGa4ObservationState,
} from "../src/health-engine.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function loadManifest(): EventManifest {
  return JSON.parse(readFileSync(path.join(rootDir, "fixtures/mock-manifest.json"), "utf-8"));
}

function eventByKey(manifest: EventManifest, eventKey: string): DetectedEvent {
  const event = manifest.events.find((e) => e.eventKey === eventKey);
  if (!event) throw new Error(`fixture missing ${eventKey}`);
  return event;
}

function baseResult(overrides: Partial<NormalizedAnalyticsResult>): NormalizedAnalyticsResult {
  return {
    provider: "ga4",
    metricType: "event_count",
    resultStatus: "ok",
    dateRange: { startDate: "2026-08-01", endDate: "2026-08-18" },
    reportingTimezone: "Asia/Seoul",
    fetchedAt: "2026-08-18T12:00:00Z",
    qualityFlags: [],
    ...overrides,
  };
}

describe("resolveGa4ObservationState (DEC-023 / Spike §3)", () => {
  test("ok → observed", () => expect(resolveGa4ObservationState("ok")).toBe("observed"));
  test("no_rows → not_observed (에러가 아니라 확실한 미관측)", () =>
    expect(resolveGa4ObservationState("no_rows")).toBe("not_observed"));
  test.each(["unauthorized", "unsupported", "error"] as const)(
    "%s → unknown (관측 여부 판단 불가)",
    (status) => expect(resolveGa4ObservationState(status)).toBe("unknown"),
  );
});

describe("buildHealthItemForDetectedEvent — fixtures/mock-ga4-health.json 재현 (ADR-006)", () => {
  test("purchase_click: campaign_slot 미등록 → parameterRegistrationGap, reviewReason=parameter_registration_gap", () => {
    const manifest = loadManifest();
    const event = eventByKey(manifest, "ga4:purchase_click");
    const item = buildHealthItemForDetectedEvent({
      event,
      queryResult: baseResult({ eventKey: event.eventKey, resultStatus: "ok", value: 1240 }),
      customDimensions: { status: "ok", registeredParameterNames: new Set() },
    });

    expect(item).toEqual({
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
  });

  test("signup_complete: no_rows + recent_data_may_change → codeOnly, reviewReason=code_only_recent_data", () => {
    const manifest = loadManifest();
    const event = eventByKey(manifest, "ga4:signup_complete");
    const item = buildHealthItemForDetectedEvent({
      event,
      queryResult: baseResult({
        eventKey: event.eventKey,
        resultStatus: "no_rows",
        qualityFlags: ["recent_data_may_change"],
      }),
      customDimensions: { status: "ok", registeredParameterNames: new Set() },
    });

    expect(item).toEqual({
      eventKey: "ga4:signup_complete",
      eventName: "signup_complete",
      codeState: "detected",
      ga4ObservationState: "not_observed",
      ga4ManagedState: "not_managed",
      parameterRegistrationStates: [],
      latestMeasurement: { resultStatus: "no_rows", value: undefined, qualityFlags: ["recent_data_may_change"] },
      reviewReason: "code_only_recent_data",
    });
  });
});

describe("computeReviewReason (ADR-006 우선순위)", () => {
  const detected = (overrides: Partial<Parameters<typeof computeReviewReason>[0]> = {}) => ({
    codeState: "detected" as const,
    ga4ObservationState: "observed" as const,
    ga4ManagedState: "not_managed" as const,
    parameterRegistrationStates: [],
    ...overrides,
  });

  test("parameterRegistrationGap → parameter_registration_gap", () => {
    const item = detected({
      parameterRegistrationStates: [{ parameter: "campaign_slot", state: "not_registered" }],
    });
    expect(computeReviewReason(item, [])).toBe("parameter_registration_gap");
  });

  test("codeOnly + recent flag → code_only_recent_data", () => {
    const item = detected({ ga4ObservationState: "not_observed" });
    expect(computeReviewReason(item, ["recent_data_may_change"])).toBe("code_only_recent_data");
  });

  test("codeOnly인데 recent flag 없으면 null (REVIEW_KO에 없는 코드를 만들지 않는다, labels.ts 확인)", () => {
    const item = detected({ ga4ObservationState: "not_observed" });
    expect(computeReviewReason(item, [])).toBeNull();
  });

  test("parameterRegistrationGap이 codeOnly보다 우선한다 (bucket 우선순위)", () => {
    const item = detected({
      ga4ObservationState: "not_observed",
      parameterRegistrationStates: [{ parameter: "campaign_slot", state: "not_registered" }],
    });
    expect(computeReviewReason(item, ["recent_data_may_change"])).toBe("parameter_registration_gap");
  });

  test("healthy + quality flag가 있어도 reviewReason은 null이다 — flag는 qualityFlags로 별도 렌더링되므로 중복 코드를 만들지 않는다", () => {
    const item = detected();
    expect(computeReviewReason(item, ["subject_to_thresholding"])).toBeNull();
    expect(computeReviewReason(item, ["other_row_data_loss"])).toBeNull();
    expect(computeReviewReason(item, [])).toBeNull();
  });

  test("ga4Managed도 flag와 무관하게 reviewReason은 null (정상 분류, docs/06 §2)", () => {
    const item = detected({ ga4ManagedState: "managed" });
    expect(computeReviewReason(item, ["subject_to_thresholding"])).toBeNull();
  });
});

describe("buildHealthItemsForGa4OnlyEvents (ADR-007)", () => {
  const GA4_MANIFEST_EVENT_NAMES = new Set(["purchase_click", "custom_card_click", "signup_complete"]);

  test("page_view: fixtures/mock-manifest.json에 없는 이벤트 → not_detected + managed", () => {
    const observed: Ga4ObservedEventsResult = {
      resultStatus: "ok",
      eventNames: ["page_view", "purchase_click"],
      qualityFlags: [],
    };
    const items = buildHealthItemsForGa4OnlyEvents({
      manifestEventNames: GA4_MANIFEST_EVENT_NAMES,
      observedEvents: observed,
    });

    // purchase_click은 Manifest에 있으니 제외되고 page_view만 GA4-only로 남는다 (fixtures/mock-ga4-health.json 재현).
    expect(items).toEqual([
      {
        eventKey: "ga4:page_view",
        eventName: "page_view",
        codeState: "not_detected",
        ga4ObservationState: "observed",
        ga4ManagedState: "managed",
        parameterRegistrationStates: [],
        latestMeasurement: { resultStatus: "ok", qualityFlags: [] },
        reviewReason: null,
      },
    ]);
  });

  test("resultStatus가 ok가 아니면 빈 배열 (no_rows/unauthorized/error/unsupported)", () => {
    for (const resultStatus of ["no_rows", "unauthorized", "error", "unsupported"] as const) {
      const items = buildHealthItemsForGa4OnlyEvents({
        manifestEventNames: GA4_MANIFEST_EVENT_NAMES,
        observedEvents: { resultStatus, eventNames: ["page_view"], qualityFlags: [] },
      });
      expect(items).toEqual([]);
    }
  });

  test("Manifest 파라미터가 없어 parameterRegistrationStates는 항상 빈 배열", () => {
    const items = buildHealthItemsForGa4OnlyEvents({
      manifestEventNames: new Set(),
      observedEvents: { resultStatus: "ok", eventNames: ["scroll"], qualityFlags: [] },
    });
    expect(items[0]?.parameterRegistrationStates).toEqual([]);
  });
});
