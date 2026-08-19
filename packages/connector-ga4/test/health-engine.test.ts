import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import type { DetectedEvent, EventManifest } from "@metric-atlas/contracts";
import type { NormalizedAnalyticsResult } from "@metric-atlas/connector-sdk";
import {
  buildHealthItemForDetectedEvent,
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

  test("unresolved: unauthorized/unsupported/error는 각각 다른 code", () => {
    const unresolved = detected({ ga4ObservationState: "unknown" });
    expect(computeReviewReason(unresolved, "unauthorized", [])).toBe("ga4_query_unauthorized");
    expect(computeReviewReason(unresolved, "unsupported", [])).toBe("ga4_query_unsupported");
    expect(computeReviewReason(unresolved, "error", [])).toBe("ga4_query_error");
  });

  test("codeOnly인데 recent flag 없으면 code_only_not_observed", () => {
    const item = detected({ ga4ObservationState: "not_observed" });
    expect(computeReviewReason(item, "no_rows", [])).toBe("code_only_not_observed");
  });

  test("parameterRegistrationGap은 codeOnly보다 우선하지 않는다 (bucket 우선순위상 parameterRegistrationGap이 먼저 체크됨)", () => {
    // ga4ObservationState=not_observed + not_registered 파라미터가 같이 있어도
    // classifyHealthItemBucket 우선순위상 parameterRegistrationGap이 codeOnly보다 먼저 걸린다.
    const item = detected({
      ga4ObservationState: "not_observed",
      parameterRegistrationStates: [{ parameter: "campaign_slot", state: "not_registered" }],
    });
    expect(computeReviewReason(item, "no_rows", ["recent_data_may_change"])).toBe(
      "parameter_registration_gap",
    );
  });

  test("healthy + thresholding flag → thresholding_may_affect_accuracy (other_row보다 우선)", () => {
    const item = detected();
    expect(
      computeReviewReason(item, "ok", ["subject_to_thresholding", "other_row_data_loss"]),
    ).toBe("thresholding_may_affect_accuracy");
  });

  test("healthy + other_row_data_loss만 → other_row_data_loss", () => {
    const item = detected();
    expect(computeReviewReason(item, "ok", ["other_row_data_loss"])).toBe("other_row_data_loss");
  });

  test("healthy, flag 없음 → null", () => {
    const item = detected();
    expect(computeReviewReason(item, "ok", [])).toBeNull();
  });

  test("ga4Managed(정상 관리 이벤트)는 flag가 있어도 리뷰 불필요라 flag 규칙이 적용된다", () => {
    // ga4ManagedState=managed는 classifyHealthItemBucket에서 ga4Managed 버킷으로 분류되고,
    // computeReviewReason은 unresolved/parameterRegistrationGap/codeOnly가 아니므로 flag 규칙으로 내려간다.
    const item = detected({ ga4ManagedState: "managed" });
    expect(computeReviewReason(item, "ok", [])).toBeNull();
    expect(computeReviewReason(item, "ok", ["subject_to_thresholding"])).toBe(
      "thresholding_may_affect_accuracy",
    );
  });
});
