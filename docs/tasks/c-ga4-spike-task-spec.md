# Task Spec

- Task ID: C-SPIKE-001
- Owner: 재욱 (Member C)
- Branch: `feature/ga4-health/ga4-data-api-spike`
- Related docs: `docs/17-ga4-spike-plan.md`, `docs/06-feature-2-analytics-health-ga4.md`, `docs/08-contracts-and-schema.md`, `docs/20-phase-0-common-fields.md`, `docs/contract-inputs/c-phase0-common-fields-review.md`
- Related decisions: DEC-013 (GA4 first Connector), DEC-018 (Funnel 제외), DEC-023 (Result Status / Quality Flag 분리), DEC-026 (Pre-Phase 0 Contract Inputs)

## Goal

Phase 0 계약 v1 Freeze 전에 GA4 Data API / Admin API의 실제 동작을 실 Property로 검증하고, Health 판정 규칙·DataQualityFlag 매핑·기본 설정값의 실측 근거를 확보한다. 결과는 `docs/spikes/ga4-data-api-result.md`에 기록하고, C Contract Input 2차분(계약 변경 제안)의 근거로 사용한다.

검증 항목 (docs/17 §1):

1. `eventName` dimension + `eventCount` metric 조회 (`runReport`)
2. Property의 Reporting Time Zone 획득 및 dateRange 경계가 해당 timezone 기준으로 해석되는지 확인
3. Response Metadata에서 thresholding(`dataLossFromOtherRow` 외 `schemaRestrictionResponse`/`subjectToThresholding` 계열) 구분 가능 여부
4. `(other)` row / data loss metadata 확인
5. 실 Property의 최근 데이터 지연 체감 측정 (intraday 반영 시점)
6. Admin/Metadata API로 Custom Dimension 목록 + built-in dimension 목록 조회 → `builtin | registered_custom_dimension | not_registered | unknown` 판정 가능성 확인
7. API quota/token 소비량과 호출 latency 측정
8. Service Account 최소 권한(Viewer, 대상 Property 한정) 구성으로 위 항목 전부 동작하는지 확인

`runFunnelReport`는 검증하지 않는다 (DEC-018).

## Inputs / Mocks

- 테스트용 GA4 Property ID + 트래픽이 있는 실 데이터 (⛔ 선행 조건 — 아래 Open decisions)
- 대상 Property에 Viewer 권한으로 추가된 Service Account JSON
- `GOOGLE_APPLICATION_CREDENTIALS` 로컬 환경변수 (`.env.example` 방식 A)
- Mock 미사용 — 본 태스크는 실 API 검증이 목적

## Producer / Consumer impact

- Produces: `docs/spikes/ga4-data-api-result.md` (Spike 결과), Contract 변경 제안 목록, 기본값 조정 제안 (`METRIC_ATLAS_GA4_RECENT_WINDOW_HOURS`, Cache TTL, outbound concurrency)
- Consumes: GA4 Data API (`runReport`, metadata), GA4 Admin API (customDimensions list), Property metadata
- Affected consumers:
  - A(가현) — Contract v1 Freeze 판단, Decision Log 갱신, `.env.example` 기본값
  - C(재욱) 본인 — Health 판정 규칙, DataQualityFlag 매핑, Cache 설계
  - D(호범) — Quality Flag별 UI 문구(docs/03 §6), no_rows 표시 규칙

## Allowed files

- `docs/spikes/**` (결과 문서)
- `spikes/ga4/**` (일회성 검증 스크립트 — 프로덕션 코드 아님, 패키지 빌드에 포함하지 않음)
- `.env.example` 변경 제안은 결과 문서에 기록만 (직접 수정 금지)

## Forbidden files

- `fixtures/**` (계약 승인 전 fixture 교체 금지 — docs/20 §8)
- `docs/20-phase-0-common-fields.md`, `docs/08-contracts-and-schema.md`, `docs/15-decision-log.md` (A 승인 영역)
- `packages/**` (프로덕션 구현은 별도 태스크)
- Service Account JSON, `.env` 등 credential 파일 일체 (커밋 금지)

## Contract impact

**None → 제안 생성.** Spike 자체는 계약을 변경하지 않는다. 결과로 도출되는 계약 변경 제안(예: DataQualityFlag 세분화, QueryResult 필드 조정)은 결과 문서에 기록하고, A 채택 시 별도 ADR로 진행한다 (docs/17 §4).

## Acceptance criteria

1. 검증 항목 1~8 각각에 대해 성공/실패/부분확인이 결과 문서에 기록됨
2. 응답 예시가 민감정보(Property 실명, 실 수치 식별 가능 정보) 제거 후 요약 첨부됨
3. latency(호출별 p50/max 체감치)와 quota 소비 관찰이 기록됨
4. thresholding·`(other)` 재현 여부가 기록됨 — **재현 불가 시 그 사실과 사유(예: Google Signals 미활성, 데이터량 부족)도 결과로 인정**
5. Custom Dimension 판정 4상태 매핑의 실현 가능성 결론이 명시됨
6. recent-data 안정화 관찰에 근거한 `METRIC_ATLAS_GA4_RECENT_WINDOW_HOURS` 기본값 유지/조정 제안이 포함됨
7. 계약 변경 제안 목록(없으면 "없음")이 포함됨
8. 최소 권한(Property 단위 Viewer)으로 전 항목 수행됨이 확인됨

## Tests

- 일회성 스크립트는 정식 테스트 스위트 대상 아님. 단 각 검증 항목의 **재현 명령**(스크립트 실행 커맨드 + 필요한 환경변수 이름)을 결과 문서에 기록
- 스크립트에 credential 경로 하드코딩 금지 (환경변수 참조만)

## Performance / Security

- Service Account는 대상 Property 1개, Viewer(읽기) 권한만
- 호출량은 quota 관찰에 필요한 최소로 제한 (무한 루프/대량 반복 금지)
- credential·raw 응답 원문을 repo, 로그, 결과 문서에 남기지 않음 (요약·마스킹만)
- Spike 중 확인한 quota 한도는 outbound concurrency 기본값(현재 4) 제안에 반영

## Deliverables

1. `docs/spikes/ga4-data-api-result.md` (docs/17 §3 산출물 형식)
2. `spikes/ga4/` 검증 스크립트 + 실행 방법
3. C Contract Input 2차분 요약 (계약 변경 제안 + 기본값 제안) — Daily Sync 또는 PR로 A에게 전달

## Open decisions

1. **어느 GA4 Property를 쓸 것인가** — 사내 기존 Property(실 트래픽, 지연·thresholding 관찰에 유리) vs 신규 테스트 Property(안전하지만 데이터 부족). 권한 요청 대상 확인 필요. → 가현님/사내 GA4 관리자
2. thresholding 재현이 안 될 경우 DataQualityFlag 매핑을 문서 근거(GA4 공식 문서)만으로 v1에 반영할지 → A 결정
3. Spike 스크립트 언어/의존성 — TypeScript + `@google-analytics/data`, `@google-analytics/admin` 공식 클라이언트 사용 제안 (추후 connector-ga4 구현과 동일 스택)
