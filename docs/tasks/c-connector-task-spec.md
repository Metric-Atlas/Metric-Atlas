# Task Spec

- Task ID: C-IMPL-001
- Owner: 재욱 (Member C)
- Branch: `feature/ga4-health/connector-ga4`
- Related docs: `docs/08-contracts-and-schema.md` (§5, §6), `docs/06-feature-2-analytics-health-ga4.md` (§4, §5, §8), `docs/09-security-and-secrets.md`, `docs/spikes/ga4-data-api-result.md`
- Related decisions: DEC-013, DEC-022, DEC-023, DEC-008

## Goal

`connector-sdk`의 `AnalyticsConnector` 계약 인터페이스와 `connector-ga4`의 GA4 호출 계층을 구현한다. Spike(C-SPIKE-001)에서 실측한 GA4 API 동작을 프로덕션 품질 코드로 승격한다.

계약 변동 노출을 최소화하기 위해 **docs/08 현행 기준선에 정의된 타입만** 구현하고, docs/20 Proposed 항목(HealthSummary 버킷 규칙 등)과 Health 판정 엔진은 범위에서 제외한다 (Phase 0 Freeze 후 별도 태스크).

## Inputs / Mocks

- docs/08 §5 (Connector Contract), §6 (NormalizedAnalyticsResult)
- Spike 실측 결론: no_rows = 정상응답 + rowCount 0 / `subjectToThresholding` 부재 = false / timezone은 Admin getProperty 1회
- 테스트는 GA4 클라이언트를 주입식(fake)으로 대체 — 실 API 호출 없음

## Producer / Consumer impact

- Produces: `packages/connector-sdk` (인터페이스), `packages/connector-ga4` (GA4 구현)
- Consumes: GA4 Data/Admin API (런타임), `GOOGLE_APPLICATION_CREDENTIALS` / `METRIC_ATLAS_GA4_SERVICE_ACCOUNT_JSON_BASE64` (방식 A/B)
- Affected consumers: C 자신의 analytics-health(후속), D의 Query 실행 경로, A의 Runtime 통합

## Allowed files

- `packages/connector-sdk/**`, `packages/connector-ga4/**` (CODEOWNERS상 C 소유)
- `pnpm-workspace.yaml`, 루트 `package.json` — **잠정(Provisional)**: A의 skeleton 조율 소유권을 인정하며, A 확정 시 그 구조를 따름

## Forbidden files

- `packages/contracts/**` (A 소유 — SDK 타입은 로컬 정의 후 Freeze 시 이관 주석 명시)
- `fixtures/**`, `docs/08`, `docs/20` (A 승인 영역)
- credential/.env 커밋 금지

## Contract impact

**None.** docs/08 현행 계약을 구현으로 옮기는 것이며 계약 자체를 변경하지 않음. 타입은 `connector-sdk`에 로컬 정의하고 `packages/contracts` Zod Schema 확정 시 이관한다.

## Acceptance criteria

1. `AnalyticsConnector` 인터페이스가 docs/08 §5 개념(ConnectorContext, ConnectionResult, ProviderAgnosticQuery, ConnectorCapabilities)을 모두 표현
2. credential 해석이 방식 A → B 우선순위로 동작하고, 둘 다 없으면 명확한 에러 (Secret 로깅 금지)
3. `testConnection`이 성공 시 reportingTimezone 반환, 권한 실패 시 `errorCode` 반환 (throw 아님)
4. `query`가 event_count/comparison을 지원하고 `NormalizedAnalyticsResult`로 정규화
5. Spike 결론 반영: rowCount 0 → `no_rows`, `subjectToThresholding` 부재 → flag 없음, 존재+true → flag, `dataLossFromOtherRow` true → flag
6. recent window(48h) 이내 종료일 조회 → `recent_data_may_change` flag
7. 전 로직 unit test 커버 (실 API 미호출), TDD로 작성

## Tests

- vitest, GA4 클라이언트 fake 주입
- docs/14 §4 중 connector 책임 케이스: no rows, thresholding metadata, other-row data loss, recent data warning, timezone

## Performance / Security

- credential은 Node 프로세스 메모리에만, 로그·에러 메시지에 미포함
- 클라이언트 인스턴스 재사용 (호출당 재생성 금지)
- rate/concurrency guard는 Runtime 계층 책임으로 이 태스크 범위 밖

## Deliverables

1. `packages/connector-sdk` + `packages/connector-ga4` (테스트 포함)
2. Handoff 문서 (통합 시 A가 알아야 할 것: workspace 잠정 구조, contracts 이관 대상 타입 목록)

## Open decisions

- 루트 workspace skeleton의 최종 구조 — A(가현) 확정 대기 (본 태스크는 잠정 구조로 진행)
- `ProviderAgnosticQuery`의 breakdowns/filters 상세 — Core MVP는 event_count/comparison만이므로 이번 범위에서는 타입만 정의, 실행은 미지원(`unsupported`) 처리
