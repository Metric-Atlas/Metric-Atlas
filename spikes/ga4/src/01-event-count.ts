/**
 * 검증 1: eventName dimension + eventCount metric 조회 (docs/17 검증 1)
 * 검증 7: latency / quota 관찰 (returnPropertyQuota)
 */
import { dataClient, getPropertyId, printQuota, section, timed } from "./lib.js";

const propertyId = getPropertyId();
section(`01. runReport eventName/eventCount — 최근 7일`);

const client = dataClient();
const [response] = await timed("data.runReport", () =>
  client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: "7daysAgo", endDate: "today" }],
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }],
    limit: 50,
    returnPropertyQuota: true,
  }),
);

console.log(`rowCount(전체): ${response.rowCount}`);
console.log(`반환 rows: ${response.rows?.length ?? 0}`);
for (const row of response.rows ?? []) {
  console.log(`  ${row.dimensionValues?.[0]?.value}: ${row.metricValues?.[0]?.value}`);
}

if (!response.rows?.length) {
  console.log("⚠️  no_rows — Property에 최근 7일 데이터가 없거나 수집 전입니다.");
}

printQuota(response.propertyQuota);
