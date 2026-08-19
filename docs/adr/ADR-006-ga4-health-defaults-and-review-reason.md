# ADR

- ID: ADR-006
- Date: 2026-08-19
- Status: Proposed
- Author: Member C (재욱)

## Problem

ADR-001 "보류 (GA4 Spike 결과 대기)" 목록과 `docs/15` DEC-034는 다음 4가지를 GA4 Spike(C-SPIKE-001) 완료 후 별도 ADR로 확정하기로 했다:

1. `METRIC_ATLAS_GA4_RECENT_WINDOW_HOURS` 및 Health 관측 기간 기본값
2. thresholding / `(other)` row data loss → `DataQualityFlag` 매핑 세부 규칙
3. `no_rows` + `recent_data_may_change`일 때 `reviewReason` 문구 규칙
4. Cache TTL, outbound concurrency 기본값 재검토

Spike는 `docs/spikes/ga4-data-api-result.md`(PR #2)로 완료됐다. 이 ADR로 4가지를 확정한다.

## Proposed change

### 1. 기본값 — 변경 없이 유지

Spike §9 실측(latency 0.6~1.2초/콜, quota 여유 큼, concurrent 한도 10)에 근거해 `docs/10`의 기존 기본값을 그대로 확정한다:

- `METRIC_ATLAS_GA4_RECENT_WINDOW_HOURS=48`
- `METRIC_ATLAS_CACHE_TTL_SECONDS=300`
- `METRIC_ATLAS_MAX_OUTBOUND_CONCURRENCY=4`

2차 스파이크 실행(실 트래픽 확보 후)에서 반증되면 재검토한다 (스파이크 결과 §10).

### 2. `DataQualityFlag` 매핑 규칙 — 확정

Spike §4 실측대로 확정한다 (이미 `connector-ga4/src/quality-flags.ts`(PR #14)에 구현됨, 이 ADR로 근거를 공식화):

- `metadata.subjectToThresholding === true`일 때만 `subject_to_thresholding`. 필드 부재(proto3 기본값 생략)는 `false`로 해석하며 `unknown` 취급하지 않는다.
- `metadata.dataLossFromOtherRow === true`일 때만 `other_row_data_loss`. 동일하게 부재=false.
- 조회 종료일이 `now - recentWindowHours` 이후면 `recent_data_may_change`.

### 3. `reviewReason` 코드 규칙 — 확정 (기존 Dashboard 관례에 맞춤)

`apps/demo-react-vite/src/labels.ts`의 `REVIEW_KO`를 확인한 결과, D가 이미 `fixtures/mock-ga4-health.json` 예시를 기준으로 정확히 **두 개의 reviewReason code**만 소비하도록 구현해 두었다: `parameter_registration_gap`, `code_only_recent_data`.

또한 `EventDetail.tsx`는 `reviewReason`과 무관하게 `latestMeasurement.qualityFlags` 배열을 **항상** `FLAG_KO`로 개별 렌더링한다 (`recent_data_may_change`/`subject_to_thresholding`/`other_row_data_loss` 문구가 이미 `FLAG_KO`에 있음). 따라서 `reviewReason`에 quality-flag 기반 code(예: `thresholding_may_affect_accuracy`)를 추가로 두면:

- `REVIEW_KO`에 없는 키라 `EventCard`/`OverviewView`가 "검토 사유 없음"으로 **잘못** 표시하고,
- `EventDetail`에서는 이미 `FLAG_KO`가 표시하는 문구와 **중복**된다.

**확정 규칙** (기존 UI 소비 관례 그대로, 이 ADR은 새 code를 만들지 않는다):

| reviewReason code | 조건 |
|---|---|
| `parameter_registration_gap` | Health bucket = `parameterRegistrationGap` |
| `code_only_recent_data` | bucket = `codeOnly` **그리고** `latestMeasurement.qualityFlags`에 `recent_data_may_change` 포함 |
| `null` | 그 외 전부 — `codeOnly`(recent flag 없음), `healthy`/`ga4Managed`(quality flag 유무 무관, flag는 `FLAG_KO`로 별도 표시됨), `ga4Only`, `unresolved` 포함 |

**우선순위**: parameterRegistrationGap > codeOnly+recent > null. quality flag(thresholding/other_row/recent)는 `reviewReason`이 아니라 `qualityFlags` 배열 자체로 전달되며 Dashboard가 `FLAG_KO`로 독립 렌더링하므로 이 함수의 책임이 아니다. `unresolved` 버킷(쿼리 실패)에 대한 code는 `REVIEW_KO`가 아직 없어 이번 범위에서는 `null`로 두고, 후속 UI 작업 필요 시 D와 함께 `REVIEW_KO`를 확장한다.

이 규칙은 `fixtures/mock-ga4-health.json`(Phase 0에서 이미 승인된 예시)의 `purchase_click`(→`parameter_registration_gap`)과 `signup_complete`(→`code_only_recent_data`)를 정확히 재현한다.

## Producers affected

- C: `packages/connector-ga4/src/health-engine.ts`에 `computeReviewReason()`/`resolveGa4ObservationState()`/`buildHealthItemForDetectedEvent()` 구현

## Consumers affected

- D: 변경 없음 — `apps/demo-react-vite/src/labels.ts`의 기존 `REVIEW_KO`/`FLAG_KO` 그대로 소비 가능 (새 code 없음)
- A: 영향 없음 (계약 필드 타입 변경 없음, `reviewReason`은 이미 `z.string().nullable().optional()`)

## Alternatives

- `reviewReason`에 화면 문구 자체를 담기 — 기각. i18n/문구 변경 시 계약을 흔들게 됨. code 방식이 Contract-UI 분리 원칙(docs/04)에 맞음.
- thresholding/other_row/recent quality flag마다 별도 reviewReason code 발급(`thresholding_may_affect_accuracy` 등) — 최초 초안에서 시도했으나 기각. `apps/demo-react-vite`가 이미 `qualityFlags`를 `reviewReason`과 독립적으로 `FLAG_KO`로 렌더링하고 있어(labels.ts, EventDetail.tsx), 추가 code는 `REVIEW_KO`에 없는 미등록 키가 되어 "검토 사유 없음" 오표시와 문구 중복을 동시에 일으킨다. 기존 UI 소비 관례(코드 2종)를 그대로 따르는 쪽으로 수정했다.

## Compatibility

Breaking 없음. `reviewReason`은 기존에도 optional/nullable string이었고 값 채우는 규칙만 정의한다.

## Migration

없음. `fixtures/mock-ga4-health.json`은 이미 이 규칙과 일치해 수정 불필요.

## Fixture updates

없음 (위 fixture-parity 확인 참고).

## Contract tests

`packages/connector-ga4/test/health-engine.test.ts` — `fixtures/mock-ga4-health.json`의 `purchase_click`/`signup_complete` 항목을 동일 입력으로 재현해 `reviewReason`이 일치하는지 검증하는 테스트 포함.

## Decision

Proposed. A 리뷰 후 Accepted 전환 요청.
