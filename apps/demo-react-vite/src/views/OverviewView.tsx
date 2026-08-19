import { C, HEALTH_META, REVIEW_KO, SUMMARY_BUCKETS, eventKo } from "../labels";
import { badge, card, grid, sectionTitle } from "../ui";
import type { Ga4Health, HealthBucket, JoinedRow, Manifest } from "../types";

const GLOSSARY: { term: string; desc: string }[] = [
  { term: "eventKey", desc: "이벤트를 구분하는 고유 키입니다. 예: ga4:purchase_click" },
  {
    term: "Provider / Emitter",
    desc: "Provider는 데이터가 최종적으로 쌓이는 도구, Emitter는 코드가 사용한 전송 방식입니다. dataLayer.push는 GTM 전송이며 GA4로 단정하지 않습니다."
  },
  { term: "파라미터 등록", desc: "코드가 보내는 값을 GA4 보고서에서 쓰려면 GA4 쪽 등록이 필요합니다." },
  { term: "Fixture 모드", desc: "저장된 예시 데이터로만 동작하는 모드입니다. 실제 GA4 조회는 하지 않습니다." }
];

const tile = (accent?: string) => ({
  textAlign: "left" as const, display: "block", background: C.surface, border: `1px solid ${C.line}`,
  borderRadius: 11, padding: "14px 16px", cursor: "pointer",
  ...(accent ? { borderTop: `3px solid ${accent}` } : {})
});

export function OverviewView(props: {
  rows: JoinedRow[];
  manifest: Manifest;
  health: Ga4Health;
  onOpenAll: () => void;
  onOpenBucket: (b: HealthBucket) => void;
  onOpenEvent: (eventKey: string) => void;
}) {
  const reviewRows = props.rows.filter((r) => r.health?.reviewReason);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={grid(210)}>
        <button onClick={props.onOpenAll} style={tile()}>
          <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.muted }}>코드에서 찾은 이벤트</span>
          <span style={{ display: "block", fontSize: 28, fontWeight: 700, marginTop: 3, letterSpacing: "-0.02em" }}>
            {props.manifest.events.length}
          </span>
          <span style={{ display: "block", fontSize: 11.5, color: C.faint, marginTop: 2 }}>
            Manifest events · 화면 연결 {props.manifest.bindings.length}건 · 클릭하면 전체 목록
          </span>
        </button>

        {SUMMARY_BUCKETS.map((b) => {
          const meta = HEALTH_META[b];
          return (
            <button key={b} onClick={() => props.onOpenBucket(b)} style={tile(meta.color)}>
              <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: C.muted }}>{meta.ko}</span>
              <span
                style={{ display: "block", fontSize: 28, fontWeight: 700, marginTop: 3, letterSpacing: "-0.02em", color: meta.color }}
              >
                {props.health.summary[b as keyof typeof props.health.summary]}
              </span>
              <span style={{ display: "block", fontSize: 11.5, color: C.faint, marginTop: 2, lineHeight: 1.45 }}>
                {meta.explain}
              </span>
            </button>
          );
        })}
      </div>

      <section style={card}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <h2 style={sectionTitle}>지금 확인이 필요한 이벤트</h2>
          <span style={{ fontSize: 12, color: C.faint }}>{reviewRows.length}건</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
          {reviewRows.map((r) => {
            const meta = HEALTH_META[r.bucket];
            return (
              <button
                key={r.eventKey}
                onClick={() => props.onOpenEvent(r.eventKey)}
                style={{
                  textAlign: "left", border: `1px solid ${C.lineSoft}`, background: C.surfaceAlt, borderRadius: 10,
                  padding: "12px 14px", cursor: "pointer", display: "flex", flexWrap: "wrap", gap: "8px 14px",
                  alignItems: "flex-start"
                }}
              >
                <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: "1 1 200px", minWidth: 0 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 700 }}>{eventKo(r.eventName)}</span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, overflowWrap: "anywhere" }}>
                    {r.eventName}
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: C.faint, overflowWrap: "anywhere" }}>
                    {r.eventKey}
                  </span>
                </span>
                <span style={{ flex: "2 1 260px", minWidth: 0, fontSize: 12.5, color: "#4a4c47", lineHeight: 1.5 }}>
                  {REVIEW_KO[r.health!.reviewReason!] ?? "검토 사유 없음"}
                </span>
                <span style={{ flex: "0 0 auto", ...badge(meta.bg, meta.fg) }}>{meta.ko}</span>
              </button>
            );
          })}
        </div>
        <p style={{ margin: "12px 0 0", fontSize: 11.5, color: C.faint, lineHeight: 1.55 }}>
          GA4에서 관측되지 않아도 즉시 구현 오류로 단정하지 않습니다. 최근 데이터 지연, 임계값 처리, (other) 집계 가능성을 함께 확인합니다.
        </p>
      </section>

      <section style={card}>
        <h2 style={{ ...sectionTitle, marginBottom: 10 }}>용어 안내</h2>
        <div style={grid(240, 18)}>
          {GLOSSARY.map((g) => (
            <div key={g.term}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{g.term}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 1.5 }}>{g.desc}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
