# 06. Feature 2 — Analytics Health & GA4 Connector

## 1. 목적

GA4 자체 콘솔을 복제하지 않고 **코드와 GA4 사이의 불일치와 관측 가능성 문제를 자동 탐지**합니다.

## 2. 첫 화면 — Analytics Health

분류:

### Healthy
코드에서 GA4 direct event를 발견했고 GA4에서 해당 Event를 관측할 수 있습니다.

### Code only / Review needed
코드에는 있으나 조회 범위에서 GA4 Event가 관측되지 않습니다.

단 다음은 함께 고려합니다.
- 최근 데이터 지연 가능성
- Thresholding
- `(other)` data loss

따라서 즉시 “구현 오류”라고 단정하지 않습니다.

### GA4 only / Review needed
GA4에서 관측되지만 코드에서 발견되지 않습니다.

단 GA4-managed event registry에 포함되면 정상 관리 이벤트로 분류합니다.

### Parameter Registration Gap
코드에서 GA4 Event Parameter를 보내지만 GA4 Built-in Dimension/Metric 또는 Custom Dimension 등록으로 확인되지 않는 경우입니다.

## 3. GA4 Managed Event Registry

GA4 자동 수집 및 Enhanced Measurement 이벤트를 버전 관리된 Registry로 관리합니다.

예시:
- `page_view`
- `session_start`
- `first_visit`
- `user_engagement`
- 설정에 따라 자동/향상된 측정으로 발생하는 이벤트

Registry는 Health 판정에서 “GA4 only = 오류” 노이즈를 줄이는 목적이며 GA4 공식 목록 변화에 따라 업데이트할 수 있어야 합니다.

## 4. Connector Authentication

우선순위:

1. `GOOGLE_APPLICATION_CREDENTIALS`
2. `METRIC_ATLAS_GA4_SERVICE_ACCOUNT_JSON_BASE64`
3. Internal Mode + Allow Flag에서만 Runtime 임시 입력

필수 설정:
- GA4 Property ID
- 대상 Property에 서비스 계정을 최소 읽기 권한으로 추가

## 5. GA4 조회

Core MVP:
- Event Name / Event Count
- 기간 조회
- 이전 기간 비교
- Property Reporting Time Zone 확인
- Response Metadata → Quality Flag

퍼널은 Core MVP에서 제외합니다.

## 6. Custom Dimension Gap

입력:
- Manifest의 GA4 Event Parameters
- GA4 Admin/Metadata에서 확인 가능한 등록 정보

출력 상태:
- `builtin`
- `registered_custom_dimension`
- `not_registered`
- `unknown`

`not_registered`는 보고 활용을 위해 검토가 필요한 항목으로 표시합니다.

## 7. Event Detail

Event Detail은 GA4 카운트와 비교를 제공합니다.

표시:
- eventKey
- eventName
- code implementations
- UI bindings
- eventCount
- comparison
- reporting timezone
- fetchedAt
- qualityFlags

## 8. Result Status와 Quality Flag

Result Status:
- `ok`
- `no_rows`
- `unauthorized`
- `unsupported`
- `error`

Quality Flag:
- `subject_to_thresholding`
- `other_row_data_loss`
- `recent_data_may_change`

`recent_data_may_change`의 정확한 기본 시간 범위는 GA4 Spike 후 조정할 수 있습니다.

## 9. Cache

Fingerprint:

```text
provider + propertyId + eventName + dateRange + metric + dimensions + filters
```

- TTL Cache
- In-flight request deduplication
- Manual refresh
- Runtime restart 시 폐기

## 10. Rate Protection

- GA4 외부 요청 동시 실행 상한
- IP/Runtime Session rate limit
- 초과 시 queue 또는 429
- 실제 기본값은 `.env.example`에서 설정

## 11. Dashboard 배포 방식

Dashboard UI(`packages/dashboard`)는 소비자가 별도로 설치하는 패키지도, Vite Plugin 빌드 옵션도 아닙니다. `@metric-atlas/runtime`(`metric-atlas serve`)이 빌드 시 정적 자산으로 포함해 기본 경로 `/__metric-atlas/dashboard`에서 서빙하며, `--dashboard-path`로 변경할 수 있습니다.

이렇게 설계한 이유(ADR-009):
- GA4 조회는 매 요청마다 credential을 쥔 살아있는 서버가 필요해서, `vite build`로 만드는 정적 산출물에는 애초에 라이브 대시보드를 넣을 방법이 없습니다.
- Metric-Atlas가 공유 호스팅 서비스(예: `dashboard.metric-atlas.site`)로 이 문제를 대신 해결하는 방안은 제3자 GA4 credential을 중앙에서 보관해야 해서 현재 self-hosted 보안 모델(`docs/09`)과 "MVP엔 내장 인증 없음"(`DEC-011`)을 뒤집는 SaaS급 스코프 변경이라 채택하지 않았습니다.

소비자는 여전히 Runtime을 자기 인프라에 배포하고 GA4 credential을 설정해야 하지만(§4), 그 이상 Dashboard UI를 직접 만들거나 복붙할 필요가 없습니다. Runtime을 공개 URL로 배포하면 Dashboard도 누구나 열람 가능해지므로, 접근 제한은 배포/네트워크 레벨에서 처리해야 합니다(Risk Register R-11).
