import type { CSSProperties } from "react";
import { C } from "../labels";
import { mono } from "../ui";
import type { ViewId } from "../App";

const NAV: { id: ViewId; label: string; sub: string }[] = [
  { id: "overview", label: "Health 요약", sub: "상태별 이벤트 수" },
  { id: "events", label: "이벤트 탐색", sub: "검색 · 목록 · 상세" },
  { id: "query", label: "질의", sub: "QueryPlan · Mock 결과" }
];

const navButton = (active: boolean): CSSProperties => ({
  flex: "1 1 170px", textAlign: "left", border: 0, borderRadius: 9, padding: "11px 12px", cursor: "pointer",
  background: active ? "#f4f4f1" : "#22252b", color: active ? C.ink : "#e8e8e2"
});

export function Sidebar(props: {
  view: ViewId;
  onNavigate: (v: ViewId) => void;
  context: { label: string; value: string }[];
}) {
  return (
    <aside
      style={{
        flex: "1 1 244px", maxWidth: "100%", background: C.ink, color: "#f4f4f1",
        padding: "20px 18px", display: "flex", flexDirection: "column", gap: 18
      }}
    >
      <div>
        <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: "-0.01em" }}>Metric Atlas</div>
        <div style={{ fontSize: 11.5, color: "#9b9d9a", marginTop: 2 }}>Local Demo Dashboard</div>
      </div>

      <div
        style={{
          display: "flex", alignItems: "center", gap: 8, padding: "7px 11px",
          border: "1px solid #b45309", borderRadius: 9, background: "#3a2a11"
        }}
      >
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#f0a13a", flex: "none" }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: "#f0c48a", overflowWrap: "anywhere" }}>
          Fixture 모드 · Mock 데이터
        </span>
      </div>

      <nav style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {NAV.map((n) => {
          const active = props.view === n.id;
          return (
            <button key={n.id} onClick={() => props.onNavigate(n.id)} style={navButton(active)}>
              <span style={{ display: "block", fontSize: 13.5, fontWeight: 600 }}>{n.label}</span>
              <span style={{ display: "block", fontSize: 11, marginTop: 2, color: active ? C.muted : "#8f918b" }}>
                {n.sub}
              </span>
            </button>
          );
        })}
      </nav>

      <div
        style={{
          borderTop: "1px solid #2c2f35", paddingTop: 14, display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(104px, 1fr))", gap: "10px 14px"
        }}
      >
        {props.context.map((c) => (
          <div key={c.label}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.08em", color: "#83857f" }}>{c.label}</div>
            <div style={{ fontFamily: mono, fontSize: 11.5, marginTop: 2, overflowWrap: "anywhere", lineHeight: 1.4 }}>
              {c.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: "auto", fontSize: 10.5, color: "#7d7f7a", lineHeight: 1.55, overflowWrap: "anywhere" }}>
        실제 GA4/LLM 호출 없음 · Secret 입력 없음 · credential 저장 없음
      </div>
    </aside>
  );
}
