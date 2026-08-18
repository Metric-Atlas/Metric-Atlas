# @metric-atlas/detector

Metric Atlas의 read-only source scanner와 build transform입니다.

```ts
import { scanProject } from "@metric-atlas/detector";

const { manifest } = await scanProject({
  root: process.cwd(),
  buildId: "commit-or-build-id",
});
```

`analyzeSource()`는 변환된 문자열을 반환할 뿐 입력 파일을 쓰지 않습니다. 기본 glob은 `src`의 JavaScript/TypeScript/JSX/TSX이며 test/spec/story와 build output을 제외합니다.

공식 MVP 패턴은 GA4 `gtag`/`sendGAEvent`, GTM `dataLayer.push`입니다. Mixpanel/Meta/PostHog/Amplitude direct adapter도 구조적 확장으로 포함되어 있으며 기본 활성화 여부는 Contract Approver가 최종 결정해야 합니다.
