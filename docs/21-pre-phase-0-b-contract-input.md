# 21. Pre-Phase 0 — B Detection / Manifest Contract Input

- Status: Proposed
- Domain Input Owner: Member B (성준)
- Approver: Member A (가현)
- Affected reviewers: Member C (재욱), Member D (호범)
- Related task: `docs/tasks/B-001-detection-manifest-overlay.md`

이 문서는 B 영역의 조사·구현 입력이며 A 승인 전까지 Shared Contract가 아닙니다. 현재 Phase 0 fixture는 변경하지 않습니다.

## 1. 조사한 사실

- 공식 MVP 탐지 분모는 SDK 직접 호출이며 GA4 `gtag("event", ...)`, `sendGAEvent("event", ...)`, GTM `dataLayer.push({ event: ... })`가 기준입니다.
- GTM emitter와 목적 Analytics Provider는 별개입니다. 정적 소스의 `dataLayer.push`만으로 GA4 목적지를 확정할 수 없습니다.
- 정적 문자열 eventName만 안정적인 `eventKey`를 만들 수 있습니다. Template literal interpolation, identifier, binary expression은 실행 없이 확정할 수 없습니다.
- TypeScript `as const`, `satisfies`, non-null/parenthesized wrapper 안의 literal은 실행 없이 안전하게 벗겨낼 수 있습니다. Identifier 자체는 별도 const propagation 결정 전까지 동적으로 취급합니다.
- 인라인 JSX handler와 같은 파일의 identifier handler는 Babel binding으로 연결할 수 있습니다. 파일 간 handler, member-expression handler, runtime wrapper call graph는 MVP 범위를 벗어납니다.
- native JSX tag에는 build transform에서 attribute를 주입할 수 있지만 Custom Component와 Portal에는 동일한 DOM 존재를 보장할 수 없습니다.
- 한 논리 Event가 여러 코드 위치에 존재할 수 있어 `eventKey`만으로 Overlay의 정확한 source occurrence를 선택할 수 없습니다.
- C Health는 logical key/provider/parameter가 필요하고, D Search/Detail은 원본 이름/emitter/provider/source/overlay 상태가 필요합니다. Overlay는 binding과 구현 위치의 직접 연결이 필요합니다.
- Build transform은 원본 파일을 쓰지 않고 Vite transform result만 반환할 수 있습니다. Scanner CLI도 source를 read-only로 취급할 수 있습니다.
- Vite dev session은 파일별 최신 분석을 보관하며 수정 시 교체하고 삭제/unlink 시 Manifest에서 제거해야 stale event를 남기지 않습니다.

## 2. 계약에 반영해야 할 조건

- 원본 `eventName`을 그대로 유지하고 logical key는 `${analyticsProvider}:${eventName}`를 기본으로 합니다. 목적 Provider가 불명인 GTM은 `gtm:${eventName}`입니다.
- `providerDetectionConfidence`와 `bindingConfidence`를 분리합니다.
- `DetectedEvent`는 구현 occurrence 단위이며 `implementationKey`를 가져야 합니다. Binding은 `eventKeys`와 `implementationKeys`를 함께 제공해야 합니다.
- `atlasDomId`는 build-scoped DOM matching 전용이며 영구 링크/캐시 키로 사용하지 않습니다.
- 동적 eventName은 `events`에 넣지 않고 review 가능한 warning으로 보존합니다.
- 정적으로 확인 가능한 parameter key만 `parameters`에 넣고 spread/computed key는 warning으로 노출합니다.
- Custom Component에서 발견한 Event는 삭제하지 않고 `overlaySupported=false`와 warning을 제공합니다.
- `dataLayer.push`는 `emitter=gtm`, `analyticsProvider=unknown`, `providerDetectionConfidence=provider_unknown`이어야 합니다.
- source path는 repo-relative POSIX separator, line/column은 1-based로 정규화합니다.

## 3. 아직 불확실한 조건

- import alias까지 공식 지원할지, 문서의 canonical callee 이름만 지원할지
- `sendGAEvent`의 object-form API를 MVP에 포함할지
- 동일 handler가 여러 native element에 연결될 때 모두 exact로 볼지 review-needed로 낮출지
- parameter spread/computed key를 별도 필드로 구조화할지 warning만 둘지
- Portal 내부 native element의 overlay 지원을 전부 제외할지 실제 DOM 검증 후 허용할지
- `summaries`와 `scanStats`를 required로 freeze할지
- 다른 emitter adapter(Mixpanel/Meta/PostHog/Amplitude)를 기본 활성화할지 opt-in으로 둘지

## 4. 필요한 Fixture / Mock

- canonical GA4/GTM direct call과 parameter 추출
- inline handler와 same-file handler reference
- 동적 eventName, dynamic/computed parameter
- SDK import + direct call 0건 wrapper 가능성
- Custom Component, Portal, unresolved member handler
- 한 logical Event의 복수 implementation
- 기존 `data-atlas-id` 충돌
- Base/Head manifest의 added/removed/provider change/parameter diff
- Overlay DOM matched/missing coverage

이 작업은 위 항목을 B 패키지 test fixture로 추가합니다. 공유 `fixtures/mock-manifest.json` 교체는 A 승인 후 수행합니다.

## 5. 영향을 받는 Consumer

| Consumer | 필요한 최소 정보 | 영향 |
|---|---|---|
| B Overlay | `atlasDomId`, `implementationKeys`, source, parameter, badges | 정확한 DOM ↔ occurrence 표시 |
| C Analytics Health | `eventKey`, `eventName`, provider/confidence, parameters | Provider 대상 선별과 등록 gap 근거 |
| D Search/Detail | 원본 이름, emitter/provider, source, overlay 상태 | 검색 결과와 사용자 설명 |
| A Runtime | manifest version/build/generated time/warnings/stats | API 제공과 validation/logging |
| A CI / PR Report | logical event와 warning/parameter diff | Base/Head semantic report |

## 6. A 결정이 필요한 항목

1. `implementationKey`와 Binding `implementationKeys`의 Contract v0 필수 채택
2. 동적 eventName을 warning-only로 표현하는 규칙 채택
3. 추가 warning code 승인: `DYNAMIC_PARAMETER_KEY`, `UNRESOLVED_EVENT_BINDING`, `PORTAL_OVERLAY_UNSUPPORTED`, `ATLAS_ATTRIBUTE_CONFLICT`
4. `summaries`/`scanStats` required 여부
5. B provisional manifest를 shared Zod schema 및 mock fixture로 승격할 시점
6. Runtime manifest endpoint와 emitted static manifest 간 production 통합 방식
7. `summaries.analyticsProviders`에 `unknown` 집계를 포함할지 여부

## 7. B의 provisional 구현 정책

- 구현은 Proposed 필드를 생성하지만 `packages/contracts`를 만들거나 shared fixture를 수정하지 않습니다.
- Consumer는 A 승인 전까지 Proposed extension에 의존하면 안 됩니다.
- A가 승인할 때 ADR, Zod schema, fixture, contract test를 함께 변경합니다.
