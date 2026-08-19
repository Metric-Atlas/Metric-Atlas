# Task Spec

- Task ID: B-001
- Owner: Member B (성준)
- Branch: `feature/detection-overlay/core`
- Related docs: `docs/00-project-source-of-truth.md`, `docs/04-system-architecture.md`, `docs/05-feature-1-detection-overlay.md`, `docs/08-contracts-and-schema.md`, `docs/14-testing-and-acceptance.md`, `docs/19-pr-analytics-change-report.md`, `docs/20-phase-0-common-fields.md`
- Related decisions: DEC-002, DEC-003, DEC-004, DEC-016, DEC-020, DEC-021, DEC-022, DEC-024, DEC-025, DEC-026

## Goal

B가 소유하는 Detection / Manifest / Overlay / PR scanner 영역을 독립 실행 가능한 패키지로 구현한다. Pre-Phase 0 조사 결과는 Contract Input으로 제출하되 A 승인 전에는 shared contract와 Phase 0 fixture를 freeze하지 않는다.

## Inputs / Mocks

- `fixtures/mock-manifest.json`: 기존 Contract v0 소비 예시이며 이 작업에서 교체하지 않음
- detector transform fixture: 지원 패턴, 동적 이름, wrapper 가능성, Custom Component
- overlay manifest fixture: DOM match/missing coverage

## Producer / Consumer impact

- Produces: Event Manifest, transformed build module, DOM coverage, PR semantic diff
- Consumes: React/Vite source files, B plugin options
- Affected consumers: B Overlay, C Analytics Health, D Search/Query/Demo, A Runtime/CI

## Allowed files

- `packages/detector/**`
- `packages/vite/**`
- `packages/overlay/**`
- `packages/cli/**`
- B 전용 test fixture와 문서
- 위 패키지를 실행하기 위한 최소 root workspace 설정

## Forbidden files

- `packages/contracts/**` (A 승인 전)
- 기존 `fixtures/mock-*.json` 기준선 (A 승인 전)
- C/D 기능 구현

## Contract impact

- Proposed only. `implementationKey`, binding `implementationKeys`, 추가 warning code는 B Contract Input이며 shared contract가 아님.
- A 승인 후 ADR required.

## Acceptance criteria

- GA4 `gtag`, `sendGAEvent`와 GTM `dataLayer.push` 직접 호출 탐지
- 정적 이름만 Event로 생성하고 동적 이름은 warning 처리
- native JSX inline/same-file handler binding 및 build output에만 `data-atlas-id` 주입
- Custom Component Event 유지 + overlay unsupported warning
- SDK/import는 있으나 direct call이 없으면 wrapper warning
- Manifest summary/stats, overlay coverage, scanner/diff CLI 제공
- 원본 source 파일 무변경

## Tests

- detector unit/transform fixtures
- scanner project integration
- overlay DOM/coverage tests
- manifest diff/report tests
- TypeScript build

## Performance / Security

- include/exclude glob과 단일 AST pass 중심
- scan duration/file count 출력
- source/manifest 외 secret 처리 없음
- overlay는 manifest 문자열을 `textContent`로 렌더링

## Deliverables

- B Contract Input 문서
- detector/Vite/overlay/CLI packages
- tests and reproduction commands

## Open decisions

- A의 Proposed common fields 승인
- 추가 warning code 승인
- Manifest URL/runtime envelope 통합
- Vite plugin ordering 및 production runtime injection 정책
