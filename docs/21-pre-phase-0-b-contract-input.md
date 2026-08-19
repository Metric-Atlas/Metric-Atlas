# 21. Pre-Phase 0 — B Detection / Manifest Contract Input

- Status: Contract v0 입력은 ADR-002로 승인됨; §8 후속 범위 제안은 A 결정 대기
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

## 7. B의 승인 전 provisional 구현 정책 (완료)

- 구현은 Proposed 필드를 생성하지만 `packages/contracts`를 만들거나 shared fixture를 수정하지 않습니다.
- Consumer는 A 승인 전까지 Proposed extension에 의존하면 안 됩니다.
- A가 승인할 때 ADR, Zod schema, fixture, contract test를 함께 변경합니다.

위 정책은 ADR-002 승인 전 작업 규칙이었습니다. 승인 이후 실제 B Producer/Consumer migration은 B-002에서 완료했으며 현재 Machine SoT는 `packages/contracts`입니다.

## 8. 2026-08-19 후속 조사 — Detector Coverage Input

### 조사한 사실

- Google의 현재 Google tag API는 `gtag('event', '<event_name>', { ...event_params })` 형태를 공식 Event 전송 문법으로 정의합니다. 현재 GA4 Adapter의 3-argument 해석과 일치합니다. ([Google tag API reference](https://developers.google.com/tag-platform/gtagjs/reference))
- Next.js의 현재 `@next/third-parties/google` 문서도 `sendGAEvent('event', 'buttonClicked', { value: 'xyz' })`를 공식 예제로 사용합니다. `sendGAEvent({ event: ... })` object-form은 공식 GA 예제가 아니므로 GA4 Event로 새로 지원하면 안 됩니다. ([Next.js Third Party Libraries](https://nextjs.org/docs/app/guides/third-party-libraries))
- `sendGTMEvent({ event: ... })`는 별도의 GTM helper이며 `sendGAEvent`와 의미가 다릅니다. 이를 추가할 경우에도 `emitter=gtm`, `analyticsProvider=unknown` 원칙을 유지해야 합니다.
- ES import alias(`import { sendGAEvent as trackGa } ...`)는 binding origin을 정적으로 확인할 수 있지만 현재 Detector는 callee identifier 문자열만 비교하므로 탐지하지 않습니다.
- 같은 파일의 `const EVENT_NAME = "purchase_click"`는 Babel binding이 constant이고 initializer가 static literal인지 확인하면 실행 없이 안전하게 제한적 propagation이 가능합니다. 반면 import/re-export, mutable binding, object member는 call graph 범위로 확장되므로 같은 규칙으로 취급할 수 없습니다.
- 하나의 same-file handler가 여러 native JSX element의 handler prop에 연결되면 각 DOM 요소가 같은 직접 호출 occurrence를 실제로 실행할 수 있습니다. 각 Binding을 `binding_exact`로 유지하고 동일 `implementationKey`를 공유하는 현재 표현이 Contract v0 ID 모델과 맞습니다.

### 계약에 반영해야 할 조건

- `sendGAEvent` 공식 지원 형태는 현재의 `(command="event", staticEventName, optionalStaticObject)`를 유지합니다.
- object-form API는 helper 이름별 의미를 구분하며 `sendGAEvent` object-form을 GA4로 추론하지 않습니다.
- import alias나 const propagation을 추가하더라도 원본 `eventName`, `eventKey`, provider/emitter 규칙과 Manifest 필드는 변경하지 않습니다.
- alias 지원은 import source와 imported symbol을 확인한 경우로 제한하고 임의 local wrapper alias는 지원 범위에 넣지 않습니다.

### 아직 불확실한 조건

- canonical import alias를 Core MVP denominator에 포함할지 opt-in/후속 범위로 둘지
- same-file constant eventName propagation을 Core MVP denominator에 포함할지
- `sendGTMEvent`를 GTM direct helper로 추가할지, 기존 `dataLayer.push`만 공식 GTM 범위로 유지할지
- `window.gtag(...)` member call을 공식 `gtag(...)`와 같은 직접 호출로 볼지

### 필요한 Fixture / Mock

- canonical/aliased `sendGAEvent` import 비교
- `sendGAEvent` 3-argument와 잘못된 object-form 비교
- `sendGTMEvent({ event: ... })`의 GTM/unknown 기대값
- constant/mutable/imported eventName identifier 비교
- 하나의 handler를 공유하는 복수 native element와 동일 `implementationKey` 연결

### 영향을 받는 Consumer

- C Health와 D Search의 필드 형태에는 영향이 없고 탐지되는 Event 집합만 additive하게 달라질 수 있습니다.
- PR Report에서는 alias/const 지원 전후 added event가 나타날 수 있으므로 지원 범위 변경을 release note에 기록해야 합니다.
- Detection Acceptance denominator와 false-negative 기준을 함께 갱신해야 합니다.

### A 결정이 필요한 항목

1. canonical import alias를 공식 MVP 탐지 범위로 승격할지
2. same-file constant eventName propagation을 공식 MVP 탐지 범위로 승격할지
3. `sendGTMEvent`와 `window.gtag` 지원을 이번 MVP에 추가할지
4. 위 범위 확장 시 새 Detector fixture와 acceptance denominator를 Contract 변경 없이 B public behavior 변경으로 승인할지
