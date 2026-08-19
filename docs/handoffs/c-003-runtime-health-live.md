# Handoff — C-003 Runtime `/api/health` 라이브 GA4 연결

## Summary

C-002 handoff의 핵심 공백을 해소: `/__metric-atlas/api/health`가 GA4 구성 환경에서 `buildAnalyticsHealthReport()`를 실제로 호출한다. **라이브 조회 + TTL 캐시** 방식으로 구현 (A 승인 요청 항목 — 빌드 아티팩트 방식 대비 배포 없이 데이터 갱신). 이것으로 실 Property Analytics Health 실측이 가능해짐.

## Implemented

- `connector-ga4`: `resolveHealthDateRange()` — Property Reporting Time Zone 기준 최근 N일 절대 dateRange 계산 (KST/UTC 날짜 경계 테스트 포함). preset 미지원 한계를 Runtime에서 흡수.
- `runtime`: `createLiveHealthProvider()` — env 판정(PROPERTY_ID + credential 있을 때만 활성), manifest Zod 검증, testConnection → timezone → dateRange → customDimensions → report 조립. **report 수준 TTL 캐시(기본 300s) + in-flight dedup, 실패는 캐시 안 함.**
- `runtime` `/api/health` 라우트: 라이브 성공 → 200 report / 라이브 실패 → 정적 `health.json` fallback / 둘 다 없으면 → 502 + `HealthLiveError.code` (secret 미노출)
- demo 모드(GA4 미설정) 동작 불변 — 기존 테스트 전부 통과.

## Not implemented

- `/api/connectors/:provider/query` 등 나머지 미구현 envelope (DEC-046 기재 그대로)
- 관측 window preset화/사용자 지정 기간 — env 고정값(기본 30일)만
- Dashboard의 라이브/정적 출처 구분 표시 (D 판단 사항)

## Changed files

- `packages/connector-ga4/src/health-date-range.ts` (신규) + index export
- `packages/runtime/src/health-live.ts` (신규), `server.ts` (라우트/DI), `index.ts` (export), `package.json`·`tsconfig.json` (**connector-ga4/connector-sdk/contracts 의존성 추가**)
- `.env.example`, `.env.metric-atlas.example` — `METRIC_ATLAS_GA4_HEALTH_WINDOW_DAYS=30` 신규
- `docs/tasks/c-003-runtime-health-live.md` (Task Spec)

## Contract impact

None — 응답은 기존 `AnalyticsHealthReport` 계약 그대로. 신규 env 1건은 운영 설정.

## Producer / Consumer impact

- A: runtime 의존성 추가 + 라이브 방식 + 신규 env 승인 필요 (runtime은 A+D 공동 소유, DEC-047)
- D: Dashboard 변경 불필요 — `/api/health`가 진짜 데이터를 반환하기 시작. 502 응답의 `error.code` 표시는 선택적 개선
- C: 2차 Spike를 이 경로로 실측 가능해짐

## How to run

```bash
pnpm install && pnpm build && pnpm test   # 155 tests
# 실 GA4: .env.metric-atlas에 PROPERTY_ID + credential 설정 후
# metric-atlas serve ./dist → GET /__metric-atlas/api/health
```

## Tests

신규 21개 (date-range 6, health-live 11, server-live 4) 전부 TDD로 RED 확인 후 구현. 전체 155/155, typecheck 통과. 실 API 미호출(fake backend).

## Performance

GA4 호출 상한: 캐시 TTL(300s)당 [GA4 이벤트 수 × runReport + listEventNames 1 + listCustomDimensions 1(property 캐시) + getProperty 1(캐시)]. Spike 실측 기준 토큰 ~1/call이라 일 한도의 <0.1%.

## Security

- credential은 `createLiveHealthProvider` 내부에서만 해석 (DEC-045)
- 502 에러 메시지에 secret 미포함, `HealthLiveError` 코드만 구조화 노출

## Known limitations

- Ga4Connector의 per-query `withCache`는 이 경로에서 미사용 — report 캐시가 상위에서 흡수. Event Detail용 개별 query 경로가 생기면 재검토
- timezone 조회 실패 시 `ga4_error`로 fail (빈 timezone으로 잘못된 dateRange를 만들지 않음)

## Integration actions

1. **A**: 라이브+캐시 방식, runtime 의존성 추가, `METRIC_ATLAS_GA4_HEALTH_WINDOW_DAYS` env 승인 (PR draft)
2. **C(본인)**: 머지 후 실 Property로 `/api/health` 실측 → 2차 Spike 결과에 반영
3. **D**: 필요 시 Dashboard에 502 `error.code` 안내 표시 검토
