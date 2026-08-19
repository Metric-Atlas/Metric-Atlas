# ADR

- ID: ADR-003
- Date: 2026-08-18
- Status: Accepted
- Author: Member A (가현)

## Problem

C(재욱)가 PR #8(`feature/ga4-health/connector-ga4`, C-IMPL-001)에서 `AnalyticsConnector` 계약(`connector-sdk`)과 실제 GA4 호출 계층(`connector-ga4`)을 구현했습니다. PR은 Draft 상태로 두 가지를 A 결정 대기로 명시했습니다.

1. `ProviderAgnosticQuery.comparisonRange` 필드 추가 여부 (docs/08 §5에 명시되지 않았던 필드)
2. Workspace skeleton 확정 — C도 B/A와 마찬가지로 최초 baseline 커밋 기준으로 작업해 루트 `package.json`/`pnpm-workspace.yaml`을 독자적으로(Provisional로 명시) 만든 상태

또한 C의 `NormalizedAnalyticsResult` 구현이 ADR-001 이전 `docs/08` 기준이라 `comparisonDateRange` 필드가 없었고, `docs/08` §5~§6의 `ConnectorContext`/`ProviderAgnosticQuery`/`ConnectorCapabilities`/`ConnectionResult`/`NormalizedAnalyticsResult`는 지금까지 Human-readable 설명으로만 존재하고 `packages/contracts`에 Zod로 코드화되어 있지 않았습니다.

## Proposed change

### 1. `comparisonRange` 승인

`ProviderAgnosticQuery.comparisonRange`를 채택합니다. `QueryPlan.comparisonRange`(ADR-001)와 대응되며, C의 `Ga4Connector.query()` 구현이 이미 GA4 dual-dateRange 조회(`date_range_0`/`date_range_1`)로 정확히 처리하고 있습니다. `metric="comparison"`일 때 필수로 확정합니다.

### 2. Connector 계약을 `packages/contracts`에 코드화

`docs/08` §5~§6에 설명으로만 있던 다음 타입을 `packages/contracts/src/connector.ts`에 Zod Schema로 추가합니다: `ConnectorContext`, `ConnectionResult`, `ProviderAgnosticQuery`, `ConnectorCapabilities`, `NormalizedAnalyticsResult`, `AnalyticsConnector`(TS interface, 함수 시그니처라 Zod 대상 아님).

`connector-sdk`는 이 시점부터 위 타입의 순수 re-export barrel로 전환합니다 — C가 원래 코드에 남긴 주석("packages/contracts Zod Schema가 Freeze되면 그쪽으로 이관하고 re-export만 남깁니다")대로입니다.

### 3. `NormalizedAnalyticsResult` vs `QueryResult` 관계 정의

두 타입은 필드가 거의 같지만 레이어가 다릅니다.

- `NormalizedAnalyticsResult`(docs/08 §6): **Connector 실행 결과** — `eventKey`는 optional(쿼리에 없을 수 있음), `providerMetadata` 포함 가능. C(Connector)가 생산.
- `QueryResult`(docs/20 §6): **D Query UI로 노출되는 결과 envelope** — `eventKey` 필수, `providerMetadata` 없음(Module Boundary: Query Engine은 GA4 Raw Response를 직접 쓰지 않음, docs/04 §5). C가 `NormalizedAnalyticsResult`를 `QueryResult`로 변환해 D에 전달하는 책임을 가집니다(변환 코드는 Runtime Query API 구현 시점의 후속 작업, 이 PR 범위 아님).

`comparisonDateRange`를 `NormalizedAnalyticsResult`에도 추가해 두 타입 간 무손실 매핑을 보장합니다.

### 4. 계약 정밀화 — comparisonDateRange 필수 조건 보정

ADR-001은 `metricType="comparison"`이면 `comparisonDateRange`가 무조건 필수라고 정의했으나, 구현 중 `resultStatus`가 `unsupported`/`error`/`no_rows`인 comparison 쿼리는 비교 기간 자체가 의미가 없어 값을 채울 수 없다는 것이 드러났습니다. **정정**: `comparisonDateRange`는 `metricType="comparison"` **그리고** `resultStatus="ok"`일 때만 필수입니다. `QueryResult`와 `NormalizedAnalyticsResult` 양쪽에 동일하게 적용합니다. 기존 Fixture(`resultStatus="ok"`)는 영향 없습니다.

### 5. 버그 수정 — `DateRange` 판별 유니온 형태

`packages/contracts`의 기존 `DateRange`가 `docs/20` §6에 문서화된 형태(`{ preset: string; startDate?: never; endDate?: never } | { preset?: never; startDate: string; endDate: string }`)와 다르게 구현되어 있었습니다(단순 `z.union`으로 `never` 형제 필드 누락). 이 때문에 C의 `connector-ga4` 코드처럼 유니온 전체에서 좁히기(narrowing) 없이 `.startDate`/`.endDate`에 바로 접근하는 흔한 패턴이 타입 에러를 냈습니다. `docs/20`은 이미 올바르게 문서화되어 있었으므로 이는 코드가 문서를 따라가지 못한 버그이며, 새 계약 결정이 아니라 ADR-001 구현 보정입니다.

### 6. Workspace 재통합

`connector-sdk`/`connector-ga4`를 B baseline(ADR-002) 패턴(`tsc -b`, `../../tsconfig.base.json` extends, 루트 `vitest.config.ts` glob 수집)에 맞춰 재작성하고 루트 `tsconfig.json` references에 추가합니다. C의 Provisional 루트 `package.json`/`pnpm-workspace.yaml`은 채택하지 않습니다(main 기준으로 이미 확정됨).

`@google-analytics/data`의 전이 의존성 `protobufjs`가 postinstall 스크립트를 필요로 해 `pnpm-workspace.yaml`에 `allowBuilds: { protobufjs: true }`를 추가합니다(코드 생성 최적화 목적, 런타임 필수 아님).

## Producers affected

- A: `packages/contracts`에 `connector.ts` 추가, `DateRange`/`QueryResult` 보정
- C: `connector-sdk`(re-export barrel로 전환), `connector-ga4`(`comparisonDateRange` 채움, `exactOptionalPropertyTypes` 대응 타입 보정)

## Consumers affected

- C 본인: `Ga4Connector`가 이제 `comparisonDateRange`를 채워 반환
- D: 후속 Query API 통합 시 `QueryResult`에서 `comparisonDateRange`를 항상 기대할 수 있음(comparison+ok인 경우)
- B: 영향 없음

## Alternatives

- `comparisonRange` 보류(반려) — 기각. Comparison 지표 실행에 실질적으로 필요하고 이미 올바르게 구현되어 있음.
- `NormalizedAnalyticsResult`와 `QueryResult`를 완전히 동일한 타입으로 통합 — 기각. Module Boundary(docs/04 §5)상 D에 `providerMetadata`/optional `eventKey`를 노출하지 않아야 하므로 레이어 분리 유지가 맞음.
- `comparisonDateRange` 필수 조건을 원안(status 무관 항상 필수) 유지 — 기각. 실패/빈 결과에 비교 기간을 강제로 채우게 하면 Connector 구현이 인위적인 값을 만들어야 함.

## Compatibility

Breaking 없음. `comparisonRange`/`comparisonDateRange` 추가는 additive. `comparisonDateRange` 필수 조건의 `resultStatus="ok"` 조건 추가는 기존에 통과하던 case(항상 status=ok였던 Fixture)에 영향 없이 오히려 제약을 완화합니다. `DateRange` 수정은 버그 수정이며 기존 Fixture 데이터 형태와 호환됩니다.

## Migration

없음. `connector-sdk`/`connector-ga4`는 이번 PR에서 바로 새 구조로 작성됨.

## Fixture updates

없음. Fixture는 이미 `resultStatus="ok"` + `metricType="comparison"` 조합만 사용하므로 영향 없음.

## Contract tests

- `packages/contracts`의 기존 fixture 검증 테스트 그대로 유지 (DateRange 수정 후에도 통과 확인)
- `connector-ga4`의 comparison 테스트에 `comparisonDateRange` 검증 assertion 추가

## Decision

Accepted. `comparisonRange`/`comparisonDateRange`를 채택하고, Connector 계약을 `packages/contracts`로 코드화하며, `DateRange` 구현 버그를 수정한다. `connector-sdk`/`connector-ga4`는 B baseline(ADR-002)에 맞춰 재통합한다.
