/**
 * C-003: Health 관측 기간을 Property Reporting Time Zone 기준 절대 날짜로 계산한다.
 * Connector가 preset을 지원하지 않으므로(asAbsolute) Runtime이 이 함수로 절대
 * dateRange를 만들어 buildAnalyticsHealthReport에 넘긴다.
 */
export function resolveHealthDateRange(input: {
  timezone: string;
  windowDays: number;
  now: Date;
}): { startDate: string; endDate: string } {
  const endDate = dateInTimezone(input.now, input.timezone || "UTC");
  const endUtcMs = Date.parse(`${endDate}T00:00:00Z`);
  const startUtcMs = endUtcMs - (input.windowDays - 1) * 86_400_000;
  const startDate = new Date(startUtcMs).toISOString().slice(0, 10);
  return { startDate, endDate };
}

/** 해당 timezone의 "오늘"을 YYYY-MM-DD로 반환 (en-CA locale은 ISO 형식을 냄). */
function dateInTimezone(now: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
