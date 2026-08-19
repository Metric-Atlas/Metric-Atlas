# Task Spec

- Task ID: B-002
- Owner: Member B (성준)
- Branch: `feature/detection-overlay/phase0-finish`
- Related docs: `docs/00-project-source-of-truth.md`, `docs/04-system-architecture.md`, `docs/05-feature-1-detection-overlay.md`, `docs/08-contracts-and-schema.md`, `docs/14-testing-and-acceptance.md`, `docs/19-pr-analytics-change-report.md`, `docs/20-phase-0-common-fields.md`, `docs/21-pre-phase-0-b-contract-input.md`
- Related decisions: DEC-020, DEC-022, DEC-025, DEC-035, DEC-037, DEC-039, DEC-045, DEC-046

## Goal

승인된 Contract v0를 B 패키지의 실제 타입·검증 기준으로 적용하고, GA4/GTM 기본 탐지 정책, Local Node Runtime Manifest 전달, Demo Overlay, PR Analytics Report, Detection Acceptance 측정을 하나의 재현 가능한 통합 경로로 완성한다.

## Inputs / Mocks

- `packages/contracts`의 승인된 Event Manifest Zod Schema
- `fixtures/mock-manifest.json`, `fixtures/mock-ga4-health.json`, `fixtures/mock-query-result.json` (read-only baseline)
- `apps/demo-react-vite`의 Runtime → Fixture fallback
- `packages/runtime`의 `GET /__metric-atlas/api/manifest`
- B detector/overlay/browser fixtures와 Base/Head manifest fixture

## Producer / Consumer impact

- Produces: Zod-valid Event Manifest, transformed build, DOM coverage report, PR semantic diff/report
- Consumes: Contract v0, React/Vite source, Local Node Runtime artifact convention
- Affected consumers: B Overlay/CLI, A Runtime/CI, C Analytics Health, D Dashboard/Search/Demo

## Allowed files

- `packages/detector/**`
- `packages/vite/**`
- `packages/overlay/**`
- `packages/cli/**`
- `apps/demo-react-vite`의 B 통합 설정·showcase·E2E 관련 파일
- `.github/actions/**`, `.github/workflows/**`
- B Task/Handoff/Research 문서
- 필요한 workspace package/TypeScript/Playwright 설정

## Forbidden files

- `packages/contracts` Schema 의미 변경
- 승인된 `fixtures/mock-*.json` 기준선 변경
- C의 GA4 Connector/Health 판정 구현
- A Runtime의 credential/auth 정책 변경
- D Query 의미 또는 LLM 동작 변경

## Contract impact

- Compatible. 승인된 Contract v0를 실제 Producer/Consumer에 적용하며 새 공유 필드를 추가하지 않는다.
- Manifest artifact 경로는 ADR-004의 `.metric-atlas/manifest.json` 규칙에 맞춘다.
- 공식 Detector 지원 범위 확장은 조사·제안으로만 남기며 A 승인 전 구현하지 않는다.

## Acceptance criteria

- B 패키지의 공유 Manifest 타입은 `@metric-atlas/contracts`를 단일 SoT로 사용한다.
- `implementationKey`와 Binding `implementationKeys`는 Producer 타입에서 필수다.
- 생성·입력 Manifest의 Contract validation test가 존재한다.
- 기본 탐지는 GA4/GTM만 활성화되고 다른 Provider는 명시적 opt-in에서만 탐지된다.
- Vite build 산출물을 Local Node Runtime이 `/__metric-atlas/api/manifest`로 제공한다.
- Demo에서 Overlay launcher, native binding, Manifest/Health Dashboard가 함께 동작한다.
- Base/Head scan과 Markdown PR Report를 GitHub Actions에서 재현할 수 있다.
- Detector acceptance와 Demo DOM coverage/build overhead를 자동 검증한다.
- 사용자 소스파일을 수정하지 않고 Secret을 client bundle/log에 추가하지 않는다.

## Tests

- TypeScript project build
- Detector/Vite/Overlay/CLI unit and integration tests
- Contract producer/consumer tests
- Runtime Manifest endpoint integration
- Demo browser E2E and README quickstart smoke
- PR report script tests
- Detection corpus evaluator and Demo build benchmark

## Performance / Security

- Detector build absolute overhead 2초 이하 기준을 유지한다.
- Runtime/Overlay 실패가 Dashboard fixture fallback을 막지 않는다.
- Manifest와 report에 credential을 포함하지 않는다.
- GitHub Action은 checkout된 소스를 읽고 임시 디렉터리에만 산출물을 기록한다.

## Deliverables

- Contract v0 migration
- Opt-in adapter configuration
- Runtime/Demo Overlay integration
- PR report workflow/action
- Acceptance/performance evidence
- Detector scope research update
- B-002 handoff

## Open decisions

- import alias와 `sendGAEvent` object-form을 공식 MVP 탐지 분모에 포함할지
- const identifier propagation을 공식 지원할지
- 동일 handler의 복수 native element binding을 모두 exact로 유지할지
