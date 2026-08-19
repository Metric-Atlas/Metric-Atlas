import { describe, expect, test } from "vitest";
import { resolveHealthDateRange } from "../src/health-date-range.js";

describe("resolveHealthDateRange (C-003 — Property timezone 기준 관측 기간)", () => {
  test("UTC 20시, Asia/Seoul은 이미 다음날 → endDate가 KST 날짜", () => {
    const range = resolveHealthDateRange({
      timezone: "Asia/Seoul",
      windowDays: 30,
      now: new Date("2026-08-19T20:00:00Z"), // KST 2026-08-20 05:00
    });
    expect(range.endDate).toBe("2026-08-20");
  });

  test("같은 시각 UTC timezone이면 endDate는 UTC 날짜", () => {
    const range = resolveHealthDateRange({
      timezone: "UTC",
      windowDays: 30,
      now: new Date("2026-08-19T20:00:00Z"),
    });
    expect(range.endDate).toBe("2026-08-19");
  });

  test("windowDays=30이면 startDate는 endDate 포함 30일 전 경계", () => {
    const range = resolveHealthDateRange({
      timezone: "UTC",
      windowDays: 30,
      now: new Date("2026-08-19T12:00:00Z"),
    });
    expect(range).toEqual({ startDate: "2026-07-21", endDate: "2026-08-19" });
  });

  test("windowDays=1이면 startDate=endDate (오늘 하루)", () => {
    const range = resolveHealthDateRange({
      timezone: "Asia/Seoul",
      windowDays: 1,
      now: new Date("2026-08-19T02:00:00Z"), // KST 2026-08-19 11:00
    });
    expect(range).toEqual({ startDate: "2026-08-19", endDate: "2026-08-19" });
  });

  test("월 경계를 넘는 뺄셈이 올바름", () => {
    const range = resolveHealthDateRange({
      timezone: "UTC",
      windowDays: 7,
      now: new Date("2026-03-03T12:00:00Z"),
    });
    expect(range).toEqual({ startDate: "2026-02-25", endDate: "2026-03-03" });
  });

  test("timezone이 빈 문자열이면 UTC로 동작 (연결 실패 대비 안전 기본값)", () => {
    const range = resolveHealthDateRange({
      timezone: "",
      windowDays: 30,
      now: new Date("2026-08-19T20:00:00Z"),
    });
    expect(range.endDate).toBe("2026-08-19");
  });
});
