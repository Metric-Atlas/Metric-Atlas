# GA4 Data API Spike 결과 (C-SPIKE-001)

- Status: **In progress — 실행 대기** (Property/Service Account 확보 전)
- Owner: 재욱 (Member C)
- Plan: `docs/17-ga4-spike-plan.md` / Task Spec: `docs/tasks/c-ga4-spike-task-spec.md`
- Scripts: `spikes/ga4/`

> 아래 각 섹션은 스크립트 실행 후 채웁니다. `TODO`가 남아 있는 동안 이 문서는 결론이 아닙니다.

## 1. Property 설정

- Property: TODO (실명 마스킹, 예: "사내 서비스 X production")
- Property ID: TODO (마지막 3자리 마스킹 권장)
- Service Account 권한: TODO (Viewer 확인 여부)
- 데이터 특성: TODO (일일 이벤트 규모 대략치, Google Signals 활성 여부)

## 2. 검증 결과 요약

| # | 항목 (docs/17 §1) | 결과 | 스크립트 |
|---|---|---|---|
| 1 | eventName + eventCount 조회 | TODO | `spike:report` |
| 2 | Reporting Time Zone / 기간 경계 | TODO | `spike:timezone` |
| 3 | thresholding metadata 구분 | TODO (미재현 시 사유) | `spike:quality` |
| 4 | (other) / data loss metadata | TODO (미재현 시 사유) | `spike:quality` |
| 5 | 최근 데이터 지연 체감 | TODO (관찰 기간 명시) | `spike:freshness` 반복 |
| 6 | Custom Dimension 목록 조회 | TODO | `spike:dimensions` |
| 7 | quota / latency | TODO | 전 스크립트 공통 |
| 8 | 최소 권한으로 전 항목 동작 | TODO | `check` + 전체 |

## 3. 테스트 Query와 응답 요약 (민감정보 제거)

TODO — 항목별 요청 파라미터와 응답 구조 요약 (raw 응답 원문 금지)

## 4. Latency / Quota 관찰

- runReport latency: TODO (호출별 기록, 체감 p50/max)
- getMetadata / listCustomDimensions latency: TODO
- 토큰 소비: TODO (`propertyQuota` 출력 기준, 호출당 소비량)
- → outbound concurrency 기본값(현재 4) 유지/조정 제안: TODO

## 5. Recent-data 안정화 관찰

- 관찰 로그: `spikes/ga4/out/freshness-log.jsonl` 요약 TODO
- → `METRIC_ATLAS_GA4_RECENT_WINDOW_HOURS=48` 유지/조정 제안: TODO

## 6. Quality Flag 매핑 결론

| GA4 응답 신호 | DataQualityFlag | 근거 |
|---|---|---|
| `metadata.subjectToThresholding` | `subject_to_thresholding` | TODO (실측/문서) |
| `metadata.dataLossFromOtherRow` 또는 `(other)` row | `other_row_data_loss` | TODO |
| 조회 종료일이 recent window 이내 | `recent_data_may_change` | TODO (관찰 근거) |

## 7. Custom Dimension 판정 (`builtin`) 규칙 결론

- Admin API `parameterName` 매칭으로 `registered_custom_dimension` 판정: TODO
- `builtin` 판정 방법 (Metadata apiName vs 예약 파라미터 목록): TODO
- `unknown` 처리 조건: TODO

## 8. Contract 변경 제안

TODO — 없으면 "없음". 채택 시 ADR로 진행 (docs/17 §4).

## 9. 기본값 조정 제안

- `METRIC_ATLAS_GA4_RECENT_WINDOW_HOURS`: TODO
- Cache TTL (`METRIC_ATLAS_CACHE_TTL_SECONDS=300`): TODO
- `METRIC_ATLAS_MAX_OUTBOUND_CONCURRENCY=4`: TODO
