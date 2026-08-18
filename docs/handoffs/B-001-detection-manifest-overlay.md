# Handoff — B-001 Detection / Manifest / Overlay

## Summary

B 소유 범위의 Contract Input, detector/manifest producer, Vite build transform, runtime overlay, scanner/PR diff CLI를 독립 실행 가능한 TypeScript workspace로 구현했습니다. Proposed shared field와 기존 Phase 0 fixture는 freeze하지 않았습니다.

## Implemented

- GA4 `gtag` / `sendGAEvent`와 GTM `dataLayer.push` direct detector
- Mixpanel / Meta / PostHog / Amplitude direct adapter
- 정적 eventName/parameter 추출과 dynamic/review warning
- inline/same-file handler reference의 native JSX exact binding
- Custom Component/Portal/기존 attribute 충돌의 non-silent warning
- build-scoped `atlasDomId`, occurrence-scoped provisional `implementationKey`
- source read-only scanner와 Vite output-only Babel transform
- Manifest summary/scan stats 및 dev manifest endpoint/build asset
- Shadow DOM Web Component launcher/overlay와 DOM coverage event
- Base/Head semantic manifest diff와 Markdown/JSON CLI
- Vite dev transform memory cache와 삭제/unlink 시 stale Manifest 제거
- 실제 React/Vite reference fixture의 Chromium Overlay E2E
- 200-file build overhead benchmark와 publish package dry-run

## Not implemented

- shared `packages/contracts` Zod schema와 기존 `fixtures/mock-*.json` 변경: A 승인 전이므로 제외
- 파일 간 call graph, wrapper event resolution, Custom Component/Portal injection: MVP 범위 밖
- GA4 connector/dashboard/query/demo/runtime server: C/D/A 소유
- 팀의 최종 reference/demo repository cold-build overhead 측정: D 소유 Demo App 미제공

## Changed files

- Root execution skeleton: `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig*.json`, `vitest.config.ts`, `playwright.config.ts`, `.gitignore`
- B packages: `packages/detector/**`, `packages/vite/**`, `packages/overlay/**`, `packages/cli/**`
- B documents: `docs/21-pre-phase-0-b-contract-input.md`, `docs/tasks/B-001-detection-manifest-overlay.md`
- Ownership: `.github/CODEOWNERS`

## Contract impact

- Shared contract 변경 없음.
- Proposed producer extension: `DetectedEvent.implementationKey`, `ElementBinding.implementationKeys`.
- Proposed warning codes: `DYNAMIC_PARAMETER_KEY`, `UNRESOLVED_EVENT_BINDING`, `PORTAL_OVERLAY_UNSUPPORTED`, `ATLAS_ATTRIBUTE_CONFLICT`.
- A가 채택할 경우 ADR + Zod schema + fixture + contract test 동시 변경 필요.

## Producer / Consumer impact

- B produces Event Manifest, transformed modules, DOM coverage, PR semantic diff.
- C는 logical event/provider/parameter를 Health 입력으로 소비할 수 있습니다.
- D는 original eventName/emitter/provider/source/overlay 상태를 Search/Detail에서 소비할 수 있습니다.
- B Overlay의 정확한 occurrence 연결은 Proposed `implementationKeys`에 의존합니다.
- A Runtime은 production manifest endpoint를 Vite plugin option과 연결해야 합니다.

## How to run

```bash
corepack pnpm install
corepack pnpm exec playwright install chromium
corepack pnpm typecheck
corepack pnpm test
corepack pnpm test:e2e
corepack pnpm benchmark:detection
node packages/cli/dist/bin.js scan --root . --include packages/detector/test/fixtures/supported.tsx --stdout
node packages/cli/dist/bin.js diff --base fixtures/mock-manifest.json --head fixtures/mock-manifest.json
```

## Tests

- TypeScript project build/typecheck: pass
- Vitest: 6 files, 14 tests pass (handoff 작성 시점; 최종 재실행 결과 우선)
- Playwright Chromium: 1 browser E2E pass
- Real Vite production build: manifest emit, transformed `data-atlas-id`, bundled overlay 확인
- Real React/Vite dev server: native DOM injection, unsupported warning, Overlay hover, runtime event, coverage 확인
- Scanner integration: include/exclude/stats/source non-mutation 확인
- CLI scan/diff smoke: pass
- 4개 publish package dry-run: exports/README/dist 구성 확인, `.tsbuildinfo` 제외

## Performance

- Scan은 include/exclude glob 후 파일별 단일 parse와 두 traversal을 사용하며 Vite session 내 동일 transform은 memory cache를 사용합니다.
- 200-file local reference build에서 baseline 약 390ms, Metric Atlas 약 638ms, absolute overhead 약 248ms로 2초 기준을 통과했습니다.
- 팀 최종 Demo App에서도 동일 명령으로 재측정해야 합니다.

## Security

- credential/secret 입력·저장·로그 경로 없음.
- `VITE_*` secret, localStorage, database 사용 없음.
- Overlay manifest 값은 DOM `textContent`로 렌더링합니다.
- Manifest dev endpoint는 same-origin/no-store이며 인증은 A Runtime 배포 경계의 책임입니다.

## Known limitations

- import alias와 cross-file handler/wrapper는 resolve하지 않습니다.
- static object에서 계산/전개된 parameter key는 warning 후 제외합니다.
- 동일 eventName이 여러 provider에 동시에 이동하는 모호한 PR diff는 add/remove로 남을 수 있습니다.
- 다른 emitter adapter의 default 활성화와 `unknown` provider summary 포함 여부는 A 결정 대기입니다.
- production overlay는 기본 `/__metric-atlas/api/manifest` endpoint가 필요합니다.

## Integration actions

1. A: `docs/21-pre-phase-0-b-contract-input.md`의 7개 결정 항목 검토/승인.
2. A: 채택 시 ADR, `packages/contracts` Zod schema, shared fixture, contract test를 함께 갱신.
3. A: Runtime manifest endpoint와 Vite `manifestEndpoint`를 통합.
4. C/D: 승인된 logical fields만 사용해 B manifest consumer test 추가.
5. D/A: demo/reference app에서 overlay DOM coverage와 build overhead 측정.
