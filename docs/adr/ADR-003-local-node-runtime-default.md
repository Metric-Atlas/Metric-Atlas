# ADR

- ID: ADR-003
- Date: 2026-08-19
- Status: Proposed
- Author: Member D / 호범

## Problem

Metric Atlas는 패키지형 도구이지만 GA4 조회와 LLM 질의는 credential, token, rate limit, timeout, cache 처리가 필요하다. 브라우저 UI만으로는 GA4 Service Account key나 LLM API key를 안전하게 보관할 수 없고, 마케터 사용자가 Node.js, API key, OAuth 설정을 직접 이해해야 하는 구조도 MVP 사용 흐름에 맞지 않는다.

`docs/contract-inputs/d-runtime-auth-deployment-options.md`에서는 Browser BYOK, Browser OAuth, Render Runtime, Internal Hosted Runtime, Local Node Runtime을 비교했다. 본 ADR은 그중 Metric Atlas의 기본 실행 모델을 Local Node Runtime으로 확정하기 위한 결정문이다.

## Proposed change

Metric Atlas의 실 API 호출 기본값을 **Local Node Runtime**으로 둔다.

기본 흐름:

```text
Browser UI
→ Metric Atlas Node Runtime
→ GA4 / LLM API
```

패키지는 CLI와 Node runtime을 제공한다. 개발자 또는 사내 운영자는 패키지를 설치하고 `metric-atlas serve` 형태의 명령으로 runtime을 실행한다. 마케터는 개발자가 공유한 URL에 접속해 대시보드를 사용한다.

초기 구현 후보:

```text
packages/cli       # metric-atlas 명령어 진입점
packages/runtime   # local server, API envelope, auth/config resolve
packages/query     # QueryPlan, search, LLM adapter boundary
packages/contracts # shared schemas
apps/demo-react-vite
```

MVP runtime API 후보:

```text
GET  /__metric-atlas/api/health
POST /__metric-atlas/api/query-plan
POST /__metric-atlas/api/llm/generate
```

GA4 API endpoint는 `packages/runtime` 구현 시점에 별도 task/ADR에서 확정한다.

## Producers affected

- A / Runtime: `packages/runtime` 또는 동등한 runtime package를 설계하고 local server contract를 제공한다.
- D / Query: demo dashboard의 `search`, `queryPlan`, label mapping을 runtime API와 연결 가능한 경계로 정리한다.
- B / Detector: manifest fixture/producer payload를 변경하지 않는다. Runtime은 producer 산출물을 읽는 consumer로 동작한다.
- C / Analytics: GA4 Health 연결 시 runtime을 통해 credential을 resolve한다.

## Consumers affected

- Browser UI는 GA4/LLM API를 직접 호출하지 않고 Metric Atlas runtime API만 호출한다.
- 마케터는 Node.js나 API key를 직접 다루지 않는 사용 흐름을 기본으로 한다.
- 개발자 또는 사내 운영자는 runtime 실행, env 설정, 사내 배포를 담당한다.

## Alternatives

- Browser BYOK LLM: 기술적으로 가능하지만 브라우저에 API key가 노출될 수 있어 기본값으로 채택하지 않는다. Demo/Experimental 모드로만 별도 검토한다.
- Browser OAuth GA4: 서버 없는 GA4 데모로는 가능하지만 LLM credential 문제를 해결하지 못한다. GA4 개인/OSS 데모 옵션으로만 유지한다.
- Render Free Runtime: 한 달 MVP 데모에는 유용하지만 free tier sleep/cold start와 조직 보안 정책 문제가 있어 기본 운영 모델로 채택하지 않는다.
- Central Hosted SaaS Runtime: 장기적으로 가능하지만 현재 패키지형 OSS/사내 배포 방향보다 운영 부담이 크다.

## Compatibility

Fixture와 Phase 0 contract는 변경하지 않는다.

현재 demo dashboard는 fixture-only 모드로 계속 동작해야 한다. LLM이나 GA4 credential이 없어도 exact search, fuzzy search, provider/emitter/file path filter, QueryPlan draft 생성, 실행 차단 사유 표시는 유지한다.

브라우저 bundle, manifest, fixture, localStorage, log에는 GA4 Service Account key 또는 LLM API key를 저장하지 않는다.

## Migration

1. 본 ADR을 기준으로 Runtime/Auth 기본 방향을 Local Node Runtime으로 확정한다.
2. 후속 PR에서 `packages/runtime` 최소 서버와 `packages/cli` serve command를 설계한다.
3. `apps/demo-react-vite`는 fixture-only mode와 runtime-connected mode를 분리한다.
4. Runtime implementation PR에서 API envelope, error shape, timeout, credential source precedence를 문서화한다.
5. Browser OAuth GA4와 Browser BYOK LLM은 별도 Experimental ADR 또는 task로 분리한다.

## Fixture updates

없음. 기존 `fixtures/*.json`은 read-only로 유지한다.

## Contract tests

본 ADR은 문서 결정만 포함한다. 후속 runtime 구현에서 다음 테스트를 추가한다.

- runtime health endpoint
- missing credential fail-closed behavior
- QueryPlan 실행 차단 사유
- fixture-only mode fallback
- browser bundle에 secret이 포함되지 않는지 확인하는 build/test guard

## Decision

Proposed. Metric Atlas MVP의 기본 실 API 호출 구조는 Local Node Runtime으로 둔다. Browser UI는 Metric Atlas runtime API만 호출하며, GA4/LLM credential은 Node Runtime에서만 resolve한다.
