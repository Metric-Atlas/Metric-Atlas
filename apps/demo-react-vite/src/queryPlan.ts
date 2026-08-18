import { health, queryFixture } from "./data";
import { FLAG_KO } from "./labels";
import type { AnalysisType, JoinedRow, QueryOutcome, QueryPlanDraft } from "./types";

export function buildPlan(row: JoinedRow | null, analysisType: AnalysisType): QueryPlanDraft {
  const provider = row ? row.event?.analyticsProvider ?? "ga4" : "unknown";
  return {
    version: "1",
    analysisType,
    eventKeys: row ? [row.eventKey] : [],
    ...(analysisType === "definition" ? {} : { dateRange: { preset: "last_30_days" } }),
    ...(analysisType === "comparison" ? { comparisonRange: { preset: "previous_30_days" } } : {}),
    filters: [],
    breakdowns: [],
    sourceRefs: [provider],
    assumptions: []
  };
}

/**
 * Execution gate. Blocks on: no candidate, unknown provider (GTM dataLayer.push
 * must not be assumed to be GA4), and GA4-observed events with no code evidence.
 */
export function evaluateQuery(row: JoinedRow | null, analysisType: AnalysisType): QueryOutcome {
  const plan = buildPlan(row, analysisType);
  const provider = row?.event?.analyticsProvider ?? (row ? "ga4" : null);

  let blocked = false;
  let statusLabel = "실행 가능";
  let statusReason = "eventKey와 provider가 확정되어 조회를 실행할 수 있습니다. Fixture 모드이므로 실제 호출은 하지 않습니다.";

  if (!row) {
    blocked = true;
    statusLabel = "실행 차단";
    statusReason = "선택된 이벤트가 없습니다. 후보 없음(no candidate) 상태로 실행이 차단됩니다.";
  } else if (analysisType === "definition") {
    statusLabel = "실행 불필요";
    statusReason = "정의 조회는 Manifest만 사용하며 GA4 요청이 없습니다.";
  } else if (provider === "unknown") {
    blocked = true;
    statusLabel = "실행 차단";
    statusReason = "analyticsProvider가 unknown입니다. dataLayer.push는 GTM 전송이며 GA4로 단정할 수 없어 실행이 차단됩니다.";
  } else if (!row.event) {
    blocked = true;
    statusLabel = "실행 차단";
    statusReason = "코드에서 탐지되지 않은 GA4 관측 이벤트입니다. 코드 근거가 없어 실행이 차단됩니다.";
  }

  const out: QueryOutcome = { plan, blocked, statusLabel, statusReason, result: null, noResultReason: "" };
  if (blocked) {
    out.noResultReason = "실행이 차단되어 결과가 없습니다.";
    return out;
  }
  if (analysisType === "definition") {
    out.noResultReason = "정의 조회는 측정 결과를 반환하지 않습니다. 이벤트 화면의 상세 정보를 사용하세요.";
    return out;
  }

  const fx = queryFixture.result;
  if (analysisType === "comparison" && row && row.eventKey === fx.eventKey) {
    const delta = Math.round(((fx.value - fx.previousValue) / fx.previousValue) * 1000) / 10;
    out.result = {
      value: fx.value.toLocaleString(),
      previousValue: fx.previousValue.toLocaleString(),
      dateRange: `${fx.dateRange.startDate} ~ ${fx.dateRange.endDate}`,
      comparisonDateRange: `${fx.comparisonDateRange.startDate} ~ ${fx.comparisonDateRange.endDate}`,
      deltaPercent: delta,
      resultStatus: fx.resultStatus,
      reportingTimezone: fx.reportingTimezone,
      fetchedAt: fx.fetchedAt
    };
    return out;
  }

  if (analysisType === "event_count" && row?.health) {
    const m = row.health.latestMeasurement;
    if (m.resultStatus === "ok") {
      out.result = {
        value: (m.value ?? 0).toLocaleString(),
        dateRange: "last_30_days",
        resultStatus: m.resultStatus,
        reportingTimezone: health.reportingTimezone,
        fetchedAt: health.generatedAt
      };
    } else {
      const flags = m.qualityFlags.map((x) => FLAG_KO[x] ?? x).join(" ");
      out.noResultReason = `resultStatus=${m.resultStatus}. ${flags || "조회된 행이 없습니다."}`;
    }
    return out;
  }

  out.noResultReason =
    "이 조합에 해당하는 mock 결과가 fixture에 없습니다. mock-query-result.json은 comparison · ga4:purchase_click 조합만 포함합니다.";
  return out;
}
