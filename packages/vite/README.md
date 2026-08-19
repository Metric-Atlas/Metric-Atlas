# @metric-atlas/vite

```ts
import metricAtlas from "@metric-atlas/vite";

metricAtlas({
  enabled: true,
  include: ["src/**/*.{js,jsx,ts,tsx}"],
  overlay: { enabled: true },
});
```

플러그인은 source 파일을 수정하지 않고 Vite transform output에만 `data-atlas-id`를 주입합니다. Production build에는 `metric-atlas/manifest.json`을 emit하고, dev server에서는 기본적으로 `/__metric-atlas/api/manifest`를 제공합니다.

Production overlay의 manifest endpoint는 A의 Single Node Runtime과 통합해야 합니다. 다른 endpoint를 사용할 때는 `manifestEndpoint`를 지정합니다.

Dev session에서는 동일 source transform 결과를 메모리에서 재사용하고, 파일 삭제/unlink 시 해당 파일의 Event와 Binding을 Manifest에서 제거합니다.
