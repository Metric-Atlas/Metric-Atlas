# 10. Deployment, Runtime, Environment

## 1. 운영 모델

```text
CI / Internal Build
→ Vite build
→ Metric Atlas scanner + transform
→ manifest.json
→ frontend + dashboard bundle
→ Single Node Runtime
```

Node Runtime 역할:
- 정적 파일 제공
- Manifest 제공
- GA4 Data/Admin API proxy
- Analytics Health 계산
- LLM proxy
- in-memory cache
- rate/concurrency guard

## 2. GA4 Setup

### 필수
- `METRIC_ATLAS_GA4_PROPERTY_ID`
- Service Account Credential
- 대상 GA4 Property에 해당 Service Account 권한 부여

### Credential 방식 A

```env
GOOGLE_APPLICATION_CREDENTIALS=/secure/path/service-account.json
```

### 방식 B

```env
METRIC_ATLAS_GA4_SERVICE_ACCOUNT_JSON_BASE64=...
```

## 3. Build

```bash
METRIC_ATLAS_ENABLED=true pnpm build
```

## 4. Runtime

```bash
metric-atlas serve ./dist
metric-atlas serve ./dist --env ./.env.metric-atlas --port 8787
```

`.env.metric-atlas`는 Node Runtime 실행자가 관리하는 파일입니다. 브라우저 bundle이나 `VITE_*` 환경변수로 GA4/LLM credential을 전달하지 않습니다. 예시는 `.env.metric-atlas.example`을 사용합니다.

## 5. Runtime API

```text
GET  /__metric-atlas/api/manifest
GET  /__metric-atlas/api/health
GET  /__metric-atlas/api/providers
POST /__metric-atlas/api/connectors/:provider/test
POST /__metric-atlas/api/connectors/:provider/query
POST /__metric-atlas/api/query
```

## 6. Local Demo

```bash
pnpm demo
```

- 실제 Credential 불필요
- mock manifest / mock health 사용
- Overlay / Dashboard UX 체험 가능
- OSS contributor 개발에 사용

## 7. Code Update

배포마다 Manifest를 재생성합니다.

별도 Git Webhook 서버는 필요하지 않습니다.

GitHub Actions의 PR Report는 배포 최신화가 아니라 **변경 전달과 사전 검증** 목적입니다.
