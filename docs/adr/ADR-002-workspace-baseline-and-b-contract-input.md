# ADR

- ID: ADR-002
- Date: 2026-08-18
- Status: Accepted
- Author: Member A (가현)

## Problem

PR #3(A, Contract v0 Freeze)과 PR #4(B, Detection/Manifest/Overlay 구현)가 각자 `main`을 기준으로 독립적으로 pnpm workspace 루트를 구성했습니다. 둘 다 `package.json`, `tsconfig.base.json`, `pnpm-workspace.yaml`, `.gitignore`, `pnpm-lock.yaml`을 새로 만들었고 내용이 서로 다릅니다(패키지 매니저 버전, TypeScript/vitest 메이저 버전, `moduleResolution`, TS project references 사용 여부). 두 PR을 그대로 병합하면 루트 설정 파일에서 충돌이 발생합니다.

또한 B가 Contract Input(PR #4, `docs/21-pre-phase-0-b-contract-input.md`)에서 A 결정이 필요한 항목 7건을 제출했습니다.

## Proposed change

### 1. Workspace 루트 Baseline = B 채택

B의 루트 구성(TypeScript project references, `moduleResolution: NodeNext`, 루트 `vitest.config.ts` glob 기반 테스트 수집, `pnpm@11.22.0`)을 canonical로 채택합니다.

근거:
- B의 구성은 이미 실제 프로덕션 코드(detector/vite/overlay/cli 4개 패키지) + 14개 테스트 + Playwright E2E로 동작이 검증된 상태입니다.
- A의 PR #3 루트 구성은 `packages/contracts` 하나만 지원하던 잠정 구성이었습니다.
- 두 구성을 병존시키는 것은 monorepo 루트 설정 하나로 수렴해야 하는 pnpm/TS project reference 특성상 불가능합니다.

PR #3은 닫고, `packages/contracts`를 B의 구성(`../../tsconfig.base.json` extends, `composite` 상속, 루트 `tsconfig.json`의 `references`에 추가, 루트 `vitest.config.ts`의 `packages/*/test/**/*.test.ts` glob으로 테스트 수집)에 맞춰 새 PR로 다시 올립니다. 새 PR은 `feature/detection-overlay/core`(PR #4)를 base로 하여, PR #4가 `main`에 먼저 병합된 뒤 자연스럽게 합류하도록 합니다.

### 2. B Contract Input 결정 (`docs/21` §6)

1. **`implementationKey`/`implementationKeys` 필수화** — ADR-001에서 이미 확정(필수). B의 현재 producer는 optional 타입으로 표시하되 항상 값을 채우고 있음 — Contract 위반 아님. `packages/contracts` 의존으로 전환하는 시점에 타입이 required로 자동 정합됩니다 (후속 작업, B 소유).
2. **추가 Warning Code 4종 승인** — 채택. `DYNAMIC_PARAMETER_KEY`, `UNRESOLVED_EVENT_BINDING`, `PORTAL_OVERLAY_UNSUPPORTED`, `ATLAS_ATTRIBUTE_CONFLICT`를 `docs/20` §4 목록에 추가. `ScanWarning.code`는 Zod에서 `z.string()`으로 열려있어 스키마 변경 없이 이미 유효합니다.
3. **다른 Emitter Adapter(Mixpanel/Meta/PostHog/Amplitude) 기본 활성화 여부** — **opt-in(기본 비활성화)로 결정**. `docs/00` §8 MVP 지원 원칙상 공식 MVP 대상은 GA4/GTM이며 나머지는 "구조상 유지" 수준입니다. 기본값은 GA4/GTM 탐지만 켜고, 나머지는 Vite Plugin Config로 명시적으로 켜야 하는 것으로 확정합니다.
4. **`summaries.analyticsProviders`에 `unknown` 집계 포함 여부** — **포함으로 결정**. `analyticsProvider="unknown"`인 GTM 이벤트도 실제 스캔 결과이므로 집계에서 숨기지 않습니다. `fixtures/mock-manifest.json`에 반영.
5. **B provisional manifest → shared Zod/fixture 승격 시점** — 본 ADR 시점(Contract v0가 B 도메인까지 포함해 확정)으로 결정. `packages/detector/src/model.ts`의 타입을 `@metric-atlas/contracts`로 교체하는 작업은 B 소유의 후속 PR로 진행합니다 (A가 B의 owned 파일을 대신 고치지 않음, CODEOWNERS 존중).
6. **Runtime manifest endpoint와 emitted static manifest 간 production 통합 방식** — 보류. A Runtime 구현 시점에 별도 ADR로 결정합니다. Contract v0 Freeze를 막지 않습니다.
7. **Vite plugin ordering 및 production runtime injection 정책** — 보류, 위와 동일하게 A Runtime 구현 시점 결정.

### 3. CODEOWNERS 정리

B가 원래 계획된 `detector-core`/`detector-ga4`/`detector-gtm`/`detector-meta`/`detector-mixpanel`/`transform-babel` 패키지 분할 대신 `packages/detector`(전 provider adapter 통합) + `packages/vite`(빌드 transform 포함) + `packages/cli` 구조로 통합 구현했습니다. 존재하지 않는 경로를 가리키던 위 6개 항목을 CODEOWNERS에서 제거합니다.

## Producers affected

- A: `packages/contracts`의 `package.json`/`tsconfig.json`을 B 구성에 맞춰 재작성
- B: 후속 PR에서 `packages/detector`/`packages/vite`/`packages/overlay`/`packages/cli`가 `@metric-atlas/contracts`를 의존하도록 마이그레이션 필요 (본 ADR은 트리거만, 구현은 B)

## Consumers affected

- C, D: 구조적 영향 없음. Contract v0 필드/타입은 ADR-001 기준 그대로 유지.

## Alternatives

- A의 PR #3 루트 구성을 canonical로 삼고 B에게 rebase 요청 — 기각. B 쪽이 이미 실제 코드와 테스트로 검증된 더 큰 자산이라 폐기 비용이 큼.
- 두 루트 구성을 그대로 두고 병합 시점에 수동 conflict 해결 — 기각. 재현 불가능한 임시방편이며 어차피 하나로 수렴해야 함.

## Compatibility

Breaking 없음 — Contract v0의 필드/타입 자체는 변경하지 않습니다. Warning Code 목록 확장은 추가적(additive)이라 기존 Consumer와 호환됩니다. `summaries.analyticsProviders`에 `unknown` 항목 추가는 additive이며 기존 소비 코드가 해당 배열에서 `ga4` 항목만 찾는다면 영향 없습니다.

## Migration

1. PR #3(`chore/contracts/phase0-contract-v0` → `main`) 종료.
2. 신규 브랜치(`chore/contracts/phase0-contract-v0-b`)를 `feature/detection-overlay/core`(PR #4) 기준으로 생성, `packages/contracts`를 B 구성에 맞게 이식.
3. 신규 PR을 `feature/detection-overlay/core`를 base로 오픈. PR #4가 `main`에 병합된 뒤 이 PR도 `main` 기준으로 재정렬.
4. B는 후속 PR에서 `packages/detector` 등이 `@metric-atlas/contracts`를 의존하도록 마이그레이션.

## Fixture updates

- `fixtures/mock-manifest.json`: `summaries.analyticsProviders`에 `{ "name": "unknown", "eventCount": 1 }` 추가

## Contract tests

- 기존 `packages/contracts/test/fixtures.test.ts` 그대로 유지. 실행 경로만 패키지 로컬 `vitest run`에서 루트 `vitest.config.ts`의 workspace glob으로 변경 (동작 동일).

## Decision

Accepted. B의 workspace 루트 구성을 baseline으로 채택하고, `docs/21`의 7개 결정 항목을 위와 같이 확정한다.
