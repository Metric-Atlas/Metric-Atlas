# 04. System Architecture

## 1. 전체 구조

```text
React + Vite Source
    │
    ├─ Build-Time Scanner / Transformer (B)
    │   ├─ Detector
    │   ├─ JSX Binding
    │   ├─ data-atlas-id injection
    │   └─ Event Manifest
    │
    ├─ Browser Runtime
    │   ├─ Atlas Launcher / Overlay (B)
    │   └─ Dashboard / Search UI (C/D)
    │
    └─ Single Node Runtime (A integration)
        ├─ Static Asset Serve
        ├─ Manifest Serve
        ├─ GA4 Connector execution (C)
        ├─ Analytics Health API (C)
        ├─ LLM Proxy (D)
        ├─ In-memory Cache
        └─ Rate / Concurrency Guard
```

## 2. Producer / Consumer Map

| Artifact / Contract | Primary Producer | Integrator | Consumers | Phase 0 Mock |
|---|---|---|---|---|
| Event Manifest | B | A | Overlay B, Dashboard C, Query D | Yes |
| Detected Provider/Emitter Summary | B | A | C, D | Included in mock manifest |
| Runtime Config / API Envelope | A | A | C, D | Yes |
| GA4 Connector Result | C | A | Dashboard C, Query D | Yes |
| Analytics Health Report | C | A | Dashboard C, Query D | Yes |
| Query Plan | D | A review | Runtime/Connector C, Result UI D | Yes |
| PR Analytics Diff | B scan + A CI integration | A | Developers | Base/Head fixtures |

## 3. Pre-Phase 0 Contract Input Map (Proposed)

| Contract Input | Domain Input Owner | Approver | Reviewers / Affected Consumers |
|---|---|---|---|
| Detection / Manifest / Overlay | B | A | C, D |
| GA4 Connector / Analytics Health | C | A | D, B for Manifest semantics |
| Search / Query / Demo | D | A | C, B for Manifest semantics |

Domain Input Owner는 자기 영역의 계약 조건을 조사하고 제안합니다. Shared Contract의 최종 승인과 충돌 조정은 A가 담당합니다. Phase 0 공통 필드 초안은 `docs/20-phase-0-common-fields.md`에 기록합니다.

## 4. A 병목 방지

A는 계약 승인자·통합 담당자이며 모든 기능의 구현자가 아닙니다.

- B가 실제 Manifest를 만들기 전 C/D는 Mock Manifest 사용
- C가 실제 GA4 Connector를 만들기 전 D는 Mock Analytics Result 사용
- A Runtime 완성 전 C/D는 Mock Runtime Adapter 사용

## 5. Module Boundary

- Detector는 GA4 API를 알지 않습니다.
- Overlay는 GA4 Raw Response를 알지 않습니다.
- GA4 Connector는 JSX AST를 알지 않습니다.
- Query Engine은 GA4 Raw Response를 직접 사용하지 않습니다.
- Dashboard는 Secret을 알지 않습니다.
- Contract 공유는 `packages/contracts`만 사용합니다.

## 6. ID Model

### `atlasDomId`
- DOM ↔ Manifest 매칭
- Build-scoped
- 위치 기반 Hash 사용 가능
- 영구 링크/북마크/캐시 키 금지

### `eventKey`
- 논리 Event 식별
- 기본: `${analyticsProvider}:${eventName}`
- GTM Destination Unknown인 경우 `gtm:${eventName}` namespace 사용
- Dashboard URL과 Query 참조에 사용

### `implementationKey`
- 동일 Event의 코드 구현 위치 식별
- `eventKey + relativePath + enclosingSymbol` 기반
- Refactor 시 변경 가능함을 명시

## 7. Build / Runtime Split

Build:
- 코드 분석
- Manifest 생성
- Overlay Metadata 주입

Runtime:
- Manifest 제공
- GA4 API 조회
- Health 계산
- LLM Proxy

DB는 사용하지 않습니다.
