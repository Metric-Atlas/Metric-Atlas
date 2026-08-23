import { C, FILTER_BUCKETS, HEALTH_META } from "../labels";
import { card, fieldLabel, grid, input, sectionTitle, select } from "../ui";
import { EMPTY_FILTERS, type FilterState, type SearchField } from "../search";
import { EventCard } from "../components/EventCard";
import { EventDetail } from "../components/EventDetail";
import type { JoinedRow } from "../types";

const FIELDS: { id: SearchField; label: string }[] = [
  { id: "all", label: "전체" },
  { id: "name", label: "eventName" },
  { id: "key", label: "eventKey" },
  { id: "file", label: "source" }
];

export function EventsView(props: {
  filters: FilterState;
  setFilters: (f: FilterState) => void;
  rows: JoinedRow[];
  totalCount: number;
  selected: JoinedRow | null;
  onSelect: (eventKey: string) => void;
  onMakeQuery: () => void;
}) {
  const { filters, setFilters } = props;
  const patch = (p: Partial<FilterState>) => setFilters({ ...filters, ...p });

  return (
    <div style={{ ...grid(340, 16), alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
        <section style={card}>
          <div
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 11 }}
          >
            <h2 style={sectionTitle}>검색 / 필터</h2>
            <button
              onClick={() => setFilters(EMPTY_FILTERS)}
              style={{
                border: "1px solid #d9d9d2", background: "#fafaf7", borderRadius: 7, padding: "5px 10px",
                fontSize: 12, fontWeight: 600, color: "#4a4c47", cursor: "pointer"
              }}
            >
              초기화
            </button>
          </div>

          <input
            value={filters.query}
            onChange={(e) => patch({ query: e.target.value })}
            placeholder="이벤트명 / eventKey / 파일 경로 검색"
            style={{ ...input, fontFamily: "'JetBrains Mono', monospace" }}
          />

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 9 }}>
            <div style={{ display: "flex", flexWrap: "wrap", border: "1px solid #d9d9d2", borderRadius: 8, overflow: "hidden", background: "#fafaf7" }}>
              {FIELDS.map((f) => {
                const on = filters.field === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => patch({ field: f.id })}
                    style={{
                      border: 0, borderRight: "1px solid #e6e6e0", padding: "8px 11px", fontSize: 11.5, fontWeight: 600,
                      cursor: "pointer", background: on ? C.ink : "transparent", color: on ? "#f4f4f1" : "#4a4c47"
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
            <label
              style={{
                display: "flex", alignItems: "center", gap: 7, padding: "7px 11px", border: "1px solid #d9d9d2",
                borderRadius: 8, background: "#fafaf7", fontSize: 11.5, fontWeight: 600, color: "#4a4c47", cursor: "pointer"
              }}
            >
              <input
                type="checkbox"
                checked={filters.exact}
                onChange={(e) => patch({ exact: e.target.checked })}
                style={{ accentColor: C.accent, width: 14, height: 14 }}
              />
              정확히 일치
            </label>
          </div>

          <div style={{ ...grid(148, 8), marginTop: 10 }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ ...fieldLabel, fontSize: 10, letterSpacing: "0.07em" }}>수집 도구 (PROVIDER)</span>
              <select value={filters.provider} onChange={(e) => patch({ provider: e.target.value })} style={select}>
                <option value="all">전체</option>
                <option value="ga4">ga4</option>
                <option value="unknown">unknown</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ ...fieldLabel, fontSize: 10, letterSpacing: "0.07em" }}>전송 방식 (EMITTER)</span>
              <select value={filters.emitter} onChange={(e) => patch({ emitter: e.target.value })} style={select}>
                <option value="all">전체</option>
                <option value="ga4">ga4 (gtag)</option>
                <option value="gtm">gtm (dataLayer.push)</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ ...fieldLabel, fontSize: 10, letterSpacing: "0.07em" }}>화면 표시 지원</span>
              <select
                value={filters.overlay}
                onChange={(e) => patch({ overlay: e.target.value as FilterState["overlay"] })}
                style={select}
              >
                <option value="all">전체</option>
                <option value="yes">지원</option>
                <option value="no">미지원</option>
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ ...fieldLabel, fontSize: 10, letterSpacing: "0.07em" }}>상태 / 검토 사유</span>
              <select value={filters.health} onChange={(e) => patch({ health: e.target.value })} style={select}>
                <option value="all">전체</option>
                {FILTER_BUCKETS.map((b) => (
                  <option key={b} value={b}>
                    {HEALTH_META[b].ko}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section style={{ ...card, padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <h2 style={sectionTitle}>이벤트 목록</h2>
            <span style={{ fontSize: 12, color: C.muted }}>
              <b style={{ color: C.ink }}>{props.rows.length}</b>건 / 전체 {props.totalCount}건
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 11 }}>
            {props.rows.map((r) => (
              <EventCard
                key={r.eventKey}
                row={r}
                active={props.selected?.eventKey === r.eventKey}
                onSelect={() => props.onSelect(r.eventKey)}
              />
            ))}
          </div>
          {props.rows.length === 0 && (
            <div style={{ padding: "24px 6px", textAlign: "center", color: C.faint, fontSize: 13, lineHeight: 1.55 }}>
              조건에 맞는 이벤트가 없습니다. 후보 없음(no candidate) 상태입니다.
            </div>
          )}
        </section>
      </div>

      <EventDetail row={props.selected} onMakeQuery={props.onMakeQuery} />
    </div>
  );
}
