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

Node Runtime이 `/__metric-atlas/dashboard`(변경 가능)에서 서빙하는 첫 화면은 단순 이벤트 카운트가 아니라 **Code ↔ GA4 Health**입니다.

- 코드에는 있는데 GA4에서 관측되지 않는 이벤트
- GA4에는 있는데 코드에서 발견되지 않는 이벤트
- GA4 자동 수집·Enhanced Measurement로 관리되는 이벤트
- 코드에서 전송하지만 GA4 Custom Dimension으로 등록되지 않은 커스텀 파라미터
- 정상적으로 코드와 GA4가 연결된 이벤트
- Data Quality Flag가 있어 판정에 주의가 필요한 이벤트

이벤트 발생 수와 기간 비교는 Event Detail에서 제공합니다. Dashboard는 `@metric-atlas/runtime`에 내장되어 배포됩니다 — 아래 "Analytics Health Dashboard" 섹션 참고.

### 3. Natural Language Query

OpenRouter API Key를 Runtime 서버에 설정하면 이벤트와 GA4 결과를 자연어로 조회할 수 있습니다.

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

`@metric-atlas/vite`는 npm에 publish되어 있습니다.

```bash
npm install -D @metric-atlas/vite
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
    }),
    react(),
  ],
});
```

```bash
METRIC_ATLAS_ENABLED=true npm run build
```

Vercel 같은 배포 환경에서는 `METRIC_ATLAS_ENABLED=true`를 Preview 환경변수로만 등록하면 production 빌드에는 영향이 없습니다.

`@metric-atlas/vite`는 Event Overlay(코드 쪽 배지)만 담당합니다. `dashboard` 옵션은 없습니다 — Analytics Health Dashboard는 별개로 Node Runtime이 서빙합니다. 아래 "Analytics Health Dashboard" 섹션 참고.

### `main`을 직접 추적하기 (고급)

위 npm publish가 있기 전에는 이 레포가 `dist/vite-plugin` 브랜치를 유지해서 Git으로 직접 설치할 수 있는 번들 빌드를 제공했습니다(`docs/adr/ADR-008-standalone-vite-plugin-distribution.md` 참고). 이 브랜치는 지금도 `main` 푸시마다 자동으로 재빌드되고 계속 동작하며, 다음 npm 버전보다 앞선 미배포 변경사항이 필요한 경우에만 씁니다:

```bash
npm install "github:Metric-Atlas/Metric-Atlas#dist/vite-plugin"
```

일반적인 용도로는 위 npm install을 쓰세요 — `main`에 뭐가 올라와 있는지가 아니라 실제로 릴리스된 버전을 받게 됩니다.

## GA4 인증

Analytics Health는 Node Runtime이 필요합니다. 브라우저가 GA4를 직접 조회하지 않습니다.
GA4 인증 정보는 Runtime 환경에 설정한 뒤 CLI 서버를 실행합니다.

### 로컬 Runtime

서비스 계정 JSON은 레포 밖에 보관합니다.

```bash
mkdir -p ~/secure
mv ~/Downloads/service-account.json ~/secure/metric-atlas-reader.json
chmod 600 ~/secure/metric-atlas-reader.json
```

로컬 Runtime용 env 파일을 만듭니다.

```bash
cat > .env.metric-atlas <<'EOF'
METRIC_ATLAS_GA4_PROPERTY_ID=123456789
GOOGLE_APPLICATION_CREDENTIALS=/Users/YOUR_NAME/secure/metric-atlas-reader.json
METRIC_ATLAS_GA4_HEALTH_WINDOW_DAYS=30
METRIC_ATLAS_GA4_RECENT_WINDOW_HOURS=48
METRIC_ATLAS_CACHE_TTL_SECONDS=300
EOF
```

또는 CLI로 같은 Runtime env 파일을 만들 수 있습니다. LLM key는 커맨드 인자에 직접 쓰지 말고, 현재 셸의 환경변수에서 읽게 합니다.

```bash
export OPENROUTER_API_KEY=<YOUR_LLM_KEY>

npx metric-atlas init-env \
  --output ./.env.metric-atlas \
  --ga4-property-id 123456789 \
  --google-application-credentials /Users/YOUR_NAME/secure/metric-atlas-reader.json \
  --llm-provider openrouter \
  --llm-base-url https://openrouter.ai/api/v1 \
  --llm-model openrouter/free \
  --llm-api-key-env OPENROUTER_API_KEY
```

이미 만든 Runtime env 파일에 LLM key만 등록하거나 교체할 수도 있습니다.

```bash
npx metric-atlas set-llm-key \
  --env ./.env.metric-atlas \
  --key <YOUR_LLM_KEY> \
  --provider openrouter \
  --base-url https://openrouter.ai/api/v1 \
  --model openrouter/free
```

셸 히스토리에 key를 남기고 싶지 않으면 stdin 또는 환경변수 방식을 씁니다.

```bash
printf '%s' "$OPENROUTER_API_KEY" | npx metric-atlas set-llm-key \
  --env ./.env.metric-atlas \
  --key-stdin \
  --provider openrouter \
  --base-url https://openrouter.ai/api/v1 \
  --model openrouter/free
```

Runtime CLI를 설치하고, Metric Atlas가 적용된 앱을 빌드한 뒤 Runtime을 실행합니다.

```bash
npm install -D @metric-atlas/cli
METRIC_ATLAS_ENABLED=true npm run build
npx metric-atlas serve ./dist --env ./.env.metric-atlas --host 127.0.0.1 --port 8787
```

Runtime API를 확인합니다.

```bash
curl http://127.0.0.1:8787/__metric-atlas/api/runtime-health
curl http://127.0.0.1:8787/__metric-atlas/api/manifest
curl http://127.0.0.1:8787/__metric-atlas/api/health
```

### 배포 Runtime

운영 환경에서는 같은 값을 배포 플랫폼의 Secret 또는 Environment Variable CLI로 등록합니다.
`.env.metric-atlas`는 Git에 커밋하지 않습니다.

배포 환경이 Secret File을 지원하면 다음 값을 설정합니다.

```bash
METRIC_ATLAS_GA4_PROPERTY_ID=123456789
GOOGLE_APPLICATION_CREDENTIALS=/secure/path/metric-atlas-reader.json
```

배포 환경이 문자열 환경변수만 지원하면 JSON을 base64로 저장합니다.

```bash
base64 -i ~/secure/metric-atlas-reader.json | pbcopy
```

배포 플랫폼에 다음 Secret을 등록합니다.

```bash
METRIC_ATLAS_GA4_PROPERTY_ID=123456789
METRIC_ATLAS_GA4_SERVICE_ACCOUNT_JSON_BASE64=<PASTE_BASE64_VALUE>
```

서버 시작 명령에서 키를 복원한 뒤 Runtime을 실행합니다.

```bash
echo "$METRIC_ATLAS_GA4_SERVICE_ACCOUNT_JSON_BASE64" | base64 -d > /tmp/metric-atlas-ga4.json
export GOOGLE_APPLICATION_CREDENTIALS=/tmp/metric-atlas-ga4.json
npx metric-atlas serve ./dist --host 0.0.0.0 --port "$PORT"
```

서비스 계정은 대상 GA4 Property에 필요한 최소 읽기 권한으로 추가해야 합니다.
GA4/LLM 인증 정보는 `VITE_*`, 브라우저 저장소, 소스 코드, 빌드 산출물, 로그에 넣지 않습니다.

## Analytics Health Dashboard

Dashboard는 별도로 설치하는 패키지도, Vite Plugin 옵션도 아닙니다 — `@metric-atlas/runtime`에 내장되어 있고, GA4 credential을 설정한 뒤(위 섹션) `metric-atlas serve`로 Runtime을 배포하면 함께 서빙됩니다. GA4 조회는 credential을 쥔 살아있는 서버가 필요해서, 정적 `vite build` 산출물만으로는 애초에 대시보드를 띄울 방법이 없습니다(`docs/adr/ADR-009-runtime-embedded-analytics-health-dashboard.md` 참고).

```bash
npx metric-atlas serve ./dist --env ./.env.metric-atlas --host 127.0.0.1 --port 8787
```

`http://127.0.0.1:8787/__metric-atlas/api/runtime-health`로 credential이 정상 로드됐는지 확인한 뒤, 대시보드를 엽니다:

```text
http://127.0.0.1:8787/__metric-atlas/dashboard
```

자기 사이트에 이미 그 경로가 있어서 충돌하면 옮길 수 있습니다:

```bash
npx metric-atlas serve ./dist --env ./.env.metric-atlas --dashboard-path /my-dashboard
```

별도 설치 단계나 Metric-Atlas가 운영하는 공유 대시보드 서비스는 없습니다 — 각 배포는 이 프로젝트의 나머지 보안 모델(`docs/09-security-and-secrets.md`)과 동일하게 자기 GA4 credential로 self-host됩니다. Runtime을 공개 URL로 배포하면 그 URL을 아는 누구나 대시보드를 볼 수 있습니다(credential 자체는 아니지만 이벤트명/카운트/GA4 관측 상태는 노출) — 필요하면 네트워크나 호스팅 플랫폼 레벨에서 접근을 제한하세요.

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
