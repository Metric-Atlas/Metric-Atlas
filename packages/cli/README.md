# @metric-atlas/cli

```bash
metric-atlas scan --root . --output .metric-atlas/manifest.json
metric-atlas diff --base base-manifest.json --head head-manifest.json --format markdown
```

`scan`은 source를 read-only로 스캔합니다. `diff`는 logical event 추가/삭제, emitter/provider 변경, parameter 변경, dynamic/unresolved와 wrapper warning을 PR용 Markdown 또는 JSON으로 출력합니다.
