# Handoff — C-IMPL-001 connector-sdk / connector-ga4

## Summary

`AnalyticsConnector` 계약 인터페이스(connector-sdk)와 GA4 호출 계층(connector-ga4) 구현. Spike(C-SPIKE-001) 실측 결론을 프로덕션 코드로 승격. TDD로 작성 (테스트 23개 전부 RED 확인 후 구현).

## Implemented

- `@metric-atlas/connector-sdk`: docs/08 §5·§6 타입 (ConnectorContext, ConnectionResult, ProviderAgnosticQuery, ConnectorCapabilities, NormalizedAnalyticsResult 등)
- `@metric-atlas/connector-ga4`:
  - credential 해석 — 방식 A(`GOOGLE_APPLICATION_CREDENTIALS`) → 방식 B(base64) 우선순위, 에러 메시지에 secret 미노출
  - `Ga4Connector` — testConnection(권한 오류 시 errorCode 반환, throw 안 함), query(event_count/comparison), timezone 1회 조회 후 캐시
  - Quality Flag 매핑 — `subjectToThresholding` **부재=false** 해석(Spike §4), `dataLossFromOtherRow`, recent window(48h) 판정
  - no_rows 판정 — 정상응답 + rowCount 0 (Spike §3)
  - `createGoogleGa4Client` — 실 API 어댑터 (Spike 스크립트로 실측 검증된 호출 형태)

## Not implemented

- DateRange **preset 해석** (`last_30_days` 등) — Property timezone 기준 날짜 계산 필요, `unsupported` 반환. 후속 태스크
- breakdowns/filters 실행 — 타입만 정의, `unsupported`
- Health 판정 엔진, 캐시(TTL/dedup), rate guard — Phase 0 Freeze 후 별도 태스크
- Runtime API 연결 — A의 envelope 통합 시점에

## Changed files

- `packages/connector-sdk/**`, `packages/connector-ga4/**` (신규)
- `pnpm-workspace.yaml`, 루트 `package.json`, `.gitignore` (신규 — **잠정**)

## Contract impact

None — docs/08 현행 계약의 구현. 단 `ProviderAgnosticQuery.comparisonRange` 필드를 추가함 (docs/08 §5에 명시 안 된 항목이나 QueryPlan.comparisonRange와 대응, comparison metric 실행에 필요). **A 확인 요청** — 승인 시 contracts 반영, 거부 시 별도 설계.

## Producer / Consumer impact

- connector-sdk 타입은 `packages/contracts` Zod Freeze 시 이관 대상 (파일 헤더에 명시)
- D의 Query 실행 경로가 `Ga4Connector.query`를 소비하게 됨
- A: 루트 workspace 구조는 잠정 — skeleton 확정 시 이 구조를 덮어써도 packages 내부는 영향 없음

## How to run

```bash
pnpm install
pnpm -r test        # connector-ga4 23 tests
pnpm -r typecheck
```

## Tests

23/23 통과 (credential 5, quality-flags 7, connector 11). 실 API 미호출(fake 주입). docs/14 §4 중 connector 책임 케이스(no rows, thresholding, other-row, recent warning, timezone) 커버.

## Performance

클라이언트 인스턴스 재사용, timezone Property당 1회 조회 후 캐시. 추가 오버헤드 없음.

## Security

credential은 env에서만 해석, 로그·에러 메시지 미노출 (테스트로 검증). `.env` gitignore.

## Known limitations

- preset 미해석 (위 Not implemented)
- gRPC 오류 코드 매핑은 7(PERMISSION_DENIED)/16(UNAUTHENTICATED)만 unauthorized 처리, 나머지는 error
- `getPropertyTimezone` 실패 시 timezone 빈 문자열로 응답에 포함됨 — Runtime 통합 시 정책 결정 필요

## Integration actions

1. A: workspace skeleton 확정 여부 회신 (잠정 구조 유지 or 교체)
2. A: `comparisonRange` 필드 계약 반영 여부 결정
3. Phase 0 Freeze 후: connector-sdk 타입 → packages/contracts 이관
