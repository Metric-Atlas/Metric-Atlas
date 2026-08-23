import { describe, expect, it } from "vitest";
import { joinRows } from "../src/data";
import { evaluateQuery } from "../src/queryPlan";

const rows = joinRows();
const row = (key: string) => rows.find((r) => r.eventKey === key)!;

describe("unknown provider execution blocked", () => {
  it("blocks gtm:lead_submit because the provider is unknown", () => {
    const out = evaluateQuery(row("gtm:lead_submit"), "event_count");
    expect(out.blocked).toBe(true);
    expect(out.statusLabel).toBe("실행 차단");
    expect(out.result).toBeNull();
  });

  it("blocks a GA4-observed event with no code evidence", () => {
    const out = evaluateQuery(row("ga4:page_view"), "comparison");
    expect(out.blocked).toBe(true);
  });

  it("blocks when there is no candidate", () => {
    const out = evaluateQuery(null, "comparison");
    expect(out.blocked).toBe(true);
    expect(out.plan.eventKeys).toEqual([]);
  });
});

describe("mock comparison result display", () => {
  it("returns the fixture comparison result for ga4:purchase_click", () => {
    const out = evaluateQuery(row("ga4:purchase_click"), "comparison");
    expect(out.blocked).toBe(false);
    expect(out.result).not.toBeNull();
    expect(out.result!.value).toBe((1240).toLocaleString());
    expect(out.result!.previousValue).toBe((1100).toLocaleString());
    expect(out.result!.deltaPercent).toBeCloseTo(12.7, 1);
    expect(out.result!.dateRange).toBe("2026-07-12 ~ 2026-08-11");
    expect(out.result!.comparisonDateRange).toBe("2026-06-12 ~ 2026-07-11");
    expect(out.result!.reportingTimezone).toBe("Asia/Seoul");
  });

  it("has no fixture result for other comparison combinations", () => {
    const out = evaluateQuery(row("ga4:custom_card_click"), "comparison");
    expect(out.result).toBeNull();
    expect(out.noResultReason).toContain("fixture");
  });

  it("event_count falls back to the health latestMeasurement", () => {
    expect(evaluateQuery(row("ga4:purchase_click"), "event_count").result!.value).toBe((1240).toLocaleString());
    const noRows = evaluateQuery(row("ga4:signup_complete"), "event_count");
    expect(noRows.result).toBeNull();
    expect(noRows.noResultReason).toContain("no_rows");
  });

  it("definition needs no execution and no date range", () => {
    const out = evaluateQuery(row("ga4:purchase_click"), "definition");
    expect(out.blocked).toBe(false);
    expect(out.statusLabel).toBe("실행 불필요");
    expect(out.plan.dateRange).toBeUndefined();
    expect(out.plan.comparisonRange).toBeUndefined();
  });
});

describe("query plan draft", () => {
  it("carries the eventKey and provider source ref verbatim", () => {
    const out = evaluateQuery(row("ga4:purchase_click"), "comparison");
    expect(out.plan.eventKeys).toEqual(["ga4:purchase_click"]);
    expect(out.plan.sourceRefs).toEqual(["ga4"]);
    expect(out.plan.comparisonRange).toEqual({ preset: "previous_30_days" });
  });
});
