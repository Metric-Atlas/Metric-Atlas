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
