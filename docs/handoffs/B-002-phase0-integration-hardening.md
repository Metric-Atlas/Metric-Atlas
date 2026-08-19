# Handoff — B-002 Phase 0 Integration Hardening

## 구현 범위

- C Connector Contract(ADR-003)과 A Runtime/D fallback(ADR-004)을 B 작업 브랜치 기준선에 통합
- `packages/detector`/`vite`/`overlay`/`cli`를 `@metric-atlas/contracts` Event Manifest 타입과 Zod validation으로 마이그레이션
- `implementationKey`/`implementationKeys`를 B Producer 타입에서 필수화
- DEC-037에 따라 기본 Detector를 GA4/GTM으로 제한하고 Vite/Scanner/CLI `detectors` opt-in 추가
- Vite 기본 Manifest 산출물을 ADR-004의 `.metric-atlas/manifest.json`으로 통일
- D Demo에 실제 Vite Plugin, GA4/GTM local-only showcase, Runtime Manifest + Fixture Health fallback 연결
- Demo Manifest/Health consumer를 shared Zod Contract validation으로 전환
- checkout을 변경하지 않는 `scanGitRef`와 `metric-atlas report --base-ref --head-ref` 추가
- GitHub Actions PR report, artifact, Job Summary, marker 기반 comment update 추가
- Detection Acceptance corpus와 실제 Demo build overhead/bundle/security benchmark 추가
- import alias, const propagation, `sendGAEvent`/`sendGTMEvent` 범위 후속 Contract Input 조사

## 미완료 범위

- import alias, same-file const eventName propagation, `sendGTMEvent`, `window.gtag` 지원은 A 결정 전이므로 구현하지 않음
- 실제 GA4 Analytics Health artifact 생성과 Query API는 C/A 소유이며 Demo는 Health fixture fallback 유지
- GitHub-hosted PR event에서 Workflow 실행은 PR 생성 후 확인 필요. 로컬에서는 Git ref CLI 통합 테스트와 YAML parse를 검증함
- GitHub fork PR에서는 write token 제한으로 comment step이 생략될 수 있으나 artifact와 Job Summary는 유지됨

## 변경 파일

- B packages: `packages/detector/**`, `packages/vite/**`, `packages/overlay/**`, `packages/cli/**`
- Demo integration: `apps/demo-react-vite/**`, `playwright.demo.config.ts`
- CI delivery: `.github/actions/analytics-report/action.yml`, `.github/workflows/metric-atlas-analytics-report.yml`, `.github/CODEOWNERS`
- Root execution: `package.json`, `pnpm-lock.yaml`
- Documents: `docs/19-pr-analytics-change-report.md`, `docs/21-pre-phase-0-b-contract-input.md`, `docs/tasks/B-002-phase0-integration-hardening.md`
- Integrated accepted work: ADR-003 Connector packages/contracts and ADR-004 Runtime/D fallback branch changes

## 계약 영향

- B 변경은 Compatible: Contract v0 필드/enum/fixture 의미 변경 없음
- `packages/contracts` Schema는 B가 수정하지 않았으며 C의 승인된 ADR-003 변경만 통합함
- 승인된 Manifest Schema가 B Producer와 Overlay/CLI/Demo trust boundary의 실제 validator가 됨
- shared `fixtures/mock-*.json` 변경 없음

## Producer / Consumer 영향

- B Producer: 모든 생성 Manifest가 Zod parse를 통과하며 GA4/GTM만 기본 탐지
- A Runtime: Vite와 CLI가 `.metric-atlas/manifest.json`을 생성하므로 `/__metric-atlas/api/manifest`와 경로 일치
- C Health: Event Manifest 구조 변화 없이 탐지 기본 집합이 공식 GA4/GTM 범위로 정렬됨
- D Demo/Search: Runtime Manifest를 우선 소비하고 invalid/unavailable 응답은 Fixture로 fallback
- A CI: Base/Head Git tree scan과 PR report를 reusable composite action으로 소비 가능

## 테스트 결과

- `corepack pnpm verify`: pass
  - TypeScript project build: pass
  - Vitest: 16 files, 87 tests pass
  - 기존 Overlay Playwright E2E: 1 pass
  - Demo Overlay/DOM coverage Playwright E2E: 1 pass, 2/2 DOM matched
  - Detection Acceptance: 21/21 detected, provider false positive 0%, exact binding 100%, unresolved 4.76%
  - Demo build/security benchmark: pass
- Demo production build: pass, `.metric-atlas/manifest.json`에 2 events 생성
- Local Node Runtime smoke: built Demo와 Manifest endpoint 응답 확인
- 실제 `origin/main` → `HEAD` Git-ref report smoke: Demo GA4/GTM 2 events added, warning 0
- GitHub Action/Workflow YAML parse: pass

## 성능 영향

- Demo 5회 median build: baseline 60.73ms, Metric Atlas 75.09ms, absolute overhead 14.36ms
- Demo scan: 14 files, 20.41ms, 2 events
- Browser JS delta: +6,629 bytes raw, +2,408 bytes gzip
- 10초 미만 build의 absolute overhead 2초 이하 기준 통과

## 보안 영향

- Demo browser bundle forbidden secret marker 0
- GitHub report job은 read-only token으로 untrusted Head를 처리하고 PR write 권한은 code execution 없는 별도 comment job으로 분리
- GitHub official actions는 major tag의 현재 commit SHA로 고정
- Report event/parameter 문자열의 newline/backtick을 Markdown에서 neutralize
- Scanner는 Git object를 직접 읽으며 checkout/source를 수정하지 않음
- Overlay/CLI/Demo Runtime 입력은 Zod validation 실패 시 거부 또는 fixture fallback

## 알려진 한계

- `scanGitRef`는 Git object의 source text를 분석하므로 LFS pointer가 checkout에서 materialize되는 저장소는 별도 대응이 필요함
- Build가 매우 짧아 relative overhead 비율은 변동성이 크며 acceptance는 문서 규칙대로 absolute 2초 기준을 사용함
- Zod Runtime validation과 Overlay로 Demo gzip bundle이 약 2.4KB 증가함
- PR comment는 60,000자로 제한하고 전체 report/manifests는 artifact에 보존함

## 재현 명령

```bash
corepack pnpm install
corepack pnpm verify
corepack pnpm acceptance:detection
corepack pnpm benchmark:demo
corepack pnpm --filter @metric-atlas/demo-react-vite build
node packages/cli/dist/bin.js report --root . --base-ref origin/main --head-ref HEAD --output /tmp/metric-atlas-report.md --manifest-dir /tmp/metric-atlas-manifests
node packages/cli/dist/bin.js serve apps/demo-react-vite/dist --host 127.0.0.1 --port 8791
```

## Handoff

1. A: ADR-003/ADR-004 통합과 `.metric-atlas/manifest.json` convention 최종 review
2. A: GitHub Workflow 권한/branch protection에 맞춰 report-only 또는 `fail-on-parse-error` 정책 선택
3. D: Demo showcase와 Runtime Manifest/Fixture Health 혼합 표시 UX review
4. C: 실제 Health Producer 연결 시 Demo `/__metric-atlas/api/health` artifact 교체 검증
5. A/B: `docs/21` §8의 alias/const/helper 지원 범위 결정 후 별도 Task/ADR 진행
