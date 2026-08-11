# AGENTS.md — AI 및 개발자 공통 실행 규칙

## 1. 작업 전 필수 확인

1. `docs/00-project-source-of-truth.md`
2. `docs/15-decision-log.md`
3. `docs/04-system-architecture.md`
4. `docs/08-contracts-and-schema.md`
5. Phase 0 계약 작업이면 `docs/20-phase-0-common-fields.md`
6. 담당 기능 문서
7. `docs/12-team-rnr.md`
8. `docs/13-collaboration-workflow.md`
9. 해당 Task Spec

문서가 충돌하면 임의 구현하지 않습니다. 구현 이후 계약에 관한 최종 Machine SoT는 `packages/contracts`의 Zod Schema입니다.

## 2. 제품 원칙

- 사용자 소스파일을 직접 수정하지 않습니다.
- JSX 주입은 빌드 결과에만 수행합니다.
- 원본 이벤트명을 자동 번역하거나 영구 의미로 재정의하지 않습니다.
- `data-atlas-id`는 현재 빌드 DOM 매칭 전용이며 영구 링크 ID로 사용하지 않습니다.
- 논리 이벤트 키는 `(analyticsProvider, eventName)`을 기본으로 합니다.
- `dataLayer.push(...)`는 GTM Emitter이며 목적 Provider를 임의 추론하지 않습니다.
- 소문자 JSX 태그인 네이티브 요소에만 기본 주입합니다.
- 대문자 Custom Component, Fragment, Portal은 MVP 오버레이 주입 대상이 아닙니다.
- Custom Component의 이벤트 탐지 결과 자체는 대시보드에서 삭제하지 않습니다.
- 래퍼 경유 추적 호출은 MVP 공식 지원 대상이 아닙니다.
- SDK import는 있으나 직접 호출이 0건이면 래퍼 가능성을 경고합니다.
- GA4 자동 수집·Enhanced Measurement 이벤트는 일반 Data-only 이벤트와 구분합니다.
- 여러 Provider의 수치를 자동 합산하지 않습니다.
- GA4 Result Status와 Data Quality Flag를 분리합니다.
- GA4 기본 시간대는 해당 Property의 Reporting Time Zone입니다.
- Secret을 브라우저 번들, `VITE_*`, localStorage, Git, 로그에 저장하지 않습니다.
- Database를 추가하지 않습니다.
- 자연어 기능은 Core MVP 완료를 막지 않습니다.

## 3. Phase 0 병렬개발 원칙

Pre-Phase 0에서는 B/C/D가 자기 Domain의 Contract Input을 조사·제안하고 A가 충돌을 조정합니다. 제안은 A 승인 전까지 Shared Contract가 아닙니다.

Phase 0은 상세 구현 고정이 아니라 **B/C/D가 Mock으로 동시에 출발 가능한 기준선 확정**이 목적입니다.

필수 기준선:

- 최소 Zod Contract
- `fixtures/mock-manifest.json`
- `fixtures/mock-ga4-health.json`
- `fixtures/mock-query-result.json`
- Runtime API Mock
- Demo App Shell
- Package Skeleton

A가 모든 코어를 구현할 때까지 다른 담당자가 기다리는 구조를 만들지 않습니다.

## 4. 계약 변경

공통 계약 변경 전 `templates/adr.md`를 작성합니다.

반드시 포함:

- 변경 이유
- Producer 영향
- Consumer 영향
- 호환성
- 마이그레이션
- 계약 테스트

## 5. 금지 사항

- API Secret을 `VITE_*`로 전달
- GA4와 GTM을 동일 개념으로 처리
- 존재하지 않는 Event를 LLM이 만들어 조회
- 최근 GA4 결과 없음 = 구현 오류로 단정
- 미지원 패턴을 조용히 무시
- 기능 담당자가 공유 계약을 독단 변경
- 테스트 실패를 완료로 보고

## 6. 완료 보고

- 구현 범위
- 미완료 범위
- 변경 파일
- 계약 영향
- Producer/Consumer 영향
- 테스트 결과
- 성능 영향
- 보안 영향
- 알려진 한계
- 재현 명령
- Handoff
