# @metric-atlas/overlay

Vanilla TypeScript Web Component와 Shadow DOM으로 구현한 build DOM overlay입니다.

```ts
import { mountMetricAtlasOverlay } from "@metric-atlas/overlay";

mountMetricAtlasOverlay({
  manifestUrl: "/__metric-atlas/api/manifest",
});
```

`metric-atlas:coverage` event의 detail에는 inject candidate, DOM matched/missing, binding coverage가 들어갑니다. Manifest의 사용자 문자열은 `textContent`로 렌더링합니다.
