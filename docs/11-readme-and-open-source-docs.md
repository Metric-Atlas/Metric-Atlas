# 11. README / OSS Documentation Requirements

README는 clone 후 5분 안에 기능을 확인할 수 있어야 합니다.

## 필수 목차

1. What is Metric Atlas
2. Why it exists
3. Code ↔ GA4 Health example
4. Local Demo Quickstart
5. Internal Deployment
6. Installation
7. Vite Configuration
8. GA4 Service Account Setup
9. `.env.example`
10. Supported Patterns
11. Unsupported Patterns
12. Analytics Health statuses
13. Custom Dimension Gap
14. PR Analytics Report
15. Natural Language Query optional setup
16. Detector Extension Guide
17. Connector Extension Guide
18. Security
19. Troubleshooting
20. Contributing
21. License / Versioning

## Supported / Unsupported Showcase

`apps/demo-react-vite` 자체를 문서의 실행 가능한 예제로 사용합니다.

반드시 포함:
- inline gtag
- same-file handler
- dataLayer.push
- wrapper unsupported
- Custom Component overlay unsupported
- dynamic event unresolved

## OSS Position

운영은 내부 자체 호스팅이지만 Local Demo와 Adapter 구조를 제공해 외부 개발자가 쉽게 평가·기여할 수 있어야 합니다.
