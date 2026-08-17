/**
 * 검증 5: 최근 데이터 지연 체감 측정 (docs/17 검증 5)
 *
 * 오늘/어제 날짜별 eventCount를 실행 시각과 함께 남깁니다.
 * 하루 중 여러 번(예: 오전/오후/다음날) 실행해 out/freshness-log.jsonl에
 * 누적하고, 값이 안정화되는 시점을 관찰합니다.
 * → METRIC_ATLAS_GA4_RECENT_WINDOW_HOURS 기본값(현재 48h) 근거.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { dataClient, getPropertyId, section, timed } from "./lib.js";

const propertyId = getPropertyId();
section(`04. Data freshness 관찰 (반복 실행용)`);

const client = dataClient();
const [response] = await timed("data.runReport(date별, 최근 3일)", () =>
  client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: "2daysAgo", endDate: "today" }],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "eventCount" }],
  }),
);

const observation = {
  observedAt: new Date().toISOString(),
  rows: (response.rows ?? []).map((row) => ({
    date: row.dimensionValues?.[0]?.value,
    eventCount: row.metricValues?.[0]?.value,
  })),
};
console.log(JSON.stringify(observation, null, 2));

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "out");
fs.mkdirSync(outDir, { recursive: true });
const logPath = path.join(outDir, "freshness-log.jsonl");
fs.appendFileSync(logPath, JSON.stringify(observation) + "\n");
console.log(`\n관찰 기록 누적: ${logPath} (gitignore됨)`);
console.log(`→ 몇 시간 간격으로 재실행해 같은 date의 값 변화를 비교하세요.`);
