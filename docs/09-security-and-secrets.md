# 09. Security and Secrets

## 1. MVP 인증 전제

Metric Atlas 자체 SSO는 구현하지 않습니다. 사내 네트워크 또는 배포 플랫폼이 접근을 제한합니다.

이 결정은 다음 위험을 의미합니다.

> Runtime 접근권이 있는 임직원은 제공되는 GA4 분석 데이터를 열람할 수 있습니다.

따라서 GA4 서비스 계정은 반드시 **필요한 Property + 최소 읽기 권한**으로 제한합니다.

## 2. Credential

정식 방식:
- 서버 환경변수
- `metric-atlas serve --env ./.env.metric-atlas`
- `GOOGLE_APPLICATION_CREDENTIALS`
- 또는 Base64 Service Account JSON Secret

금지:
- `VITE_*`
- localStorage
- client bundle
- manifest
- fixture
- log

`.env.metric-atlas`는 Node Runtime에서만 읽습니다. 이 파일은 마케터 브라우저 설정이 아니라 개발자 또는 사내 배포 환경의 secret 입력 경로입니다.

## 3. Runtime Temporary Input

다음 두 조건이 모두 참일 때만 코드가 입력 Endpoint를 활성화합니다.

```text
METRIC_ATLAS_MODE=internal
AND
METRIC_ATLAS_ALLOW_RUNTIME_CREDENTIAL_INPUT=true
```

Demo/Public mode에서는 설정값이 있어도 Runtime Credential 입력을 거부합니다.

## 4. API Proxy Protection

- outbound concurrency limit
- IP 또는 Runtime Session rate limit
- request timeout
- bounded retry/backoff
- 429 handling

## 5. LLM

전송 가능:
- eventName
- provider/emitter
- parameter names
- relative source path
- limited UI label

전송 금지:
- GA credential
- LLM credential
- full source code by default
- raw user analytics records

## 6. Internal Build

Metric Atlas Overlay/Manifest에는 코드 경로와 이벤트명이 포함되므로 Public Production 배포에 기본 포함하지 않습니다.

Local Demo는 Mock Fixture만 사용합니다.
