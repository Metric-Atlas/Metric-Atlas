import { describe, expect, it } from "vitest";
import { joinRows } from "../data";
import { EMPTY_FILTERS, filterRows, findCandidates, fuzzyMatch } from "../search";

const rows = joinRows();
const keys = (rs: { eventKey: string }[]) => rs.map((r) => r.eventKey);

describe("eventName exact search", () => {
  it("matches only the exact event name", () => {
    const out = filterRows(rows, { ...EMPTY_FILTERS, query: "purchase_click", field: "name", exact: true });
    expect(keys(out)).toEqual(["ga4:purchase_click"]);
  });

  it("does not match a partial name when exact is on", () => {
    const out = filterRows(rows, { ...EMPTY_FILTERS, query: "purchase", field: "name", exact: true });
    expect(out).toHaveLength(0);
  });
});

describe("eventKey exact search", () => {
  it("matches the provider-prefixed key verbatim", () => {
    const out = filterRows(rows, { ...EMPTY_FILTERS, query: "gtm:lead_submit", field: "key", exact: true });
    expect(keys(out)).toEqual(["gtm:lead_submit"]);
  });
});

describe("fuzzy search", () => {
  it("matches a substring", () => {
    const out = filterRows(rows, { ...EMPTY_FILTERS, query: "signup" });
    expect(keys(out)).toEqual(["ga4:signup_complete"]);
  });

  it("matches a subsequence", () => {
    expect(fuzzyMatch("pchk", "purchase_click")).toBe(true);
    expect(fuzzyMatch("zzz", "purchase_click")).toBe(false);
  });
});

describe("source file search", () => {
  it("finds events by source path", () => {
    const out = filterRows(rows, { ...EMPTY_FILTERS, query: "src/LeadForm.tsx", field: "file", exact: true });
    expect(keys(out)).toEqual(["gtm:lead_submit"]);
  });
});

describe("provider filter", () => {
  it("keeps ga4 provider events only", () => {
    const out = filterRows(rows, { ...EMPTY_FILTERS, provider: "ga4" });
    expect(keys(out)).toEqual(["ga4:purchase_click", "ga4:custom_card_click", "ga4:signup_complete", "ga4:page_view"]);
  });

  it("keeps unknown provider events only", () => {
    const out = filterRows(rows, { ...EMPTY_FILTERS, provider: "unknown" });
    expect(keys(out)).toEqual(["gtm:lead_submit"]);
  });
});

describe("emitter filter", () => {
  it("gtm emitter is not conflated with ga4", () => {
    const out = filterRows(rows, { ...EMPTY_FILTERS, emitter: "gtm" });
    expect(keys(out)).toEqual(["gtm:lead_submit"]);
    expect(out[0]!.event?.analyticsProvider).toBe("unknown");
  });
});

describe("overlay filter", () => {
  it("splits supported and unsupported", () => {
    expect(keys(filterRows(rows, { ...EMPTY_FILTERS, overlay: "no" }))).toContain("ga4:custom_card_click");
    expect(keys(filterRows(rows, { ...EMPTY_FILTERS, overlay: "yes" }))).not.toContain("ga4:custom_card_click");
  });
});

describe("no candidate state", () => {
  it("returns nothing for an unmatched query", () => {
    expect(filterRows(rows, { ...EMPTY_FILTERS, query: "존재하지_않는_이벤트", exact: true })).toHaveLength(0);
    expect(findCandidates(rows, "존재하지 않는 이벤트")).toHaveLength(0);
  });
});

describe("multiple candidate state", () => {
  it("returns every match without auto-picking, capped at 20", () => {
    const out = findCandidates(rows, "click");
    expect(out.length).toBeGreaterThan(1);
    expect(out.length).toBeLessThanOrEqual(20);
  });

  it("narrows a Korean question to one candidate via local hints", () => {
    expect(keys(findCandidates(rows, "구매 클릭이 지난달보다 늘었나요?"))).toEqual(["ga4:purchase_click"]);
  });
});
