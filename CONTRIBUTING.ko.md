# Metric Atlas 기여 안내

[English](./CONTRIBUTING.md) · **한국어**

> 이 문서는 한국어 번역본입니다. 내용이 다를 경우 영어 `CONTRIBUTING.md`를 기준으로 합니다.

분석 이벤트 구현을 눈에 보이고, 검증 가능하며, 신뢰할 수 있게 만드는 데 함께해 주셔서 감사합니다.

## 로컬 빠른 시작

Node.js 22.18 이상이 필요합니다.

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm demo
```

Demo Mode는 Fixture를 사용하므로 실제 GA4 Credential이 필요하지 않습니다.

## 작업 전 확인

큰 변경을 시작하기 전에 [AGENTS.md](./AGENTS.md), Project Source of Truth, Decision Log, 관련 기능 문서와 해당 Task Spec을 읽어 주세요.

## 작업 원칙

- Task Spec 없이 큰 변경을 시작하지 않습니다.
- 공통 계약 변경은 ADR이 필요합니다.
- 지원 패턴 추가 시 Fixture와 Detector 문서를 같이 추가합니다.
- 사용자 소스파일을 수정하는 방식은 허용하지 않습니다.
- 새 Connector는 `AnalyticsConnector` 계약을 구현해야 합니다.
- 원본 이벤트명을 보존하고 GA4와 GTM의 의미를 구분합니다.
- Credential을 브라우저 번들, `VITE_*`, localStorage, Git 또는 로그에 노출하지 않습니다.

## PR 완료 조건

- Unit, Fixture와 Contract Test가 통과합니다.
- 관련 문서를 갱신합니다.
- 계약 변경의 Producer와 Consumer 영향을 기록합니다.
- 성능 영향을 기록합니다.
- Secret 노출 여부를 검사합니다.
- 알려진 한계를 기록합니다.
- Handoff를 작성합니다.

## 기여할 수 있는 영역

- Detector Fixture 및 추가 직접 SDK 패턴 지원
- 공유 계약을 따르는 Connector Adapter
- Overlay, Dashboard, 검색, 접근성과 개발자 경험 개선
- 미지원 또는 해결되지 않은 패턴의 재현 사례
- 문서, 예제와 번역
- Contract, 통합, E2E, 보안과 성능 테스트

## 공개 릴리스

[MIT](./LICENSE) 라이선스입니다. SemVer 정책과 Release cadence는 [`docs/18-positioning-and-open-source.md` §4](./docs/18-positioning-and-open-source.md#4-public-release-gate), 취약점 신고는 [`SECURITY.ko.md`](./SECURITY.ko.md), Maintainer 목록은 [`MAINTAINERS.ko.md`](./MAINTAINERS.ko.md), 오픈소스 의존성 라이선스 목록은 [`THIRD-PARTY-NOTICES.ko.md`](./THIRD-PARTY-NOTICES.ko.md)를 참고하세요.
