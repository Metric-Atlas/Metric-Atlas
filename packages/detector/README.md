# @metric-atlas/detector

Metric Atlas의 read-only source scanner와 build transform입니다.

```ts
import { scanProject } from "@metric-atlas/detector";

const { manifest } = await scanProject({
  root: process.cwd(),
  buildId: "commit-or-build-id",
  detectors: ["ga4", "gtm"],
});
```

`analyzeSource()`는 변환된 문자열을 반환할 뿐 입력 파일을 쓰지 않습니다. 기본 glob은 `src`의 JavaScript/TypeScript/JSX/TSX이며 test/spec/story와 build output을 제외합니다.

공식 MVP 패턴은 GA4 `gtag`/`sendGAEvent`, GTM `dataLayer.push`이며 기본 Adapter도 이 둘뿐입니다. Mixpanel/Meta/PostHog/Amplitude direct adapter는 `detectors`에 이름을 추가한 경우에만 opt-in으로 활성화됩니다.

`scanGitRef({ root, ref })`는 checkout을 변경하지 않고 Git tree를 직접 읽어 PR Base/Head Manifest를 생성합니다. 모든 Manifest는 반환 전에 `@metric-atlas/contracts`의 Event Manifest Zod Schema를 통과해야 합니다.
