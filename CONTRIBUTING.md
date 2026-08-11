# Contributing to Metric Atlas

## Local Quickstart

```bash
pnpm install
pnpm demo
```

Demo Mode는 실제 GA4 Credential 없이 Fixture를 사용합니다.

## 작업 원칙

- Task Spec 없이 큰 변경을 시작하지 않습니다.
- 공통 계약 변경은 ADR이 필요합니다.
- 지원 패턴 추가 시 Fixture와 Detector 문서를 같이 추가합니다.
- 사용자 소스파일을 수정하는 방식은 허용하지 않습니다.
- 새 Connector는 `AnalyticsConnector` 계약을 구현해야 합니다.

## PR 완료 조건

- Unit / Fixture / Contract Test 통과
- 관련 문서 갱신
- 성능 영향 기록
- Secret 노출 검사
- Handoff 작성

## Public Release

라이선스와 Semantic Versioning 정책은 공개 릴리스 전 팀이 최종 확정합니다. 기본 제안은 permissive OSS license와 SemVer입니다.
