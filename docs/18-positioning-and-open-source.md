# 18. Positioning and Open-source Direction

## 1. 무엇과 다른가

기존 Analytics Governance / Tracking Plan 계열 도구는 사람이 이벤트 정의를 먼저 작성하고 구현을 검증하는 방향이 많습니다.

Metric Atlas의 핵심 방향은 반대입니다.

```text
Existing Implementation
→ Discover
→ Bind to UI
→ Compare with GA4
→ Surface Health
```

## 2. 핵심 차별점

1. 코드의 실제 Event Call 자동 발견
2. Event Call ↔ 화면 요소 자동 연결
3. Code ↔ GA4 실측 대조
4. Code Parameter ↔ GA4 Custom Dimension 등록 대조
5. PR 단계 이벤트 변경 전달

## 3. 사내 Self-hosting과 OSS

서로 충돌하지 않습니다.

- Production usage: internal self-hosted
- Evaluation / contributor workflow: Local Demo Mode
- Extension: Detector / Connector adapter

## 4. Public Release Gate

공개 릴리스 전에 확정해야 하는 별도 운영 결정:
- License
- Semantic Versioning policy
- Security disclosure path
- Maintainer list
- Release cadence

기본 권장 방향은 permissive license + SemVer이며, 대회/조직 정책 확인 후 확정합니다.
