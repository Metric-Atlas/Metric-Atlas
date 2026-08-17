# Pre-Phase 0 — C(재욱) docs/20 검토 의견

- Status: Draft (팀 공유용 제안, A 승인 전까지 Shared Contract 아님)
- Author: Member C (재욱)
- Date: 2026-08-17
- Scope: `docs/20-phase-0-common-fields.md` 승인 전 결정 항목에 대한 C 도메인 의견 + Health/Query Fixture 정합성 수정안
- Note: GA4 API 실측 근거가 필요한 항목은 GA4 Spike(`docs/17`) 이후 확정하며 본 문서에 `[Spike 후 확정]`으로 표시

## 1. docs/20 §10 승인 전 결정 항목 — C 의견

### 1-1. `implementationKey` / `implementationKeys` 필수화 → **찬성**
Event Detail(docs/03 §4)은 "코드 구현 위치 목록"을 표시해야 하고, 같은 `eventKey`가 여러 구현에서 나타날 때 Health/Detail에서 구현 단위 구분이 필요합니다. C는 Consumer로서 이 필드에 의존할 예정이므로 Contract v0 필수 필드로 확정하는 데 찬성합니다.

### 1-2. 동적 이벤트 Warning-only 표현 → **조건부 찬성**
규칙 자체는 찬성. 단 아래 1-6의 `HealthSummary.unresolved` 산정 기준 정의가 선행되어야 합니다. 동적 이벤트가 `events[]`에 없으면 C의 Health Report는 `DYNAMIC_EVENT_NAME` Warning 개수를 근거로 `unresolved`를 계산하게 되는데, 이 도출 규칙을 계약에 명시해야 D의 화면과 어긋나지 않습니다.

### 1-3. `summaries` / `scanStats` optional → **찬성**
C의 Health 엔진과 Dashboard는 두 필드 없이 동작하도록 설계하겠습니다.

### 1-4. Query Result Producer = C 확정 → **수용**
Module Boundary(docs/04 §5) 원칙상 D가 GA4 Raw Response를 직접 다루지 않아야 하므로 C가 Connector 실행 + 정규화를 담당하는 것이 맞습니다. D는 QueryPlan Producer, C는 QueryResult Producer로 확정하는 데 동의합니다.

### 1-5. Fixture 정합성 수정안 채택 → **찬성 + 아래 §2 구체안 제안**

### 1-6. (추가 결정 요청) `HealthSummary` 버킷의 상호배타성 정의
현재 `mock-ga4-health.json`은 item 3개에 대해 summary 합계가 5입니다.
- `purchase_click`이 `healthy=1`과 `parameterRegistrationGap=1`에 중복 계상
- `page_view`가 `ga4Only=1`과 `ga4Managed=1`에 중복 계상

반면 docs/03 §3의 Summary 예시는 상호배타적 버킷처럼 읽힙니다. C 제안:

> **버킷은 상호배타(이벤트당 1개)로 하고 우선순위를 정한다:**
> `unresolved` > `parameterRegistrationGap` > `codeOnly` > (`ga4Managed`이면 `ga4Managed`, 아니면 `ga4Only`) > `healthy`

이 규칙 채택 시 현재 fixture의 올바른 summary는 `{healthy:0, codeOnly:1, ga4Only:0, ga4Managed:1, parameterRegistrationGap:1, unresolved:0}`입니다. 중복 허용으로 결정한다면 그 규칙을 계약에 명시해야 합니다. **A 결정 필요.**

## 2. Fixture 정합성 수정안 (C 제안)

### 2-1. `ga4:signup_complete`가 Manifest에 없음 (README 기지 이슈)
Health 규칙상 `codeState="detected"`이면 Manifest에 같은 `eventKey`가 있어야 합니다. **수정안: `mock-manifest.json` events에 `ga4:signup_complete` 추가** (code-only/no_rows 시나리오는 데모 가치가 높아 item 삭제보다 manifest 추가가 낫습니다).

### 2-2. `campaign_slot` 파라미터가 Manifest에 없음 (README 기지 이슈)
Parameter Registration State는 Manifest Parameter를 근거로 해야 합니다. **수정안: manifest의 `purchase_click.parameters`에 `campaign_slot` 추가.** 아울러 manifest에 있는 `value` 파라미터가 health의 `parameterRegistrationStates`에 누락되어 있습니다 — **"Manifest의 모든 parameter는 Health Item에 등록 상태를 가져야 하는가"를 계약에 명시 요청** (C 제안: 전수 포함, 판단 불가 시 `unknown`).

### 2-3. GTM 이벤트의 `providerDetectionConfidence` 오류 (README 기지 이슈, B 도메인)
`gtm:lead_submit`은 `provider=unknown`이므로 규칙상 `provider_unknown`이어야 합니다. B(성준) 수정 영역이나, C의 Health 대상 선정 로직(아래 §3-1)에 직접 영향이 있어 v0 기준선 채택 전 수정을 요청합니다.

### 2-4. `mock-query-result.json` result에 `dateRange` 없음 (README 기지 이슈)
QueryResult 필수 필드이므로 추가해야 합니다. **C 제안: QueryPlan은 preset을 쓰더라도, QueryResult의 `dateRange`는 C가 Property Reporting Time Zone 기준으로 해석한 절대 날짜(`startDate`/`endDate`)로 반환** — D의 UI가 "어느 기간의 값인지"를 preset 재해석 없이 표시할 수 있습니다.

### 2-5. (추가 발견) comparison 결과에 비교 기간 정보 없음
`metricType="comparison"`일 때 `previousValue`는 있으나 이전 기간 범위 필드가 없어 D UI가 "무엇 대비인지" 표시할 수 없습니다. **C 제안: `comparisonDateRange?: DateRange` 추가 (comparison일 때 필수).** Consumer는 D. **A 결정 필요.**

## 3. C가 계약에 반영을 요청하는 조건

1. **GA4 Health Report 대상 범위**: `analyticsProvider="ga4"`인 이벤트만 포함. `provider=unknown`인 GTM 이벤트는 GA4 Health 판정 대상에서 제외 (docs/20 §8 재확인 + 명시).
2. **`HealthSummary.unresolved` 산정 근거**: Manifest `warnings[]`의 `DYNAMIC_EVENT_NAME` 건수로 정의 (§1-2와 연동).
3. **Health 관측 기간 기본값**: "GA4 not observed" 판정의 조회 범위 기본값 정의 필요. `[Spike 후 확정]` — 초안은 `.env`의 `METRIC_ATLAS_GA4_RECENT_WINDOW_HOURS=48`과 별도로 관측 window(예: 최근 30일)를 둘 것을 제안.
4. **`no_rows` ≠ `not_observed` 단정 금지의 계약 표현**: `no_rows` + `recent_data_may_change`일 때 reviewReason 문구 규칙 (docs/03 §6). `[Spike 후 확정]`

## 4. 아직 불확실한 조건 (Spike 의존)

- thresholding / `(other)` metadata의 실제 응답 형태와 DataQualityFlag 매핑
- Admin API Custom Dimension 조회 가능 범위 (`builtin` 판정에 쓸 기본 dimension 목록 포함)
- 데이터 지연 체감치 → recent window 기본값
- quota/latency → Cache TTL, outbound concurrency 기본값

## 5. 영향 Consumer

- §1-6, §2-4, §2-5: D(호범) — Dashboard/Query UI 표시 로직
- §2-1, §2-2, §2-3: B(성준) — mock-manifest 및 Detector confidence 규칙
- 전체: A(가현) — Contract v0 승인 및 Zod Schema 반영

## 6. A 결정 필요 항목 요약

1. HealthSummary 버킷 상호배타 + 우선순위 규칙 (§1-6)
2. Manifest parameter 전수를 Health 등록 상태에 포함할지 (§2-2)
3. QueryResult.dateRange를 절대 날짜로 반환하는 규칙 (§2-4)
4. `comparisonDateRange` 필드 추가 (§2-5)
5. HealthSummary.unresolved 산정 근거 명시 (§3-2)
