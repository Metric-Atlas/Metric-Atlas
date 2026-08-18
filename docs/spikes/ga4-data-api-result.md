# GA4 Data API Spike 결과 (C-SPIKE-001)

- Status: **Partially complete** — API 동작·권한·quota 검증 완료. 데이터 의존 항목은 Property 데이터 수집 후 재실행 필요 (아래 §10)
- Owner: 재욱 (Member C)
- 실행일: 2026-08-18 (1차)
- Plan: `docs/17-ga4-spike-plan.md` / Task Spec: `docs/tasks/c-ga4-spike-task-spec.md`
- Scripts: `spikes/ga4/`

## 1. Property 설정

- Property: Metric Atlas Homepage (사내 신규 생성, 2026-08 중순 생성)
- Property ID: 550079xxx (마스킹)
- Reporting Time Zone: `Asia/Seoul`, currency: KRW
- Service Account 권한: 대상 Property 뷰어(Viewer)만 — 전 항목 이 권한으로 수행됨
- 데이터 특성: **수집 데이터 0건** (rowCount=0). Measurement ID 태그(G-MSPT...)의 사이트 설치 여부 확인 필요

## 2. 검증 결과 요약

| # | 항목 (docs/17 §1) | 결과 |
|---|---|---|
| 1 | eventName + eventCount 조회 | ✅ API 동작 확인. 단 데이터 0건 → `no_rows` 시나리오가 실측됨 (§3) |
| 2 | Reporting Time Zone / 기간 경계 | 🟡 부분 — Admin `property.timeZone`과 Data `metadata.timeZone` 모두 `Asia/Seoul`로 일치 확인. 날짜 경계 검증은 데이터 필요 |
| 3 | thresholding metadata 구분 | 🟡 응답 구조 확인 (§4). 재현은 불가 — 데이터 0건 + Google Signals 미설정 추정 |
| 4 | (other) / data loss | 🟡 `dataLossFromOtherRow=false` 필드 존재 확인. `(other)` row 미재현 (데이터 없음) |
| 5 | 최근 데이터 지연 체감 | ⏸ 대기 — 데이터 수집 시작 후 `spike:freshness` 반복 실행 |
| 6 | Custom Dimension 목록 조회 | ✅ Admin `listCustomDimensions` 동작 (현재 0건). **builtin 판정의 중대한 발견 → §5** |
| 7 | quota / latency | ✅ §6 |
| 8 | 최소 권한으로 전 항목 동작 | ✅ Viewer만으로 Data/Admin/Metadata 전부 성공 |

## 3. `no_rows` 실측 (검증 1)

데이터 없는 Property 조회 시 에러가 아니라 **정상 응답 + `rowCount: 0` + `rows` 생략**으로 반환됨.

→ 계약 확인: `resultStatus="no_rows"` 판정은 "응답 성공 & rowCount=0"으로 구현 가능. `unauthorized`/`error`와 명확히 구분됨 (DEC-023 지지). Health의 `ga4ObservationState="not_observed"`도 동일 근거 사용 가능.

## 4. Response Metadata 구조 (검증 3, 4)

실측된 `metadata` 형태:

```text
dataLossFromOtherRow: false      ← 항상 존재
subjectToThresholding: (생략됨)   ← proto3 기본값 생략: false면 필드 자체가 없음
samplingMetadatas: []
schemaRestrictionResponse: (생략됨)
```

→ **계약 반영 필요**: `subjectToThresholding`은 false일 때 응답에서 필드가 생략된다. Connector는 `metadata.subjectToThresholding === true`일 때만 `subject_to_thresholding` flag를 세워야 하며, **필드 부재 = false로 해석**한다 (undefined를 unknown으로 취급하지 않음).

thresholding 실재현은 user 계열 metric + 충분한 데이터 + (통상) Google Signals 활성이 필요해 현 Property에서 불가. **문서 근거 + 위 필드 구조 확인으로 v1 매핑을 진행하고, 데이터 축적 후 재검증을 권고** (Task Spec Open decision 2 → A 판단 요청).

## 5. Custom Dimension / `builtin` 판정 (검증 6) — 중대 발견

- Admin API `listCustomDimensions`: 동작 확인. `parameterName`/`scope`/`displayName` 반환 → `registered_custom_dimension` 판정은 **`parameterName` 정확 매칭으로 실현 가능** (현재 등록 0건이라 등록 후 재확인 필요).
- Data API `getMetadata`: built-in **dimension** 375건 반환. 그러나 **이벤트 파라미터 이름공간과 다름** — `currency`, `value` 같은 GA4 예약/자동 파라미터가 dimension `apiName` 목록에 그대로 존재하지 않음 (실측: `currency` → 매칭 실패).

→ **계약 반영 필요**: `ParameterState="builtin"` 판정은 getMetadata apiName 매칭으로 **불가**. GA4 예약·자동 수집 파라미터 목록(예: `currency`, `value`, `page_location` 등)을 **버전 관리되는 Registry로 별도 유지**해야 함 — docs/06 §3의 GA4 Managed Event Registry와 동일한 접근을 Parameter에도 적용. 판정 순서 제안:
1. Admin custom dimension `parameterName` 매칭 → `registered_custom_dimension`
2. Reserved Parameter Registry 매칭 → `builtin`
3. 둘 다 아니면 → `not_registered`
4. Admin API 조회 실패 시 → `unknown`

## 6. Latency / Quota 관찰 (검증 7)

- latency (1차 실행, 콜드 스타트 포함): Data `runReport` 0.6~1.2초, Admin `getProperty`/`listCustomDimensions` ~1.1초, `getMetadata` ~1.2초
- 토큰 소비: **단순 runReport 1회당 ~1토큰** (한도: 일 200,000 / 시간 40,000). Health Dashboard가 이벤트 50개를 개별 조회해도 하루 한도의 0.03% 수준
- concurrent request 한도: **10** (property 단위)
- `potentiallyThresholdedRequestsPerHour`: 120 — user 계열 metric 조회는 시간당 120회 제한이 별도로 있음. **Health 엔진은 eventCount(이벤트 계열)만 쓰므로 무관하나, 향후 확장 시 주의**

→ 기본값 제안 (§9): outbound concurrency 4는 한도 10 대비 안전. quota가 아니라 latency(~1초/콜)가 실질 제약이므로 Cache TTL 300초 유지 적절.

## 7. Timezone (검증 2)

- Admin과 Data API 모두 `Asia/Seoul` 일치 → `reportingTimezone`은 둘 중 어디서든 획득 가능. **Connector는 Admin `getProperty` 1회로 확보 후 캐시 권장** (요청마다 조회 불필요)
- `yesterday`/`today` preset의 날짜 경계가 Property timezone 기준인지는 데이터 필요 → 2차 실행 항목

## 8. Contract 변경 제안

1. **`subjectToThresholding` 부재=false 해석 규칙** 명시 (§4) — Connector 구현 규칙, Zod schema 영향 없음
2. **Reserved Parameter Registry 신설** (§5) — `builtin` 판정용. GA4 Managed Event Registry(docs/06 §3)와 짝을 이루는 versioned registry. Producer C, Consumer C. → **ADR 필요**
3. `ConnectionResult.reportingTimezone`은 Admin getProperty 기반으로 확정 가능 (§7) — 기존 계약과 일치, 변경 없음

## 9. 기본값 조정 제안

- `METRIC_ATLAS_GA4_RECENT_WINDOW_HOURS=48`: **유지** (지연 실측 전까지. 2차 관찰 후 재검토)
- `METRIC_ATLAS_CACHE_TTL_SECONDS=300`: **유지** (quota 여유 크므로 신선도 우선 가능하나, latency ~1초 감안 시 적절)
- `METRIC_ATLAS_MAX_OUTBOUND_CONCURRENCY=4`: **유지** (property 동시 한도 10의 40%)

## 10. 2차 실행 조건 (남은 TODO)

데이터 의존 항목 재검증을 위해 필요한 것:

1. **홈페이지에 G-MSPT... 태그 설치 확인 + 실 트래픽** (또는 테스트 이벤트 발생) → 검증 1 rows, 2 날짜 경계, 5 freshness 재실행
2. **Custom Dimension 1건 테스트 등록** (GA4 편집자 권한 필요 — 관리자에게 요청, 예: `campaign_slot`) → §5의 `registered_custom_dimension` 매칭 실측
3. thresholding/(other) 재현은 데이터 축적 후 시도하되, **미재현이어도 §4 구조 확인으로 v1 진행 가능** — A 확인 요청
