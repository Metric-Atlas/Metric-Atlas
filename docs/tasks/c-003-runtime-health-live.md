# Task Spec

- Task ID: C-003
- Owner: 재욱 (Member C)
- Branch: `feature/ga4-health/runtime-health-live`
- Related docs: `docs/handoffs/c-002-analytics-health-engine.md` (Integration action 1), `docs/06-feature-2-analytics-health-ga4.md` (§9 Cache), `docs/08-contracts-and-schema.md` (§9 Runtime API), `docs/10-deployment-runtime-env.md`
- Related decisions: DEC-045(Node Runtime 기본), DEC-046(API envelope), DEC-047(runtime A+D 공동 소유), DEC-049(기본값), DEC-051(후속 작업 A+C 명시)

## Goal

`packages/runtime`의 `/__metric-atlas/api/health`가 정적 `health.json` 서빙에 머물지 않고, GA4가 설정된 환경에서 `buildAnalyticsHealthReport()`를 호출해 **실제 GA4 실측 Health Report를 반환**하게 한다. 이것이 없으면 실 Property Analytics Health 실측이 불가능하다 (C-002 handoff 핵심 공백).

방식 제안: **라이브 조회 + TTL 캐시** (빌드 아티팩트 방식 대비 배포 없이 데이터 갱신, `withCache`/report 캐시로 GA4 호출 상한 보장). A 승인 요청 항목.

## Inputs / Mocks

- `.metric-atlas/manifest.json` (B의 산출물, contracts `EventManifest` Zod로 검증)
- `Ga4Connector` + `createGoogleGa4Client` + `resolveGa4Credentials` (connector-ga4, C-IMPL-001/C-002)
- 테스트는 fake backend 주입 — 실 GA4 미호출

## Producer / Consumer impact

- Produces: `/api/health` 라이브 응답 (AnalyticsHealthReport 계약 그대로), `resolveHealthDateRange()` (connector-ga4 신규 export)
- Consumes: `@metric-atlas/connector-ga4`, `@metric-atlas/contracts` — **runtime에 신규 의존성 추가**
- Affected consumers:
  - D Dashboard — 변경 불필요 (fixture fallback 로직 유지, 진짜 데이터가 오기 시작할 뿐)
  - A — runtime 의존성 추가 + 신규 env(`METRIC_ATLAS_GA4_HEALTH_WINDOW_DAYS`) 승인

## Allowed files

- `packages/runtime/**` (A+D 공동 소유 — **머지는 A 리뷰 필수**, C는 feature 브랜치 제안)
- `packages/connector-ga4/**` (C 소유 — dateRange 해석 유틸)
- `.env.example` 신규 변수 1건 (PR에서 A 확인)

## Forbidden files

- `packages/contracts/**` (계약 변경 없음 — AnalyticsHealthReport 그대로 사용)
- `apps/demo-react-vite/**` (D 소유, 변경 불필요)

## Contract impact

None — 응답은 기존 `AnalyticsHealthReport` 계약 그대로. 신규 env 변수 1건(`METRIC_ATLAS_GA4_HEALTH_WINDOW_DAYS`, 기본 30)은 계약이 아닌 운영 설정.

## Acceptance criteria

1. GA4 미설정(demo 모드) 환경에서 기존 동작 불변: 정적 `health.json` 서빙, 기존 테스트 전부 통과
2. GA4 설정 시 `/api/health`가 `buildAnalyticsHealthReport()` 결과를 반환
3. Health 관측 기간은 Property Reporting Time Zone 기준 최근 N일(기본 30) 절대 날짜로 계산 — timezone이 UTC와 날짜가 다른 시각에도 올바른 endDate
4. report 수준 TTL 캐시(기본 `METRIC_ATLAS_CACHE_TTL_SECONDS=300`) + in-flight dedup으로 동시/연속 요청이 GA4 재조회를 유발하지 않음
5. 라이브 조회 실패 시: 정적 `health.json`이 있으면 fallback, 없으면 502 + 에러 코드 (secret 미노출)
6. credential은 Node Runtime에서만 해석 (DEC-045), 응답·에러에 미포함
7. 전 로직 TDD (fake backend, 실 API 미호출)

## Tests

- connector-ga4: `resolveHealthDateRange` timezone 경계 (KST에서 UTC와 날짜가 갈리는 시각), windowDays 계산
- runtime unit: 미설정 → null / 설정 → report / TTL 캐시 / in-flight dedup / manifest 오류 / 연결 실패
- runtime 통합: 라이브 200, 실패 fallback, 실패+파일 없음 502, 기존 정적 경로 회귀 없음

## Performance / Security

- GA4 호출 상한: report 캐시 TTL당 (이벤트 수 + 1(listObservedEventNames) + 1(customDimensions, propertyId 캐시) + 1(timezone, 캐시)) 회
- 에러 메시지에 credential 값 미포함, runtime-health의 boolean-only 노출 관례 유지

## Deliverables

1. 구현 + 테스트
2. `.env.example` `METRIC_ATLAS_GA4_HEALTH_WINDOW_DAYS` 추가
3. Handoff + PR (A 리뷰 필수: 방식 승인, 의존성 추가, env 추가)

## Open decisions

- 라이브 조회 vs 빌드 아티팩트 — 본 태스크는 라이브+캐시로 제안, **A 승인 대기** (PR draft로 제출)
- Health 관측 window 기본 30일의 적정성 — 2차 Spike 후 재검토 가능
