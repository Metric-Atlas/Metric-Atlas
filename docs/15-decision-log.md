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
- Status: Proposed
- Decision: B/C/D가 Domain Contract Input을 조사·제안하고 A가 충돌을 조정한 뒤 Contract v0와 Fixture set을 승인한다.
- Note: A 승인 전까지 `docs/20-phase-0-common-fields.md`와 관련 필드 변경은 제안 상태이다.
