import { describe, expect, test } from "vitest";
import { mapQualityFlags } from "../src/quality-flags.js";

const NOW = new Date("2026-08-18T12:00:00Z");

describe("mapQualityFlags (Spike §4 실측 반영)", () => {
  test("metadata에 플래그 신호가 없으면 빈 배열", () => {
    const flags = mapQualityFlags({ metadata: {}, endDate: "2026-07-01", now: NOW, recentWindowHours: 48 });
    expect(flags).toEqual([]);
  });

  test("subjectToThresholding=true → subject_to_thresholding", () => {
    const flags = mapQualityFlags({
      metadata: { subjectToThresholding: true },
      endDate: "2026-07-01",
      now: NOW,
      recentWindowHours: 48,
    });
    expect(flags).toContain("subject_to_thresholding");
  });

  test("subjectToThresholding 필드 부재는 false로 해석 (proto3 생략) — flag 없음", () => {
    // Spike 실측: false일 때 응답에서 필드 자체가 생략됨
    const flags = mapQualityFlags({
      metadata: { dataLossFromOtherRow: false },
      endDate: "2026-07-01",
      now: NOW,
      recentWindowHours: 48,
    });
    expect(flags).not.toContain("subject_to_thresholding");
  });

  test("dataLossFromOtherRow=true → other_row_data_loss", () => {
    const flags = mapQualityFlags({
      metadata: { dataLossFromOtherRow: true },
      endDate: "2026-07-01",
      now: NOW,
      recentWindowHours: 48,
    });
    expect(flags).toContain("other_row_data_loss");
  });

  test("조회 종료일이 recent window(48h) 이내면 recent_data_may_change", () => {
    const flags = mapQualityFlags({ metadata: {}, endDate: "2026-08-18", now: NOW, recentWindowHours: 48 });
    expect(flags).toEqual(["recent_data_may_change"]);
  });

  test("종료일이 window 밖이면 recent flag 없음", () => {
    // 48h window, now=8/18 12:00Z → 경계는 8/16 12:00Z. 8/15 종료 조회는 밖.
    const flags = mapQualityFlags({ metadata: {}, endDate: "2026-08-15", now: NOW, recentWindowHours: 48 });
    expect(flags).toEqual([]);
  });

  test("복수 신호는 flag를 모두 세운다", () => {
    const flags = mapQualityFlags({
      metadata: { subjectToThresholding: true, dataLossFromOtherRow: true },
      endDate: "2026-08-18",
      now: NOW,
      recentWindowHours: 48,
    });
    expect(flags.sort()).toEqual([
      "other_row_data_loss",
      "recent_data_may_change",
      "subject_to_thresholding",
    ]);
  });
});
