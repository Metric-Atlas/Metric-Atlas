# Fixtures

Phase 0 병렬 개발 기준선입니다.

`docs/20-phase-0-common-fields.md`는 ADR-001(`docs/adr/ADR-001-phase0-contract-v0-freeze.md`)로 Accepted 상태이며, 아래 Fixture는 Contract v0 기준선입니다. `packages/contracts`의 Zod Schema가 Machine SoT이며, Contract Test가 이 Fixture들을 검증합니다.

- `mock-manifest.json`: B의 실제 Scanner가 완성되기 전 C/D가 사용
- `mock-ga4-health.json`: C Dashboard와 D Search/Query가 공통 사용
- `mock-query-result.json`: D Query UI 및 통합 테스트에 사용

Fixture 변경은 Contract 변경과 동일하게 Consumer 영향을 확인해야 하며, 신규 ADR을 거칩니다.

확인된 정합성 (ADR-001 반영):

- Health Item의 `codeState="detected"`인 GA4 Event는 Manifest에 같은 `eventKey`가 존재 (`ga4:signup_complete` 추가)
- Health Parameter Registration State는 Manifest Parameter를 근거로 하며 전수 포함 (`purchase_click`에 `value`/`campaign_slot` 반영)
- `mock-query-result.json`의 `result`가 QueryResult 필수 필드(`dateRange` 절대 날짜, `comparisonDateRange`)를 포함
- GTM Event(`gtm:lead_submit`)는 `analyticsProvider="unknown"`이므로 `providerDetectionConfidence="provider_unknown"`
- `mock-manifest.json`의 모든 Event/Binding에 `implementationKey`/`implementationKeys` 포함
- `mock-ga4-health.json`의 `summary`는 상호배타 버킷 우선순위(`unresolved > parameterRegistrationGap > codeOnly > ga4Managed > ga4Only > healthy`)로 재계산됨

Contract v0에 아직 없는 것 (GA4 Spike, C-SPIKE-001 결과 대기):

- Health 관측 기간 기본값, thresholding/`(other)` → DataQualityFlag 매핑 세부 규칙, `no_rows` 문구 규칙은 미확정이며 Fixture의 현재 값은 예시입니다.
