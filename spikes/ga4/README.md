# GA4 Data/Admin API Spike (C-SPIKE-001)

`docs/17-ga4-spike-plan.md` 검증용 일회성 스크립트. **프로덕션 코드가 아니며** 패키지 빌드에 포함하지 않습니다. Task Spec: `docs/tasks/c-ga4-spike-task-spec.md`.

## 준비

1. GA4 Property에 Service Account를 **뷰어(Viewer)** 로 추가 (GA4 관리 → 속성 액세스 관리)
2. 해당 GCP 프로젝트에서 **Google Analytics Data API**, **Google Analytics Admin API** 활성화
3. Service Account JSON 키를 repo 밖 경로에 저장

```bash
cd spikes/ga4
pnpm install
cp .env.example .env   # 실제 값 입력 (.env는 gitignore됨)
```

## 실행

```bash
pnpm check              # 0. 연결/최소 권한 확인 (docs/17 검증 8)
pnpm spike:report       # 1. eventName/eventCount + quota/latency (검증 1, 7)
pnpm spike:timezone     # 2. Reporting Time Zone과 기간 경계 (검증 2)
pnpm spike:quality      # 3-4. thresholding / (other) metadata (검증 3, 4)
pnpm spike:freshness    # 5. 데이터 지연 관찰 — 몇 시간 간격 반복 실행 (검증 5)
pnpm spike:dimensions   # 6. Custom Dimension / builtin 판정 (검증 6)
pnpm spike:all          # 1~6 일괄 실행
```

## 결과 기록

각 스크립트 출력의 "확인 포인트"를 `docs/spikes/ga4-data-api-result.md`에 기록합니다. 민감정보(Property 실명, 실 URL 등)는 마스킹합니다. thresholding/(other)가 재현되지 않으면 그 사실과 추정 사유를 결과로 기록합니다.

## 금지

- credential 파일·`.env`를 커밋하지 않기
- `fixtures/`, `docs/20` 등 A 승인 영역 수정하지 않기 (Task Spec Forbidden files)
