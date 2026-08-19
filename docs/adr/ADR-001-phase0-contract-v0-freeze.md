# ADR

- ID: ADR-001
- Date: 2026-08-18
- Status: Accepted
- Author: Member A (가현)

## Problem

`docs/20-phase-0-common-fields.md`가 `Proposed` 상태로 남아 있어 Phase 0 병렬 개발이 공식적으로 시작되지 않았습니다. Member C(재욱)가 `docs/contract-inputs/c-phase0-common-fields-review.md`(PR #1)에서 §10 승인 전 결정 항목 5건에 대한 의견과 Fixture 정합성 수정안, 신규 발견 2건(HealthSummary 버킷 중복 계상, comparison 결과의 비교 기간 필드 부재)을 제출했습니다. B/D의 Contract Input은 아직 제출되지 않았습니다.

## Proposed change

C의 제안을 검토하여 Contract v0을 Freeze합니다. B/D 입력이 없는 상태이지만, 이번에 확정하는 항목은 (a) 이미 Accepted된 원칙(Module Boundary, GTM/GA4 분리, DEC-016/023/024)의 단순 재확인이거나 (b) C가 유일한 Producer인 GA4 Connector/Health 영역이라 B/D 합의가 필수는 아닙니다. GA4 실측이 필요한 항목(Health 관측 기간 기본값, thresholding/quality flag 매핑, no_rows 문구 규칙)은 GA4 Spike(C-SPIKE-001, PR #2, 현재 Draft) 완료 전까지 확정하지 않습니다.

### 결정 사항

1. **`implementationKey` / `implementationKeys` 필수화** — 채택. `DetectedEvent.implementationKey`, `ElementBinding.implementationKeys`를 Contract v0 필수 필드로 확정.
2. **동적 이벤트 Warning-only 표현** — 채택. 정적으로 `eventKey`를 만들 수 없는 이벤트는 `events[]`에 넣지 않고 `DYNAMIC_EVENT_NAME` Warning으로만 기록.
3. **`HealthSummary.unresolved` 산정 근거** — 다음 두 원천의 합으로 정의합니다.
   - Manifest `warnings[]`의 `DYNAMIC_EVENT_NAME` 건수
   - `items[]` 중 `codeState="unknown"` 또는 `ga4ObservationState="unknown"`인 Health Item 수 (판정 불가 항목)
4. **`HealthSummary` 버킷 상호배타 + 우선순위** — 채택. 각 Health Item은 정확히 하나의 버킷에만 속하며 우선순위는 다음과 같습니다.

   ```text
   unresolved (codeState=unknown 또는 ga4ObservationState=unknown)
     > parameterRegistrationGap (parameterRegistrationStates에 not_registered 존재)
     > codeOnly (codeState=detected, ga4ObservationState=not_observed)
     > ga4Managed (ga4ManagedState=managed)
     > ga4Only (codeState=not_detected, ga4ObservationState=observed, ga4ManagedState=not_managed)
     > healthy (그 외: codeState=detected, ga4ObservationState=observed, gap 없음)
   ```

5. **`summaries` / `scanStats` optional 유지** — 채택. Manifest Phase 0 확장 필드로 유지하며 C/D는 이 필드 없이도 개발 가능해야 합니다.
6. **Manifest Parameter 전수를 Health Parameter Registration State에 포함** — 채택. `DetectedEvent.parameters`의 모든 파라미터는 대응 `HealthItem.parameterRegistrationStates`에 항목을 가져야 하며, 판정 불가 시 `state="unknown"`을 사용합니다.
7. **`QueryResult` Producer = C 확정** — 채택. D는 `QueryPlan` Producer이며 `QueryResult`/GA4 Raw Response의 Producer가 아닙니다 (Module Boundary, docs/04 §5).
8. **`QueryResult.dateRange`는 절대 날짜로 반환** — 채택. `QueryPlan.dateRange`가 `preset`이어도 `QueryResult.dateRange`는 Property Reporting Time Zone 기준으로 해석된 `{ startDate, endDate }`를 반환합니다.
9. **`comparisonDateRange` 필드 추가** — 채택. `metricType="comparison"`인 `QueryResult`는 `comparisonDateRange: DateRange`를 필수로 포함합니다.
10. **GA4 Analytics Health Report 대상 범위** — 채택. `AnalyticsHealthReport.items`는 `analyticsProvider="ga4"`인 Manifest Event만 포함합니다. `provider=unknown`인 GTM 이벤트는 GA4 Health 판정 대상에서 제외합니다 (docs/20 §8 재확인).
11. **Fixture 버그 수정** — 채택.
    - `mock-manifest.json`의 `gtm:lead_submit`은 `providerDetectionConfidence="provider_unknown"`으로 수정 (기존 `docs/20 §7` 규칙 위반이던 버그).
    - `mock-manifest.json`에 `ga4:signup_complete` 이벤트 추가 (Health와 `eventKey` 정합).
    - `purchase_click.parameters`에 `campaign_slot` 추가.

### 보류 (GA4 Spike 결과 대기, C-SPIKE-001)

- `METRIC_ATLAS_GA4_RECENT_WINDOW_HOURS` 및 Health 관측 기간 기본값
- thresholding / `(other)` row data loss → `DataQualityFlag` 매핑 세부 규칙
- `no_rows` + `recent_data_may_change`일 때 `reviewReason` 문구 규칙
- Cache TTL, outbound concurrency 기본값 재검토

이 항목들은 Contract v0 구조(필드 존재 여부)에는 영향이 없으므로 Freeze를 막지 않습니다. Spike 완료 후 별도 ADR로 진행합니다 (docs/17 §4).

## Producers affected

- B(성준): `mock-manifest.json` 수정 사항 반영 필요 (실제 Detector 구현 시 GTM confidence 규칙, `implementationKey` 채번 규칙 준수)
- C(재욱): `AnalyticsHealthReport`/`QueryResult` Producer로서 버킷 우선순위, `dateRange`/`comparisonDateRange` 규칙 구현
- D(호범): `QueryPlan` Producer는 변경 없음

## Consumers affected

- C(재욱): Dashboard, Event Detail
- D(호범): Search/Query UI, Demo App
- B(성준): Overlay(`implementationKeys` 사용)

## Alternatives

- HealthSummary 버킷 중복 허용(현재 Fixture 상태 유지) — 기각. `docs/03`의 Summary 표시 예시와 불일치하고 D UI에서 합계가 총 이벤트 수를 넘는 혼란을 유발.
- `unresolved`를 DYNAMIC_EVENT_NAME 건수만으로 정의 — 기각. Health Item 자체의 판정 불가 상태(`unknown`)를 누락하면 D UI가 "판정 불가" 이벤트를 `healthy`/`codeOnly` 등으로 잘못 표시할 위험.
- B/D 입력 전체 도착까지 Freeze 보류 — 기각. Phase 0 목적은 병렬 시작이며(DEC-021), 이번 결정은 B/D 도메인과 충돌 가능성이 낮은 항목 위주. B/D 입력 도착 시 필요하면 후속 ADR로 조정.

## Compatibility

Contract v0 최초 Freeze이므로 이전 Freeze된 버전과의 호환성 이슈 없음. 기존 Fixture는 본 ADR과 함께 갱신.

## Migration

없음 (최초 Freeze).

## Fixture updates

- `fixtures/mock-manifest.json`: `ga4:signup_complete` 추가, `campaign_slot` 파라미터 추가, GTM `providerDetectionConfidence` 수정, `implementationKey`/`implementationKeys` 추가
- `fixtures/mock-ga4-health.json`: 버킷 우선순위 규칙에 따라 `summary` 재계산, `value` 파라미터 등록 상태 추가
- `fixtures/mock-query-result.json`: `dateRange`(절대 날짜), `comparisonDateRange` 추가
- `fixtures/README.md`: 해소된 기지 이슈 목록 갱신

## Contract tests

- `packages/contracts`에 Zod Schema 추가
- 3개 Fixture를 Schema로 검증하는 Contract Test 추가 (`packages/contracts/test/fixtures.test.ts`)

## Decision

Accepted. 본 ADR 승인과 함께 `docs/20-phase-0-common-fields.md` Status를 `Accepted`로, `DEC-026`을 `Accepted`로 갱신하고 `packages/contracts` Zod Schema v0을 Freeze한다.
