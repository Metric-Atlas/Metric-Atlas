# 19. PR Analytics Change Report

## 1. 목적

사용자가 Dashboard를 습관적으로 열지 않아도 Analytics 변경을 코드 리뷰 흐름으로 전달합니다.

## 2. 비교 방식

DB나 외부 Baseline Store를 사용하지 않습니다.

PR:
```text
Base SHA checkout → metric-atlas scan → base manifest
Head SHA checkout → metric-atlas scan → head manifest
→ semantic diff
```

Push:
```text
before SHA vs after SHA
```

## 3. Report

예시:

```text
Metric Atlas Analytics Change

+ Added events: 3
- Removed events: 1
~ Changed emitter/provider: 0
! Dynamic/unresolved: 2
! Possible wrapper usage: 1

GA4 custom parameter changes:
+ added parameter: campaign_slot
```

## 4. CI Blocking Policy

초기에는 Report-only를 기본으로 합니다.

다음은 선택적으로 Block 가능:
- scanner crash
- contract invalid
- source mutation detected
- secret exposure

Event 추가/삭제 자체는 제품 변경일 수 있으므로 기본 Build Failure로 간주하지 않습니다.

## 5. 구현 경로

```bash
metric-atlas report \
  --root . \
  --base-ref "$BASE_SHA" \
  --head-ref "$HEAD_SHA" \
  --output metric-atlas-report.md \
  --manifest-dir .metric-atlas/pr
```

`report`는 checkout이나 사용자 source를 바꾸지 않고 Git object의 Base/Head tree를 직접 읽습니다. 기본 GA4/GTM Detector만 실행하며 다른 Provider는 `--detectors`로 opt-in합니다. `.github/workflows/metric-atlas-analytics-report.yml`은 report와 두 Manifest를 artifact/Job Summary로 보존하고 동일 marker의 PR comment를 갱신합니다.

기본 정책은 report-only입니다. `--fail-on-parse-error`를 지정한 경우에만 parse warning을 실패 코드로 승격하며 scanner crash와 Contract validation 실패는 항상 실패합니다.
