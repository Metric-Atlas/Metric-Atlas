import {
  C, FIELD_KO, FLAG_KO, HEALTH_META, PARAM_STATE_COLOR, REVIEW_KO, VALUE_KO, eventKo, valueKo
} from "../labels";
import { badge, card, fieldLabel, grid, mono, sectionTitle } from "../ui";
import type { JoinedRow } from "../types";

/** Field names stay English; Korean marketer term + value meaning are shown alongside. */
function factsOf(row: JoinedRow) {
  const ev = row.event;
  const h = row.health;
  const b = row.bindings[0];
  return [
    ["PROVIDER", ev?.analyticsProvider ?? "ga4"],
    ["EMITTER", ev?.emitter ?? "—"],
    ["PROVIDER CONFIDENCE", ev?.providerDetectionConfidence ?? "—"],
    ["OVERLAY SUPPORTED", String(ev?.overlaySupported ?? false)],
    ["BINDING ELEMENT", b?.element.type ?? "없음"],
    ["ATLAS DOM ID", b?.atlasDomId ?? "—"],
    ["BINDING CONFIDENCE", b?.bindingConfidence ?? "—"],
    ["CODE STATE", h?.codeState ?? "no_health"],
    ["GA4 OBSERVATION", h?.ga4ObservationState ?? "no_health"],
    ["GA4 MANAGED", h?.ga4ManagedState ?? "no_health"],
    ["GTM DESTINATION", row.gtmRoute?.destinationProvider ?? "—"]
  ] as [string, string][];
}

export function EventDetail({ row, onMakeQuery }: { row: JoinedRow | null; onMakeQuery: () => void }) {
  if (!row) {
    return (
      <section style={card}>
        <h2 style={sectionTitle}>선택 이벤트 상세</h2>
        <div style={{ padding: "22px 0", color: C.faint, fontSize: 13 }}>목록에서 이벤트를 선택하세요.</div>
      </section>
    );
  }

  const ev = row.event;
  const h = row.health;
  const meta = HEALTH_META[row.bucket];
  const m = h?.latestMeasurement ?? null;
  const flags = m?.qualityFlags ?? [];
  const notice = [h?.reviewReason ? REVIEW_KO[h.reviewReason] : null, ...flags.map((x) => FLAG_KO[x] ?? x)]
    .filter(Boolean)
    .join(" ");
  const params = (ev?.parameters ?? []).map((name) => {
    const st = h?.parameterRegistrationStates.find((p) => p.parameter === name);
    const key = st?.state ?? (h ? "unknown" : "no_health");
    return { name, state: key, stateKo: VALUE_KO[key] ?? key, ...PARAM_STATE_COLOR[key] };
  });

  return (
    <section style={{ ...card, minWidth: 0 }}>
      <h2 style={{ ...sectionTitle, marginBottom: 12 }}>선택 이벤트 상세</h2>

      <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
        <span style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em", overflowWrap: "anywhere" }}>
          {eventKo(row.eventName)}
        </span>
        <span style={badge(meta.bg, meta.fg)}>{meta.ko}</span>
      </div>
      <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 600, marginTop: 4, overflowWrap: "anywhere" }}>
        {row.eventName}
      </div>
      <div style={{ fontFamily: mono, fontSize: 12, color: C.faint, marginTop: 3, overflowWrap: "anywhere" }}>
        {row.eventKey}
      </div>

      <div
        style={{
          marginTop: 13, padding: "11px 13px", background: "#fafaf7", border: `1px solid ${C.lineSoft}`,
          borderRadius: 9, fontFamily: mono, fontSize: 11.5, color: "#3a3c37", lineHeight: 1.6, overflowWrap: "anywhere"
        }}
      >
        <div>{ev ? `${ev.source.file}:${ev.source.line}:${ev.source.column}` : "코드에서 탐지되지 않음"}</div>
        <div style={{ color: C.faint }}>{ev?.implementationKey ?? "implementationKey 없음"}</div>
      </div>

      {notice && (
        <div
          style={{
            marginTop: 11, padding: "11px 13px", borderRadius: 9, background: "#fff8ea",
            border: "1px solid #f0d9a8", fontSize: 12.5, color: "#6b4a12", lineHeight: 1.55, overflowWrap: "anywhere"
          }}
        >
          {notice}
        </div>
      )}

      {row.gtmRoute && (
        <div
          style={{
            marginTop: 11, padding: "11px 13px", borderRadius: 9, background: C.tealBg,
            border: `1px solid ${C.teal}`, fontSize: 12.5, color: "#134e4a", lineHeight: 1.55,
            overflowWrap: "anywhere"
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 3 }}>Code → GTM → GA4</div>
          <div>
            GTM Trigger <span style={{ fontFamily: mono }}>{row.gtmRoute.triggerName}</span>
            {" → "}
            Tag <span style={{ fontFamily: mono }}>{row.gtmRoute.tagName}</span>
          </div>
          <div>
            destination event <span style={{ fontFamily: mono }}>{row.gtmRoute.destinationEventName}</span>
            {row.gtmRoute.measurementId ? (
              <> · measurement <span style={{ fontFamily: mono }}>{row.gtmRoute.measurementId}</span></>
            ) : null}
          </div>
        </div>
      )}

      <div style={{ ...grid(130, 14), marginTop: 14 }}>
        {factsOf(row).map(([label, value]) => (
          <div key={label}>
            <div style={fieldLabel}>{label}</div>
            <div style={{ fontSize: 11, color: "#a0a29c", marginTop: 1 }}>{FIELD_KO[label] ?? ""}</div>
            <div style={{ fontFamily: mono, fontSize: 12, marginTop: 3, overflowWrap: "anywhere" }}>{value}</div>
            <div style={{ fontSize: 11.5, color: "#4a4c47", marginTop: 1, lineHeight: 1.45 }}>
              {valueKo(label, value)}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16 }}>
        <div style={{ ...fieldLabel, fontSize: 10, marginBottom: 6 }}>PARAMETERS · GA4 등록 상태</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {params.length === 0 && <div style={{ fontSize: 12, color: C.faint }}>파라미터 없음</div>}
          {params.map((p) => (
            <div
              key={p.name}
              style={{
                display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between",
                gap: "6px 10px", padding: "7px 10px", border: `1px solid ${C.lineSoft}`, borderRadius: 7,
                background: C.surfaceAlt
              }}
            >
              <span style={{ fontFamily: mono, fontSize: 12.5, overflowWrap: "anywhere" }}>{p.name}</span>
              <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 11.5, color: "#4a4c47" }}>{p.stateKo}</span>
                <span
                  style={{
                    padding: "2px 8px", borderRadius: 5, fontFamily: mono, fontSize: 11, fontWeight: 600,
                    background: p.bg, color: p.fg
                  }}
                >
                  {p.state}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ ...grid(150, 10), marginTop: 14 }}>
        <div style={{ padding: "11px 13px", border: `1px solid ${C.lineSoft}`, borderRadius: 9, background: C.surfaceAlt }}>
          <div style={fieldLabel}>최근 측정값</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginTop: 3, letterSpacing: "-0.02em" }}>
            {m?.value != null ? m.value.toLocaleString() : "—"}
          </div>
          <div style={{ fontSize: 11.5, color: "#4a4c47" }}>{VALUE_KO[m?.resultStatus ?? "no_health"] ?? ""}</div>
          <div style={{ fontFamily: mono, fontSize: 11, color: C.faint }}>status: {m?.resultStatus ?? "no_health"}</div>
        </div>
        <div style={{ padding: "11px 13px", border: `1px solid ${C.lineSoft}`, borderRadius: 9, background: C.surfaceAlt }}>
          <div style={fieldLabel}>QUALITY FLAGS</div>
          <div style={{ fontFamily: mono, fontSize: 11.5, marginTop: 4, color: "#3a3c37", overflowWrap: "anywhere" }}>
            {flags.length ? flags.join(", ") : "없음"}
          </div>
        </div>
      </div>

      <button
        onClick={onMakeQuery}
        style={{
          marginTop: 14, width: "100%", border: `1px solid ${C.accentLine}`, background: C.accentBg,
          color: C.accent, borderRadius: 9, padding: "10px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer"
        }}
      >
        이 이벤트로 질의 만들기 →
      </button>
    </section>
  );
}
