# 14. Testing and Acceptance

## 1. Test Layers

- Unit
- Transform Fixture
- Contract
- Integration
- Browser E2E
- GA4 Spike/Smoke
- README Quickstart E2E

## 2. Detection Acceptance

분모는 **MVP가 공식 지원하는 SDK 직접 호출**입니다.

초기 목표:
- Provider false positive ≤ 1%
- Exact binding ≥ 90% among supported direct calls attached to native JSX handlers
- unresolved ≤ 10% in same denominator

Wrapper call은 분모에 넣지 않지만 wrapper-likelihood warning은 검증합니다.

## 3. DOM Coverage

- injected `atlasDomId` count
- actual DOM matched count
- missing count

Demo App과 reference app에서 실측합니다.

## 4. Analytics Health Tests

필수:
- code + GA4 observed
- code only
- GA4 only
- GA4-managed event
- custom dimension registered
- custom dimension missing
- no rows
- thresholding metadata
- other-row data loss
- recent data warning
- timezone consistency

## 5. Build Performance

Reference Repo에서:
- Cold build overhead 초기 목표 ≤ 20%
- 원래 빌드가 10초 미만이면 absolute overhead ≤ 2초
- scanned file count / transform time log 필수

## 6. Security

Release blocker:
- client bundle secret 0
- localStorage secret 0
- logs secret 0
- temporary credential endpoint improperly enabled = fail

## 7. Runtime Resilience

- outbound concurrency guard
- rate limit
- timeout
- bounded retry
- GA4 failure가 static overlay를 막지 않아야 함

## 8. Natural Language

Core release blocker 아님.

별도 acceptance:
- candidate ≤20
- nonexistent event execution 0
- invalid QueryPlan execute 0
- LLM unavailable fallback works

## 9. README E2E

새 환경에서 README만 따라:

```bash
pnpm install
pnpm demo
```

후 5분 내 Overlay + Mock Health Dashboard가 보여야 합니다.
