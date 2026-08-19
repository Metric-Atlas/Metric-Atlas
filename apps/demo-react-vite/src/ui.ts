import type { CSSProperties } from "react";
import { C } from "./labels";

export const mono = "'JetBrains Mono', monospace";

export const card: CSSProperties = {
  background: C.surface, border: `1px solid ${C.line}`, borderRadius: 12, padding: "16px 18px"
};
export const sectionTitle: CSSProperties = { margin: 0, fontSize: 14, fontWeight: 700 };
export const fieldLabel: CSSProperties = {
  fontSize: 9.5, fontWeight: 700, letterSpacing: "0.06em", color: C.faint, overflowWrap: "anywhere"
};
export const input: CSSProperties = {
  width: "100%", padding: "10px 12px", border: `1px solid #d9d9d2`, borderRadius: 8,
  fontSize: 13, background: C.surfaceAlt, color: C.ink
};
export const select: CSSProperties = { ...input, padding: "8px 10px", fontSize: 12.5 };
export const badge = (bg: string, fg: string): CSSProperties => ({
  padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: bg, color: fg
});
export const tag = (bg: string, fg: string): CSSProperties => ({
  display: "inline-flex", flexWrap: "wrap", alignItems: "center", gap: 5,
  padding: "3px 8px", borderRadius: 5, background: bg, color: fg, fontSize: 10.5, fontWeight: 600
});
export const monoText = (size = 12): CSSProperties => ({
  fontFamily: mono, fontSize: size, overflowWrap: "anywhere"
});
export const grid = (min: number, gap = 10): CSSProperties => ({
  display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap
});
