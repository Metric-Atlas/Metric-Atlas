# 보안 정책

[English](./SECURITY.md) · **한국어**

> 이 문서는 한국어 번역본입니다. 내용이 다를 경우 영어 `SECURITY.md`를 기준으로 합니다.

## 지원 버전

Metric Atlas는 아직 1.0 이전이며 공식 공개 릴리스가 없습니다. 최신 `0.x` 라인에만 보안 수정을 제공합니다.

| 버전 | 지원 여부 |
| --- | --- |
| 최신 `0.x` | 지원 |
| 이전 `0.x` | 미지원 |

## 취약점 신고

**limgh2002@gmail.com** 으로 상세 내용을 보내주세요. 취약점 의심 사항은 공개 GitHub Issue로 등록하지 마세요.

가능하다면 다음을 포함해 주세요:

- 영향을 받는 패키지와 버전/커밋
- 재현 절차 또는 PoC
- 영향 범위(예: Credential 노출, 코드 실행, 데이터 노출)

신고 접수 후 **영업일 기준 5일 이내** 확인 회신을 목표로 하며, Triage 후 수정 일정을 공유합니다. 공개 전 저희가 수정할 수 있도록 합리적인 기간을 두는 Coordinated Disclosure를 권장합니다.

## 범위 참고

- GA4/LLM Credential 해석 방식과 브라우저 Bundle에 노출되지 않는 이유 등 Credential 처리 설계는 `docs/09-security-and-secrets.md`를 참고하세요.
- 이 정책은 이 모노레포의 패키지(`packages/*`)와 `docs/adr/ADR-008-standalone-vite-plugin-distribution.md`에 설명된 `@metric-atlas/vite` 배포본을 대상으로 합니다. 서드파티 의존성은 해당 프로젝트에 직접 신고해 주세요.
