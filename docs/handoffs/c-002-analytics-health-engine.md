# Handoff — C-002 GA4 Analytics Health Engine

## Summary

GA4 Spike(C-SPIKE-001) 완료 이후 GA4 Connector와 Analytics Health Engine을 프로덕션 코드로 완성했다 (ADR-005/006/007, PR #15/#19/#21/#22→#23). `packages/connector-ga4`에서 Manifest + GA4 API 조회 + Registry를 조합해 실제 `AnalyticsHealthReport`를 만드는 함수까지 완성됐지만, **이걸 실제로 호출하는 Runtime 쪽 연결이 아직 없다** — 이게 이 handoff의 핵심 요청이다.

## Implemented

- **Reserved Parameter Registry** / **GA4 Managed Event Registry** (ADR-005) — `resolveParameterState()`, `resolveGa4ManagedState()`. Spike §5 실측(`getMetadata` dimension 매칭으로 `builtin` 판정 불가)에 근거.
- **Health Engine 조각들** (ADR-006) — `resolveGa4ObservationState()`, `computeReviewReason()`(`apps/demo-react-vite/src/labels.ts`의 `REVIEW_KO` 2개 코드와 정합성 확인·수정함), `buildHealthItemForDetectedEvent()`.
- **GA4-only 이벤트 탐지** (ADR-007, A 승인) — `Ga4Connector.listObservedEventNames()`, `buildHealthItemsForGa4OnlyEvents()`. `AnalyticsConnector` 인터페이스에 `listObservedEventNames`/`ConnectorCapabilities.eventListingSupport` 추가.
- **Custom Dimension Gap 실연결** — `Ga4Connector.getCustomDimensionLookup()` (Admin `listCustomDimensions` 호출, propertyId별 캐시).
- **Cache** (docs/06 §9) — `withCache()`: TTL + in-flight dedup, fingerprint `provider+propertyId+eventName+dateRange+metric+breakdowns+filters`.
- **`buildAnalyticsHealthReport()`** — 위 전부를 조합하는 최종 조립 함수. `fixtures/mock-manifest.json` 전체를 fake connector로 재현해 검증(4개 HealthItem + summary 버킷 집계 + `classifyHealthItemBucket` 재계산 일치까지 확인).

## Not implemented — Integration action 필요 (A/D)

**`packages/runtime`의 `/api/health`가 `buildAnalyticsHealthReport()`를 호출하지 않는다.** 현재 `server.ts`의 `sendHealth()`는 `.metric-atlas/health.json`(또는 루트의 `health.json`) 정적 파일을 그대로 서빙하기만 한다 — GA4를 실제로 조회하는 코드 경로가 Runtime 어디에도 없다.

이 때문에 실 환경(예: `metric-atlas-homepage.vercel.app`에 GA4를 연결하고 버튼을 클릭해도)에서 Analytics Health를 실측하려고 해도 **`/api/health`가 GA4를 조회하지 않으므로 실측 자체가 불가능한 상태**다. 이번에 실 트래픽으로 검증해보려는 시도가 이 공백 때문에 막혀 있다.

필요한 것 (A/D 판단 요청, C가 임의로 `packages/runtime`을 건드리지 않음 — DEC-047 co-ownership):

1. `/api/health` 요청 시(또는 빌드/CLI 단계에서) 다음을 조합해 `buildAnalyticsHealthReport()`를 호출하는 코드 경로 추가:
   - `EventManifest` — 이미 있는 `.metric-atlas/manifest.json`
   - `Ga4Connector`(`createGoogleGa4Client` + credential 해석, 이미 connector-ga4에 있음) — `ConnectorContext`(propertyId 등)는 `.env`/설정에서
   - `Ga4Connector.getCustomDimensionLookup()`으로 1회 조회한 `customDimensions`
   - `dateRange`는 절대 날짜여야 함 (preset 미지원, Known limitation 참고)
2. 라이브 조회(요청마다 GA4 호출) vs 빌드/배치 시점에 `health.json` 아티팩트를 생성해두는 방식 중 택1 — Cache(`withCache`, TTL 300s)가 있어 라이브 조회도 비용이 크지 않음
3. Credential 해석·주입 흐름은 DEC-045(Node Runtime에서만 resolve) 원칙 유지

## Changed files

`packages/connector-ga4/**`, `packages/connector-sdk/src/index.ts`, `packages/contracts/src/connector.ts` (PR #15, #19, #21, #22→#23 — 전부 main에 병합됨). `packages/runtime`은 변경하지 않았다.

## Contract impact

없음 — 전부 기존 계약(ADR-001/002/003) 위에 additive. `ConnectorCapabilities.eventListingSupport`, `AnalyticsConnector.listObservedEventNames` 추가는 ADR-007로 A 승인됨.

## Producer / Consumer impact

- C: 위 전부 소유·구현 완료.
- A/D: `packages/runtime`이 이제 `@metric-atlas/connector-ga4`의 `buildAnalyticsHealthReport`/`Ga4Connector`를 의존성으로 추가해야 함.
- D: Dashboard(`apps/demo-react-vite`)는 변경 불필요 — `/api/health`가 진짜 데이터를 리턴하기 시작하면 그대로 소비 가능 (fixture fallback 로직 이미 있음).

## How to run

```bash
pnpm install
pnpm build
pnpm test   # workspace 전체 134 tests
```

## Tests

`packages/connector-ga4/test/*.test.ts` — registries, quality-flags, cache, health-engine, health-report(오케스트레이터). fixture-parity 검증 다수(`mock-ga4-health.json`, `mock-manifest.json`).

## Known limitations

- `dateRange`는 절대 날짜만 지원(`asAbsolute`) — preset(`last_30_days` 등) 해석은 Property timezone 기준 날짜 계산이 필요해 아직 미구현. Runtime 연결 시 절대 날짜를 계산해서 넘겨야 함.
- `Ga4ObservedEventsResult`(GA4-only 판정용)는 이벤트별 `eventCount` 값을 포함하지 않음(ADR-007 승인 스키마) — GA4-only 항목의 `latestMeasurement.value`는 항상 `undefined`.
- 2차 GA4 스파이크 실행(실 트래픽/Custom Dimension 테스트 등록)은 아직 완료 전 — thresholding/`(other)` 실측은 여전히 대기 중.

## Integration actions

1. **A/D**: `packages/runtime`에 `/api/health` 실제 GA4 조회 연결 (위 "Not implemented" 참고) — 이게 없으면 실 Property로 Analytics Health 실측이 불가능함
2. **A**: ADR-005/006/007 Status Proposed → Accepted 전환 + decision log 반영 (PR #15/#16 리뷰에서 본인이 하겠다고 한 후속 작업, 아직 미반영)
3. **외부 의존**: 2차 GA4 스파이크 실행 조건(실 트래픽 확보, Custom Dimension 테스트 등록) — 준비되면 `docs/spikes/ga4-data-api-result.md` §10 참고
