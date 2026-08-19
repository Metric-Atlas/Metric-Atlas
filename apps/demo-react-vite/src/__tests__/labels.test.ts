import { describe, expect, it } from "vitest";
import { EVENT_KO, FIELD_KO, eventKo, valueKo } from "../labels";
import { manifest } from "../data";

describe("Korean label mapping", () => {
  it("covers every manifest event name", () => {
    for (const e of manifest.events) expect(EVENT_KO[e.eventName]).toBeTruthy();
  });

  it("never replaces the original event name", () => {
    expect(eventKo("purchase_click")).toBe("구매 버튼 클릭");
    expect(Object.keys(EVENT_KO)).toContain("purchase_click");
  });

  it("keeps field names English with a Korean marketer term", () => {
    expect(FIELD_KO.EMITTER).toBe("전송 방식");
    expect(FIELD_KO.PROVIDER).toBe("수집 도구");
  });

  it("maps EMITTER values as transmission methods, not destinations", () => {
    expect(valueKo("EMITTER", "ga4")).toBe("gtag 직접 전송");
    expect(valueKo("EMITTER", "gtm")).toBe("GTM(dataLayer) 전송");
    expect(valueKo("PROVIDER", "ga4")).toBe("GA4");
    expect(valueKo("PROVIDER", "unknown")).toBe("확인 불가");
  });

  it("falls back to an empty gloss for unmapped values", () => {
    expect(valueKo("PROVIDER", "mixpanel")).toBe("");
    expect(eventKo("brand_new_event")).toBe("설명 없음");
  });
});
