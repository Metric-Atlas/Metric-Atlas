/**
 * Korean display mapping for marketers/PMs.
 *
 * Product rule: original event names and eventKeys are NEVER translated or
 * replaced — Korean labels are shown ALONGSIDE the raw values. Field NAMES stay
 * English; only field VALUES and a human description of the event get Korean.
 *
 * This file is display metadata only. It lives outside fixtures/ on purpose so
 * fixture JSON stays untouched (contract v0).
 */
import type { HealthBucket } from "./types";

export const C = {
  green: "#15803d", greenBg: "#e6f4e9",
  amber: "#b45309", amberBg: "#fdf2dc",
  red: "#b91c1c", redBg: "#fbeaea",
  blue: "#1d4ed8", blueBg: "#e8ecfb",
  gray: "#5d5f5a", grayBg: "#eeeeea",
  teal: "#0f766e", tealBg: "#e2f2f0",
  orange: "#c2410c", orangeBg: "#fceee6",
  ink: "#16181d", muted: "#6c6e69", faint: "#8a8c86",
  line: "#e3e3dd", lineSoft: "#eaeae4", surface: "#fff", surfaceAlt: "#fcfcfa",
  accent: "#2d3bd4", accentBg: "#f1f3ff", accentLine: "#c9cdf3"
} as const;

/** eventName → 마케터용 설명. 원본 이름은 그대로 유지하고 병기용으로만 사용한다. */
export const EVENT_KO: Record<string, string> = {
  purchase_click: "구매 버튼 클릭",
  lead_submit: "문의 폼 전송",
  custom_card_click: "카드 클릭",
  signup_complete: "가입 완료",
  page_view: "페이지 조회",
  // Metric-Atlas-homepage 데모 사이트 이벤트
  nav_click: "상단 메뉴 클릭",
  issue_click: "GitHub 이슈 등록 클릭",
  contact_click: "문의하기 클릭",
  sponsor_click: "스폰서 클릭",
  star_click: "GitHub Star 클릭"
};
export const eventKo = (eventName: string): string => EVENT_KO[eventName] ?? "설명 없음";

/** 영어 필드명 → 마케터 용어 (필드명 자체는 화면에서 영어로 유지) */
export const FIELD_KO: Record<string, string> = {
  PROVIDER: "수집 도구",
  EMITTER: "전송 방식",
  "PROVIDER CONFIDENCE": "도구 판별 확신도",
  "OVERLAY SUPPORTED": "화면 표시 지원",
  "BINDING ELEMENT": "연결된 화면 요소",
  "ATLAS DOM ID": "요소 식별자",
  "BINDING CONFIDENCE": "연결 확신도",
  "CODE STATE": "코드 상태",
  "GA4 OBSERVATION": "GA4 관측 상태",
  "GA4 MANAGED": "GA4 관리 여부",
  "GTM DESTINATION": "GTM 목적지"
};

/** 원천 필드 값 → 한국어 뜻 */
export const VALUE_KO: Record<string, string> = {
  ga4: "GA4",
  unknown: "확인 불가",
  provider_exact: "정확히 확인됨",
  provider_unknown: "확인 불가",
  binding_exact: "정확히 연결됨",
  detected: "코드에서 발견",
  not_detected: "코드에서 발견되지 않음",
  observed: "GA4에서 관측됨",
  not_observed: "GA4에서 관측되지 않음",
  managed: "GA4 자동 수집 이벤트",
  not_managed: "직접 구현 이벤트",
  builtin: "GA4 기본 제공",
  registered_custom_dimension: "맞춤 측정기준 등록됨",
  not_registered: "GA4에 등록되지 않음",
  ok: "정상 조회",
  no_rows: "조회된 데이터 없음",
  unauthorized: "권한 없음",
  unsupported: "지원되지 않음",
  error: "오류",
  no_health: "상태 정보 없음",
  button: "버튼",
  form: "폼",
  true: "지원",
  false: "미지원",
  "—": "해당 없음",
  "없음": "연결된 요소 없음"
};

/** EMITTER는 전송 방식이므로 Provider(도착지)와 다른 사전을 쓴다. GA4와 GTM을 같은 개념으로 취급하지 않는다. */
export const EMITTER_KO: Record<string, string> = {
  ga4: "gtag 직접 전송",
  gtm: "GTM(dataLayer) 전송",
  "—": "해당 없음"
};

export const valueKo = (field: string, value: unknown): string => {
  const key = String(value);
  return (field === "EMITTER" ? EMITTER_KO[key] : VALUE_KO[key]) ?? "";
};

export const HEALTH_META: Record<HealthBucket, { ko: string; color: string; bg: string; fg: string; explain: string }> = {
  healthy: { ko: "정상", color: C.green, bg: C.greenBg, fg: C.green, explain: "코드에 있고 GA4에서도 관측됩니다." },
  parameterRegistrationGap: { ko: "파라미터 등록 누락", color: C.red, bg: C.redBg, fg: C.red, explain: "보내는 값이 GA4 보고서에 안 나올 수 있습니다." },
  codeOnly: { ko: "코드에만 있음", color: C.amber, bg: C.amberBg, fg: C.amber, explain: "GA4에서 아직 관측되지 않았습니다. 검토가 필요합니다." },
  ga4Managed: { ko: "GA4 자동 수집", color: C.blue, bg: C.blueBg, fg: C.blue, explain: "GA4가 스스로 수집하는 이벤트입니다. 정상입니다." },
  ga4Only: { ko: "GA4에만 있음", color: C.blue, bg: C.blueBg, fg: C.blue, explain: "GA4에는 있지만 코드에서 찾지 못했습니다." },
  unresolved: { ko: "미해결", color: C.gray, bg: C.grayBg, fg: C.gray, explain: "코드와 GA4 어느 쪽으로도 판정하지 못했습니다." },
  noHealth: { ko: "상태 정보 없음", color: C.gray, bg: C.grayBg, fg: C.gray, explain: "GA4 Health 데이터에 없는 이벤트입니다." }
};

/** 마케터 요약 화면에 노출하는 상태 (조치가 필요한 것만) */
export const SUMMARY_BUCKETS: HealthBucket[] = ["healthy", "codeOnly", "parameterRegistrationGap"];
/** 이벤트 탐색 필터에 노출하는 상태 (전수) */
export const FILTER_BUCKETS: HealthBucket[] = [
  "healthy", "codeOnly", "ga4Only", "ga4Managed", "parameterRegistrationGap", "unresolved", "noHealth"
];

export const REVIEW_KO: Record<string, string> = {
  parameter_registration_gap: "코드가 보내는 파라미터가 GA4에 등록되어 있지 않습니다. 보고서에서 값을 쓰려면 등록이 필요합니다.",
  code_only_recent_data: "코드에는 있으나 GA4에서 아직 관측되지 않았습니다. 최근 데이터는 변동될 수 있습니다."
};

export const FLAG_KO: Record<string, string> = {
  recent_data_may_change: "최근 데이터는 아직 변동될 수 있습니다.",
  subject_to_thresholding: "GA4 데이터 임계값 처리의 영향을 받을 수 있습니다.",
  other_row_data_loss: "고카디널리티로 인해 일부 값이 (other)에 집계될 수 있습니다."
};

export const PARAM_STATE_COLOR: Record<string, { bg: string; fg: string }> = {
  builtin: { bg: C.greenBg, fg: C.green },
  registered_custom_dimension: { bg: C.greenBg, fg: C.green },
  not_registered: { bg: C.redBg, fg: C.red },
  unknown: { bg: C.grayBg, fg: C.gray },
  no_health: { bg: C.grayBg, fg: C.gray }
};

export const ANALYSIS_KO: Record<string, string> = {
  definition: "이벤트 정의만 확인",
  event_count: "기간 내 발생 수",
  comparison: "이전 기간과 비교"
};

export const providerColors = (provider: string) =>
  provider === "ga4" ? { bg: C.orangeBg, fg: C.orange } : { bg: C.grayBg, fg: C.gray };

export const emitterColors = (emitter: string) => {
  if (emitter === "ga4") return { bg: C.orangeBg, fg: C.orange };
  if (emitter === "gtm") return { bg: C.tealBg, fg: C.teal };
  return { bg: C.grayBg, fg: C.gray };
};
