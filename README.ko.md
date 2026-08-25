# Metric Atlas

[English](./README.md) · **한국어**

[![npm](https://img.shields.io/npm/v/%40metric-atlas%2Fvite?label=%40metric-atlas%2Fvite)](https://www.npmjs.com/package/@metric-atlas/vite)
[![license](https://img.shields.io/github/license/Metric-Atlas/Metric-Atlas)](./LICENSE)
[![node](https://img.shields.io/badge/node-%E2%89%A522.18-brightgreen)](#퀵스타트)

**코드 속 분석 이벤트가 어디에 구현되어 있고, 화면 어느 요소에 연결되어 있으며, GA4에서 실제로 관측되는지 — 자동으로 보여줍니다.**

Metric Atlas는 GA4 대시보드를 다시 만드는 도구가 아닙니다. **코드에 구현된 것**과 **분석 데이터에서 관측되는 것**을 자동 대조해 그 결과를 *Analytics Health*로 보여줍니다.

![요소에 호버하면 이벤트명·코드 위치·파라미터가 보입니다](./docs/assets/overlay-hover.gif)

**▶ [라이브 데모](https://metric-atlas-homepage.fly.dev/)** — 우측 하단 `MA` 런처를 켜고 버튼에 호버해보세요.

## 왜 필요한가

- 이벤트 정보가 코드·문서·분석 콘솔에 흩어져 있고, 코드가 바뀌는 순간 문서는 낡습니다.
- 비개발자는 어느 화면 요소가 어떤 이벤트를 쏘는지 알 수 없어 개발자에게 반복해서 묻게 됩니다.
- 코드에 이벤트가 있다고 GA4에 도착한다는 보장이 없고, GA4에 데이터가 있다고 코드에 구현이 남아 있다는 보장도 없습니다.

Metric Atlas의 출발점은 **이미 존재하는 구현**입니다:

```text
Existing Code → Event Detection → UI Binding → GA4 Observation → Analytics Health
```

## 핵심 기능

### 🔍 Event Overlay — 서버 불필요

빌드 시 AST를 분석해 지원 패턴(`gtag(...)`, `sendGAEvent(...)`, `dataLayer.push(...)`, `mixpanel.track(...)`)을 찾고, **빌드 결과에만** `data-atlas-id`를 주입합니다 — 원본 소스는 절대 수정하지 않습니다. 배포된 화면에서 런처를 켜고 요소에 호버하면 이벤트명, Emitter/Provider, 코드 파일·행, 파라미터를 확인할 수 있습니다.

`dataLayer.push(...)`는 GTM 호출로 탐지하며 GA4로 단정하지 않습니다.

### 📊 Analytics Health Dashboard

Node Runtime이 `/__metric-atlas/dashboard`에서 서빙합니다. 첫 화면은 단순 카운트 테이블이 아니라 **Code ↔ GA4 대조**입니다:

- 코드에는 있는데 GA4에서 관측되지 않는 이벤트 (데이터 품질 주의 플래그와 함께 — 섣불리 "버그"로 단정하지 않음);
- GA4에서 관측되지만 코드에 없는 이벤트 — GA4 자동 수집 이벤트는 별도 분류되어 목록을 오염시키지 않음;
- 코드가 보내지만 **GA4 Custom Dimension으로 등록되지 않은** 커스텀 파라미터 (보고서에서 안 보이는 값);
- 정상 연결된 이벤트, 이벤트별 발생 수와 기간 비교.

### 🤖 자연어 질의 *(선택)*

이벤트에 대해 자연어로 질문할 수 있습니다. 답변은 대시보드가 보여주는 것과 같은 Health 근거(코드 상태, GA4 관측 여부, 최근 발생 수)에 기반하므로, 근거 없이 "정상 수집 중"이라고 단정하지 않습니다. Runtime 환경에 키를 설정하면 됩니다 — OpenAI 또는 Anthropic, `metric-atlas init-env`나 `metric-atlas set-llm-key`로 설정 (아래 [LLM 설정](#자연어-질의-설정-llm-선택) 참고). 검색·필터·Health는 LLM 없이도 전부 동작합니다.

### ✅ PR Analytics Change Report — 서버 불필요

GitHub Actions가 base/head 커밋을 재스캔해 PR마다 이벤트 변경을 코멘트합니다. Git이 기준선이라 DB가 필요 없습니다.

```text
Metric Atlas Analytics Change

+ Added events: 3
- Removed events: 1
~ Changed emitter/provider: 0
! Dynamic/unresolved: 2
! Possible wrapper usage: 1
```

## 퀵스타트

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
      overlay: { enabled: true },
    }),
    react(),
  ],
});
```

```bash
METRIC_ATLAS_ENABLED=true npm run build
```

Overlay는 이게 전부입니다 — 빌드 결과물은 완전한 정적 파일이라 어디에나 배포할 수 있습니다. Vercel 같은 호스트에서는 Preview 환경에만 플래그를 켜서 production 빌드에 영향을 주지 않을 수 있습니다.

요구사항: Node.js ≥ 22.18, React + Vite 프로젝트.

<details>
<summary>고급: <code>main</code>의 미공개 변경을 바로 쓰기</summary>

`main`에 푸시될 때마다 self-contained 플러그인 빌드가 `dist/vite-plugin` 브랜치에 자동 배포됩니다 (`docs/adr/ADR-008-standalone-vite-plugin-distribution.md` 참고):

```bash
npm install "github:Metric-Atlas/Metric-Atlas#dist/vite-plugin"
```

일반 사용에는 위의 npm 릴리스를 권장합니다.

</details>

## 서버가 필요한가요?

**핵심 기능에는 필요 없습니다.** Overlay와 PR Report는 서버 0대로 동작합니다. 서버가 필요한 건 **Analytics Health Dashboard**뿐입니다 — GA4 조회에는 credential이 필요하고, 그 credential은 절대 브라우저에 내려가면 안 되므로, 조회는 여러분이 통제하는 Node 프로세스에서 실행되어야 합니다.

| 현재 상황 | Overlay | PR Report | Health Dashboard |
|---|---|---|---|
| 정적 호스팅만 사용 (S3/Vercel/Pages) | ✅ 그대로 동작 | ✅ 동작 (CI에서 실행) | 필요할 때 로컬에서 `metric-atlas serve` 실행, 또는 Runtime을 따로 호스팅하고 `/__metric-atlas/*`를 프록시 |
| 자체 서버/리버스 프록시 보유 (nginx, ALB, k8s) | ✅ 그대로 동작 | ✅ 동작 | Runtime을 내부 서비스 하나로 추가하고 `/__metric-atlas/*` 경로만 라우팅 — 프록시 규칙 한 줄, 기존 배포는 그대로 |
| 아직 서버 없음 | ✅ | ✅ | `npx metric-atlas serve ./dist` 하나가 유일한 서버 — 사이트 + 대시보드 + GA4 proxy를 Node 프로세스 하나로 서빙 (DB 없음) |

대부분의 팀이 따르는 도입 사다리:

```text
1. 플러그인만                → Overlay                  (서버 없음)
2. + CI에 CLI               → PR Analytics Report      (서버 없음)
3. + 필요할 때 로컬 serve    → 그때그때 Health 확인      (호스팅 없음)
4. + Runtime 호스팅          → 팀 상시 대시보드          (작은 Node 프로세스 1개)
```

## Analytics Health 설정 (GA4)

브라우저는 GA4를 직접 호출하지 않습니다. credential은 Runtime 프로세스에만 존재합니다.

1. Google Cloud 서비스 계정을 만들고 JSON 키를 발급받아, GA4 속성에 **뷰어(Viewer)** 로 추가합니다.
2. 키는 저장소 밖에 보관하고, Runtime env 파일을 만듭니다:

```bash
cat > .env.metric-atlas <<'EOF'
METRIC_ATLAS_GA4_PROPERTY_ID=123456789
GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/service-account.json
EOF
```

직접 작성하지 않아도 됩니다 — CLI를 설치한 뒤(아래 3단계) `metric-atlas init-env --ga4-property-id 123456789 --google-application-credentials /absolute/path/to/service-account.json`를 실행하면 같은 파일을 만들어주고, Health 조회 기간·캐시 TTL 같은 기본값도 같이 채워줍니다 (자세한 값은 [환경변수 레퍼런스](#runtime-환경변수-레퍼런스) 참고).

3. 빌드하고 서빙합니다:

```bash
npm install -D @metric-atlas/cli
METRIC_ATLAS_ENABLED=true npm run build
npx metric-atlas serve ./dist --env ./.env.metric-atlas --port 8787
```

`http://127.0.0.1:8787/__metric-atlas/dashboard`를 엽니다 (경로는 `--dashboard-path`로 변경 가능). 확인:

```bash
curl http://127.0.0.1:8787/__metric-atlas/api/runtime-health
curl http://127.0.0.1:8787/__metric-atlas/api/health
```

**Runtime 배포 시:** 플랫폼이 환경변수만 지원하면 키를 base64로 인코딩해 `METRIC_ATLAS_GA4_SERVICE_ACCOUNT_JSON_BASE64`에 넣으면 됩니다 — Runtime이 직접 읽습니다. 서비스 계정에는 대상 속성 하나에 최소 읽기 권한만 부여하세요. GA4 credential을 `VITE_*`, 브라우저 저장소, 소스 코드, 빌드 결과, 로그에 절대 넣지 마세요. Metric Atlas에는 자체 로그인이 없으므로 대시보드 접근 제한은 네트워크/호스팅 계층에서 하세요.

## 자연어 질의 설정 (LLM, 선택)

위에서 만든 `.env.metric-atlas`에 키를 추가하되, 비밀값을 파일에 직접 붙여넣지 않도록 합니다 (`--key-env`는 이미 설정해둔 셸 변수에서 읽고, `--key-stdin`은 표준입력에서 읽습니다):

```bash
export MY_OPENAI_KEY=sk-...
npx metric-atlas set-llm-key --key-env MY_OPENAI_KEY
```

Anthropic(Claude)도 방식은 같습니다 — `--provider anthropic`과 해당 키를 넘기면 됩니다:

```bash
export MY_ANTHROPIC_KEY=sk-ant-...
npx metric-atlas set-llm-key --key-env MY_ANTHROPIC_KEY --provider anthropic
```

`metric-atlas serve`를 재시작하면(또는 Runtime을 재배포하면) 새 키가 적용됩니다. OpenAI 호환 게이트웨이(OpenRouter, 자체 호스팅 모델 등)도 `--base-url`로 그대로 사용할 수 있습니다:

```bash
npx metric-atlas set-llm-key --key-env MY_KEY --base-url https://openrouter.ai/api/v1 --model openrouter/some-model
```

CLI 대신 환경변수를 직접 설정하고 싶다면: `METRIC_ATLAS_LLM_API_KEY`(또는 `OPENAI_API_KEY`), `METRIC_ATLAS_LLM_PROVIDER`(기본 `openai`, 또는 `anthropic`), `METRIC_ATLAS_LLM_BASE_URL`, `METRIC_ATLAS_LLM_MODEL` — 전체 목록은 [아래 레퍼런스](#runtime-환경변수-레퍼런스) 참고.

## Runtime 환경변수 레퍼런스

아래 변수는 전부 Node Runtime 프로세스(`metric-atlas serve`)에서만 읽으며, 브라우저 번들에는 절대 들어가지 않습니다. `metric-atlas init-env`는 아래와 같은 기본값으로 GA4/LLM 항목이 채워진 `.env.metric-atlas` 파일을 생성합니다.

| 변수 | 기본값 | 용도 |
|---|---|---|
| `METRIC_ATLAS_GA4_PROPERTY_ID` | *(없음)* | 조회할 GA4 속성. 실제 Health 데이터를 받으려면 필수. |
| `METRIC_ATLAS_GA4_SERVICE_ACCOUNT_JSON_BASE64` | *(없음)* | 서비스 계정 JSON을 base64로 인코딩한 값. 아래 변수와 둘 중 호스팅 환경에 맞는 걸 사용. |
| `GOOGLE_APPLICATION_CREDENTIALS` | *(없음)* | 서비스 계정 JSON 파일의 절대 경로. |
| `METRIC_ATLAS_GA4_HEALTH_WINDOW_DAYS` | `30` | Health 리포트가 다루는 GA4 데이터 기간(일). |
| `METRIC_ATLAS_GA4_RECENT_WINDOW_HOURS` | `48` | 이 시간 이내에 관측된 이벤트는 "최근 데이터라 변동될 수 있음"으로 표시되고, 확정된 값으로 취급되지 않습니다. |
| `METRIC_ATLAS_CACHE_TTL_SECONDS` | `300` | 계산된 Health 리포트를 메모리에 캐시해두는 시간(초). 이 시간이 지나야 GA4를 다시 조회합니다. |
| `METRIC_ATLAS_LLM_API_KEY`(또는 `OPENAI_API_KEY`) | *(없음)* | LLM 키. 없으면 자연어 질의만 비활성화되고 나머지는 그대로 동작합니다. |
| `METRIC_ATLAS_LLM_PROVIDER` | `openai` | `openai` 또는 `anthropic`. |
| `METRIC_ATLAS_LLM_BASE_URL` | provider 기본값 | OpenAI 호환 게이트웨이(OpenRouter, 자체 호스팅 모델 등)나 Anthropic 엔드포인트로 바꿀 때 사용. |
| `METRIC_ATLAS_LLM_MODEL` | provider 기본값 | 모델명. |
| `METRIC_ATLAS_LLM_MAX_CANDIDATES` | `20` | 질문 하나당 LLM에 같이 보내는 후보 이벤트 최대 개수. |
| `METRIC_ATLAS_LLM_TIMEOUT_MS` | `10000` | LLM 요청 타임아웃(밀리초). |
| `METRIC_ATLAS_RUNTIME_HOST` | `127.0.0.1` | 바인딩 주소. 컨테이너 밖에서 접근해야 하면 `0.0.0.0`으로 설정(또는 `--host 0.0.0.0`). |
| `METRIC_ATLAS_RUNTIME_PORT` | `8787` | 리스닝 포트 (또는 `--port`로 지정). |
| `METRIC_ATLAS_DASHBOARD_PATH` | `/__metric-atlas/dashboard` | 대시보드가 서빙되는 경로 (또는 `--dashboard-path`로 지정). |

## 로컬에서 데모 체험

API 키 없이 fixture로 체험할 수 있습니다:

```bash
git clone https://github.com/Metric-Atlas/Metric-Atlas.git && cd Metric-Atlas
corepack pnpm install --frozen-lockfile
corepack pnpm demo
```

데모 앱은 지원 패턴(인라인 `gtag`, 같은 파일 핸들러, `dataLayer.push`)과 의도적 미지원 패턴(래퍼 경유 → 경고, Custom Component → 탐지되나 오버레이 없음, 동적 이벤트명 → `unresolved`)을 한 화면에서 보여줍니다.

## Metric Atlas가 아닌 것

이벤트 승인/거버넌스 SaaS, BI 도구, GA4 대체재, Tracking Plan 검증기가 아닙니다 — 그 계열 도구는 사람이 작성한 계획에서 출발하지만, Metric Atlas는 여러분의 코드에서 출발합니다.

## 아키텍처 한 문단

Vite 플러그인(Babel AST)이 빌드 시 소스를 스캔해 이벤트 manifest를 만들고, 오버레이 Web Component가 화면에서 그것을 읽습니다. 단일 Node Runtime(DB 없음, 인메모리 캐시)이 사이트, 내장 대시보드, GA4 Data/Admin API proxy를 서빙합니다 — credential은 서버에만 머물고, 응답은 캐시·rate guard로 보호됩니다. 설계 기록은 [`docs/`](./docs)에 있습니다 ([`docs/00-project-source-of-truth.md`](./docs/00-project-source-of-truth.md)와 결정 로그 [`docs/15-decision-log.md`](./docs/15-decision-log.md)부터).

## 기여하기

기여를 환영합니다 — 시작 전에 [Contributing Guide](./CONTRIBUTING.md) ([한국어](./CONTRIBUTING.ko.md))를 읽어주세요.

## 라이선스

[MIT](./LICENSE). 공개된 `@metric-atlas/*` 패키지는 [Semantic Versioning](./docs/18-positioning-and-open-source.md#4-public-release-gate)을 따릅니다 (1.0 이전에는 minor에도 breaking change 가능). 보안 신고: [`SECURITY.md`](./SECURITY.md) · 메인테이너: [`MAINTAINERS.md`](./MAINTAINERS.md) · 의존성 라이선스: [`THIRD-PARTY-NOTICES.md`](./THIRD-PARTY-NOTICES.md)
