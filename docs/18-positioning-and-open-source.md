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

공개 릴리스 전에 확정해야 하는 별도 운영 결정과 현재 상태:

- **License** — MIT로 확정 (`LICENSE`). DEC-052.
- **Semantic Versioning policy** — 확정 (제안). 공개 배포되는 `@metric-atlas/*` 패키지(현재 `@metric-atlas/vite`, ADR-008)는 Lockstep 버전으로 관리한다. 1.0 이전(`0.x.y`)에는 Minor(`0.X.0`)에서도 Breaking Change가 가능하고 Patch(`0.x.Y`)는 하위 호환 수정만 포함한다. 1.0.0은 `docs/02` MVP Core Release Blocker 7개 항목과 본 §4의 5개 항목이 모두 닫힌 뒤 컷한다. 1.0 이후에는 표준 SemVer(Major/Minor/Patch)를 따른다. `packages/contracts` 등 외부에 독립 배포되지 않는 워크스페이스 전용 패키지는 이 정책 대상이 아니며 `main`을 그대로 따른다. DEC-053.
- **Security disclosure path** — 확정. `SECURITY.md`/`SECURITY.ko.md`, 연락처 `limgh2002@gmail.com`. DEC-054.
- **Maintainer list** — 확정. `MAINTAINERS.md`/`MAINTAINERS.ko.md`, `.github/CODEOWNERS`(실제 GitHub 계정 반영). DEC-055.
- **Release cadence** — 확정 (제안). Phase 6(정식 npm 배포) 이전에는 고정 주기 없이 `main` 반영 시 `dist/vite-plugin` 브랜치가 지속적으로(Continuous) 재빌드된다(`.github/workflows/publish-vite-plugin-dist.yml`). Phase 6 이후에는 공개 패키지에 영향을 주는 PR이 머지될 때마다 배포하는 PR-triggered Continuous Release를 기본으로 하며, 고정 주기(주간/월간)는 채택하지 않는다. 보안 수정은 정규 주기와 무관하게 즉시 배포한다. DEC-056.

License/Security/Maintainer는 확정 결정이며, SemVer/Release cadence는 A가 제안한 정책으로 Phase 6 착수 시 재검토할 수 있다.
