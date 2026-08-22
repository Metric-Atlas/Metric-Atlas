# Metric Atlas

[English](./README.md) · **한국어**

> 이 문서는 한국어 번역본입니다. 내용이 다를 경우 영어 `README.md`를 기준으로 합니다.

Metric Atlas는 React·Vite 프로젝트의 분석 이벤트를 **코드 위치·화면 요소·GA4 실측 데이터와 연결**하는 오픈소스 개발 도구입니다.

핵심 가치는 GA4 대시보드를 다시 만드는 것이 아니라, **코드에는 무엇이 구현되어 있고 실제 분석 데이터에는 무엇이 관측되는지를 자동 대조하여 Analytics Health를 보여주는 것**입니다.

## 핵심 기능

### 1. Event Overlay

빌드 시 AST를 분석해 `gtag(...)`, `sendGAEvent(...)`, `dataLayer.push(...)` 등 지원 패턴을 찾고, 이벤트가 연결된 네이티브 JSX 요소에 빌드 결과에서만 `data-atlas-id`를 주입합니다.

사내 배포 화면의 Metric Atlas 런처를 켠 뒤 버튼·링크를 호버하면 다음을 확인할 수 있습니다.

- 원본 이벤트명
- Tracking Emitter / Analytics Provider
- 코드 파일과 위치
- 이벤트 파라미터
- 바인딩 상태

`dataLayer.push(...)`는 GTM 호출로 탐지하며 GA4로 단정하지 않습니다.

### 2. Analytics Health Dashboard

`/event-dashboard`의 첫 화면은 단순 이벤트 카운트가 아니라 **Code ↔ GA4 Health**입니다.

- 코드에는 있는데 GA4에서 관측되지 않는 이벤트
- GA4에는 있는데 코드에서 발견되지 않는 이벤트
- GA4 자동 수집·Enhanced Measurement로 관리되는 이벤트
- 코드에서 전송하지만 GA4 Custom Dimension으로 등록되지 않은 커스텀 파라미터
- 정상적으로 코드와 GA4가 연결된 이벤트
- Data Quality Flag가 있어 판정에 주의가 필요한 이벤트

이벤트 발생 수와 기간 비교는 Event Detail에서 제공합니다.

### 3. Natural Language Query

사내 LLM 또는 OpenAI-compatible LLM을 연결하면 이벤트와 GA4 결과를 자연어로 조회할 수 있습니다.

이 기능은 **Core MVP의 Release Blocker가 아닙니다.** LLM이 없어도 이벤트 검색·Provider 필터·파일 위치 조회·Analytics Health는 동작합니다.

### 4. PR Analytics Change Report

GitHub Actions에서 Base Commit과 Head Commit을 각각 스캔하여 PR에 이벤트 변경을 전달합니다.

- 추가된 이벤트
- 삭제된 이벤트
- Tracking Emitter / Provider 변경
- 동적 이벤트
- 지원되지 않는 래퍼 가능성
- `unresolved` 증가

별도의 DB나 이전 매니페스트 저장소 없이 Git Commit을 기준선으로 사용합니다.

## 제품 포지셔닝

Tracking Plan을 사람이 먼저 정의하고 코드와 검증하는 도구와 달리, Metric Atlas의 출발점은 **이미 존재하는 코드**입니다.

```text
Existing Code
→ Event Detection
→ UI Binding
→ GA4 Observation
→ Analytics Health
→ Search / Query
```

Metric Atlas는 이벤트 승인·거버넌스 SaaS, BI, GA4 대체재가 아닙니다.

## 기술 방향

- Node.js + TypeScript
- React + Vite 우선 지원
- pnpm Workspace
- Vite Plugin API
- Babel AST
- 필요 시 TypeScript Compiler API 확장
- Web Component + Shadow DOM Overlay
- GA4 Data API / Admin API Connector
- Single Node Runtime
- Database 없음
- 인메모리 캐시
- 사내 자체 호스팅
- 개발·OSS 체험용 Local Demo Mode 공식 지원

## 빠른 체험

Node.js 22.18 이상이 필요합니다. API Key 없이 Demo Fixture로 Event Overlay와 Analytics Health를 체험할 수 있습니다.

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm demo
```

Demo 앱은 다음 지원·미지원 패턴을 한 화면에서 보여줍니다.

- `gtag` 인라인
- 같은 파일 핸들러
- `dataLayer.push`
- 래퍼 경유 호출 — MVP 미지원
- Custom Component — 이벤트는 탐지하되 오버레이 미지원
- 동적 이벤트명 — `unresolved`

## 사용자 프로젝트 설치

이 프로젝트는 아직 `@metric-atlas/vite`를 npm에 publish하지 않았습니다(SemVer/레지스트리 릴리스는 이후 OSS 단계에서 계획됨). 그 전까지는 이 레포의 `dist/vite-plugin` 브랜치에서 설치합니다 — 내부 `@metric-atlas/*` 패키지가 이미 번들된 독립 실행 가능한 빌드입니다(`docs/adr/ADR-008-standalone-vite-plugin-distribution.md` 참고):

```bash
npm install "github:Metric-Atlas/Metric-Atlas#dist/vite-plugin"
```

```ts
// vite.config.ts
import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react";

async function metricAtlasPlugin(): Promise<PluginOption[]> {
  if (process.env.METRIC_ATLAS_ENABLED !== "true") return [];
  const { default: metricAtlas } = await import("@metric-atlas/vite");
  return [metricAtlas({ enabled: true, overlay: { enabled: true } })];
}

export default defineConfig(async () => ({
  plugins: [...(await metricAtlasPlugin()), react()],
}));
```

```bash
METRIC_ATLAS_ENABLED=true npm run build
```

Vercel 같은 배포 환경에서는 `METRIC_ATLAS_ENABLED=true`를 Preview 환경변수로만 등록하면 production 빌드에는 영향이 없습니다. 위 동적 `import()`는 패키지가 설치되지 않은 경우에도 의존성을 선택적으로 유지합니다.

`dist/vite-plugin` 브랜치는 `packages/{contracts,detector,overlay,vite}`를 건드리는 `main` 푸시마다 자동으로 재빌드됩니다(`.github/workflows/publish-vite-plugin-dist.yml` 참고). SemVer 범위가 아니라 브랜치 참조이므로 `npm update`로 새 커밋을 자동으로 받아오지 않습니다 — 해당 브랜치 참조로 `npm install`을 다시 실행하거나, 재현 가능한 설치를 원하면 커밋 SHA를 고정하세요(`#dist/vite-plugin@<sha>`).

### 이 레포가 레지스트리에 publish된 이후

```bash
corepack pnpm add -D @metric-atlas/vite
corepack pnpm add @metric-atlas/runtime
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import metricAtlas from "@metric-atlas/vite";

export default defineConfig({
  plugins: [
    metricAtlas({
      enabled: process.env.METRIC_ATLAS_ENABLED === "true",
      include: ["src/**/*.{js,jsx,ts,tsx}"],
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/*.test.*",
        "**/*.spec.*",
        "**/*.stories.*",
      ],
      overlay: { enabled: true },
      dashboard: { enabled: true, path: "/event-dashboard" },
    }),
    react(),
  ],
});
```

## GA4 인증

정식 운영에서는 환경변수·Secret Manager를 사용합니다.

권장 우선순위:

1. `GOOGLE_APPLICATION_CREDENTIALS`
2. `METRIC_ATLAS_GA4_SERVICE_ACCOUNT_JSON_BASE64`
3. `METRIC_ATLAS_MODE=internal`이며 임시 입력이 명시적으로 허용된 경우 Runtime 메모리 입력

서비스 계정은 대상 GA4 Property에 필요한 최소 읽기 권한으로 추가해야 합니다.

## 문서 읽기 순서

1. `AGENTS.md`
2. `docs/00-project-source-of-truth.md`
3. `docs/15-decision-log.md`
4. `docs/04-system-architecture.md`
5. `docs/08-contracts-and-schema.md`
6. Phase 0 계약 작업이면 `docs/20-phase-0-common-fields.md`
7. 담당 기능 문서
8. `docs/12-team-rnr.md`
9. `docs/13-collaboration-workflow.md`
10. `docs/14-testing-and-acceptance.md`

## Source of Truth

- 사람이 읽는 제품 SoT: `docs/00-project-source-of-truth.md`
- 확정 의사결정 SoT: `docs/15-decision-log.md`
- 구현 이후 Machine Contract SoT: `packages/contracts`의 Zod Schema
- 통합 Markdown은 전달용 편의본이며 SoT가 아닙니다.

## 기여하기

기여를 환영합니다. 변경을 시작하기 전에 [기여 안내](./CONTRIBUTING.ko.md) 또는 [English guide](./CONTRIBUTING.md)를 읽어 주세요.

## 라이선스

[MIT](./LICENSE). 공개 배포되는 `@metric-atlas/*` 패키지는 [Semantic Versioning](./docs/18-positioning-and-open-source.md#4-public-release-gate) 정책을 따릅니다(1.0 이전에는 Minor 버전에서도 Breaking Change 가능). 취약점 신고는 [`SECURITY.ko.md`](./SECURITY.ko.md), Maintainer 목록은 [`MAINTAINERS.ko.md`](./MAINTAINERS.ko.md), 이 프로젝트가 사용하는 오픈소스 의존성의 라이선스 목록은 [`THIRD-PARTY-NOTICES.ko.md`](./THIRD-PARTY-NOTICES.ko.md)를 참고하세요.
