import { C, EMITTER_KO, HEALTH_META, REVIEW_KO, VALUE_KO, emitterColors, eventKo, providerColors } from "../labels";
import { badge, tag } from "../ui";
import type { JoinedRow } from "../types";

export function EventCard({ row, active, onSelect }: { row: JoinedRow; active: boolean; onSelect: () => void }) {
  const ev = row.event;
  const meta = HEALTH_META[row.bucket];
  const provider = ev?.analyticsProvider ?? "ga4";
  const emitter = ev?.emitter ?? "—";
  const pc = providerColors(provider);
  const ec = emitterColors(emitter);
  const review = row.health
    ? row.health.reviewReason
      ? REVIEW_KO[row.health.reviewReason] ?? "검토 사유 없음"
      : "검토 사유 없음"
    : "GA4 Health 데이터 없음";

  return (
    <button
      onClick={onSelect}
      style={{
        textAlign: "left", border: `1px solid ${active ? C.accentLine : C.lineSoft}`,
        background: active ? C.accentBg : C.surfaceAlt, borderRadius: 10, padding: "12px 13px",
        cursor: "pointer", display: "flex", flexDirection: "column", gap: 7
      }}
    >
      <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 7 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, overflowWrap: "anywhere" }}>{eventKo(row.eventName)}</span>
        <span style={badge(meta.bg, meta.fg)}>{meta.ko}</span>
      </span>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, fontWeight: 600, overflowWrap: "anywhere" }}>
        {row.eventName}
      </span>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.faint, overflowWrap: "anywhere" }}>
        {row.eventKey}
      </span>
      <span style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
        <span style={tag(pc.bg, pc.fg)}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>provider {provider}</span>
          <span style={{ opacity: 0.75 }}>{VALUE_KO[provider] ?? ""}</span>
        </span>
        <span style={tag(ec.bg, ec.fg)}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>emitter {emitter}</span>
          <span style={{ opacity: 0.75 }}>{EMITTER_KO[emitter] ?? ""}</span>
        </span>
        <span style={{ ...tag("#f0f0eb", ev?.overlaySupported ? C.green : C.gray) }}>
          {ev ? (ev.overlaySupported ? "overlay 지원" : "overlay 미지원") : "overlay —"}
        </span>
        <span style={{ ...tag("#f0f0eb", C.gray), fontFamily: "'JetBrains Mono', monospace" }}>
          param {ev?.parameters.length ?? 0}
        </span>
      </span>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.muted, overflowWrap: "anywhere" }}>
        {ev ? `${ev.source.file}:${ev.source.line}:${ev.source.column}` : "코드에서 탐지되지 않음"}
      </span>
      <span style={{ fontSize: 12, color: "#4a4c47", lineHeight: 1.5, textWrap: "pretty" } as never}>{review}</span>
    </button>
  );
}
