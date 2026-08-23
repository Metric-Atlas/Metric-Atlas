import type { JoinedRow } from "./types";

export type SearchField = "all" | "name" | "key" | "file";

export interface FilterState {
  query: string;
  field: SearchField;
  exact: boolean;
  provider: string; // "all" | analyticsProvider
  emitter: string;  // "all" | emitter
  overlay: "all" | "yes" | "no";
  health: string;   // "all" | HealthBucket
}

export const EMPTY_FILTERS: FilterState = {
  query: "", field: "all", exact: false, provider: "all", emitter: "all", overlay: "all", health: "all"
};

/** substring match, then subsequence match (fuzzy). Case-insensitive. */
export function fuzzyMatch(needle: string, haystack: string | undefined): boolean {
  const n = needle.toLowerCase();
  const s = (haystack ?? "").toLowerCase();
  if (!n) return true;
  if (s.includes(n)) return true;
  let i = 0;
  for (const ch of s) {
    if (ch === n[i]) i += 1;
    if (i === n.length) return true;
  }
  return false;
}

function targetsFor(row: JoinedRow, field: SearchField): string[] {
  const file = row.event?.source.file ?? "";
  if (field === "name") return [row.eventName];
  if (field === "key") return [row.eventKey];
  if (field === "file") return [file];
  return [row.eventName, row.eventKey, file];
}

export function filterRows(rows: JoinedRow[], f: FilterState): JoinedRow[] {
  const q = f.query.trim();
  return rows.filter((row) => {
    if (q) {
      const targets = targetsFor(row, f.field);
      const hit = f.exact ? targets.some((t) => t === q) : targets.some((t) => fuzzyMatch(q, t));
      if (!hit) return false;
    }
    const provider = row.event?.analyticsProvider ?? "ga4";
    const emitter = row.event?.emitter ?? "—";
    if (f.provider !== "all" && provider !== f.provider) return false;
    if (f.emitter !== "all" && emitter !== f.emitter) return false;
    if (f.overlay !== "all") {
      const supported = row.event?.overlaySupported ?? false;
      if ((f.overlay === "yes") !== supported) return false;
    }
    if (f.health !== "all" && row.bucket !== f.health) return false;
    return true;
  });
}

/** 한국어 질문에서 이벤트 후보를 좁히기 위한 로컬 힌트 (LLM 호출 없음) */
export const KO_HINTS: { words: string[]; eventName: string }[] = [
  { words: ["구매", "결제", "purchase"], eventName: "purchase_click" },
  { words: ["가입", "회원", "signup"], eventName: "signup_complete" },
  { words: ["리드", "문의", "폼", "lead"], eventName: "lead_submit" },
  { words: ["카드", "card"], eventName: "custom_card_click" },
  { words: ["페이지", "조회", "page"], eventName: "page_view" }
];

export const MAX_CANDIDATES = 20;

/** Local candidate narrowing for the query screen. Never picks one automatically. */
export function findCandidates(rows: JoinedRow[], question: string): JoinedRow[] {
  const q = question.trim();
  if (!q) return rows.slice(0, MAX_CANDIDATES);
  const lower = q.toLowerCase();
  const hinted = KO_HINTS.filter((h) => h.words.some((w) => lower.includes(w))).map((h) => h.eventName);
  const tokens = q.split(/\s+/).filter((t) => t.length > 1);
  const matched = rows.filter((row) => {
    if (hinted.includes(row.eventName)) return true;
    const file = row.event?.source.file ?? "";
    return tokens.some((t) => fuzzyMatch(t, row.eventName) || fuzzyMatch(t, row.eventKey) || fuzzyMatch(t, file));
  });
  return matched.slice(0, MAX_CANDIDATES);
}
