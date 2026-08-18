# Local Demo Dashboard (apps/demo-react-vite)

## 구현 범위

- `apps/demo-react-vite` React + Vite demo app 신규 추가 (`pnpm install` 후 `dev` / `test` / `typecheck` / `build`)
- fixture 3종(`mock-manifest.json`, `mock-ga4-health.json`, `mock-query-result.json`)을 읽어 화면 구성
- 사이드 탭 셸 + 3개 화면
  - Health 요약: manifest 이벤트 수 / 화면 연결 수 / 정상 / 코드에만 있음 / 파라미터 등록 누락, 확인 필요 목록, 용어 안내
  - 이벤트 탐색: eventName·eventKey·source file 검색(exact/fuzzy), Provider·Emitter·Overlay·Health 필터, 목록, 상세
  - 질의: 자연어 질문 → 로컬 후보 축소(최대 20) → analysisType(definition/event_count/comparison) → QueryPlan draft → 실행 가능/차단 → mock 결과
- 상세: eventKey, source file/line/column, parameters + 등록 상태, overlaySupported, binding element type, atlasDomId, bindingConfidence, codeState, ga4ObservationState, ga4ManagedState, parameterRegistrationStates, latestMeasurement, qualityFlags
- 한국어 매핑(`src/labels.ts`): 이벤트 설명, 필드 마케터 용어, 원천 값 뜻, 검토 사유, quality flag 문구

## 추가한 UX (요청 범위 외, 보고 대상)

- 검색 대상 세그먼트(전체/eventName/eventKey/source) + "정확히 일치" 토글로 exact/fuzzy 분리
- 필터 초기화 버튼
- 요약 타일 클릭 → 해당 상태로 필터된 목록 이동
- "지금 확인이 필요한 이벤트" 목록(클릭 → 상세)
- 용어 안내 섹션(비개발자용)
- Health에만 있는 이벤트를 "코드 미탐지" 행으로 목록에 포함
- 상세 → "이 이벤트로 질의 만들기" 딥링크
- 질의 예시 칩, 후보 다중 상태 안내, comparison 변화율(%)

## 미구현 범위

- Overlay/Launcher, 실제 GA4 Connector, LLM 자연어 파싱(질문은 로컬 문자열 매칭만)
- URL 라우팅/딥링크 영속화, 데이터 캐시·rate limit, i18n 프레임워크
- `no_rows` 문구 규칙, 관측 기간 기본값 등 GA4 Spike 대기 항목
- Playwright E2E (unit test만 추가)

## fixture / contract 영향

- fixture 변경 없음 (읽기 전용 import)
- contract 변경 없음. `packages/contracts` Zod schema 미수정
- 한국어 라벨은 fixture가 아닌 앱 내 `src/labels.ts`에만 존재

## 테스트 결과

`src/__tests__` (vitest):

- search.test.ts — eventName exact, eventKey exact, fuzzy(substring/subsequence), source file search, provider filter, emitter filter, overlay filter, no candidate, multiple candidate
- health.test.ts — eventKey join, 버킷 우선순위, fixture summary 정합, 원본 이름/키 무번역
- queryPlan.test.ts — unknown provider 차단, 코드 미탐지 차단, 후보 없음 차단, mock comparison 결과, event_count fallback, no_rows, definition
- labels.test.ts — 이벤트 매핑 전수, 필드명 영어 유지, EMITTER/PROVIDER 사전 분리, 미매핑 fallback

로컬 실행 결과:

- `pnpm --filter @metric-atlas/demo-react-vite test`: 4 files / 30 tests passed
- `pnpm --filter @metric-atlas/demo-react-vite typecheck`: passed
- `pnpm --filter @metric-atlas/demo-react-vite build`: passed
- `pnpm typecheck`: passed
- `pnpm test`: 11 files / 51 tests passed
- `pnpm demo -- --host 127.0.0.1` + `curl -I http://localhost:5180/`: 200 OK
