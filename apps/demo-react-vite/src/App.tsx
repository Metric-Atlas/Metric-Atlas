import { useMemo, useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { OverviewView } from "./views/OverviewView";
import { EventsView } from "./views/EventsView";
import { QueryView } from "./views/QueryView";
import { health, joinRows, manifest } from "./data";
import { C } from "./labels";
import { EMPTY_FILTERS, filterRows, findCandidates, type FilterState } from "./search";
import type { AnalysisType, HealthBucket } from "./types";

export type ViewId = "overview" | "events" | "query";

const VIEW_META: Record<ViewId, { title: string; sub: string }> = {
  overview: {
    title: "Analytics Health 요약",
    sub: "코드에서 찾은 이벤트와 GA4 관측 결과를 비교한 결과입니다. 모든 수치는 fixture의 Mock 데이터입니다."
  },
  events: {
    title: "이벤트 탐색",
    sub: "이벤트명, eventKey, 파일 경로로 찾고 상태와 구현 위치를 함께 확인합니다."
  },
  query: {
    title: "질의",
    sub: "질문에서 이벤트 후보를 좁히고 QueryPlan을 만든 뒤 Mock 결과를 확인합니다. 실제 GA4/LLM 호출은 없습니다."
  }
};

export function App() {
  const rows = useMemo(() => joinRows(), []);
  const [view, setView] = useState<ViewId>("overview");
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [selectedKey, setSelectedKey] = useState<string | null>("ga4:purchase_click");
  const [question, setQuestion] = useState("구매 클릭이 지난달보다 늘었나요?");
  const [chosenKey, setChosenKey] = useState<string | null>(null);
  const [analysisType, setAnalysisType] = useState<AnalysisType>("comparison");

  const visibleRows = useMemo(() => filterRows(rows, filters), [rows, filters]);
  const selected = rows.find((r) => r.eventKey === selectedKey) ?? null;

  const candidates = useMemo(() => findCandidates(rows, question), [rows, question]);
  const chosen = candidates.find((c) => c.eventKey === chosenKey) ?? (candidates.length === 1 ? (candidates[0] ?? null) : null);

  const openBucket = (bucket: HealthBucket) => {
    setFilters({ ...EMPTY_FILTERS, health: bucket });
    setView("events");
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "stretch", minHeight: "100vh" }}>
      <Sidebar
        view={view}
        onNavigate={setView}
        context={[
          { label: "MANIFEST", value: `v${manifest.version}` },
          { label: "BUILD ID", value: manifest.buildId },
          { label: "GENERATED AT", value: manifest.generatedAt },
          { label: "GA4 PROPERTY", value: health.propertyId },
          { label: "REPORTING TZ", value: health.reportingTimezone }
        ]}
      />

      <main
        style={{
          flex: "9999 1 620px", padding: "22px 24px 56px", display: "flex", flexDirection: "column",
          gap: 16, minWidth: 0
        }}
      >
        <header>
          <h1 style={{ margin: 0, fontSize: 21, fontWeight: 700, letterSpacing: "-0.02em" }}>{VIEW_META[view].title}</h1>
          <p style={{ margin: "5px 0 0", fontSize: 13, color: C.muted, lineHeight: 1.5, maxWidth: "74ch" }}>
            {VIEW_META[view].sub}
          </p>
        </header>

        {view === "overview" && (
          <OverviewView
            rows={rows}
            onOpenAll={() => {
              setFilters(EMPTY_FILTERS);
              setView("events");
            }}
            onOpenBucket={openBucket}
            onOpenEvent={(key) => {
              setSelectedKey(key);
              setView("events");
            }}
          />
        )}

        {view === "events" && (
          <EventsView
            filters={filters}
            setFilters={setFilters}
            rows={visibleRows}
            totalCount={rows.length}
            selected={selected}
            onSelect={setSelectedKey}
            onMakeQuery={() => {
              if (selected) {
                setQuestion(selected.eventName);
                setChosenKey(selected.eventKey);
              }
              setView("query");
            }}
          />
        )}

        {view === "query" && (
          <QueryView
            question={question}
            setQuestion={(q) => {
              setQuestion(q);
              setChosenKey(null);
            }}
            candidates={candidates}
            chosen={chosen}
            onChoose={setChosenKey}
            analysisType={analysisType}
            setAnalysisType={setAnalysisType}
          />
        )}

        <footer style={{ fontSize: 11.5, color: C.faint, lineHeight: 1.6, overflowWrap: "anywhere" }}>
          fixtures/mock-manifest.json · mock-ga4-health.json · mock-query-result.json (읽기 전용) · scan{" "}
          {manifest.scanStats.filesScanned} files · {manifest.scanStats.durationMs}ms ·{" "}
          {manifest.scanStats.eventsDetected} events
        </footer>
      </main>
    </div>
  );
}
