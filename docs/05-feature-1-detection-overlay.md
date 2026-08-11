# 05. Feature 1 — Detection & Overlay

## 1. 공식 MVP Detector

### GA4 direct
```ts
gtag("event", "purchase_click", { value: 100 });
```

```ts
sendGAEvent("event", "purchase_click", { value: 100 });
```

### GTM direct
```ts
dataLayer.push({
  event: "purchase_click",
  value: 100,
});
```

`dataLayer.push`는 `emitter=gtm`, `analyticsProvider=unknown`입니다. GTM Container 내부 Tag Destination은 정적 코드만으로 확정하지 않습니다.

## 2. 다른 Emitter

구조상 Mixpanel / Meta / PostHog / Amplitude Detector를 추가할 수 있으나 첫 Connector는 GA4입니다.

## 3. MVP 미지원 — 래퍼

```ts
export function trackEvent(name: string, params?: object) {
  gtag("event", name, params);
}

<button onClick={() => trackEvent("purchase_click")}>구매</button>
```

MVP에서는 이 호출을 Event로 정식 해석하지 않습니다.

대신 다음 조건에서 Build Warning을 냅니다.

```text
GA4 SDK/import detected but direct event call count = 0.
A wrapper function may be in use. Review Custom Detector configuration.
```

## 4. Event ↔ JSX Binding

지원:
- 인라인 핸들러
- 같은 파일에 선언된 handler reference
- 소문자 JSX 네이티브 태그

주입 규칙:

```text
<button>      → inject
<a>           → inject
<form>        → inject
<MyButton>    → do not inject
<>...</>      → do not inject
Portal        → do not inject
```

Custom Component Event는 Manifest Event List에는 유지하며 `overlayUnsupported=true`로 표시합니다.

## 5. Binding Confidence

- `exact`: 지원 패턴에서 JSX 네이티브 요소까지 정적으로 연결
- `inferred`: 동일 파일 제한적 call relation 등
- `unresolved`: 동적 eventName, 파일 간 call, 기타 미지원

Provider Detection Confidence와 Binding Confidence는 다른 축이며 동일 enum을 공유하지 않습니다.

## 6. Build-time Injection

원본 소스파일은 변경하지 않습니다.

```tsx
<button onClick={() => gtag("event", "purchase_click")}>구매</button>
```

브라우저 전달 코드:

```tsx
<button data-atlas-id="atlas_xxx" onClick={...}>구매</button>
```

DOM에는 eventName을 직접 넣지 않습니다.

## 7. Runtime Coverage

Runtime은 Manifest의 `atlasDomId`와 실제 DOM 존재 여부를 비교합니다.

측정:
- inject candidate count
- DOM matched count
- DOM missing count
- binding coverage

이 결과를 Demo/QA에서 자동 수집해 MVP 정확도 판정에 사용합니다.

## 8. Overlay

- Vanilla TypeScript
- Web Component
- Shadow DOM
- Pointer Event Delegation
- Internal Launcher
- Provider/Emitter Badge

## 9. Source Scanning Performance

- Configurable include/exclude glob
- 기본 src만 분석
- 파일 해시/transform cache 사용 가능
- Build Summary에 스캔 파일 수, 소요시간, event count 출력
