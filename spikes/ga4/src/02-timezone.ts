/**
 * 검증 2: Reporting Time Zone 획득 + 기간 경계 해석 확인 (docs/17 검증 2)
 * Admin API의 property.timeZone과 Data API response metadata의 timeZone이
 * 일치하는지, dateRange "yesterday"가 어느 시간대 기준인지 확인합니다.
 */
import { adminClient, dataClient, getPropertyId, section, timed } from "./lib.js";

const propertyId = getPropertyId();
section(`02. Reporting Time Zone 확인`);

const admin = adminClient();
const [property] = await timed("admin.getProperty", () =>
  admin.getProperty({ name: `properties/${propertyId}` }),
);
console.log(`Admin API property.timeZone: ${property.timeZone}`);

const client = dataClient();
const [response] = await timed("data.runReport(yesterday, date별)", () =>
  client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: "yesterday", endDate: "today" }],
    dimensions: [{ name: "date" }],
    metrics: [{ name: "eventCount" }],
  }),
);

console.log(`Data API metadata.timeZone: ${response.metadata?.timeZone ?? "(없음)"}`);
console.log(`로컬 머신 시각: ${new Date().toISOString()} (UTC)`);
console.log(`반환된 date dimension 값:`);
for (const row of response.rows ?? []) {
  console.log(`  date=${row.dimensionValues?.[0]?.value} eventCount=${row.metricValues?.[0]?.value}`);
}
console.log(
  `\n→ 확인 포인트: date 경계가 Property timezone 기준인지 (UTC 자정과 다른지) 기록.`,
);
