# Fixtures

Phase 0 병렬 개발 기준선입니다.

현재 Fixture는 기존 계약 설명을 따릅니다. `docs/20-phase-0-common-fields.md`는 Proposed 상태이며, A 승인 후 Zod Schema와 Fixture를 함께 갱신합니다.

- `mock-manifest.json`: B의 실제 Scanner가 완성되기 전 C/D가 사용
- `mock-ga4-health.json`: C Dashboard와 D Search/Query가 공통 사용
- `mock-query-result.json`: D Query UI 및 통합 테스트에 사용

Fixture 변경은 Contract 변경과 동일하게 Consumer 영향을 확인해야 합니다.

승인 후 확인할 정합성:

- Health Item의 `codeState="detected"`인 GA4 Event는 Manifest에 같은 `eventKey`가 존재
- Health Parameter Registration State는 Manifest Parameter를 근거로 함
- `mock-query-result.json`의 `result`가 QueryResult 필수 필드를 포함

현재 Proposed Common Fields와의 알려진 차이:

- `mock-manifest.json`에 `implementationKey`와 Binding의 `implementationKeys`가 없음
- GTM Event가 `analyticsProvider="unknown"`이지만 `providerDetectionConfidence="provider_exact"`임
- Health의 `ga4:signup_complete`가 Manifest에 없음
- Health의 `campaign_slot` Parameter가 Manifest의 동일 Event Parameter에 없음
- `mock-query-result.json`의 `result`에 `dateRange`가 없음
