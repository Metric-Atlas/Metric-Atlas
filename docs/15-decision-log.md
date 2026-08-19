# 15. Decision Log

모든 Decision은 날짜, 상태, 대체 관계를 기록합니다.

Status:
- Proposed
- Accepted
- Superseded
- Rejected

## DEC-001 — React + Vite first
- Date: 2026-08-11
- Status: Accepted
- Decision: 최초 프레임워크는 React + Vite.

## DEC-002 — Source files remain untouched
- Date: 2026-08-11
- Status: Accepted
- Decision: 빌드 결과에만 `data-atlas-id` 주입.

## DEC-003 — Provider / emitter auto detection
- Date: 2026-08-11
- Status: Accepted

## DEC-004 — Original event names preserved
- Date: 2026-08-11
- Status: Accepted

## DEC-005 — Internal self-hosted production
- Date: 2026-08-11
- Status: Accepted

## DEC-006 — No database
- Date: 2026-08-11
- Status: Accepted

## DEC-007 — Mixpanel first Connector
- Date: 2026-08-10
- Status: Superseded
- Superseded by: DEC-013

## DEC-008 — Environment variables are canonical credentials
- Date: 2026-08-11
- Status: Accepted

## DEC-009 — Natural-language query retained
- Date: 2026-08-11
- Status: Accepted
- Note: Not a Core MVP Release Blocker.

## DEC-010 — Single Node Runtime
- Date: 2026-08-11
- Status: Accepted

## DEC-011 — No built-in employee authentication in MVP
- Date: 2026-08-11
- Status: Accepted

## DEC-012 — Local HMR excluded from user flow
- Date: 2026-08-10
- Status: Superseded
- Superseded by: DEC-019

## DEC-013 — GA4 first Connector
- Date: 2026-08-11
- Status: Accepted
- Supersedes: DEC-007
- Decision: 첫 실제 Analytics Connector는 GA4 Data/Admin API.

## DEC-014 — Analytics Health is Dashboard home
- Date: 2026-08-11
- Status: Accepted
- Decision: 발생 수 테이블보다 Code ↔ GA4 Health를 첫 화면으로 둠.

## DEC-015 — Internal launcher is overlay entry
- Date: 2026-08-11
- Status: Accepted

## DEC-016 — GTM dataLayer is not automatically GA4
- Date: 2026-08-11
- Status: Accepted

## DEC-017 — Custom Dimension gap is Core MVP
- Date: 2026-08-11
- Status: Accepted

## DEC-018 — GA4 funnel is out of Core MVP
- Date: 2026-08-11
- Status: Accepted

## DEC-019 — Local Demo Mode is officially supported
- Date: 2026-08-11
- Status: Accepted
- Supersedes: DEC-012 as developer/OSS policy
- Decision: 최종 사용자는 내부 배포를 사용하지만 개발·OSS 체험용 Local Demo를 공식 지원.

## DEC-020 — PR Analytics Change Report is a core delivery mechanism
- Date: 2026-08-11
- Status: Accepted

## DEC-021 — Phase 0 optimizes for parallel start
- Date: 2026-08-11
- Status: Accepted
- Decision: 상세 구현이 아니라 최소 contract + mock으로 B/C/D 동시 출발.

## DEC-022 — Zod is Machine Contract SoT
- Date: 2026-08-11
- Status: Accepted

## DEC-023 — GA4 result status and quality flags are separate
- Date: 2026-08-11
- Status: Accepted

## DEC-024 — atlasDomId and eventKey are separate
- Date: 2026-08-11
- Status: Accepted

## DEC-025 — Direct SDK calls define MVP coverage denominator
- Date: 2026-08-11
- Status: Accepted
- Decision: 래퍼는 MVP 공식 지원 밖이며 미탐지 가능성 경고를 제공.

## DEC-026 — Pre-Phase 0 Research & Contract Inputs
- Date: 2026-08-12
- Status: Accepted
- Decision: B/C/D가 Domain Contract Input을 조사·제안하고 A가 충돌을 조정한 뒤 Contract v0와 Fixture set을 승인한다.
- Note: 2026-08-18, ADR-001로 C(재욱)의 Contract Input(PR #1)을 근거로 Contract v0을 Freeze. B/D 입력은 미제출 상태이며 도착 시 충돌 항목은 후속 ADR로 조정.

## DEC-027 — implementationKey / implementationKeys are Contract v0 required fields
- Date: 2026-08-18
- Status: Accepted
- Decision: `DetectedEvent.implementationKey`, `ElementBinding.implementationKeys`를 필수 필드로 확정. ADR-001.

## DEC-028 — HealthSummary buckets are mutually exclusive with fixed priority
- Date: 2026-08-18
- Status: Accepted
- Decision: 각 Health Item은 `unresolved > parameterRegistrationGap > codeOnly > ga4Managed > ga4Only > healthy` 우선순위로 정확히 하나의 버킷에 속한다. ADR-001.

## DEC-029 — HealthSummary.unresolved definition
- Date: 2026-08-18
- Status: Accepted
- Decision: `unresolved` = (codeState 또는 ga4ObservationState가 unknown인 Health Item 수) + (Manifest `DYNAMIC_EVENT_NAME` Warning 건수). ADR-001.

## DEC-030 — Manifest parameters fully represented in Health parameter registration states
- Date: 2026-08-18
- Status: Accepted
- Decision: Manifest의 모든 Event Parameter는 대응 HealthItem에 등록 상태 항목을 가지며, 판정 불가 시 `unknown`을 사용한다. ADR-001.

## DEC-031 — QueryResult Producer is C
- Date: 2026-08-18
- Status: Accepted
- Decision: D는 QueryPlan Producer, C는 QueryResult Producer. ADR-001.

## DEC-032 — QueryResult.dateRange is resolved to absolute dates; comparisonDateRange added
- Date: 2026-08-18
- Status: Accepted
- Decision: `QueryResult.dateRange`는 Property Reporting Time Zone 기준 절대 날짜로 반환한다. `metricType="comparison"`이면 `comparisonDateRange`를 필수로 포함한다. ADR-001.

## DEC-033 — GA4 Analytics Health Report scoped to analyticsProvider="ga4"
- Date: 2026-08-18
- Status: Accepted
- Decision: `provider=unknown`인 GTM 이벤트는 GA4 Health 판정 대상에서 제외한다. ADR-001.

## DEC-034 — GA4 Health default windows and quality-flag mapping deferred to spike
- Date: 2026-08-18
- Status: Accepted
- Decision: Health 관측 기간 기본값, thresholding/`(other)` → DataQualityFlag 매핑, `no_rows` 문구 규칙, Cache TTL/concurrency 기본값은 GA4 Spike(C-SPIKE-001) 결과 이후 별도 ADR로 확정한다. Contract v0 구조 Freeze를 막지 않는다.

## DEC-035 — Workspace root toolchain baseline is B's configuration
- Date: 2026-08-18
- Status: Accepted
- Decision: PR #3(A)과 PR #4(B)가 각자 만든 루트 workspace 설정이 충돌하여, 이미 프로덕션 코드로 검증된 B의 구성(TS project references, NodeNext, 루트 vitest glob, pnpm@11.22.0)을 canonical로 채택한다. A의 `packages/contracts`를 그 구성에 맞춰 재작성한다. ADR-002.

## DEC-036 — Additional scan warning codes approved
- Date: 2026-08-18
- Status: Accepted
- Decision: B가 제안한 `DYNAMIC_PARAMETER_KEY`, `UNRESOLVED_EVENT_BINDING`, `PORTAL_OVERLAY_UNSUPPORTED`, `ATLAS_ATTRIBUTE_CONFLICT`를 Warning Code 목록에 추가한다. ADR-002.

## DEC-037 — Non-GA4/GTM detector adapters default to opt-in
- Date: 2026-08-18
- Status: Accepted
- Decision: Mixpanel/Meta/PostHog/Amplitude 어댑터는 기본 비활성화이며 Vite Plugin Config로 명시적으로 켜야 한다. MVP 공식 지원은 GA4/GTM. ADR-002.

## DEC-038 — Manifest summaries.analyticsProviders includes "unknown"
- Date: 2026-08-18
- Status: Accepted
- Decision: `analyticsProvider="unknown"`인 이벤트도 `summaries.analyticsProviders` 집계에 포함한다. ADR-002.

## DEC-039 — B provisional manifest fields promoted to Contract v0
- Date: 2026-08-18
- Status: Accepted
- Decision: B의 Contract Input(PR #4)을 Contract v0에 통합했다. `packages/detector` 등이 `@metric-atlas/contracts`를 실제로 의존하도록 마이그레이션하는 작업은 B 소유의 후속 PR로 진행한다. ADR-002.

## DEC-040 — ProviderAgnosticQuery.comparisonRange approved
- Date: 2026-08-18
- Status: Accepted
- Decision: `metric="comparison"`일 때 `comparisonRange`를 필수로 확정한다. `QueryPlan.comparisonRange`와 대응된다. ADR-003.

## DEC-041 — GA4 Connector contract codified in packages/contracts
- Date: 2026-08-18
- Status: Accepted
- Decision: `ConnectorContext`/`ConnectionResult`/`ProviderAgnosticQuery`/`ConnectorCapabilities`/`NormalizedAnalyticsResult`/`AnalyticsConnector`를 `packages/contracts`에 Zod/TS로 코드화한다. `connector-sdk`는 re-export barrel로 전환한다. ADR-003.

## DEC-042 — NormalizedAnalyticsResult and QueryResult are distinct layers
- Date: 2026-08-18
- Status: Accepted
- Decision: `NormalizedAnalyticsResult`는 Connector 실행 결과(eventKey optional, providerMetadata 포함 가능), `QueryResult`는 D에 노출되는 결과 envelope(eventKey 필수, providerMetadata 없음)로 구분한다. C가 변환 책임을 진다. ADR-003.

## DEC-043 — comparisonDateRange/comparisonRange required only when resultStatus="ok"
- Date: 2026-08-18
- Status: Accepted
- Decision: ADR-001의 "metricType=comparison이면 comparisonDateRange 필수" 규칙을 보정한다. `resultStatus`가 `ok`가 아니면 비교 기간이 없어도 된다. `QueryResult`와 `NormalizedAnalyticsResult` 양쪽에 적용. ADR-003.

## DEC-044 — DateRange discriminated union bug fix
- Date: 2026-08-18
- Status: Accepted
- Decision: `packages/contracts`의 `DateRange` Zod Schema가 `docs/20`에 문서화된 `never`-typed 판별 유니온 형태와 다르게 구현되어 있던 것을 수정한다. 계약 필드 변경이 아니라 코드-문서 정합성 버그 수정이다. ADR-003.

## DEC-045 — Local Node Runtime is the default execution model
- Date: 2026-08-19
- Status: Accepted
- Decision: Browser UI → Metric Atlas Node Runtime → GA4/LLM API 흐름을 기본으로 확정한다. GA4/LLM credential은 Node Runtime에서만 resolve하며 브라우저 bundle에 노출하지 않는다. ADR-004 (D 제안, A 승인). PR #11(`packages/runtime` 최소 서버, `metric-atlas serve`), PR #12(demo dashboard runtime→fixture fallback)로 구현·검증됨 (path traversal 방어, credential boolean-only 노출 확인).

## DEC-046 — Runtime API envelope updated with implemented endpoints
- Date: 2026-08-19
- Status: Accepted
- Decision: `docs/08` §9의 Runtime API Envelope에 실제 구현된 `/api/runtime-health`, `/api/llm/generate`(501 fail-closed)를 추가하고, `/api/health`(Analytics Health artifact)와 `/api/runtime-health`(Runtime 자체 상태)를 별개 개념으로 구분한다. `/api/providers`, `/api/connectors/:provider/*`, `/api/query`는 아직 미구현으로 표시한다. ADR-004.

## DEC-047 — packages/runtime co-owned by A and D
- Date: 2026-08-19
- Status: Accepted
- Decision: `docs/04`상 Runtime은 A 통합 영역이지만 D가 최초 구현을 담당했으므로 CODEOWNERS에 `packages/runtime`을 A+D 공동 소유로 등록한다.
