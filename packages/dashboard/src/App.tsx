import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Sidebar } from "./components/Sidebar";
import { OverviewView } from "./views/OverviewView";
import { EventsView } from "./views/EventsView";
import { QueryView } from "./views/QueryView";
import { fixtureDashboardData, joinRows, loadDashboardData, type DashboardData } from "./data";
import { C } from "./labels";
import { EMPTY_FILTERS, filterRows, type FilterState } from "./search";
import type { HealthBucket, QuerySeed } from "./types";

export type ViewId = "overview" | "events" | "query";

const VIEW_META: Record<ViewId, { title: string; sub: string }> = {
  overview: {
    title: "Analytics Health 요약",
    sub: "코드에서 찾은 이벤트와 GA4 관측 결과를 비교한 결과입니다."
  },
  events: {
    title: "이벤트 탐색",
    sub: "이벤트명, eventKey, 파일 경로로 찾고 상태와 구현 위치를 함께 확인합니다."
  },
  query: {
    title: "질의",
    sub: "질문에서 이벤트 후보를 좁히고 QueryPlan과 Mock 결과를 확인합니다. GA4 조회는 Mock이며, AI 설명만 실제 LLM을 호출합니다."
  }
};

export interface AppProps {
  /** Extra content rendered between the header and the active view (e.g. a consumer-specific showcase panel). */
  beforeContent?: ReactNode;
}

export function App({ beforeContent }: AppProps = {}) {
  const [dashboardData, setDashboardData] = useState<DashboardData>(fixtureDashboardData);
  const [dataStatus, setDataStatus] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    let active = true;
    loadDashboardData().then((data) => {
      if (!active) return;
      setDashboardData(data);
      setDataStatus("ready");
    });
    return () => {
      active = false;
    };
  }, []);

  const rows = useMemo(
    () => joinRows(dashboardData.manifest, dashboardData.health),
    [dashboardData]
  );
  const { manifest, health } = dashboardData;
  const scanStats = manifest.scanStats;
  const [view, setView] = useState<ViewId>("overview");
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [selectedKey, setSelectedKey] = useState<string | null>("ga4:purchase_click");
  const [querySeed, setQuerySeed] = useState<QuerySeed | null>(null);

  const visibleRows = useMemo(() => filterRows(rows, filters), [rows, filters]);
  const selected = rows.find((r) => r.eventKey === selectedKey) ?? null;

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
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
            {[
              `manifest: ${dashboardData.manifestSource}`,
              `health: ${dashboardData.healthSource}`,
              dataStatus === "loading" ? "runtime 확인 중" : dashboardData.runtimeAvailable ? "runtime 응답 확인" : "fixture fallback"
            ].map((label) => (
              <span key={label} style={{ border: `1px solid ${C.line}`, borderRadius: 999, padding: "4px 8px", fontSize: 11.5, color: C.muted, background: C.surface }}>
                {label}
              </span>
            ))}
          </div>
        </header>

        {beforeContent}

        {view === "overview" && (
          <OverviewView
            rows={rows}
            manifest={manifest}
            health={health}
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
                setQuerySeed({ question: selected.eventName, eventKey: selected.eventKey });
              }
              setView("query");
            }}
          />
        )}

        {view === "query" && (
          <QueryView rows={rows} seed={querySeed} onSeedConsumed={() => setQuerySeed(null)} />
        )}

        <footer style={{ fontSize: 11.5, color: C.faint, lineHeight: 1.6, overflowWrap: "anywhere" }}>
          fixtures/mock-manifest.json · mock-ga4-health.json · mock-query-result.json (읽기 전용) · scan{" "}
          {scanStats
            ? `scan ${scanStats.filesScanned} files · ${scanStats.durationMs}ms · ${scanStats.eventsDetected} events`
            : "scan stats unavailable"}
        </footer>
      </main>
    </div>
  );
}
