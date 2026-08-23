# 02. Scope and Roadmap

## Pre-Phase 0 — Research & Contract Inputs (Proposed)

### 목적

B/C/D가 각 담당 영역에서 필요한 계약 조건을 조사하고 Contract Input을 제출합니다. A는 모든 조건을 선제적으로 정하지 않고 각 Domain Input의 충돌을 조정한 뒤 Phase 0 기준선을 승인합니다.

### 담당별 입력

- B: Detection 지원 범위, Manifest 최소 필드, unsupported/unresolved 기준, Overlay/PR Diff 요구사항
- C: GA4 API 가능 여부, Health 상태와 Quality Flag, Managed Event, Custom Dimension, no-rows 기준
- D: Search/Detail/Query/Demo가 소비할 최소 데이터와 사용자 노출 상태
- A: 입력 통합, 충돌 조정, Contract v0 및 Fixture set 승인

### 제출 형식

- 조사한 사실
- 계약에 반영해야 할 조건
- 아직 불확실한 조건
- 필요한 Fixture/Mock
- 영향을 받는 Consumer
- A 결정이 필요한 항목

### 종료 조건

- B/C/D가 담당 Domain Contract Input을 제출함
- Producer/Consumer 간 필수 필드 이견이 기록됨
- A가 Phase 0에서 Freeze할 후보와 보류할 항목을 구분함
- `docs/20-phase-0-common-fields.md`가 A 승인 가능한 상태가 됨

## Phase 0 — Parallel Development Baseline

### 목적
상세 타입을 완성하는 것이 아니라 **B/C/D가 실제 구현을 기다리지 않고 동시에 개발 가능한 기준선**을 고정합니다.

Pre-Phase 0에서 제출된 Domain Contract Input을 근거로 A가 Contract v0와 Fixture set을 승인합니다.

### 필수 산출물
- Repository / pnpm Workspace Skeleton
- 최소 `packages/contracts` Zod Schema
- Mock Event Manifest
- Mock GA4 Health Result
- Mock Query Result
- Runtime Mock API
- Demo React+Vite Shell
- Producer / Consumer Map

### Phase 0 종료 조건
- B는 Mock 없이 Detector 개발 가능
- C는 Mock Manifest를 소비해 Dashboard/GA4 Connector 개발 가능
- D는 Mock Manifest + Mock Health Result로 Search/Query 개발 가능
- A의 실 Runtime 구현 완료를 기다리지 않아도 됨

## Phase 0A — GA4 Spike
Phase 0 계약 v1 Freeze 전에 `docs/17-ga4-spike-plan.md`의 핵심 항목을 실제 GA4 Property로 검증합니다.

## Phase 1 — Detection & Manifest
- `gtag`
- `sendGAEvent`
- `dataLayer.push`
- Provider/Emitter 구분
- 래퍼 가능성 경고
- PR Scan CLI

## Phase 2 — UI Binding & Overlay
- 인라인 핸들러
- 같은 파일 핸들러
- 네이티브 JSX 주입
- `atlasDomId`
- Internal Launcher
- Provider Badge
- Runtime DOM Match Coverage

## Phase 3 — Analytics Health Dashboard
- Code ↔ GA4 Event 대조
- GA4 Managed Event Registry
- Custom Dimension Registration Gap
- Health Summary
- Event Detail
- 기간 비교
- 배포: `packages/dashboard`로 UI를 추출해 `@metric-atlas/runtime`에 내장 서빙(ADR-009, DEC-061) — 소비자 설치형 패키지나 Vite Plugin 옵션이 아님

## Phase 4 — PR Analytics Change Report
- Base/Head Scan
- Added / Removed / Changed
- Unsupported Pattern Warning
- CI Summary

## Phase 5 — Natural Language Query Extension
- Local Candidate Search
- LLM Adapter
- Query Plan
- Event Count / Comparison
- Core Release와 독립

## Phase 6 — OSS DX / Release
- `pnpm demo`
- Pattern Showcase App
- README Quickstart
- CONTRIBUTING
- Detector Extension Guide
- Connector Extension Guide
- SemVer / License 최종 확정 — 완료(DEC-054, DEC-055)
- npm registry publish — 완료(DEC-062). `contracts`/`detector`/`overlay`/`vite`/`runtime`/`cli`/`connector-sdk`/`connector-ga4` 8개 패키지가 `@metric-atlas/*` 스코프로 공개돼 있다. `docs/adr/ADR-008`의 `dist/vite-plugin` git-install 경로는 `main` 추적용 fallback으로만 유지.

## MVP Core 성공 기준

다음은 Release Blocker입니다.

1. GA4 Direct SDK 이벤트 탐지
2. 네이티브 JSX Overlay
3. Analytics Health
4. Custom Dimension Gap Detection
5. PR Analytics Change Report
6. GA4 Event Detail / Period Comparison
7. 보안·성능·정확도 기준 통과

Natural Language Query는 Core MVP Release Blocker가 아닙니다.

## MVP 공식 제외

- 래퍼 함수 경유 호출
- 파일 간 호출 그래프
- Custom Component Overlay
- GTM Container 내부 Tag Resolution
- GA4 Funnel API
- Raw Event Reconstruction
- 장기 History Store
- 자체 인증
- 다중 Runtime
