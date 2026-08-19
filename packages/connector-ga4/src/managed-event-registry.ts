import type { Ga4ManagedState } from "@metric-atlas/contracts";

/**
 * GA4 자동 수집 이벤트 + Enhanced Measurement 이벤트 이름 (docs/06 §3).
 * "GA4 only" Health 판정에서 정상 관리 이벤트를 오탐(false positive)으로 잡지 않기 위한 목록.
 * GA4 공식 목록이 바뀌면 버전 관리하며 갱신한다.
 *
 * Version: 2026-08-19 (ADR-005 최초 작성 기준)
 */
export const MANAGED_EVENT_REGISTRY_VERSION = "2026-08-19";

export const MANAGED_EVENTS: ReadonlySet<string> = new Set([
  // 자동 수집
  "first_visit",
  "session_start",
  "user_engagement",
  "page_view",

  // Enhanced Measurement — 페이지뷰/스크롤/아웃바운드
  "scroll",
  "click",

  // Enhanced Measurement — 사이트 검색
  "view_search_results",

  // Enhanced Measurement — 동영상 참여
  "video_start",
  "video_progress",
  "video_complete",

  // Enhanced Measurement — 파일 다운로드
  "file_download",

  // Enhanced Measurement — 폼 상호작용
  "form_start",
  "form_submit",
]);

/**
 * 정적 버전 관리 목록 조회이므로 API 실패 개념이 없다 — 항상 managed/not_managed로 확정된다.
 * `Ga4ManagedState="unknown"`은 이 함수가 아니라 상위(이벤트 자체가 unresolved인 경우)에서 쓰인다.
 */
export function resolveGa4ManagedState(eventName: string): Ga4ManagedState {
  return MANAGED_EVENTS.has(eventName) ? "managed" : "not_managed";
}
