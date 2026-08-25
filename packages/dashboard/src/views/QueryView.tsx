import { useEffect, useRef, useState, type ReactNode } from "react";
import { ANALYSIS_KO, C, HEALTH_META, VALUE_KO, eventKo, providerColors } from "../labels";
import { badge, card, fieldLabel, grid, input, mono, sectionTitle, tag } from "../ui";
import { findCandidates, isBroadAnalysisQuestion, MAX_CANDIDATES } from "../search";
import { evaluateQuery } from "../queryPlan";
import { callRuntimeLlm, LlmRequestError, toLlmCandidates } from "../llmClient";
import type { AnalysisType, HealthBucket, JoinedRow, QueryOutcome, QuerySeed, QueryTurn } from "../types";

const EXAMPLES = [
  "구매 클릭이 지난달보다 늘었나요?",
  "가입 완료 이벤트는 GA4에 들어오고 있나요?",
  "리드 폼 전송은 어디로 수집되나요?"
];

const ANALYSES: AnalysisType[] = ["definition", "event_count", "comparison"];
const SUMMARY_BUCKET_ORDER: HealthBucket[] = [
  "codeOnly",
  "unresolved",
  "parameterRegistrationGap",
  "ga4Only",
  "noHealth",
  "healthy",
  "ga4Managed"
];
const PRIORITY_BUCKETS = new Set<HealthBucket>(["codeOnly", "unresolved", "parameterRegistrationGap", "ga4Only"]);

export function QueryView(props: { rows: JoinedRow[]; seed: QuerySeed | null; onSeedConsumed: () => void }) {
  const { rows } = props;
  const [turns, setTurns] = useState<QueryTurn[]>([]);
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [serverLlmReady, setServerLlmReady] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/__metric-atlas/api/runtime-health")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { credentials?: { llmApiKey?: boolean } } | null) => {
        if (active) setServerLlmReady(Boolean(data?.credentials?.llmApiKey));
      })
      .catch(() => {
        if (active) setServerLlmReady(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const seedRef = useRef<QuerySeed | null>(null);
  useEffect(() => {
    if (!props.seed || props.seed === seedRef.current) return;
    seedRef.current = props.seed;
    const turn = createTurn(props.seed.question, rows, props.seed.eventKey);
    setTurns((prev) => [...prev, turn]);
    setActiveTurnId(turn.id);
    props.onSeedConsumed();
    // seed 변경(질의로 보내기 클릭)에만 반응한다. rows 변화로 재실행하지 않는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.seed]);

  const llmAvailable = serverLlmReady === true;
  const activeTurn = turns.find((t) => t.id === activeTurnId) ?? turns[turns.length - 1] ?? null;

  async function runLlm(turnId: string, turn: QueryTurn) {
    const chosen = turn.candidates.find((c) => c.eventKey === turn.chosenKey) ?? null;
    if (turn.scope === "event" && !chosen) return;
    if (turn.candidates.length === 0) return;
    setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, llm: { status: "loading" } } : t)));
    const question =
      turn.scope === "health_summary"
        ? `${turn.question}\n\n전체 Analytics Health 요약 요청입니다. 공급된 이벤트 후보만 근거로 우선순위와 다음 조치를 한국어로 정리하세요.`
        : turn.question;
    const payload = {
      question,
      analysisType: turn.analysisType,
      candidates: toLlmCandidates(turn.candidates.slice(0, MAX_CANDIDATES))
    };
    try {
      const result = await callRuntimeLlm(payload);
      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId
            ? { ...t, llm: { status: "success", message: result.content, model: result.model, provider: result.provider } }
            : t
        )
      );
    } catch (error) {
      const code = error instanceof LlmRequestError ? error.code : "runtime_unavailable";
      const message = error instanceof Error ? error.message : String(error);
      setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, llm: { status: "error", code, message } } : t)));
    }
  }

  function submit(question: string) {
    const q = question.trim();
    if (!q) return;
    const turn = createTurn(q, rows);
    setTurns((prev) => [...prev, turn]);
    setActiveTurnId(turn.id);
    setInputValue("");
  }

  function chooseCandidate(turnId: string, eventKey: string) {
    const current = turns.find((t) => t.id === turnId);
    if (!current) return;
    const updated: QueryTurn = { ...current, chosenKey: eventKey };
    setTurns((prev) => prev.map((t) => (t.id === turnId ? updated : t)));
  }

  function setAnalysisType(turnId: string, analysisType: AnalysisType) {
    setTurns((prev) => prev.map((t) => (t.id === turnId ? { ...t, analysisType } : t)));
  }

  const llmNotice = !llmAvailable && serverLlmReady !== null && <LlmNotice />;

  if (turns.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <EmptyHero value={inputValue} onChange={setInputValue} onSubmit={() => submit(inputValue)} />
        {llmNotice}
      </div>
    );
  }

  return (
    <>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "stretch", height: PANE_HEIGHT, minHeight: 480 }}>
      <div style={{ display: "flex", flexDirection: "column", flex: "1 1 380px", minWidth: 320, height: "100%", minHeight: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, flex: "none", marginBottom: 10 }}>
          <h2 style={sectionTitle}>대화</h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: "1 1 auto", minHeight: 0, overflowY: "auto", paddingRight: 4 }}>
          {turns.map((t) => (
            <TurnBubble key={t.id} turn={t} active={t.id === activeTurn?.id} onSelect={() => setActiveTurnId(t.id)} />
          ))}
        </div>

        <div style={{ flex: "none", marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
          {llmNotice}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(inputValue);
            }}
            style={{ display: "flex", gap: 8 }}
          >
            <input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="이어서 질문하기..."
              style={{ ...input, flex: 1, padding: "11px 13px", fontSize: 13.5, borderRadius: 9 }}
            />
            <SendButton disabled={!inputValue.trim()} />
          </form>
        </div>
      </div>

      <ResultPane>
        {activeTurn && (
          <ResultCanvas
            turn={activeTurn}
            onChooseCandidate={(key) => chooseCandidate(activeTurn.id, key)}
            onSetAnalysisType={(a) => setAnalysisType(activeTurn.id, a)}
            onAskLlm={() => void runLlm(activeTurn.id, activeTurn)}
            llmAvailable={llmAvailable}
          />
        )}
      </ResultPane>
    </div>
    </>
  );
}

/** 사이드바 위 header, main padding 등 페이지 chrome을 대략 뺀 값. 화면 전체를 채우되 너무 작아지지 않게 최소값을 둔다. */
const PANE_HEIGHT = "calc(100vh - 175px)";

function createTurn(question: string, rows: JoinedRow[], presetKey?: string): QueryTurn {
  const broadSummary = !presetKey && isBroadAnalysisQuestion(question);
  const candidates = broadSummary ? rowsForHealthSummary(rows) : presetKey ? rows.filter((r) => r.eventKey === presetKey) : findCandidates(rows, question);
  const chosenKey = broadSummary ? null : presetKey ?? (candidates.length === 1 ? (candidates[0]?.eventKey ?? null) : null);
  return {
    id: newTurnId(),
    question,
    scope: broadSummary ? "health_summary" : "event",
    analysisType: "event_count",
    candidates,
    chosenKey,
    llm: { status: "idle" }
  };
}

function rowsForHealthSummary(rows: JoinedRow[]): JoinedRow[] {
  return [...rows].sort((a, b) => {
    const bucketDelta = SUMMARY_BUCKET_ORDER.indexOf(a.bucket) - SUMMARY_BUCKET_ORDER.indexOf(b.bucket);
    if (bucketDelta !== 0) return bucketDelta;
    return a.eventName.localeCompare(b.eventName);
  });
}

function newTurnId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `turn-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function SendButton({ disabled }: { disabled: boolean }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      style={{
        border: "none", borderRadius: 9, padding: "0 18px", fontSize: 13, fontWeight: 700, flex: "none",
        cursor: disabled ? "not-allowed" : "pointer", background: disabled ? "#d9d9d2" : C.ink, color: "#fff"
      }}
    >
      전송
    </button>
  );
}

function EmptyHero(props: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 18, padding: "48px 16px 24px", minHeight: 380, textAlign: "center"
      }}
    >
      <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}>무엇을 알고 싶으세요?</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          props.onSubmit();
        }}
        style={{ width: "100%", maxWidth: 640, display: "flex", gap: 8 }}
      >
        <input
          autoFocus
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          placeholder="예: 구매 클릭이 지난달보다 늘었나요?"
          style={{ ...input, flex: 1, padding: "13px 16px", fontSize: 14, borderRadius: 12 }}
        />
        <SendButton disabled={!props.value.trim()} />
      </form>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 640 }}>
        {EXAMPLES.map((e) => (
          <button
            key={e}
            onClick={() => props.onChange(e)}
            style={{
              border: "1px solid #d9d9d2", background: "#fafaf7", borderRadius: 999, padding: "7px 13px",
              fontSize: 12, color: "#4a4c47", cursor: "pointer"
            }}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}

function LlmNotice() {
  return (
    <div
      style={{
        padding: "10px 13px", borderRadius: 9, background: C.amberBg, border: "1px solid #f0d9a8",
        fontSize: 12, color: "#6b4a12", lineHeight: 1.6
      }}
    >
      <span>
        AI 설명을 쓰려면 Runtime 서버에 <code style={{ fontFamily: mono }}>METRIC_ATLAS_LLM_API_KEY</code>
        를 설정해야 합니다. 브라우저에 개인 API 키를 입력하는 방식은 지원하지 않습니다.
      </span>
    </div>
  );
}

function TurnBubble({ turn, active, onSelect }: { turn: QueryTurn; active: boolean; onSelect: () => void }) {
  const chosen = turn.candidates.find((c) => c.eventKey === turn.chosenKey) ?? null;
  const reply = turnReplyText(turn, chosen);
  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect();
      }}
      style={{ display: "flex", flexDirection: "column", gap: 6, cursor: "pointer", opacity: active ? 1 : 0.85 }}
    >
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div
          style={{
            maxWidth: "88%", border: `1px solid ${active ? C.accentLine : C.lineSoft}`,
            background: active ? C.accentBg : C.surfaceAlt, borderRadius: "13px 13px 3px 13px",
            padding: "9px 13px", fontSize: 12.5, fontWeight: 600, lineHeight: 1.5, overflowWrap: "anywhere"
          }}
        >
          {turn.question}
        </div>
      </div>
      <div
        style={{
          maxWidth: "92%", fontSize: 12, lineHeight: 1.55, overflowWrap: "anywhere", padding: "0 4px",
          color: reply.tone === "error" ? C.red : "#4a4c47"
        }}
      >
        {reply.text}
      </div>
    </div>
  );
}

/** 채팅 목록에 보여줄 짧은 응답 미리보기. 실제 LLM 답변이 있으면 그걸, 없으면 로컬 게이트/후보 상태를 요약한다. */
function turnReplyText(turn: QueryTurn, chosen: JoinedRow | null): { text: string; tone: "normal" | "error" } {
  if (turn.llm.status === "success") return { text: turn.llm.message, tone: "normal" };
  if (turn.llm.status === "error") return { text: `${turn.llm.code}: ${turn.llm.message}`, tone: "error" };
  if (turn.llm.status === "loading") return { text: "생각하는 중...", tone: "normal" };
  if (turn.scope === "health_summary") {
    return { text: "전체 Analytics Health 기준으로 우선 확인할 항목을 요약했습니다.", tone: "normal" };
  }
  if (turn.candidates.length === 0) return { text: "일치하는 이벤트가 없습니다.", tone: "error" };
  if (!chosen) return { text: `후보 ${turn.candidates.length}건 중 하나를 선택해 주세요.`, tone: "normal" };
  const outcome = evaluateQuery(chosen, turn.analysisType);
  return {
    text: `${outcome.statusLabel} · ${eventKo(chosen.eventName)} (${turn.analysisType})`,
    tone: outcome.blocked ? "error" : "normal"
  };
}

/** 오른쪽 "분석 결과"를 새 탭처럼 보이게 감싸는 컨테이너. 내용이 길어져도 이 안에서만 스크롤되고 페이지 전체 높이에는 영향을 주지 않는다. */
function ResultPane({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        flex: "1 1 420px", minWidth: 320, height: "100%", minHeight: 0, display: "flex", flexDirection: "column",
        border: `1px solid ${C.line}`, borderRadius: 14, background: C.surface, overflow: "hidden",
        boxShadow: "0 1px 2px rgba(22,24,29,0.05)"
      }}
    >
      <div
        style={{
          flex: "none", display: "flex", alignItems: "center", gap: 8, padding: "11px 15px",
          borderBottom: `1px solid ${C.lineSoft}`, background: C.surfaceAlt
        }}
      >
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: C.accent, flex: "none" }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: C.muted }}>분석 결과</span>
      </div>
      <div style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", padding: 16 }}>{children}</div>
    </div>
  );
}

function CandidateRow({ row, onSelect }: { row: JoinedRow; onSelect: () => void }) {
  const meta = HEALTH_META[row.bucket];
  const provider = row.event?.analyticsProvider ?? "ga4";
  const pc = providerColors(provider);
  return (
    <button
      onClick={onSelect}
      style={{
        textAlign: "left", border: `1px solid ${C.lineSoft}`, background: C.surfaceAlt, borderRadius: 9,
        padding: "10px 12px", cursor: "pointer", display: "flex", flexWrap: "wrap", gap: "6px 10px", alignItems: "center"
      }}
    >
      <span style={{ flex: "1 1 160px", minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{eventKo(row.eventName)}</span>
        <span style={{ fontFamily: mono, fontSize: 12, overflowWrap: "anywhere" }}>{row.eventName}</span>
        <span style={{ fontFamily: mono, fontSize: 10.5, color: C.faint, overflowWrap: "anywhere" }}>{row.eventKey}</span>
      </span>
      <span style={tag(pc.bg, pc.fg)}>
        <span style={{ fontFamily: mono }}>{provider}</span>
        <span style={{ opacity: 0.75 }}>{VALUE_KO[provider] ?? ""}</span>
      </span>
      <span style={badge(meta.bg, meta.fg)}>{meta.ko}</span>
    </button>
  );
}

function ResultCanvas(props: {
  turn: QueryTurn;
  onChooseCandidate: (eventKey: string) => void;
  onSetAnalysisType: (a: AnalysisType) => void;
  onAskLlm: () => void;
  llmAvailable: boolean;
}) {
  const { turn } = props;
  const chosen = turn.candidates.find((c) => c.eventKey === turn.chosenKey) ?? null;
  const multiple = turn.candidates.length > 1 && !chosen;

  if (turn.scope === "health_summary") {
    return <HealthSummaryResult turn={turn} onAskLlm={props.onAskLlm} llmAvailable={props.llmAvailable} />;
  }

  if (turn.candidates.length === 0) {
    return (
      <section style={card}>
        <h2 style={sectionTitle}>일치하는 이벤트가 없습니다</h2>
        <p style={{ fontSize: 12.5, color: C.muted, marginTop: 8, lineHeight: 1.55 }}>
          후보 없음(no candidate) 상태이므로 질의를 실행할 수 없습니다. 다른 질문으로 다시 물어보세요.
        </p>
      </section>
    );
  }

  if (!chosen) {
    return (
      <section style={card}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 11 }}>
          <h2 style={sectionTitle}>이벤트 후보 {turn.candidates.length}건</h2>
          <span style={{ fontSize: 12, color: C.muted }}>최대 {MAX_CANDIDATES}건</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {turn.candidates.map((c) => (
            <CandidateRow key={c.eventKey} row={c} onSelect={() => props.onChooseCandidate(c.eventKey)} />
          ))}
        </div>
        {multiple && (
          <div
            style={{
              marginTop: 10, padding: "10px 12px", borderRadius: 9, background: C.amberBg,
              border: "1px solid #f0d9a8", fontSize: 12, color: "#6b4a12", lineHeight: 1.55
            }}
          >
            후보가 여러 개입니다. 임의로 고르지 않으니 하나를 직접 선택하세요.
          </div>
        )}
      </section>
    );
  }

  const outcome = evaluateQuery(chosen, turn.analysisType);
  const blocked = outcome.blocked;
  const isDefinition = turn.analysisType === "definition";
  const statusColor = blocked ? C.red : isDefinition ? C.gray : C.green;
  const statusBg = blocked ? C.redBg : isDefinition ? C.grayBg : C.greenBg;
  const statusBorder = blocked ? "#eec9c9" : isDefinition ? "#dededa" : "#c8e3cf";
  const providerTag = providerColors(chosen.event?.analyticsProvider ?? "ga4");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <section style={card}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 11 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700 }}>{eventKo(chosen.eventName)}</span>
          <span style={tag(providerTag.bg, providerTag.fg)}>
            <span style={{ fontFamily: mono }}>{chosen.event?.analyticsProvider ?? "ga4"}</span>
          </span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {ANALYSES.map((a) => {
            const on = turn.analysisType === a;
            return (
              <button
                key={a}
                onClick={() => props.onSetAnalysisType(a)}
                style={{
                  flex: "1 1 140px", border: `1px solid ${on ? C.accentLine : C.line}`, borderRadius: 9,
                  padding: "10px 11px", cursor: "pointer", textAlign: "left",
                  background: on ? C.accentBg : C.surfaceAlt, color: on ? "#16218f" : C.ink
                }}
              >
                <span style={{ display: "block", fontFamily: mono, fontSize: 12, fontWeight: 600 }}>{a}</span>
                <span style={{ display: "block", fontSize: 11, marginTop: 2, color: on ? "#4a55c9" : C.muted }}>
                  {ANALYSIS_KO[a]}
                </span>
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 13, padding: "12px 14px", borderRadius: 9, background: statusBg, border: `1px solid ${statusBorder}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor, flex: "none" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: statusColor }}>{outcome.statusLabel}</span>
          </div>
          <div style={{ fontSize: 12, color: "#4a4c47", marginTop: 5, lineHeight: 1.55, overflowWrap: "anywhere" }}>
            {outcome.statusReason}
          </div>
        </div>

        <div style={{ marginTop: 13 }}>
          <div style={{ ...fieldLabel, fontSize: 10, marginBottom: 5 }}>QUERYPLAN DRAFT</div>
          <pre
            style={{
              margin: 0, padding: "12px 14px", background: C.ink, color: "#e8e8e2", borderRadius: 9,
              fontFamily: mono, fontSize: 11.5, lineHeight: 1.6, whiteSpace: "pre-wrap", overflowWrap: "anywhere"
            }}
          >
            {JSON.stringify(outcome.plan, null, 2)}
          </pre>
        </div>
      </section>

      <AiExplanationPanel turn={turn} onAskLlm={props.onAskLlm} llmAvailable={props.llmAvailable} />

      <section style={card}>
        <h2 style={{ ...sectionTitle, marginBottom: 11 }}>Mock 결과</h2>
        {outcome.result ? (
          <MockResultBlock result={outcome.result} />
        ) : (
          <div style={{ padding: 14, border: "1px dashed #d9d9d2", borderRadius: 9, fontSize: 12.5, color: C.muted, lineHeight: 1.55, overflowWrap: "anywhere" }}>
            {outcome.noResultReason}
          </div>
        )}
        <p style={{ margin: "11px 0 0", fontSize: 11.5, color: C.faint, lineHeight: 1.55 }}>
          모든 수치는 fixtures/mock-query-result.json과 mock-ga4-health.json의 값입니다.
        </p>
      </section>
    </div>
  );
}

function HealthSummaryResult(props: { turn: QueryTurn; onAskLlm: () => void; llmAvailable: boolean }) {
  const { turn } = props;
  const counts = countBuckets(turn.candidates);
  const priorityRows = turn.candidates.filter((row) => PRIORITY_BUCKETS.has(row.bucket)).slice(0, 6);
  const gtmRows = turn.candidates.filter((row) => row.event?.emitter === "gtm" || row.gtmRoute).slice(0, 4);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <section style={card}>
        <h2 style={{ ...sectionTitle, marginBottom: 8 }}>전체 Analytics Health 요약</h2>
        <p style={{ margin: 0, fontSize: 12.5, color: C.muted, lineHeight: 1.55 }}>
          특정 이벤트명이 없는 분석 요청으로 판단해, 현재 Manifest와 Health 결과를 기준으로 우선 확인할 항목을 정리했습니다.
        </p>
        <div style={{ ...grid(128, 8), marginTop: 13 }}>
          {SUMMARY_BUCKET_ORDER.map((bucket) => {
            const meta = HEALTH_META[bucket];
            return (
              <div key={bucket} style={{ border: `1px solid ${C.lineSoft}`, borderRadius: 9, padding: "11px 12px", background: C.surfaceAlt }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 5 }}>{meta.ko}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 24, fontWeight: 800, color: meta.fg }}>{counts[bucket]}</span>
                  <span style={{ fontSize: 11, color: C.faint }}>건</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section style={card}>
        <h2 style={{ ...sectionTitle, marginBottom: 11 }}>우선 확인 항목</h2>
        {priorityRows.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {priorityRows.map((row) => {
              const meta = HEALTH_META[row.bucket];
              return (
                <div key={row.eventKey} style={{ border: `1px solid ${C.lineSoft}`, borderRadius: 9, padding: "10px 12px", background: C.surfaceAlt }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7, alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{eventKo(row.eventName)}</span>
                    <span style={badge(meta.bg, meta.fg)}>{meta.ko}</span>
                  </div>
                  <div style={{ marginTop: 5, fontFamily: mono, fontSize: 11.5, color: C.faint, overflowWrap: "anywhere" }}>
                    {row.eventKey}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: "#4a4c47", lineHeight: 1.55 }}>
                    {summaryAction(row)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ padding: 14, border: "1px dashed #d9d9d2", borderRadius: 9, fontSize: 12.5, color: C.muted }}>
            즉시 조치가 필요한 Health 항목이 없습니다.
          </div>
        )}
      </section>

      {gtmRows.length > 0 && (
        <section style={card}>
          <h2 style={{ ...sectionTitle, marginBottom: 11 }}>GTM 경로 확인</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {gtmRows.map((row) => (
              <div key={row.eventKey} style={{ border: `1px solid ${C.lineSoft}`, borderRadius: 9, padding: "10px 12px", background: C.surfaceAlt }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{eventKo(row.eventName)}</div>
                <div style={{ marginTop: 5, fontSize: 12, color: C.muted, lineHeight: 1.55 }}>
                  {row.gtmRoute
                    ? `${row.gtmRoute.triggerName} -> ${row.gtmRoute.tagName} -> ${row.gtmRoute.destinationProvider}`
                    : "dataLayer.push 이벤트입니다. GTM 컨테이너의 태그/트리거 설정 확인이 필요합니다."}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <AiExplanationPanel turn={turn} onAskLlm={props.onAskLlm} llmAvailable={props.llmAvailable} />
    </div>
  );
}

function countBuckets(rows: JoinedRow[]): Record<HealthBucket, number> {
  const counts = Object.fromEntries(SUMMARY_BUCKET_ORDER.map((bucket) => [bucket, 0])) as Record<HealthBucket, number>;
  for (const row of rows) counts[row.bucket] += 1;
  return counts;
}

function summaryAction(row: JoinedRow): string {
  if (row.bucket === "codeOnly") return "코드에는 있으나 GA4 최근 결과가 없습니다. 이벤트 트리거, Measurement ID, 배포 반영 여부를 확인하세요.";
  if (row.bucket === "unresolved") return "정적 분석으로 바인딩을 확정하지 못했습니다. 래퍼 호출, 동적 이벤트명, 커스텀 컴포넌트 여부를 확인하세요.";
  if (row.bucket === "parameterRegistrationGap") return "이벤트 수집은 가능하지만 GA4 보고서용 Custom Dimension 등록이 필요합니다.";
  if (row.bucket === "ga4Only") return "GA4에는 보이지만 현재 빌드 Manifest에서 찾지 못했습니다. 자동 수집 이벤트인지, 삭제된 코드인지 확인하세요.";
  if (row.bucket === "noHealth") return "Health 결과가 없어 Runtime/GA4 연결 상태를 먼저 확인하세요.";
  return "현재 MVP 기준으로 큰 차단 신호는 없습니다.";
}

function AiExplanationPanel(props: { turn: QueryTurn; onAskLlm: () => void; llmAvailable: boolean }) {
  const { turn } = props;
  return (
    <section style={card}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 11 }}>
        <h2 style={sectionTitle}>AI 설명</h2>
        <span style={{ fontFamily: mono, fontSize: 10.5, color: C.faint }}>
          Runtime LLM · 수동 요청
        </span>
      </div>
      <button
        onClick={props.onAskLlm}
        disabled={!props.llmAvailable || turn.llm.status === "loading"}
        style={{
          border: `1px solid ${props.llmAvailable ? C.accentLine : C.line}`,
          background: props.llmAvailable ? C.accentBg : C.surfaceAlt,
          color: props.llmAvailable ? "#16218f" : C.faint,
          borderRadius: 9, padding: "10px 12px", cursor: props.llmAvailable && turn.llm.status !== "loading" ? "pointer" : "not-allowed",
          textAlign: "left", fontSize: 12.5, fontWeight: 700, width: "100%"
        }}
      >
        {turn.llm.status === "loading" ? "LLM 응답 대기 중" : turn.llm.status === "idle" ? "AI 설명 요청" : "AI 설명 다시 요청"}
      </button>
      <div
        style={{
          marginTop: 9, border: `1px solid ${turn.llm.status === "error" ? "#eec9c9" : C.lineSoft}`,
          background: turn.llm.status === "error" ? C.redBg : C.surfaceAlt, borderRadius: 9, padding: "11px 12px",
          fontSize: 12.5, color: turn.llm.status === "error" ? C.red : "#3d403a", lineHeight: 1.6,
          whiteSpace: "pre-wrap", overflowWrap: "anywhere"
        }}
      >
        {turn.llm.status === "idle" && "아직 요청하지 않았습니다."}
        {turn.llm.status === "loading" && "LLM에 질의하는 중입니다."}
        {turn.llm.status === "success" && (
          <>
            <div style={{ fontFamily: mono, fontSize: 10.5, color: C.faint, marginBottom: 5 }}>
              {turn.llm.provider} · {turn.llm.model}
            </div>
            {turn.llm.message}
          </>
        )}
        {turn.llm.status === "error" && (
          <>
            <div style={{ fontFamily: mono, fontSize: 10.5, marginBottom: 5 }}>{turn.llm.code}</div>
            {turn.llm.message}
          </>
        )}
      </div>
    </section>
  );
}

function MockResultBlock({ result }: { result: NonNullable<QueryOutcome["result"]> }) {
  return (
    <div style={{ border: `1px solid ${C.lineSoft}`, borderRadius: 9, overflow: "hidden" }}>
      <div style={grid(132, 0)}>
        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.lineSoft}`, background: C.surfaceAlt }}>
          <div style={fieldLabel}>현재 기간</div>
          <div style={{ fontSize: 23, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 2 }}>{result.value}</div>
          <div style={{ fontFamily: mono, fontSize: 10.5, color: C.muted }}>{result.dateRange}</div>
        </div>
        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.lineSoft}`, background: C.surfaceAlt }}>
          <div style={fieldLabel}>이전 기간</div>
          <div style={{ fontSize: 23, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 2, color: "#4a4c47" }}>
            {result.previousValue ?? "—"}
          </div>
          <div style={{ fontFamily: mono, fontSize: 10.5, color: C.muted }}>{result.comparisonDateRange ?? "비교 없음"}</div>
        </div>
        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.lineSoft}`, background: "#f6f8f4" }}>
          <div style={fieldLabel}>변화</div>
          <div
            style={{
              fontSize: 23, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 2,
              color: result.deltaPercent == null ? C.gray : result.deltaPercent >= 0 ? C.green : C.red
            }}
          >
            {result.deltaPercent == null ? "—" : `${result.deltaPercent > 0 ? "+" : ""}${result.deltaPercent}%`}
          </div>
          <div style={{ fontSize: 10.5, color: C.muted }}>{result.deltaPercent == null ? "비교 미포함" : "이전 기간 대비"}</div>
        </div>
      </div>
      <div style={{ padding: "9px 14px", fontFamily: mono, fontSize: 10.5, color: C.muted, display: "flex", gap: "8px 16px", flexWrap: "wrap" }}>
        <span>resultStatus: {result.resultStatus}</span>
        <span>tz: {result.reportingTimezone}</span>
        <span>fetchedAt: {result.fetchedAt}</span>
      </div>
    </div>
  );
}
