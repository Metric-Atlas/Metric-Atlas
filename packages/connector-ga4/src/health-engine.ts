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
 * ADR-006 reviewReason 코드 규칙 — 딱 두 코드만 쓴다: `parameter_registration_gap`,
 * `code_only_recent_data` (apps/demo-react-vite/src/labels.ts의 REVIEW_KO에 이미 있는
 * 두 키와 정확히 일치, fixtures/mock-ga4-health.json 예시로 확정된 관례).
 *
 * quality flag(thresholding/other_row/recent)는 reviewReason과 무관하게 항상
 * EventDetail에서 qualityFlags 배열을 통해 FLAG_KO로 별도 렌더링된다(labels.ts 확인).
 * 그래서 reviewReason에 flag 기반 코드를 추가로 넣으면 (a) REVIEW_KO에 없는 키라
 * EventCard/OverviewView에서 "검토 사유 없음"으로 잘못 표시되고 (b) EventDetail에서는
 * 같은 문구가 중복 표시된다. 두 established 코드 외에는 전부 null을 반환해
 * UI(labels.ts REVIEW_KO)가 확장되기 전까지 이 계약을 어기지 않는다.
 */
export function computeReviewReason(
  item: Pick<HealthItem, "codeState" | "ga4ObservationState" | "ga4ManagedState" | "parameterRegistrationStates">,
  qualityFlags: readonly string[],
): string | null {
  // eventKey/eventName은 classifyHealthItemBucket이 읽지 않는 필드라 더미로 채운다.
  const bucket = classifyHealthItemBucket({ eventKey: "", eventName: "", ...item });

  if (bucket === "parameterRegistrationGap") return "parameter_registration_gap";
  if (bucket === "codeOnly" && qualityFlags.includes("recent_data_may_change")) {
    return "code_only_recent_data";
  }
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
