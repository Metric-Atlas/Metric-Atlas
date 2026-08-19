# 20. Phase 0 Common Fields

- Status: Accepted
- Approver: Member A (가현)
- Domain input owners: Member B/C/D
- Accepted by: ADR-001 (`docs/adr/ADR-001-phase0-contract-v0-freeze.md`), 2026-08-18; extended by ADR-002 (`docs/adr/ADR-002-workspace-baseline-and-b-contract-input.md`), 2026-08-18; extended by ADR-003 (`docs/adr/ADR-003-connector-contract-v0.md`), 2026-08-18
- Contract Input received: C (PR #1, PR #8), B (PR #4, `docs/21-pre-phase-0-b-contract-input.md`), D (PR #7, `docs/contract-inputs/d-runtime-auth-deployment-options.md` — Runtime 인증/배포 옵션, AuthMode 계약 포함 여부는 별도 ADR 필요로 아직 미결).

## 1. 목적

이 문서는 Phase 0에서 성준/재욱/호범이 병렬 개발을 시작하기 위해 공유해야 하는 최소 공통 필드를 확정합니다.

Phase 0의 목표는 최종 구현 상세를 모두 확정하는 것이 아니라 Mock Fixture와 초기 화면/로직이 같은 기준을 바라보게 만드는 것입니다. 이 문서는 ADR-001로 Accepted 상태이며, 실제 Machine SoT는 `packages/contracts`의 Zod Schema입니다.

이 문서에 정의된 필드는 Phase 0 Consumer가 의존할 수 있는 최소 필드입니다. 여기에 없는 확장 필드는 A 승인 없이 공통 Consumer가 의존하지 않습니다.

## 2. 역할 기준

| 역할 | 담당자 | 책임 |
|---|---|---|
| A | 가현 | Contract Approver & Integration Lead |
| B | 성준 | Detection / Manifest / Overlay |
| C | 재욱 | GA4 Connector / Analytics Health |
| D | 호범 | Search / Query / Demo / OSS DX |

| Artifact | Producer | Approver / Integrator | Consumers |
|---|---|---|---|
| Event Manifest | 성준(B) | 가현(A) | B Overlay, C Health, D Search/Demo |
| Analytics Health Report | 재욱(C) | 가현(A) | C Dashboard, D Search/Detail |
| Query Plan | 호범(D) | 가현(A) + 재욱(C) capability review | C Query Executor |
| Query Result | 재욱(C) | 가현(A) | 호범(D) Query UI |
| Mock Fixtures | 각 Domain Owner | 가현(A) schema review | all |

## 3. 공통 표현 규칙

- `generatedAt`, `fetchedAt`은 ISO 8601 timestamp 문자열을 사용합니다.
- 소스 경로는 repository root 기준 상대 경로를 사용합니다.
- `line`과 `column`은 1부터 시작합니다.
- 원본 `eventName`은 번역하거나 별칭으로 치환하지 않습니다.
- 논리 이벤트는 `eventKey`, 코드 구현 위치는 `implementationKey`, DOM 매칭은 `atlasDomId`로 구분합니다.
- 동일한 `eventKey`가 여러 `DetectedEvent`에 나타날 수 있으며 Consumer는 논리 이벤트 집계 시 `eventKey`로 묶습니다.

## 4. Event Manifest

성준(B)이 생성하고 B/C/D가 소비합니다.

```ts
interface EventManifest {
  version: string;
  buildId: string;
  generatedAt: string;
  events: DetectedEvent[];
  bindings: ElementBinding[];
  warnings: ScanWarning[];
  summaries?: ManifestSummaries;
  scanStats?: ScanStats;
}
```

`summaries`와 `scanStats`는 현재 Fixture와 Build Summary를 위한 Phase 0 확장 필드입니다. C/D는 이 필드가 없어도 핵심 화면과 로직을 개발할 수 있어야 합니다.

### DetectedEvent

```ts
interface DetectedEvent {
  eventKey: string;
  implementationKey: string;
  eventName: string;
  emitter: TrackingEmitter;
  analyticsProvider: AnalyticsProvider;
  providerDetectionConfidence: ProviderDetectionConfidence;
  parameters: string[];
  source: SourceLocation;
  overlaySupported: boolean;
}
```

`DetectedEvent`는 코드 구현 단위입니다. 같은 논리 이벤트가 여러 파일이나 심볼에서 발견되면 각 구현은 같은 `eventKey`와 서로 다른 `implementationKey`를 가집니다.

### ElementBinding

```ts
interface ElementBinding {
  atlasDomId: string;
  eventKeys: string[];
  implementationKeys: string[];
  element: ElementLocation;
  bindingConfidence: BindingConfidence;
}
```

`eventKeys`는 Dashboard/Query의 논리 이벤트 연결에 사용하고, `implementationKeys`는 Overlay에서 정확한 코드 구현 위치를 찾을 때 사용합니다.

### SourceLocation

```ts
interface SourceLocation {
  file: string;
  line: number;
  column?: number;
}
```

### ElementLocation

```ts
interface ElementLocation {
  type: string;
  file: string;
  line: number;
  column?: number;
}
```

### ScanWarning

```ts
interface ScanWarning {
  code: string;
  file?: string;
  line?: number;
  message?: string;
  relatedImplementationKey?: string;
}
```

Phase 0 최소 Warning Code:

```text
DYNAMIC_EVENT_NAME
POSSIBLE_WRAPPER_USAGE
CUSTOM_COMPONENT_OVERLAY_UNSUPPORTED
PARSE_ERROR
```

B(성준)의 Contract Input(PR #4, `docs/21-pre-phase-0-b-contract-input.md`)에서 제안한 아래 4개 Warning Code를 ADR-002로 승인·추가합니다.

```text
DYNAMIC_PARAMETER_KEY
UNRESOLVED_EVENT_BINDING
PORTAL_OVERLAY_UNSUPPORTED
ATLAS_ATTRIBUTE_CONFLICT
```

`ScanWarning.code`는 Zod에서 `z.string()`으로 검증하므로(향후 코드 추가가 스키마 변경을 요구하지 않음) 위 목록은 문서화 목적이며 신규 코드는 ADR로 계속 추가할 수 있습니다.

정적으로 `eventKey`를 만들 수 없는 동적 이벤트는 `events`에 넣지 않고 `DYNAMIC_EVENT_NAME` Warning으로 기록합니다.

## 5. Analytics Health Report

재욱(C)이 생성하고 C/D가 소비합니다.

```ts
interface AnalyticsHealthReport {
  generatedAt: string;
  provider: AnalyticsProvider;
  propertyId: string;
  reportingTimezone: string;
  summary: HealthSummary;
  items: HealthItem[];
}
```

### HealthSummary

```ts
interface HealthSummary {
  healthy: number;
  codeOnly: number;
  ga4Only: number;
  ga4Managed: number;
  parameterRegistrationGap: number;
  unresolved: number;
}
```

**버킷은 상호배타적입니다 (ADR-001).** 각 `HealthItem`은 정확히 하나의 버킷에만 속하며, 판정 우선순위는 다음과 같습니다.

```text
unresolved                 codeState=unknown 또는 ga4ObservationState=unknown
> parameterRegistrationGap parameterRegistrationStates에 state=not_registered 존재
> codeOnly                 codeState=detected, ga4ObservationState=not_observed
> ga4Managed                ga4ManagedState=managed
> ga4Only                  codeState=not_detected, ga4ObservationState=observed, ga4ManagedState=not_managed
> healthy                  그 외 (codeState=detected, ga4ObservationState=observed, gap 없음)
```

`HealthSummary.unresolved`는 다음 두 원천의 합입니다.
- `items[]` 중 위 규칙으로 `unresolved` 버킷에 속한 항목 수
- Event Manifest `warnings[]`의 `DYNAMIC_EVENT_NAME` 건수 (동적 이벤트는 `events[]`에 없어 `items[]`로 나타나지 않으므로 별도 합산)

### HealthItem

```ts
interface HealthItem {
  eventKey: string;
  eventName: string;
  codeState: CodeState;
  ga4ObservationState: Ga4ObservationState;
  ga4ManagedState: Ga4ManagedState;
  parameterRegistrationStates: ParameterRegistrationState[];
  latestMeasurement?: LatestMeasurement;
  reviewReason?: string | null;
}
```

### ParameterRegistrationState

```ts
interface ParameterRegistrationState {
  parameter: string;
  state: ParameterState;
}
```

**전수 포함 규칙 (ADR-001).** 같은 `eventKey`의 Manifest `DetectedEvent.parameters`에 있는 모든 파라미터는 `HealthItem.parameterRegistrationStates`에 대응 항목을 가져야 합니다. 등록 상태를 판정할 수 없으면 `state="unknown"`을 사용하며, 항목을 생략하지 않습니다.

### LatestMeasurement

```ts
interface LatestMeasurement {
  resultStatus: ResultStatus;
  value?: number;
  qualityFlags: DataQualityFlag[];
}
```

Event List는 `EventManifest + AnalyticsHealthReport`를 사용합니다. Event Detail의 조회 기간, 조회 시각, 이전 기간 비교는 `QueryResult`를 사용합니다.

## 6. Query Result

Natural Language Query는 Core Release Blocker가 아니므로 Query UI가 결과를 표시하기 위한 최소 형태만 고정합니다.

```ts
interface QueryResult {
  provider: AnalyticsProvider;
  eventKey: string;
  metricType: MetricType;
  resultStatus: ResultStatus;
  value?: number;
  previousValue?: number;
  dateRange: DateRange;
  comparisonDateRange?: DateRange;
  reportingTimezone: string;
  fetchedAt: string;
  qualityFlags: DataQualityFlag[];
}
```

**Producer = C (ADR-001).** D는 `QueryPlan`의 Producer이며 `QueryResult`의 Producer가 아닙니다 (Module Boundary, docs/04 §5).

**`dateRange`는 절대 날짜 (ADR-001).** `QueryPlan.dateRange`가 `preset`이어도 `QueryResult.dateRange`는 Property Reporting Time Zone 기준으로 해석된 `{ startDate, endDate }` 형태로 반환합니다.

**`comparisonDateRange` (ADR-001, ADR-003 보정).** `metricType="comparison"`이고 `resultStatus="ok"`인 경우 필수이며, 비교 대상 이전 기간의 절대 날짜를 담습니다. 그 외에는 생략합니다.

### DateRange

```ts
type DateRange =
  | { preset: string; startDate?: never; endDate?: never }
  | { preset?: never; startDate: string; endDate: string };
```

Phase 0의 Query Fixture는 Query 실행 입력과 결과를 함께 담는 Fixture Envelope입니다.

```ts
interface MockQueryFixture {
  queryPlan: QueryPlan;
  result: QueryResult;
}
```

`QueryPlan`의 상세 계약은 `docs/08-contracts-and-schema.md`를 따릅니다.

## 7. 공통 상태값

### AnalyticsProvider

```ts
type AnalyticsProvider =
  | "ga4"
  | "mixpanel"
  | "meta"
  | "posthog"
  | "amplitude"
  | "unknown";
```

### TrackingEmitter

```ts
type TrackingEmitter =
  | "ga4"
  | "gtm"
  | "mixpanel"
  | "meta"
  | "posthog"
  | "amplitude"
  | "custom"
  | "unknown";
```

### ProviderDetectionConfidence

```ts
type ProviderDetectionConfidence =
  | "provider_exact"
  | "provider_configured"
  | "provider_unknown";
```

`analyticsProvider="unknown"`인 GTM 이벤트는 `providerDetectionConfidence="provider_unknown"`을 사용합니다.

### BindingConfidence

```ts
type BindingConfidence =
  | "binding_exact"
  | "binding_inferred"
  | "binding_unresolved";
```

### CodeState

```ts
type CodeState = "detected" | "not_detected" | "unknown";
```

### Ga4ObservationState

```ts
type Ga4ObservationState = "observed" | "not_observed" | "unknown";
```

### Ga4ManagedState

```ts
type Ga4ManagedState = "managed" | "not_managed" | "unknown";
```

### ParameterState

```ts
type ParameterState =
  | "builtin"
  | "registered_custom_dimension"
  | "not_registered"
  | "unknown";
```

### ResultStatus

```ts
type ResultStatus =
  | "ok"
  | "no_rows"
  | "unauthorized"
  | "unsupported"
  | "error";
```

### DataQualityFlag

```ts
type DataQualityFlag =
  | "subject_to_thresholding"
  | "other_row_data_loss"
  | "recent_data_may_change";
```

### MetricType

```ts
type MetricType = "event_count" | "comparison" | "custom";
```

## 8. Phase 0 Fixture 규칙

- Health Item에서 `codeState="detected"`인 GA4 이벤트는 Manifest에 같은 `eventKey`가 있어야 합니다.
- **GA4 Health Report 범위는 `analyticsProvider="ga4"` 이벤트로 한정합니다 (ADR-001).** 목적 Provider가 확인되지 않은 GTM 이벤트(`analyticsProvider="unknown"`)는 GA4 Health 판정 대상에서 제외합니다.
- Health Item의 Parameter Registration State는 같은 `eventKey`의 Manifest Parameter를 근거로 하며, Manifest Parameter 전수를 포함해야 합니다 (§5 전수 포함 규칙).
- `mock-query-result.json`의 `result`는 `QueryResult`의 필수 필드를 모두 포함해야 합니다.
- Fixture 변경은 계약 변경과 동일하게 Producer/Consumer 영향을 확인합니다.
- Contract v0 Fixture set은 ADR-001로 Freeze되었습니다. 이후 변경은 신규 ADR을 거칩니다.

## 9. Phase 0에서 아직 확정하지 않는 것

- 최종 API request/response 상세
- Database schema
- 모든 Provider별 세부 응답 필드
- LLM Prompt 구조
- GA4 Spike 이후 조정될 세부 판정 기준
- Enum의 최종 확장 목록
- Manifest Summary/ScanStats의 최종 필수 여부

## 10. Contract v0 결정 (ADR-001, 2026-08-18 Accepted)

C(재욱)의 Contract Input(PR #1)을 바탕으로 A가 다음을 결정했습니다. 전체 근거는 `docs/adr/ADR-001-phase0-contract-v0-freeze.md` 참고.

- `implementationKey`/`implementationKeys` → **필수 필드로 확정**
- 동적 이벤트 Warning-only 표현 → **확정**, `unresolved` 산정 근거를 §4/§5에 명시
- `summaries`/`scanStats` → **optional 유지**
- Query Result Producer → **C로 확정**
- Fixture 정합성 수정안 → **채택** (§8, Fixture 목록은 `fixtures/README.md` 참고)
- HealthSummary 버킷 상호배타 + 우선순위, Parameter 전수 포함, `dateRange` 절대 날짜, `comparisonDateRange` 추가 → **모두 채택** (각 해당 절 참고)

B/D의 Contract Input은 아직 제출되지 않았습니다. 이번 Freeze는 B/D 도메인과 충돌 가능성이 낮은 항목 위주이며, B/D 입력 도착 시 충돌이 발견되면 후속 ADR로 조정합니다.

### Spike 이후로 보류 (Contract v0 구조에는 영향 없음)

- Health 관측 기간 기본값 (`METRIC_ATLAS_GA4_RECENT_WINDOW_HOURS` 등)
- thresholding / `(other)` data loss → `DataQualityFlag` 매핑 세부 규칙
- `no_rows` + `recent_data_may_change`일 때 `reviewReason` 문구 규칙
- Cache TTL, outbound concurrency 기본값

## 11. 종료 기준

Contract v0가 Freeze되어 다음이 가능합니다.

- 성준(B)은 Mock 없이 Event Manifest Producer를 구현할 수 있습니다.
- 재욱(C)은 Mock Manifest를 소비해 Analytics Health Producer를 구현할 수 있습니다.
- 호범(D)은 Mock Manifest, Mock Health, Mock Query Result를 소비해 Event Search와 Event Detail 화면을 구현할 수 있습니다.
- 가현(A)은 Fixture와 shared contract 변경 시 영향을 받는 Consumer를 추적할 수 있습니다.
- `packages/contracts`의 Zod Schema가 본 문서와 `fixtures/`의 3개 Mock Fixture를 검증합니다.
