# 00. Project Source of Truth

## 1. 프로젝트 정의

Metric Atlas는 **이미 존재하는 프론트엔드 코드에서 분석 이벤트를 자동 발견하고, 이벤트를 화면 요소와 연결하며, GA4 실측·설정과 대조하여 분석 체계의 건강 상태를 보여주는 오픈소스 도구**입니다.

## 2. 해결하려는 문제

1. 이벤트 정보가 코드·문서·분석 솔루션에 분산됩니다.
2. 코드가 바뀌어도 이벤트 문서가 최신화되지 않습니다.
3. 비개발자는 어느 화면 요소에 어떤 이벤트가 연결되어 있는지 보기 어렵습니다.
4. 코드에 이벤트가 있어도 GA4에서 실제로 관측되는지 확인하려면 별도 조사해야 합니다.
5. GA4에 데이터는 있어도 현재 코드에 구현이 남아 있는지 파악하기 어렵습니다.
6. 커스텀 파라미터를 코드에서 전송하면서 GA4 Custom Dimension 등록을 누락할 수 있습니다.
7. 분석 지식 확인을 위해 개발자에게 반복 문의하게 됩니다.

## 3. 핵심 사용자

1순위: 사내 마케터·데이터 분석가·기획자·PM  
2순위: 이벤트 구현을 검수하는 개발자  
3순위: OSS를 도입·확장하는 외부 개발자

운영 사용은 사내 자체 호스팅을 전제로 하며, 외부 개발자를 위한 Local Demo Mode를 별도로 제공합니다.

## 4. 세 가지 사용자 기능

### 기능 1 — Event Overlay
코드에서 이벤트를 발견하고 네이티브 화면 요소와 연결합니다. 사내 배포 화면의 작은 Metric Atlas 런처 버튼으로 오버레이를 켜고, 호버 시 이벤트명·Emitter·Provider·파라미터·코드 위치를 확인합니다.

### 기능 2 — Analytics Health Dashboard
첫 화면은 GA4 카운트 테이블이 아니라 Code ↔ GA4 상태 대조입니다.

핵심 판정:

- Code detected + GA4 observed → Healthy
- Code detected + GA4 not observed → Review needed
- GA4 observed + Code not detected → Review needed, 단 GA4-managed 이벤트 제외
- Code parameter + GA4 Custom Dimension not registered → Registration gap
- 데이터 품질 플래그 존재 → 판정 주의

Event Detail에서 발생 수와 기간 비교를 제공합니다.

Dashboard는 별도 설치형 패키지가 아니라 `@metric-atlas/runtime`(`metric-atlas serve`)에 내장되어 제공됩니다. 소비자는 Runtime을 self-host하고 GA4 credential을 설정하면 기본 경로(`/__metric-atlas/dashboard`, `--dashboard-path`로 변경 가능)에서 바로 확인할 수 있습니다. ADR-009, DEC-061.

### 기능 3 — Natural Language Query
원본 이벤트명과 GA4 결과를 자연어로 조회합니다. Core MVP Release Blocker는 아닙니다.

## 5. 핵심 전달 메커니즘 — PR Analytics Change Report

대시보드를 사람이 찾아오지 않아도 변경 정보를 전달하기 위해 GitHub Actions에서 Base/Head를 각각 스캔하고 PR에 이벤트 Diff를 게시합니다.

## 6. 고유 가치

Metric Atlas의 차별점은 **코드 위치 + 실제 화면 요소 + Analytics Provider 실측을 동시에 연결하는 것**입니다.

단순 이벤트 조회, 일반 BI, Tracking Plan 승인 workflow는 핵심 목표가 아닙니다.

## 7. 확정 실행 환경

- React + Vite 우선
- Node.js + TypeScript
- 사내 자체 호스팅
- Single Node Runtime
- Database 없음
- Build 시 Manifest 재생성
- 요청 시 GA4 조회
- 인메모리 Cache
- Local Demo Mode 공식 지원

## 8. MVP 지원 원칙

- SDK 직접 호출 우선
- 정적 이벤트명
- 인라인 및 같은 파일 핸들러
- 네이티브 JSX 요소
- GA4 첫 Connector
- `dataLayer.push`는 GTM으로 탐지
- 래퍼 호출, 파일 간 호출 그래프, Custom Component Overlay는 MVP 밖

## 9. 비목표

- GA4 대체 분석 도구
- 자체 이벤트 수집 SDK
- 데이터웨어하우스
- 역사적 Analytics Health 시계열 저장
- 자체 SSO
- 다중 Runtime 인스턴스
- GA4 Funnel API 기반 MVP
- 이벤트 승인·별칭 관리 시스템
