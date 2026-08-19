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

### 3. `reviewReason` 코드 규칙 — 신규 확정

`docs/03` §6의 화면 문구 3종을 기계 판독 가능한 reason code로 대응시킨다. Dashboard(D 소비)는 code → 화면 문구를 자체 매핑한다 (문구 자체는 `docs/03` §6에 이미 있음, code는 이 ADR에서 신설):

| reviewReason code | 조건 | docs/03 §6 대응 문구 |
|---|---|---|
| `parameter_registration_gap` | Health bucket = `parameterRegistrationGap` | (Parameter Registration Gap 카테고리, docs/06 §2) |
| `code_only_recent_data` | bucket = `codeOnly` **그리고** `latestMeasurement.qualityFlags`에 `recent_data_may_change` 포함 | "최근 데이터는 아직 변동될 수 있습니다." |
| `code_only_not_observed` | bucket = `codeOnly`, recent flag 없음 | (recent 문구 없이 Code only 카테고리만) |
| `thresholding_may_affect_accuracy` | bucket ≠ unresolved/parameterRegistrationGap/codeOnly **그리고** `subject_to_thresholding` 포함 | "GA4 데이터 임계값 처리의 영향을 받을 수 있습니다." |
| `other_row_data_loss` | 위와 동일 조건, `other_row_data_loss` 포함 (thresholding과 동시 발생 시 thresholding 우선) | "고카디널리티로 인해 일부 값이 (other)에 집계될 수 있습니다." |
| `ga4_query_unauthorized` / `ga4_query_unsupported` / `ga4_query_error` | bucket = `unresolved`, 해당 `resultStatus` | (§8 Result Status, 문구는 Dashboard 후속 결정) |
| `null` | bucket = `healthy` / `ga4Managed` (flag 없음), 또는 `ga4Only` | 리뷰 불필요 |

**우선순위**: unresolved(쿼리 실패) > parameterRegistrationGap > codeOnly(recent 여부로 세분) > quality flag(thresholding > other_row) > null. 구조적 이슈(파라미터 미등록, 코드만 존재)가 데이터 품질 flag보다 먼저 표시되어야 한다는 판단 — 후자는 "정상 관측인데 참고할 캐비어트"이고 전자는 "관측/등록 자체의 문제"이기 때문이다.

이 규칙은 `fixtures/mock-ga4-health.json`(Phase 0에서 이미 승인된 예시)의 `purchase_click`(→`parameter_registration_gap`)과 `signup_complete`(→`code_only_recent_data`)를 정확히 재현한다 — 즉 기존에 암묵적으로 합의된 예시와 일치하는 규칙임을 역으로 확인했다.

## Producers affected

- C: `packages/connector-ga4/src/health-engine.ts`에 `computeReviewReason()`/`resolveGa4ObservationState()`/`buildHealthItemForDetectedEvent()` 구현

## Consumers affected

- D: Dashboard가 `reviewReason` code를 문구로 매핑할 때 위 표를 그대로 사용
- A: 영향 없음 (계약 필드 타입 변경 없음, `reviewReason`은 이미 `z.string().nullable().optional()`)

## Alternatives

- `reviewReason`에 화면 문구 자체를 담기 — 기각. i18n/문구 변경 시 계약을 흔들게 됨. code 방식이 Contract-UI 분리 원칙(docs/04)에 맞음.
- Quality flag 기반 reviewReason을 bucket과 무관하게 항상 우선 — 기각. 구조적 문제(파라미터 미등록)를 데이터 품질 caveat보다 먼저 봐야 한다는 것이 docs/06 §2 "즉시 구현 오류라고 단정하지 않음" 원칙과 더 맞음.

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
