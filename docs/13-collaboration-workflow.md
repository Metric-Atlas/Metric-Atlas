# 13. Collaboration Workflow

## 1. 시작 순서

### Step 0 — Pre-Phase 0 Research & Contract Inputs (Proposed)

B/C/D가 각 담당 영역을 조사하고 다음 형식으로 Contract Input을 제출합니다.

- 조사한 사실
- 계약에 반영해야 할 조건
- 아직 불확실한 조건
- 필요한 Fixture/Mock
- 영향을 받는 Consumer
- A 결정이 필요한 항목

A는 입력을 통합하고 Producer/Consumer 충돌을 조정합니다. Domain Input Owner의 제안은 A 승인 전까지 Shared Contract가 아닙니다.

### Step 1 — Phase 0 Baseline
A가 Repo Skeleton을 조율하고 승인 후보인 최소 계약과 Fixture를 반영합니다.

### Step 2 — Contract Snapshot
A가 `docs/20-phase-0-common-fields.md`, Contract v0, Fixture set을 함께 승인하고 Freeze합니다.

### Step 3 — Parallel Work
B/C/D는 동시에 개발합니다.

## 2. Branch

```text
main
integration/milestone-N
feature/detection-overlay/*
feature/ga4-health/*
feature/query-ossdx/*
chore/contracts/*
```

## 3. Task

모든 큰 작업은 `templates/task-spec.md`에서 시작합니다.

## 4. Contract Change

변경 전 ADR에 반드시 Producer/Consumer 영향을 적습니다.

계약 변경은 Domain Owner가 제안할 수 있지만 A 승인 없이 shared schema에 병합하지 않습니다.

Pre-Phase 0 Contract Input은 조사·제안 문서이므로 그 자체로 Freeze된 계약을 변경하지 않습니다. A가 제안을 채택할 때 ADR, Zod Schema, Fixture, Contract Test를 함께 갱신합니다.

## 5. Review

- B PR → A contract/integration, D UX/demo review
- C PR → A runtime/security, D UX review
- D PR → C connector semantics, A contract review
- A PR → B/C 중 최소 1인 리뷰

## 6. Handoff

작업 완료 시:
- 구현
- 미구현
- contract impact
- test result
- perf/security impact
- next integration actions

을 기록합니다.
