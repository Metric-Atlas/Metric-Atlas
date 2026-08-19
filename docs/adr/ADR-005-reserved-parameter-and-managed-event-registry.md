# ADR

- ID: ADR-005
- Date: 2026-08-19
- Status: Proposed
- Author: Member C (재욱)

## Problem

`docs/06` §3(GA4 Managed Event Registry)과 §6(Custom Dimension Gap)은 `ParameterState`(`builtin` / `registered_custom_dimension` / `not_registered` / `unknown`)와 `Ga4ManagedState`(`managed` / `not_managed` / `unknown`) 판정이 필요하다고만 서술하고, 실제 판정 로직은 정의하지 않았다.

GA4 Data API Spike(C-SPIKE-001, `docs/spikes/ga4-data-api-result.md` §5)에서 다음이 실측 확인됐다:

1. Data API `getMetadata`가 반환하는 built-in dimension 목록(375건)은 GA4 이벤트 파라미터 이름공간과 다르다 — 예: `currency`, `value` 같은 GA4 예약/자동 수집 파라미터가 그 목록에 그대로 존재하지 않는다. 따라서 `getMetadata` 매칭만으로는 `builtin` 판정이 불가능하다.
2. Admin API `listCustomDimensions`는 동작하며 `parameterName` 정확 매칭으로 `registered_custom_dimension` 판정이 가능하다.

`Ga4ManagedState`도 마찬가지로 GA4 API가 "이 이벤트는 자동/향상된 측정입니다"를 알려주는 조회 수단이 없어, `docs/06` §3이 요구하는 대로 별도 버전관리 Registry가 필요하다.

## Proposed change

### 1. Reserved Parameter Registry (`packages/connector-ga4/src/reserved-parameter-registry.ts`)

GA4가 자동/향상된 측정 또는 Measurement Protocol 예약으로 취급하는 이벤트 파라미터 이름을 정적 `Set<string>`으로 버전 관리한다 (`RESERVED_PARAMETER_REGISTRY_VERSION`). 최초 버전(2026-08-19)은 GA4 공식 문서 기준 자동 수집/Enhanced Measurement/전자상거래 파라미터로 구성했다(`currency`, `value`, `page_location`, `session_id` 등 약 40개).

`resolveParameterState(parameterName, customDimensions)`가 Spike §5의 판정 순서를 그대로 구현한다:

1. Admin custom dimension `parameterName` 매칭 → `registered_custom_dimension`
2. Reserved Parameter Registry 매칭 → `builtin`
3. 둘 다 아니면 → `not_registered`
4. Admin API 조회 자체가 실패하면(`customDimensions.status === "unknown"`) → `unknown` (등록 0건과는 구분 — 0건은 `status: "ok"`로 표현)

### 2. GA4 Managed Event Registry (`packages/connector-ga4/src/managed-event-registry.ts`)

GA4 자동 수집 이벤트(`session_start`, `first_visit`, `user_engagement`, `page_view`)와 Enhanced Measurement 이벤트(`scroll`, `click`, `file_download`, `video_start` 등)를 정적 `Set<string>`으로 버전 관리한다 (`MANAGED_EVENT_REGISTRY_VERSION`).

`resolveGa4ManagedState(eventName)`는 정적 목록 조회이므로 API 실패 개념이 없어 항상 `managed`/`not_managed`로 확정된다. `Ga4ManagedState="unknown"`은 이 함수의 책임이 아니며, Health Engine에서 이벤트 자체가 unresolved인 경우에 별도로 다룬다.

### 3. Registry 갱신 정책

두 Registry 모두 GA4 공식 문서(자동 수집 이벤트/파라미터, Enhanced Measurement, Measurement Protocol 예약 파라미터)가 바뀌면 값을 갱신하고 버전 상수를 갱신일로 올린다. 갱신은 Decision Log에 남기되 ADR 재작성은 필요 없다(계약 타입 변경이 아니라 데이터 갱신이므로).

## Producers affected

- C: `packages/connector-ga4`에 두 Registry 모듈과 두 resolver 함수를 추가한다. Custom Dimension Gap/Health Engine 구현(후속 작업)이 이 함수들을 소비한다.

## Consumers affected

- C 본인: Health Engine이 `resolveParameterState`/`resolveGa4ManagedState`를 호출해 `HealthItem.parameterRegistrationStates`/`ga4ManagedState`를 채운다.
- A/D: `packages/contracts`의 `ParameterState`/`Ga4ManagedState` enum 자체는 이미 Freeze되어 있어 계약 변경 없음. Registry는 `connector-ga4` 내부 구현이라 계약 표면에 노출되지 않는다.

## Alternatives

- `getMetadata` dimension `apiName` 매칭만으로 `builtin` 판정 — 기각. Spike §5에서 `currency` 매칭 실패로 실측 반증됨.
- Registry 없이 매 요청마다 GA4 공식 문서를 참조하는 수동 판단 — 기각. 판정 로직이 코드에 없으면 재현·테스트가 불가능하고 Health Engine이 결정론적으로 동작할 수 없음.
- Registry를 `packages/contracts`에 두어 A 소유로 관리 — 기각. Registry는 GA4 제공사 고유 지식이며 C가 GA4 Data/Admin API를 소유(docs/12)하므로 `connector-ga4` 내부에 두는 것이 R&R과 일치. 계약(enum)만 `contracts`에 남긴다.

## Compatibility

Breaking 없음. 새 모듈 추가이며 기존 `connector-ga4` export나 `packages/contracts` 타입을 변경하지 않는다.

## Migration

없음. 신규 코드.

## Fixture updates

없음. 두 resolver 모두 순수 함수이며 별도 Fixture 데이터 없이 단위 테스트로 검증했다.

## Contract tests

`packages/connector-ga4/test/reserved-parameter-registry.test.ts`(6), `packages/connector-ga4/test/managed-event-registry.test.ts`(4) — Spike §5 실측 케이스(등록 우선순위, Admin API 실패 시 unknown, currency/value가 Registry에 포함됨)를 포함해 10개 테스트로 검증. 전체 workspace `pnpm typecheck`/`pnpm build`/`vitest run` 통과 확인(97 tests).

## Decision

Proposed. A 리뷰 후 Accepted 전환 요청. 두 Registry와 resolver 함수를 `connector-ga4`에 추가하고, 이후 Custom Dimension Gap/Health Engine 구현(docs/06 §6, 후속 PR)이 이를 소비한다.
