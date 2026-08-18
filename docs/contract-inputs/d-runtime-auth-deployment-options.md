# D Contract Input — Runtime, Auth, and Deployment Options

- Owner: Member D / 호범
- Status: Proposed
- Scope: Search / Query / Demo / OSS DX가 실제 GA4·LLM 호출로 확장될 때 필요한 실행 구조와 인증 방식 검토
- Related docs:
  - `docs/04-system-architecture.md`
  - `docs/07-feature-3-natural-language-query.md`
  - `docs/09-security-and-secrets.md`
  - `docs/10-deployment-runtime-env.md`
  - `docs/20-phase-0-common-fields.md`

## 1. 논의 배경

Metric Atlas는 패키지형 도구이지만, GA4 조회와 LLM 질의에는 credential, token, rate limit, cache, timeout 처리가 필요합니다. 브라우저 UI만으로는 Secret을 안전하게 보관하기 어렵기 때문에 실행 위치를 명확히 나눠야 합니다.

현재 문서의 기본 방향은 `Single Node Runtime`입니다. 이 문서는 그 방향을 유지하되, Local Demo, 사내 배포, Browser OAuth, BYOK, Render 같은 선택지를 비교해 A/C/D가 후속 결정을 할 수 있게 정리합니다.

## 2. 핵심 결론

권장 기본값:

```text
Browser UI
→ Metric Atlas Node Runtime
→ GA4 / LLM API
```

단, 사용 환경별로 다음 모드를 분리합니다.

| Mode | 목적 | 서버 필요 | 권장도 |
|---|---|---:|---:|
| Fixture Demo | 설치 직후 화면 체험 | 없음 | 기본 데모 |
| Local Node Runtime | 외부 서버 없이 실 API 테스트 | 사용자 PC Node 필요 | MVP 개발/개인 테스트 |
| Internal Hosted Runtime | 개발자가 사내 서버에 배포하고 마케터에게 URL 공유 | 사내/개발 서버 필요 | 사내 운영 기본 |
| Browser OAuth GA4 | 서버 없이 사용자 Google 권한으로 GA4 조회 | 없음 | 옵션/실험 |
| Browser BYOK LLM | 사용자가 직접 LLM API Key 입력 | 없음 | 데모 한정 |
| Render Free Runtime | 한 달 MVP 검증용 외부 Runtime | Render 필요 | 프로토타입 |

## 3. 패키지로 로컬 Node Runtime을 띄우는 방식

패키지는 CLI 명령어와 Node 서버 코드를 함께 포함할 수 있습니다.

```bash
pnpm add -D @metric-atlas/cli
pnpm metric-atlas serve ./dist
```

또는 임시 실행:

```bash
pnpm dlx @metric-atlas/cli serve ./dist
npx @metric-atlas/cli serve ./dist
```

실행 흐름:

```text
사용자 터미널
→ metric-atlas serve ./dist
→ localhost Node Runtime 실행
→ Browser UI가 localhost API 호출
→ Runtime이 GA4 / LLM API 호출
```

필요 패키지 경계 후보:

```text
packages/cli       # metric-atlas 명령어
packages/runtime   # serve, API envelope, cache, rate limit
packages/query     # local search, QueryPlan, LLM prompt/adapter boundary
packages/contracts # shared Zod schema
apps/demo-react-vite
```

이 구조는 외부 서버 없이 동작하지만, 사용자 PC 또는 실행 환경에 Node.js가 필요합니다.

## 4. 사내 개발자가 배포하고 마케터가 URL만 쓰는 방식

사내 운영에서는 마케터가 Node.js나 API Key를 알 필요가 없습니다.

```text
개발자
→ 사내 개발 서버/테스트 서버에 Metric Atlas 패키지 설치
→ GA4 / LLM key를 서버 환경변수로 설정
→ Metric Atlas Runtime 배포
→ 마케터에게 URL 공유

마케터
→ URL 접속
→ 검색/질의 실행
→ 서버가 GA4 / LLM API 대신 호출
```

이 경우 API Key는 서버 환경변수나 Secret Manager에 있고, 브라우저 bundle/localStorage/manifest/log에 들어가면 안 됩니다.

## 5. 사내망 분리 환경 적용 가능성

| 환경 | 가능 여부 | 조건 |
|---|---|---|
| 마케터 PC와 서버 모두 인터넷 가능 | 가능 | Runtime이 GA4/LLM outbound 가능 |
| 마케터망은 폐쇄, 서버만 outbound 가능 | 가능 | 마케터는 사내 URL만 접근, Runtime이 외부 API 호출 |
| 서버도 완전 폐쇄망 | 제한 | 외부 GA4/LLM 실시간 조회 불가. 내부 LLM, 내부 proxy, 사전 export 필요 |
| 외부 API가 보안 프록시만 허용 | 가능 | Runtime이 `HTTPS_PROXY` / `NO_PROXY` 등 proxy 설정 지원 필요 |

Metric Atlas MVP는 DB를 요구하지 않습니다. Internal Hosted Runtime 하나가 정적 파일 제공, manifest 제공, GA4/LLM proxy, in-memory cache를 함께 처리할 수 있습니다.

## 6. Browser OAuth GA4 옵션

외부 Runtime 없이 브라우저에서 Google OAuth 동의를 받아 GA4 Data/Admin API를 직접 호출하는 방식입니다.

```text
Browser UI
→ Google OAuth consent
→ browser access token
→ GA4 API 직접 호출
```

장점:
- 별도 서버 없이 GA4 조회 데모 가능
- 사용자의 Google 권한으로 접근
- Service Account private key를 브라우저에 넣지 않음

단점:
- access token 만료 처리 필요
- refresh token/장기 세션은 브라우저만으로 제한적
- CORS, scope, 조직 보안 정책 영향을 받음
- Health 자동 계산, cache, rate limit, 장기 운영에는 약함
- LLM 호출 문제는 해결하지 않음

추천 위치:
- OSS 체험/개인 데모 옵션
- 운영 기본값은 아님

## 7. Browser BYOK LLM 옵션

브라우저에서 사용자가 자기 LLM API Key를 입력하고 외부 LLM API를 직접 호출하는 방식입니다.

```text
사용자 입력 LLM API Key
→ 브라우저 메모리 보관
→ LLM API 직접 호출
```

기술적으로 가능하지만 운영 기본값으로는 부적합합니다.

허용 조건 후보:
- Demo/Experimental 모드에서만 허용
- key는 React state 같은 메모리에만 보관
- localStorage/sessionStorage 저장 금지
- 새로고침 시 key 소멸
- UI에 브라우저 직접 호출 위험 고지
- 비용/남용 책임이 사용자에게 있음을 명시

금지 후보:
- 프로젝트 제공 LLM API Key를 브라우저 bundle에 포함
- `VITE_*`로 LLM key 전달
- key를 manifest/log/localStorage에 저장

## 8. GA4 BYOK에 대한 판단

GA4는 LLM처럼 단순 API Key 입력으로 끝나지 않습니다.

비추천:

```text
브라우저에 Service Account JSON/private key 입력
```

이유:
- private key가 브라우저에 노출됨
- JWT 서명/access token 발급 과정이 브라우저에 들어감
- 문서의 Secret 금지 원칙과 충돌 가능성이 큼

권장:
- Service Account는 Node Runtime에서만 사용
- 서버 없는 데모는 Browser OAuth GA4로 분리

## 9. Render Free Runtime 옵션

Render 무료 Web Service로 Node Runtime을 올려 MVP를 검증할 수 있습니다.

```text
Frontend / Demo UI
→ Render Node Runtime
→ GA4 / LLM API
```

장점:
- 브라우저에 Secret 미노출
- Runtime API 계약과 잘 맞음
- 조직 repo 연결 후 자동 배포 가능
- 한 달 MVP/데모 검증에 현실적

단점:
- free tier sleep/cold start
- 운영 안정성 제한
- 장기 운영/보안 정책은 별도 검토 필요

조직 repo 사용 조건:
- Render GitHub App 또는 연결 계정이 `Metric-Atlas/Metric-Atlas` 접근 권한을 가져야 함
- 조직 권한 정책에 따라 설치/승인이 필요할 수 있음

## 10. Contract / Runtime 영향 후보

기존 `ConnectorContext`는 credential이 Node Runtime에서 resolve된다는 전제를 가집니다. 모드 확장을 하려면 다음 필드가 필요할 수 있습니다.

```ts
type AuthMode =
  | "mock"
  | "service_account_runtime"
  | "local_runtime_config"
  | "browser_oauth_session"
  | "browser_byok_demo";

interface ConnectorContext {
  provider: "ga4";
  propertyId: string;
  authMode: AuthMode;
}
```

단, 이는 아직 결정이 아니며 A/C 리뷰와 ADR이 필요합니다.

## 11. D 관점 요구사항

D Search / Query UI는 인증 방식과 독립적으로 동작해야 합니다.

필수 fallback:
- LLM 미연결이어도 exact search 동작
- fuzzy search 동작
- Provider / Emitter / file path filter 동작
- Analytics Health navigation 동작
- QueryPlan draft 생성 가능
- 실행 불가 사유 표시

LLM 연결 시에도 D는 다음 원칙을 지킵니다.
- LLM은 eventName, provider/emitter, parameter names, relative source path, limited UI label만 받음
- full source code 전송 금지
- GA/LLM credential 전송 금지
- 후보 수 max 20
- invalid QueryPlan 실행 금지

## 12. Open Decisions

1. MVP 운영 기본 인증은 Service Account Runtime으로 유지할 것인가?
2. Browser OAuth GA4를 Demo 옵션으로 허용할 것인가?
3. Browser BYOK LLM을 Demo 옵션으로 허용할 것인가, 아니면 금지할 것인가?
4. Local Node Runtime credential 저장은 OS Keychain, env var, config file 중 무엇을 우선할 것인가?
5. Render free tier를 팀 데모/검증 Runtime으로 사용할 것인가?
6. 사내망 proxy 설정(`HTTPS_PROXY`, `NO_PROXY`)을 Runtime MVP 범위에 포함할 것인가?
7. `AuthMode`를 Contract v1에 포함할 것인가, Runtime 내부 설정으로만 둘 것인가?

## 13. Recommendation

Phase 0 / MVP 기본값:

```text
Fixture Demo
+ Local Node Runtime
+ Internal Hosted Runtime
```

운영 기본:

```text
Service Account / LLM API Key는 Node Runtime에서만 사용
Browser는 `/__metric-atlas/api/*`만 호출
```

옵션:

```text
Browser OAuth GA4 = OSS/개인 데모 옵션
Browser BYOK LLM = 명시적 Experimental Demo 옵션 또는 보류
Render Runtime = 한 달 MVP 검증용 후보
```

이 문서는 결정문이 아니라 D 관점 Contract Input입니다. 채택 시 ADR과 Security/Runtime 문서 갱신이 필요합니다.
