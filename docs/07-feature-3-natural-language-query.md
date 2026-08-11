# 07. Feature 3 — Natural Language Query

## 1. 위치

자연어 기능은 제품 방향상 유지하지만 Core MVP Release Blocker는 아닙니다.

## 2. 처리 흐름

```text
Question
→ Local/Fuzzy candidate search
→ max 20 candidates
→ LLM Query Plan
→ Zod validation
→ Capability validation
→ GA4 Connector
→ Result + evidence
```

## 3. Query Types

초기:
- `definition`
- `event_count`
- `comparison`

Funnel은 제외합니다.

## 4. 이벤트 의미 원칙

- Event는 원본 이름으로 유지
- `purchase_click`을 영구적으로 “결제 시작”으로 저장하지 않음
- LLM 유사도는 해당 질문을 처리하기 위한 임시 candidate retrieval에만 사용
- 후보가 여러 개면 사용자에게 선택 요청

## 5. Query Plan의 Filter / Breakdown

자연어 질의가 실용성을 갖도록 제한적 Filter/Breakdown Contract를 허용합니다.

단 LLM이 임의 GA4 Dimension을 만들지 않고 Connector Capability에 등록된 항목만 사용합니다.

## 6. LLM Budget

기본 설정:
- candidate ≤ 20
- timeout 10초
- concurrent query ≤ 2
- Secret / 전체 소스코드 전송 금지

환경변수로 조정할 수 있습니다.

## 7. LLM 미연결

다음은 계속 동작합니다.
- exact event search
- fuzzy event search
- Provider filter
- file/path search
- Analytics Health navigation
