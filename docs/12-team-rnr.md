# 12. Team R&R — 4명

## Member A — Contract Approver & Integration Lead

A의 핵심 책임은 **모든 코어를 구현하는 것**이 아니라 병렬 개발 기준선과 통합을 책임지는 것입니다.

소유:
- package/repo skeleton coordination
- shared contracts approval
- runtime API envelope
- integration branch
- CI/release integration
- decision log

Pre-Phase 0에서는 B/C/D가 제출한 Domain Contract Input을 통합하고, 필드 의미·Producer/Consumer 책임·Fixture 충돌을 조정해 Contract v0 후보를 승인합니다.

A가 병목이 되지 않도록 B/C/D는 Mock으로 독립 개발합니다.

## Member B — Detection, Manifest, Overlay

소유:
- detector core
- GA4 / GTM detector
- other detector adapters
- Babel transform
- same-file JSX binding
- manifest real producer
- `data-atlas-id`
- launcher / overlay
- scanner CLI used by PR Report

Pre-Phase 0 Domain Contract Input:
- MVP Detector와 Binding 지원 범위
- unsupported/unresolved 및 Warning 기준
- Event Manifest 최소 필드와 ID 관계
- C/D가 소비할 Parameter/Provider/Source 정보
- 필요한 Detection/Manifest Fixture

## Member C — GA4 Connector & Analytics Health Dashboard

소유:
- connector SDK implementation feedback
- GA4 Data API
- GA4 Admin/Metadata integration
- custom dimension gap
- GA4 managed event registry
- analytics health engine
- dashboard
- event detail / comparison
- cache

Pre-Phase 0 Domain Contract Input:
- GA4 Data/Admin API 가능 여부
- Health State, Quality Flag, Managed Event 기준
- Custom Dimension 및 no-rows 처리
- 필요한 GA4/Health Fixture

## Member D — Search, Natural Language, OSS DX / QA

소유:
- local/fuzzy event search
- LLM adapter
- query plan
- natural-language UI
- demo app / pattern showcase
- user docs / README
- cross-feature QA assistance

기능 3이 Core Release Blocker가 아니므로 D는 Demo/QA/OSS DX도 핵심 책임으로 가집니다.

Pre-Phase 0 Domain Contract Input:
- Search/Detail/Query/Demo가 소비할 최소 필드
- 사용자에게 노출할 상태와 근거 정보
- Query Result 및 Demo Fixture 요구사항

## Shared Artifact Responsibility

| Artifact | Producer | Approver/Integrator | Consumers |
|---|---|---|---|
| Contract v0/v1 | domain owner proposal | A | all |
| Event Manifest | B | A | B/C/D |
| GA4 Result | C | A contract review | C/D |
| Analytics Health | C | A integration | C/D |
| Query Plan | D | A + C review | C/D |
| PR Diff | B scanner | A CI | developers |
| Demo Fixtures | feature owner | A schema review | all |
