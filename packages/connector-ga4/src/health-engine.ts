import type {
  DetectedEvent,
  Ga4ObservationState,
  HealthItem,
  ResultStatus,
} from "@metric-atlas/contracts";
import { classifyHealthItemBucket } from "@metric-atlas/contracts";
import type { NormalizedAnalyticsResult } from "@metric-atlas/connector-sdk";
import { resolveGa4ManagedState } from "./managed-event-registry.js";
import { resolveParameterState, type CustomDimensionLookup } from "./reserved-parameter-registry.js";

/**
 * DEC-023 / Spike §3: no_rows는 API 오류가 아니라 정상 응답(rowCount=0)이므로 "확실히 관측 안 됨"이다.
 * unauthorized/unsupported/error는 GA4에 실제로 데이터가 있는지 판단할 수 없으므로 unknown.
 */
export function resolveGa4ObservationState(resultStatus: ResultStatus): Ga4ObservationState {
  if (resultStatus === "ok") return "observed";
  if (resultStatus === "no_rows") return "not_observed";
  return "unknown";
}

/**
 * ADR-006 reviewReason 코드 규칙. bucket 우선순위: unresolved > parameterRegistrationGap
 * > codeOnly(recent 여부로 세분) > quality flag(thresholding > other_row) > null.
 * codeState="detected"인 항목만 다루므로(이 모듈은 GA4-only/not_detected 경로는 다루지 않음)
 * "ga4Only" 버킷은 이 함수에서 도달하지 않는다.
 */
export function computeReviewReason(
  item: Pick<HealthItem, "codeState" | "ga4ObservationState" | "ga4ManagedState" | "parameterRegistrationStates">,
  resultStatus: ResultStatus,
  qualityFlags: readonly string[],
): string | null {
  // eventKey/eventName은 classifyHealthItemBucket이 읽지 않는 필드라 더미로 채운다.
  const bucket = classifyHealthItemBucket({ eventKey: "", eventName: "", ...item });

  if (bucket === "unresolved") {
    if (resultStatus === "unauthorized") return "ga4_query_unauthorized";
    if (resultStatus === "unsupported") return "ga4_query_unsupported";
    if (resultStatus === "error") return "ga4_query_error";
    return "unresolved_needs_review";
  }
  if (bucket === "parameterRegistrationGap") return "parameter_registration_gap";
  if (bucket === "codeOnly") {
    return qualityFlags.includes("recent_data_may_change")
      ? "code_only_recent_data"
      : "code_only_not_observed";
  }
  if (qualityFlags.includes("subject_to_thresholding")) return "thresholding_may_affect_accuracy";
  if (qualityFlags.includes("other_row_data_loss")) return "other_row_data_loss";
  return null;
}

export function buildHealthItemForDetectedEvent(input: {
  /** analyticsProvider="ga4"인 DetectedEvent만 전달한다 (DEC-033 scope). */
  event: DetectedEvent;
  /** event.eventName에 대한 metric="event_count" 조회 결과. */
  queryResult: NormalizedAnalyticsResult;
  customDimensions: CustomDimensionLookup;
}): HealthItem {
  const { event, queryResult, customDimensions } = input;
  const ga4ObservationState = resolveGa4ObservationState(queryResult.resultStatus);
  const ga4ManagedState = resolveGa4ManagedState(event.eventName);
  const parameterRegistrationStates = event.parameters.map((parameter) => ({
    parameter,
    state: resolveParameterState(parameter, customDimensions),
  }));

  const reviewReason = computeReviewReason(
    { codeState: "detected", ga4ObservationState, ga4ManagedState, parameterRegistrationStates },
    queryResult.resultStatus,
    queryResult.qualityFlags,
  );

  return {
    eventKey: event.eventKey,
    eventName: event.eventName,
    codeState: "detected",
    ga4ObservationState,
    ga4ManagedState,
    parameterRegistrationStates,
    latestMeasurement: {
      resultStatus: queryResult.resultStatus,
      value: queryResult.value,
      qualityFlags: queryResult.qualityFlags,
    },
    reviewReason,
  };
}
