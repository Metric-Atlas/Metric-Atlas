# @metric-atlas/cli

```bash
metric-atlas scan --root . --output .metric-atlas/manifest.json
metric-atlas diff --base base-manifest.json --head head-manifest.json --format markdown
metric-atlas serve ./dist --env ./.env.metric-atlas --port 8787
```

`scan`은 source를 read-only로 스캔합니다. `diff`는 logical event 추가/삭제, emitter/provider 변경, parameter 변경, dynamic/unresolved와 wrapper warning을 PR용 Markdown 또는 JSON으로 출력합니다.

`serve`는 빌드 산출물을 정적으로 제공하고 `/__metric-atlas/api/*` Runtime API를 엽니다. GA4/LLM credential은 브라우저가 아니라 Node Runtime의 환경변수 또는 `--env` 파일에서만 읽습니다.
