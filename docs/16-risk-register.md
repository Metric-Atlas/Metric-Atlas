# 16. Risk Register

## R-1 Wrapper coverage
직접 SDK 호출만 공식 지원하므로 실제 프로젝트에서 누락될 수 있음.

대응:
- SDK import + direct call 0 warning
- Custom Detector 안내
- 지원 범위 명시

## R-2 Custom Component overlay
이벤트는 탐지해도 DOM에 직접 주입할 수 없음.

대응:
- 대문자 JSX 주입 금지
- Dashboard Event List에는 유지
- “Overlay unsupported” 명시

## R-3 GTM destination ambiguity
`dataLayer.push`의 실제 Tag 목적지를 정적 코드만으로 알 수 없음.

대응: `emitter=gtm`, provider unknown.

## R-4 GA4-managed events noise
GA4 자동 이벤트가 data-only 목록을 오염시킬 수 있음.

대응: versioned managed-event registry.

## R-5 GA4 data quality false alarm
최근 데이터, thresholding, `(other)`로 code-only 오탐 가능.

대응: Result Status + Quality Flag 분리.

## R-6 Secret exposure
대응: Node-only credentials, no VITE secret, runtime guard.

## R-7 No DB = no history
현재 Health 상태와 Git diff는 제공하지만 장기 “언제부터 깨졌는가”는 답하지 못함.

대응: MVP trade-off로 명시. PR diff는 Base/Head 재스캔.

## R-8 Single runtime bottleneck
대응: outbound concurrency / rate limit / timeout.

## R-9 A integration bottleneck
대응: Phase 0 mocks + producer/consumer map.

## R-10 Docs / code drift
대응: Zod Machine SoT + contract tests + README E2E.

## R-11 Authentication delegated to infrastructure
사내 인증이 없으므로 내부 접근권 = Metric Atlas 제공 GA4 데이터 조회 가능.

대응:
- 내부 네트워크/배포 접근 제한
- GA4 service account 최소 Property/읽기 권한
- 공개 인터넷 배포 비지원

## R-12 Build slowdown
대응: include/exclude, scan stats, performance acceptance threshold.

## R-13 LLM hallucination/cost
대응: local candidate prefilter, max 20, query schema, timeout, concurrency cap, optional feature.
