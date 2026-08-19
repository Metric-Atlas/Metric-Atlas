import type { ParameterState } from "@metric-atlas/contracts";

/**
 * GA4가 자동/향상된 측정으로 수집하거나 예약해 둔 이벤트 파라미터 이름.
 * Spike(C-SPIKE-001) §5 실측: 이 이름들은 Data API `getMetadata`의 dimension `apiName`
 * 목록과 이름공간이 달라 매칭으로 `builtin` 판정이 불가능함을 확인했다.
 * GA4 공식 문서가 바뀌면 이 목록도 버전 관리하며 갱신한다 (docs/06 §3 registry 접근과 동일 패턴).
 *
 * Version: 2026-08-19 (ADR-005 최초 작성 기준)
 */
export const RESERVED_PARAMETER_REGISTRY_VERSION = "2026-08-19";

export const RESERVED_PARAMETERS: ReadonlySet<string> = new Set([
  // 페이지/화면
  "page_location",
  "page_referrer",
  "page_title",
  "page_encoding",
  "screen_resolution",
  "language",

  // 세션/참여
  "session_id",
  "session_number",
  "session_engaged",
  "engagement_time_msec",
  "ga_session_id",
  "ga_session_number",

  // 스크롤/아웃바운드/사이트 검색 (Enhanced Measurement)
  "percent_scrolled",
  "link_url",
  "link_domain",
  "link_classes",
  "link_id",
  "link_text",
  "outbound",
  "search_term",

  // 파일 다운로드
  "file_extension",
  "file_name",

  // 동영상 (Enhanced Measurement)
  "video_current_time",
  "video_duration",
  "video_percent",
  "video_provider",
  "video_title",
  "video_url",
  "visible",

  // 폼 상호작용 (Enhanced Measurement)
  "form_id",
  "form_name",
  "form_destination",
  "form_submit_text",

  // 전자상거래 (Measurement Protocol 예약 파라미터)
  "currency",
  "value",
  "transaction_id",
  "items",
  "shipping",
  "tax",
  "coupon",
  "payment_type",
  "shipping_tier",

  // 콘텐츠/공유/검색
  "content_type",
  "content_id",
  "method",

  // 트래픽 소스
  "source",
  "medium",
  "campaign",
]);

export interface CustomDimensionLookup {
  /**
   * Admin `listCustomDimensions` 호출이 실패했으면 "unknown".
   * 성공했으면 "ok"이고 `registeredParameterNames`로 매칭한다 (등록 0건이어도 ok).
   */
  status: "ok" | "unknown";
  registeredParameterNames?: ReadonlySet<string>;
}

/**
 * Spike §5 판정 순서:
 * 1. Admin custom dimension `parameterName` 정확 매칭 → registered_custom_dimension
 * 2. Reserved Parameter Registry 매칭 → builtin
 * 3. 둘 다 아니면 → not_registered
 * 4. Admin API 조회 자체가 실패하면 → unknown
 */
export function resolveParameterState(
  parameterName: string,
  customDimensions: CustomDimensionLookup,
): ParameterState {
  if (customDimensions.status === "unknown") return "unknown";
  if (customDimensions.registeredParameterNames?.has(parameterName)) {
    return "registered_custom_dimension";
  }
  if (RESERVED_PARAMETERS.has(parameterName)) return "builtin";
  return "not_registered";
}
