# 03. User Flows and UX

## 1. 비개발자 진입 경로

사내 배포 빌드에서는 화면 우측 하단에 작은 **Metric Atlas Launcher**를 표시합니다.

Launcher 기능:

- Overlay 켜기/끄기
- 현재 화면에서 탐지된 이벤트 수
- Dashboard(`@metric-atlas/runtime`이 서빙, 기본 `/__metric-atlas/dashboard`, ADR-009)로 이동

Launcher는 제품 UI를 가리지 않도록 최소 크기로 유지하고 설정으로 위치를 바꿀 수 있습니다.

## 2. Overlay Flow

```text
Internal App
→ Atlas Launcher
→ Overlay ON
→ Event-bound element hover
→ Tooltip
```

Tooltip:
- Tracking Emitter
- Analytics Provider
- Original Event Name
- Parameters
- Code Location
- Binding Confidence
- Dashboard Link

`dataLayer.push`의 경우:

```text
Emitter: GTM
Destination: Unknown
```

## 3. Analytics Health First Screen

Health Summary 예시:

```text
Healthy                     42
Code only / review needed    3
GA4 only / review needed     2
GA4 managed                  8
Parameter registration gap   4
Unresolved                   2
```

목록의 각 행:

- Provider
- Event Name
- Code State
- GA4 Observation State
- Quality Flag
- Parameter Registration Gap
- 최근 측정 시각

## 4. Event Detail

- `eventKey`
- Event Name
- Provider
- 코드 구현 위치 목록
- 화면 요소 수
- GA4 Event Count
- 기간 비교
- Property Time Zone
- Fetched At
- Data Quality Flags

`atlasDomId`를 URL에 사용하지 않습니다.

## 5. Provider / Emitter 표시

- GA4: 주황 계열
- GTM: 청록 계열
- Mixpanel: 보라 계열
- Meta: 파랑 계열
- Custom/Unknown: 회색

색상 + 이름 + 아이콘을 같이 사용합니다.

## 6. GA4 결과 상태와 UX

### Result Status
- `ok`
- `no_rows`
- `unauthorized`
- `unsupported`
- `error`

### Quality Flags
- `subject_to_thresholding`
- `other_row_data_loss`
- `recent_data_may_change`

화면 문구 예:

- `no_rows` + recent flag → “최근 데이터는 아직 변동될 수 있습니다.”
- thresholding flag → “GA4 데이터 임계값 처리의 영향을 받을 수 있습니다.”
- other row flag → “고카디널리티로 인해 일부 값이 (other)에 집계될 수 있습니다.”

## 7. Natural Language Query

사용자 질문 전에 로컬 검색으로 후보를 최대 20개까지 축소합니다.

후보가 여러 개면 LLM이 임의 선택하지 않고 사용자에게 보여줍니다.
