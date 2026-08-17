# 08. Contracts and Schema

> 이 문서는 Human-readable 계약 설명입니다. 구현 이후 실제 Machine SoT는 `packages/contracts`의 Zod Schema입니다.

## 1. 계약 설계 원칙

- Pre-Phase 0에는 B/C/D가 Domain Contract Input을 조사·제안하고 A가 충돌을 조정
- Phase 0에는 병렬 개발에 필요한 최소 계약만 Freeze
- Producer와 Consumer를 모든 공유 Artifact에 명시
- 세부 Provider API 응답을 공통 계약으로 유출하지 않음
- Feature 문서에서 별도 Schema를 중복 정의하지 않음

Phase 0 공통 필드는 `docs/20-phase-0-common-fields.md`에서 ADR-001로 Accepted되었습니다 (2026-08-18). 실제 Machine SoT는 `packages/contracts`의 Zod Schema입니다.

## 2. Core Types

### AnalyticsProvider

```text
ga4 | mixpanel | meta | posthog | amplitude | unknown
```

### TrackingEmitter

```text
ga4 | gtm | mixpanel | meta | posthog | amplitude | custom | unknown
```

`gtm`은 Analytics Provider와 별도 개념입니다.

### ProviderDetectionConfidence

```text
provider_exact | provider_configured | provider_unknown
```

### BindingConfidence

```text
binding_exact | binding_inferred | binding_unresolved
```

## 3. Event Manifest — B produces, A serves, C/D consume

필수 개념:

```ts
interface EventManifest {
  version: string;
  buildId: string;
  generatedAt: string;
  events: DetectedEvent[];
  bindings: ElementBinding[];
  summaries: {
    emitters: TrackingSummary[];
    analyticsProviders: ProviderSummary[];
  };
  warnings: ScanWarning[];
  scanStats: ScanStats;
}
```

`DetectedEvent` 최소 필드:
- `eventKey`
- `eventName`
- `emitter`
- `analyticsProvider`
- `providerDetectionConfidence`
- `parameters`
- `source`
- `overlaySupported`

`ElementBinding` 최소 필드:
- `atlasDomId`
- `eventKeys`
- `element`
- `bindingConfidence`

`implementationKey`, `ElementBinding.implementationKeys`는 Contract v0 필수 필드입니다 (ADR-001). 동적 이벤트는 `events[]`에 넣지 않고 `DYNAMIC_EVENT_NAME` Warning으로만 표현합니다.

## 4. ID Contracts

### atlasDomId
- build-scoped
- DOM matching only

### eventKey
- stable logical query key
- `${namespace}:${eventName}`
- direct GA4: `ga4:purchase_click`
- GTM unknown destination: `gtm:purchase_click`

### implementationKey
- 코드 구현 위치 식별
- 영구 비즈니스 ID로 보장하지 않음

## 5. GA4 Connector Contract — C produces normalized result, C/D consume

### ConnectorContext
필수 개념:
- provider
- propertyId
- credential reference resolved in Node Runtime

### ConnectionResult
- success
- provider
- propertyId
- reportingTimezone if available
- errorCode if failed

### ProviderAgnosticQuery
- eventKey/eventName
- dateRange
- metric
- optional breakdowns
- optional filters

### ConnectorCapabilities
- supported metrics
- supported dimensions
- comparison support
- admin metadata support

## 6. NormalizedAnalyticsResult

C가 Provider/Connector 실행 결과를 정규화하여 생산하고 D의 Query UI가 소비합니다. D는 Query Plan을 생산하지만 Connector Result의 Producer는 아닙니다.

```ts
interface NormalizedAnalyticsResult {
  provider: "ga4";
  eventKey?: string;
  metricType: "event_count" | "comparison" | "custom";
  resultStatus:
    | "ok"
    | "no_rows"
    | "unauthorized"
    | "unsupported"
    | "error";
  value?: number;
  previousValue?: number;
  dateRange: DateRange;
  comparisonDateRange?: DateRange;
  reportingTimezone: string;
  fetchedAt: string;
  qualityFlags: DataQualityFlag[];
  providerMetadata?: Record<string, unknown>;
}
```

`dateRange`는 Property Reporting Time Zone 기준 절대 날짜입니다. `metricType="comparison"`이면 `comparisonDateRange`가 필수입니다 (ADR-001).

### DataQualityFlag

```text
subject_to_thresholding
other_row_data_loss
recent_data_may_change
```

Quality Flag는 Result Status와 독립적입니다.

## 7. AnalyticsHealthReport — C produces, Dashboard/D consume

필수 개념:
- generatedAt
- propertyId
- reportingTimezone
- summary counts
- items

Health Item:
- eventKey
- codeState
- ga4ObservationState
- ga4ManagedState
- parameterRegistrationStates
- latestMeasurement
- qualityFlags
- reviewReason

`HealthSummary` 버킷 상호배타 우선순위와 `unresolved` 산정 근거는 `docs/20-phase-0-common-fields.md` §5, ADR-001을 따릅니다.

## 8. QueryPlan — D produces, C Connector consumes

초기 analysisType:
- definition
- event_count
- comparison

필드:
- eventKeys
- dateRange
- comparisonRange
- filters
- breakdowns
- sourceRefs
- assumptions

QueryPlan은 Zod 검증과 Connector Capability 검증을 모두 통과해야 합니다.

## 9. Runtime API Envelope — A approves/integrates

Provider-specific URL 하드코딩 금지.

```text
GET  /__metric-atlas/api/manifest
GET  /__metric-atlas/api/health
GET  /__metric-atlas/api/providers
POST /__metric-atlas/api/connectors/:provider/test
POST /__metric-atlas/api/connectors/:provider/query
POST /__metric-atlas/api/query
```

## 10. 계약 변경 영향

Pre-Phase 0의 Contract Input 제출 자체는 계약 변경이 아닙니다. A가 제안을 승인하여 Contract v0/v1 또는 Zod Schema를 변경할 때 아래 영향을 기록합니다.

ADR마다 반드시 작성:

| Field | Required |
|---|---|
| Producers affected | yes |
| Consumers affected | yes |
| Backward compatible | yes |
| Migration | yes |
| Fixture update | yes |
| Contract test update | yes |
