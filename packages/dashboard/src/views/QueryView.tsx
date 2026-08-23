import { useState } from "react";
import { ANALYSIS_KO, C, HEALTH_META, VALUE_KO, eventKo, providerColors } from "../labels";
import { badge, card, fieldLabel, grid, input, mono, sectionTitle, tag } from "../ui";
import { MAX_CANDIDATES } from "../search";
import { evaluateQuery } from "../queryPlan";
import type { AnalysisType, JoinedRow } from "../types";

const EXAMPLES = [
  "구매 클릭이 지난달보다 늘었나요?",
  "가입 완료 이벤트는 GA4에 들어오고 있나요?",
  "리드 폼 전송은 어디로 수집되나요?",
  "존재하지 않는 이벤트"
];

const ANALYSES: AnalysisType[] = ["definition", "event_count", "comparison"];

type LlmState =
  | { status: "idle"; message: string }
  | { status: "loading"; message: string }
  | { status: "success"; message: string; model: string; provider: string }
  | { status: "error"; message: string; code: string };

export function QueryView(props: {
  question: string;
  setQuestion: (q: string) => void;
  candidates: JoinedRow[];
  chosen: JoinedRow | null;
  onChoose: (eventKey: string) => void;
  analysisType: AnalysisType;
  setAnalysisType: (a: AnalysisType) => void;
}) {
  const [llm, setLlm] = useState<LlmState>({ status: "idle", message: "Runtime LLM 응답이 여기에 표시됩니다." });
  const outcome = evaluateQuery(props.chosen, props.analysisType);
  const blocked = outcome.blocked;
  const isDefinition = props.analysisType === "definition";
  const statusColor = blocked ? C.red : isDefinition ? C.gray : C.green;
  const statusBg = blocked ? C.redBg : isDefinition ? C.grayBg : C.greenBg;
  const statusBorder = blocked ? "#eec9c9" : isDefinition ? "#dededa" : "#c8e3cf";
  const multiple = props.candidates.length > 1 && !props.chosen;
  const canAskLlm = props.question.trim().length > 0 && props.candidates.length > 0;

  const askLlm = async () => {
    if (!canAskLlm) return;
    setLlm({ status: "loading", message: "Local Node Runtime을 통해 LLM에 질의하는 중입니다." });
    try {
      const response = await fetch("/__metric-atlas/api/llm/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: props.question,
          analysisType: props.analysisType,
          candidates: props.candidates.slice(0, MAX_CANDIDATES).map((row) => ({
            eventKey: row.eventKey,
            eventName: row.eventName,
            provider: row.event?.analyticsProvider ?? "unknown",
            emitter: row.event?.emitter,
            parameters: row.event?.parameters ?? [],
            sourceFile: row.event?.source.file
          }))
        })
      });
      const body = await response.json();
      if (!response.ok) {
        setLlm({
          status: "error",
          code: body?.error?.code ?? `http_${response.status}`,
          message: body?.error?.message ?? "LLM 요청이 실패했습니다."
        });
        return;
      }
      setLlm({
        status: "success",
        provider: body.provider ?? "openai-compatible",
        model: body.model ?? "unknown",
        message: body.content || "LLM이 빈 응답을 반환했습니다."
      });
    } catch (error) {
      setLlm({
        status: "error",
        code: "runtime_unavailable",
        message: error instanceof Error ? error.message : String(error)
      });
    }
  };

  return (
    <div style={{ ...grid(340, 16), alignItems: "start" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
        <section style={card}>
          <h2 style={{ ...sectionTitle, marginBottom: 10 }}>무엇을 알고 싶으세요?</h2>
          <input
            value={props.question}
            onChange={(e) => props.setQuestion(e.target.value)}
            placeholder="예: 구매 클릭이 지난달보다 늘었나요?"
            style={{ ...input, padding: "11px 13px", fontSize: 13.5, borderRadius: 9 }}
          />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 9 }}>
            {EXAMPLES.map((e) => (
              <button
                key={e}
                onClick={() => props.setQuestion(e)}
                style={{
                  border: "1px solid #d9d9d2", background: "#fafaf7", borderRadius: 999, padding: "6px 11px",
                  fontSize: 11.5, color: "#4a4c47", cursor: "pointer", textAlign: "left", maxWidth: "100%"
                }}
              >
                {e}
              </button>
            ))}
          </div>
          <p style={{ margin: "10px 0 0", fontSize: 11.5, color: C.faint, lineHeight: 1.55 }}>
            후보 추출은 브라우저 로컬 검색으로 수행하고, LLM 설명은 Local Node Runtime을 통해서만 요청합니다.
          </p>
        </section>

        <section style={card}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <h2 style={sectionTitle}>이벤트 후보</h2>
            <span style={{ fontSize: 12, color: C.muted }}>
              {props.candidates.length === 0 ? "후보 없음" : `${props.candidates.length}건 (최대 ${MAX_CANDIDATES}건)`}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 11 }}>
            {props.candidates.map((c) => {
              const meta = HEALTH_META[c.bucket];
              const provider = c.event?.analyticsProvider ?? "ga4";
              const pc = providerColors(provider);
              const on = props.chosen?.eventKey === c.eventKey;
              return (
                <button
                  key={c.eventKey}
                  onClick={() => props.onChoose(c.eventKey)}
                  style={{
                    textAlign: "left", border: `1px solid ${on ? C.accentLine : C.lineSoft}`,
                    background: on ? C.accentBg : C.surfaceAlt, borderRadius: 9, padding: "10px 12px",
                    cursor: "pointer", display: "flex", flexWrap: "wrap", gap: "6px 10px", alignItems: "center"
                  }}
                >
                  <span style={{ flex: "1 1 160px", minWidth: 0, display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>{eventKo(c.eventName)}</span>
                    <span style={{ fontFamily: mono, fontSize: 12, overflowWrap: "anywhere" }}>{c.eventName}</span>
                    <span style={{ fontFamily: mono, fontSize: 10.5, color: C.faint, overflowWrap: "anywhere" }}>
                      {c.eventKey}
                    </span>
                  </span>
                  <span style={tag(pc.bg, pc.fg)}>
                    <span style={{ fontFamily: mono }}>{provider}</span>
                    <span style={{ opacity: 0.75 }}>{VALUE_KO[provider] ?? ""}</span>
                  </span>
                  <span style={badge(meta.bg, meta.fg)}>{meta.ko}</span>
                </button>
              );
            })}
          </div>
          {props.candidates.length === 0 && (
            <div style={{ padding: "20px 6px", textAlign: "center", color: C.faint, fontSize: 12.5, lineHeight: 1.55 }}>
              일치하는 이벤트가 없습니다. 후보 없음(no candidate) 상태이므로 질의를 실행할 수 없습니다.
            </div>
          )}
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
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
        <section style={card}>
          <div
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 11 }}
          >
            <h2 style={sectionTitle}>분석 종류</h2>
            <span style={{ fontFamily: mono, fontSize: 10.5, color: C.faint }}>runtime LLM optional</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {ANALYSES.map((a) => {
              const on = props.analysisType === a;
              return (
                <button
                  key={a}
                  onClick={() => props.setAnalysisType(a)}
                  style={{
                    flex: "1 1 150px", border: `1px solid ${on ? C.accentLine : C.line}`, borderRadius: 9,
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

          <div style={{ marginTop: 13, display: "flex", flexDirection: "column", gap: 9 }}>
            <button
              onClick={askLlm}
              disabled={!canAskLlm || llm.status === "loading"}
              style={{
                border: `1px solid ${canAskLlm ? C.accentLine : C.line}`,
                background: canAskLlm ? C.accentBg : C.surfaceAlt,
                color: canAskLlm ? "#16218f" : C.faint,
                borderRadius: 9,
                padding: "10px 12px",
                cursor: canAskLlm ? "pointer" : "not-allowed",
                textAlign: "left",
                fontSize: 12.5,
                fontWeight: 700
              }}
            >
              {llm.status === "loading" ? "LLM 응답 대기 중" : "Local Runtime LLM에게 설명 요청"}
            </button>
            <div
              style={{
                border: `1px solid ${llm.status === "error" ? "#eec9c9" : C.lineSoft}`,
                background: llm.status === "error" ? C.redBg : C.surfaceAlt,
                borderRadius: 9,
                padding: "11px 12px",
                fontSize: 12.5,
                color: llm.status === "error" ? C.red : "#3d403a",
                lineHeight: 1.6,
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere"
              }}
            >
              {llm.status === "success" && (
                <div style={{ fontFamily: mono, fontSize: 10.5, color: C.faint, marginBottom: 5 }}>
                  {llm.provider} · {llm.model}
                </div>
              )}
              {llm.status === "error" && (
                <div style={{ fontFamily: mono, fontSize: 10.5, marginBottom: 5 }}>{llm.code}</div>
              )}
              {llm.message}
            </div>
          </div>
        </section>

        <section style={card}>
          <h2 style={{ ...sectionTitle, marginBottom: 11 }}>Mock 결과</h2>
          {outcome.result ? (
            <div style={{ border: `1px solid ${C.lineSoft}`, borderRadius: 9, overflow: "hidden" }}>
              <div style={grid(132, 0)}>
                <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.lineSoft}`, background: C.surfaceAlt }}>
                  <div style={fieldLabel}>현재 기간</div>
                  <div style={{ fontSize: 23, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 2 }}>
                    {outcome.result.value}
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 10.5, color: C.muted }}>{outcome.result.dateRange}</div>
                </div>
                <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.lineSoft}`, background: C.surfaceAlt }}>
                  <div style={fieldLabel}>이전 기간</div>
                  <div style={{ fontSize: 23, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 2, color: "#4a4c47" }}>
                    {outcome.result.previousValue ?? "—"}
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 10.5, color: C.muted }}>
                    {outcome.result.comparisonDateRange ?? "비교 없음"}
                  </div>
                </div>
                <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.lineSoft}`, background: "#f6f8f4" }}>
                  <div style={fieldLabel}>변화</div>
                  <div
                    style={{
                      fontSize: 23, fontWeight: 700, letterSpacing: "-0.02em", marginTop: 2,
                      color: outcome.result.deltaPercent == null ? C.gray : outcome.result.deltaPercent >= 0 ? C.green : C.red
                    }}
                  >
                    {outcome.result.deltaPercent == null
                      ? "—"
                      : `${outcome.result.deltaPercent > 0 ? "+" : ""}${outcome.result.deltaPercent}%`}
                  </div>
                  <div style={{ fontSize: 10.5, color: C.muted }}>
                    {outcome.result.deltaPercent == null ? "비교 미포함" : "이전 기간 대비"}
                  </div>
                </div>
              </div>
              <div
                style={{
                  padding: "9px 14px", fontFamily: mono, fontSize: 10.5, color: C.muted,
                  display: "flex", gap: "8px 16px", flexWrap: "wrap"
                }}
              >
                <span>resultStatus: {outcome.result.resultStatus}</span>
                <span>tz: {outcome.result.reportingTimezone}</span>
                <span>fetchedAt: {outcome.result.fetchedAt}</span>
              </div>
            </div>
          ) : (
            <div
              style={{
                padding: 14, border: "1px dashed #d9d9d2", borderRadius: 9, fontSize: 12.5, color: C.muted,
                lineHeight: 1.55, overflowWrap: "anywhere"
              }}
            >
              {outcome.noResultReason}
            </div>
          )}
          <p style={{ margin: "11px 0 0", fontSize: 11.5, color: C.faint, lineHeight: 1.55 }}>
            모든 수치는 fixtures/mock-query-result.json과 mock-ga4-health.json의 값입니다.
          </p>
        </section>
      </div>
    </div>
  );
}
