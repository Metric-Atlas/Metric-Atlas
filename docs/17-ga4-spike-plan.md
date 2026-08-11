# 17. GA4 Data API Spike Plan

이 Spike는 GA4용 계약 v1과 Health 판정 규칙을 확정하기 전에 수행합니다.

## 1. 검증 목표

1. `eventName` dimension + `eventCount` metric 조회
2. 연결 Property의 Reporting Time Zone 획득 및 기간 경계 확인
3. Response Metadata에서 thresholding 여부 구분
4. `(other)` / data loss metadata 확인
5. 실제 Property의 데이터 지연 체감 측정
6. GA4 Admin/Metadata API로 Custom Dimension 목록 조회
7. API quota/token 소비량과 호출 latency 측정
8. Service Account 최소 권한 구성 확인

## 2. 제외

`runFunnelReport`는 Core MVP에서 채택하지 않으므로 성공 기준에서 제외합니다.

## 3. 산출물

`docs/spikes/ga4-data-api-result.md`에 기록:

- Property 설정
- 테스트 Query
- 응답 예시를 민감정보 제거 후 요약
- latency
- quota observation
- recent-data 안정화 관찰
- quality flag mapping
- custom dimension lookup feasibility
- contract 변경 제안

## 4. Spike 이후 변경 가능 항목

- `METRIC_ATLAS_GA4_RECENT_WINDOW_HOURS` 기본값
- Cache TTL
- DataQualityFlag 세부 처리
- Health 판정 메시지
- Runtime outbound concurrency default

변경은 Decision Log와 Contract ADR을 거칩니다.
