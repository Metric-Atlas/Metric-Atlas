# ADR

- ID: ADR-007
- Date: 2026-08-19
- Status: Proposed
- Author: Member C (재욱)

## Problem

`docs/06` §2는 Analytics Health의 4개 분류 중 **"GA4 only"**(코드에서 발견되지 않았지만 GA4에서 관측되는 이벤트)를 정의한다. 이를 판정하려면 "이 Property에서 지금 관측되는 모든 이벤트 이름"을 GA4에서 가져와 Manifest의 `DetectedEvent` 목록과 비교(diff)해야 한다.

현재 `ProviderAgnosticQuery`(ADR-003, PR #14, 아직 미머지)는 다음과 같이 정의되어 있다:

```ts
eventName: z.string(),          // 필수
metric: MetricType,
dateRange: DateRange,
breakdowns: z.array(z.string()).optional(),  // 존재하지만 의미가 정의되지 않음
```

`eventName`이 필수이기 때문에 "특정 이벤트 하나의 카운트"만 조회할 수 있고, "이 기간에 데이터가 있는 이벤트 이름 전부"를 조회하는 방법이 없다. `breakdowns` 필드가 있지만 그 의미(어떤 dimension으로 몇 개 row가 오는지, `NormalizedAnalyticsResult`가 단일 `value`가 아니라 복수 row를 어떻게 담는지)가 정의되어 있지 않아 그대로 쓸 수 없다.

`Ga4Connector.capabilities()`(PR #15)도 현재 `supportedDimensions: []`로 이 기능이 없음을 명시하고 있다.

이 ADR은 코드 구현 없이 계약 변경 방향만 제안한다. **A 리뷰/결정을 요청한다.**

## Proposed change

### 선택지 A (제안) — 전용 메서드 추가

`ProviderAgnosticQuery`/`NormalizedAnalyticsResult`(둘 다 단일 값 스칼라 조회로 설계됨)를 건드리지 않고, `AnalyticsConnector`에 목적에 맞는 별도 메서드를 추가한다:

```ts
export const Ga4ObservedEventsResult = z.object({
  resultStatus: ResultStatus,
  eventNames: z.array(z.string()),
  qualityFlags: z.array(DataQualityFlag),
});

export interface AnalyticsConnector {
  testConnection(context: ConnectorContext): Promise<ConnectionResult>;
  query(context: ConnectorContext, query: ProviderAgnosticQuery): Promise<NormalizedAnalyticsResult>;
  capabilities(): ConnectorCapabilities;
  /** 신규: 이 기간에 데이터가 있는 이벤트 이름 전부. GA4 only 판정 전용. */
  listObservedEventNames(context: ConnectorContext, dateRange: DateRange): Promise<Ga4ObservedEventsResult>;
}
```

`ConnectorCapabilities`에 `eventListingSupport: z.boolean()`을 추가해 이 기능 지원 여부를 선언한다.

Health Engine은 `listObservedEventNames()` 결과에서 Manifest에 없는 `eventName`을 찾아 `codeState="not_detected"`인 `HealthItem`을 만드는 데 쓴다 (구현은 이 ADR 범위 밖, 별도 PR).

### 선택지 B (기각) — `ProviderAgnosticQuery`를 breakdown 모드로 확장

`eventName`을 optional로 바꾸고 `breakdowns: ["eventName"]`일 때 `NormalizedAnalyticsResult`가 단일 `value` 대신 `rows: Array<{ dimensionValues: Record<string,string>; value: number }>`를 반환하도록 확장하는 방법도 가능하다. D의 Query 기능이 향후 임의 breakdown 조회를 필요로 한다면 이 방향이 더 일반적이다.

**이번엔 선택지 A를 제안한다** — 이유는 Alternatives 참고.

## Producers affected

- C: `packages/contracts/src/connector.ts`에 `Ga4ObservedEventsResult` 추가, `AnalyticsConnector` 인터페이스에 `listObservedEventNames` 추가, `Ga4Connector` 구현 필요 (별도 PR)

## Consumers affected

- C 본인: Health Engine의 GA4-only 판정 경로가 이 메서드를 소비 (별도 PR, `packages/connector-ga4/src/health-engine.ts`)
- D: `ProviderAgnosticQuery`/`NormalizedAnalyticsResult`(Query 기능이 쓰는 계약)는 변경 없음 — 선택지 A는 그 두 타입을 건드리지 않는다
- A: `AnalyticsConnector` 인터페이스에 메서드 추가 — TS 인터페이스이므로 기존 구현체(현재 `Ga4Connector` 하나뿐, 아직 main에 없음)가 이를 구현해야 함. Zod 계약(`packages/contracts`의 스키마) 자체는 breaking 없이 addition만 발생

## Alternatives

- 선택지 B(breakdown 모드 확장) — 이번엔 기각. `NormalizedAnalyticsResult`가 단일 스칼라 값 가정으로 이미 설계되어 있고(`value`/`previousValue: number`), Query 기능(D)이 아직 breakdown을 요구하지 않는 상태에서 미리 일반화하면 YAGNI + Contract v0 Freeze(ADR-001) 범위를 불필요하게 넓힘. GA4-only 판정은 "이벤트 이름 목록"만 있으면 충분해 전용 메서드가 더 작고 명확한 변경.
- 아무 계약 변경 없이 Manifest 파라미터만으로 근사 — 기각. GA4가 실제로 관측한 이벤트 이름은 코드 스캔으로 알 수 없어 GA4 API 조회가 필수.

## Compatibility

Zod 계약(`ConnectorCapabilities`, 신규 `Ga4ObservedEventsResult`)에는 breaking 없음(addition). `AnalyticsConnector` TS 인터페이스에 메서드가 추가되므로 구현체는 갱신이 필요하지만, 현재 유일한 구현체(`Ga4Connector`)가 아직 main에 병합되지 않은 상태라 실질적 breaking 영향은 없다.

## Migration

없음(아직 구현체가 main에 없음). Accepted 시 `Ga4Connector`에 `listObservedEventNames` 구현을 추가하는 후속 PR을 연다.

## Fixture updates

`fixtures/mock-ga4-health.json`의 `page_view`(codeState="not_detected") 항목은 이미 이 판정 결과를 예시로 담고 있어 fixture 자체는 변경이 필요 없다.

## Contract tests

이 ADR은 제안 단계이며 코드 변경이 없다. Accepted 후 후속 PR에서 `Ga4ObservedEventsResult` 파싱 테스트, `Ga4Connector.listObservedEventNames()` 단위 테스트, Health Engine의 `not_detected` 경로 fixture-parity 테스트(`page_view` 예시 재현)를 추가한다.

## Decision

Proposed. A 리뷰 대기. 선택지 A/B 중 방향 결정과 `AnalyticsConnector` 인터페이스 확장 승인을 요청한다.
