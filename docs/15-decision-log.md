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

## DEC-048 — Reserved Parameter & GA4 Managed Event Registry accepted
- Date: 2026-08-19
- Status: Accepted
- Decision: GA4 Spike(C-SPIKE-001) §5 실측(`getMetadata` 매칭으로 `builtin` 판정 불가)에 근거해 `connector-ga4` 내부에 버전관리되는 Reserved Parameter Registry와 GA4 Managed Event Registry를 둔다. `packages/contracts`의 `ParameterState`/`Ga4ManagedState` enum은 변경 없음. ADR-005.

## DEC-049 — GA4 Health defaults and reviewReason codes finalized
- Date: 2026-08-19
- Status: Accepted
- Decision: Health 관측 기간/Cache TTL/outbound concurrency 기본값을 Spike 실측 근거로 유지한다. `subjectToThresholding`/`dataLossFromOtherRow` 필드 부재는 `false`로 해석한다. `reviewReason`은 기존 Dashboard(`apps/demo-react-vite/src/labels.ts`의 `REVIEW_KO`)가 이미 소비하는 `parameter_registration_gap`/`code_only_recent_data` 두 코드만 사용하고 그 외는 `null`로 둔다 (quality flag는 `reviewReason`과 무관하게 `qualityFlags` 배열로 별도 전달). ADR-006. ADR-001/DEC-034가 보류했던 4개 항목을 이것으로 확정 종료.

## DEC-050 — GA4 observed-event listing via dedicated connector method
- Date: 2026-08-19
- Status: Accepted
- Decision: "GA4 only" Health 판정을 위한 이벤트 이름 목록 조회는 `AnalyticsConnector.listObservedEventNames()` 전용 메서드로 추가한다 (`Ga4ObservedEventsResult` 신규, `ConnectorCapabilities.eventListingSupport` 추가). `ProviderAgnosticQuery`/`NormalizedAnalyticsResult`를 breakdown 모드로 일반화하는 대안은 YAGNI로 보류한다. ADR-007.

## DEC-051 — GA4 Analytics Health Report producer chain complete for detected + GA4-only paths
- Date: 2026-08-19
- Status: Accepted
- Decision: `packages/connector-ga4`에 `buildAnalyticsHealthReport()` 조립 함수가 Manifest(GA4 scope, DEC-033) + Connector 쿼리 결과 + Custom Dimension Lookup + Managed Event Registry + `listObservedEventNames()`를 엮어 `AnalyticsHealthReport`를 생성한다. `classifyHealthItemBucket`(packages/contracts)으로 summary를 재계산하고 Manifest `DYNAMIC_EVENT_NAME` warning을 `unresolved`에 합산한다 (docs/20 §5). PR #21/#22(→#23)로 구현·검증 완료. 이 함수를 호출해 `.metric-atlas/health.json`을 실제로 생성/제공하는 Runtime 통합은 후속 작업(A+C).

## DEC-052 — MIT License adopted ahead of public release
- Date: 2026-08-20
- Status: Accepted
- Decision: `docs/18` §4(Public Release Gate)가 요구하는 License 결정을 MIT로 확정한다. `LICENSE` 파일 추가, `package.json`/`packages/vite/package.json`에 `"license": "MIT"` 반영, README/CONTRIBUTING 양 언어본에 명시. SemVer 정책·보안 공개 절차·Maintainer 목록·Release cadence는 아직 미확정으로 남겨둔다 — public 전환 자체를 막지 않되, `docs/18` §4의 나머지 항목은 후속 결정 필요.

## DEC-053 — Semantic Versioning policy adopted for published packages
- Date: 2026-08-20
- Status: Accepted
- Decision: 공개 배포되는 `@metric-atlas/*` 패키지(현재 `@metric-atlas/vite`, ADR-008)는 Lockstep 버전으로 관리한다. 1.0 이전(`0.x.y`)에는 Minor(`0.X.0`)에서도 Breaking Change를 허용하고 Patch(`0.x.Y`)는 하위 호환 수정만 포함한다. 1.0.0은 `docs/02` MVP Core 성공 기준 7개 항목과 `docs/18` §4 Public Release Gate 5개 항목이 모두 닫힌 뒤 컷한다. 1.0 이후에는 표준 SemVer(Major/Minor/Patch)를 따른다. 외부에 독립 배포되지 않는 워크스페이스 전용 패키지(`packages/contracts` 등)는 이 정책 대상이 아니며 `main`을 그대로 따른다. A 제안, `docs/18` §4.

## DEC-054 — Release cadence adopted: continuous, no fixed calendar schedule
- Date: 2026-08-20
- Status: Accepted
- Decision: Phase 6(정식 npm 배포) 이전에는 고정 주기 없이 `main` 반영 시 `dist/vite-plugin` 브랜치가 지속적으로 재빌드되는 현재 체계(`.github/workflows/publish-vite-plugin-dist.yml`)를 그대로 유지한다. Phase 6 이후에는 공개 패키지에 영향을 주는 PR이 머지될 때마다 배포하는 PR-triggered Continuous Release를 기본으로 하고, 고정 주기(주간/월간)는 채택하지 않는다. 보안 수정은 정규 배포와 무관하게 즉시 배포한다. A 제안, `docs/18` §4. 4인 팀 규모에서 전담 Release 관리 없이 예측 가능한 배포를 유지하기 위한 선택이며, 소비자 피드백에 따라 Phase 6 착수 시 재검토할 수 있다.

## DEC-055 — Security disclosure path: SECURITY.md with limgh2002@gmail.com
- Date: 2026-08-20
- Status: Accepted
- Decision: `docs/18` §4가 요구하는 보안 공개 절차를 `SECURITY.md`/`SECURITY.ko.md`로 확정한다. 신고 접수 채널은 `limgh2002@gmail.com`(A)이며, 공개 GitHub Issue 대신 이메일로 비공개 신고하도록 안내한다. 접수 후 영업일 기준 5일 이내 확인 회신을 목표로 한다.

## DEC-056 — Maintainer list published with real GitHub accounts
- Date: 2026-08-20
- Status: Accepted
- Decision: `docs/18` §4가 요구하는 Maintainer 목록을 `MAINTAINERS.md`/`MAINTAINERS.ko.md`로 공개한다. A(`@limgahyun`)/B(`@westofsky`)/C(`@woogisea`)/D(`@enjoylonelines`)의 실제 GitHub 계정을 `docs/12` R&R과 함께 명시한다. 이에 맞춰 `.github/CODEOWNERS`의 placeholder(`@member-a/b/c/d`)를 실제 계정으로 교체해 GitHub CODEOWNERS 자동 리뷰 요청 기능이 실제로 동작하도록 수정한다.

이로써 `docs/18` §4 Public Release Gate 5개 항목(License/SemVer/보안 공개 절차/Maintainer 목록/Release cadence)이 모두 확정되었다.

## DEC-057 — Third-party dependency license notice published (contest §8 compliance)
- Date: 2026-08-21
- Status: Accepted
- Decision: 2026년 오픈소스 개발자대회 운영규정 제8조⑤⑥(활용한 오픈소스 라이브러리·프레임워크의 출처·라이선스 명시 의무)을 충족하기 위해 `THIRD-PARTY-NOTICES.md`/`THIRD-PARTY-NOTICES.ko.md`를 추가한다. 전체 워크스페이스 의존성 그래프(`pnpm licenses list`)를 라이선스별로 정리했으며, GPL/AGPL 등 MIT와 충돌하는 Copyleft 라이선스는 없음을 확인했다. 재생성 방법과 스캔 범위를 문서 상단에 명시한다. FOSSA 등 외부 SaaS 스캐너는 계정 생성이 필요해 채택하지 않았고, 저장소 내 정적 파일로 공개 의무를 충족한다.
