# 01. Product Requirements

## 1. 사용자 결과

사용자는 Metric Atlas에서 다음 질문에 답할 수 있어야 합니다.

- 이 버튼에는 어떤 분석 이벤트가 심겨 있는가?
- 이 이벤트는 GA4에서 실제로 관측되는가?
- 현재 코드에는 없는데 GA4에 남아 있는 이벤트는 무엇인가?
- 코드에서 보내는 파라미터 중 GA4 보고에서 사용할 수 있도록 등록되지 않은 것이 있는가?
- 이번 PR로 어떤 이벤트가 추가·삭제되었는가?
- 특정 이벤트의 최근 발생 수와 이전 기간 대비 변화는 어떤가?

## 2. 기능 요구사항

### FR-1 Code Detection
- `gtag`, `sendGAEvent`, `dataLayer.push`를 공식 지원합니다.
- Mixpanel·Meta Detector도 구조상 유지할 수 있으나 GA4가 우선입니다.
- Import/Binding/Call Shape를 근거로 Emitter와 Provider를 판단합니다.
- 정적 이벤트명과 파라미터 키를 추출합니다.
- SDK import만 있고 직접 호출이 0건이면 래퍼 가능성을 경고합니다.

### FR-2 UI Binding
- 인라인 핸들러와 같은 파일 핸들러를 연결합니다.
- 소문자 JSX 네이티브 태그에만 기본 `data-atlas-id`를 주입합니다.
- Custom Component 이벤트는 Manifest에 유지하되 Overlay 미지원으로 표시합니다.
- 원본 소스파일은 수정하지 않습니다.

### FR-3 Internal Overlay Entry
- 사내 배포 화면에 작은 Metric Atlas 런처를 표시합니다.
- 런처에서 Overlay On/Off와 Dashboard 이동을 제공합니다.
- 색상만으로 Provider를 구분하지 않고 이름·아이콘을 함께 표시합니다.

### FR-4 Analytics Health
- Code Event와 GA4 Event를 대조합니다.
- GA4 Managed Event Registry를 이용해 자동 수집 이벤트를 일반 Data-only 경고에서 제외합니다.
- 코드 파라미터와 GA4 Custom Dimension 등록 상태를 대조합니다.
- GA4 Data Quality Flag를 함께 표시합니다.

### FR-5 Event Detail
- Event Key는 `(provider, eventName)`을 사용합니다.
- GA4 Property Reporting Time Zone 기준으로 기간을 해석합니다.
- 이벤트 발생 수와 이전 기간 비교를 제공합니다.
- 조회 시각과 Data Quality를 표시합니다.

### FR-6 PR Report
- PR Base Commit과 Head Commit을 재스캔합니다.
- 추가/삭제/변경/unresolved 경고를 댓글 또는 Check Summary로 제공합니다.
- 별도의 baseline DB는 사용하지 않습니다.

### FR-7 Natural Language Query
- LLM 전 로컬 후보 검색으로 최대 20개 이하 후보만 전달합니다.
- Query Plan은 Schema 검증 후 실행합니다.
- LLM이 없는 경우 검색 UI가 계속 동작합니다.

## 3. 비기능 요구사항

### 정확도
초기 MVP 목표:
- 지원 직접 호출 Corpus에서 Provider False Positive ≤ 1%
- 지원 직접 호출 + 네이티브 JSX Handler 기준 Exact Binding ≥ 90%
- 같은 분모에서 `unresolved` ≤ 10%

정확한 목표는 Reference Repo 측정 후 Decision Log로 조정할 수 있습니다.

### 성능
- `include` / `exclude` glob 제공
- `node_modules`, build output, test/story 파일 기본 제외
- Reference Repo에서 Cold Build Overhead ≤ 20%; 원래 빌드가 10초 미만이면 절대 증가 ≤ 2초를 초기 목표로 합니다.
- Scanner 처리 시간과 분석 파일 수를 Build Summary에 기록합니다.

### 보안
- GA4 Credential은 Node Runtime에서만 사용합니다.
- 서비스 계정은 대상 Property에 최소 읽기 권한만 부여합니다.
- 임시 Credential 입력은 Internal Mode + 명시적 Allow Flag가 모두 있어야 합니다.

### 가용성
- 단일 Runtime의 외부 GA4 요청 동시 실행 수를 제한합니다.
- IP 또는 Runtime Session 기반 Rate Limit을 둡니다.
