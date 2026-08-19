/**
 * 검증 3: Response Metadata에서 thresholding 구분 (docs/17 검증 3)
 * 검증 4: (other) row / data loss metadata 확인 (docs/17 검증 4)
 *
 * thresholding은 user 계열 metric + 세분화된 dimension에서 발생하기 쉬우므로
 * 일부러 그런 조합으로 조회합니다. 재현이 안 되면 그 사실 자체를 기록합니다
 * (Task Spec C-SPIKE-001 Acceptance 4).
 */
import { dataClient, getPropertyId, printQuota, section, timed } from "./lib.js";

const propertyId = getPropertyId();
const client = dataClient();

section(`03a. 기본 조회의 metadata 플래그`);
const [basic] = await timed("data.runReport(eventName)", () =>
  client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
    dimensions: [{ name: "eventName" }],
    metrics: [{ name: "eventCount" }],
    returnPropertyQuota: true,
  }),
);

function printMetadata(label: string, metadata: unknown): void {
  const m = (metadata ?? {}) as Record<string, unknown>;
  console.log(`[${label}]`);
  console.log(`  subjectToThresholding: ${m.subjectToThresholding ?? "(필드 없음)"}`);
  console.log(`  dataLossFromOtherRow: ${m.dataLossFromOtherRow ?? "(필드 없음)"}`);
  console.log(`  samplingMetadatas: ${JSON.stringify(m.samplingMetadatas ?? "(필드 없음)")}`);
  console.log(`  schemaRestrictionResponse: ${JSON.stringify(m.schemaRestrictionResponse ?? "(필드 없음)")}`);
}
printMetadata("eventName/eventCount", basic.metadata);

section(`03b. thresholding 유발 시도 — activeUsers × eventName × pagePath`);
const [risky] = await timed("data.runReport(activeUsers 세분화)", () =>
  client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate: "28daysAgo", endDate: "today" }],
    dimensions: [{ name: "eventName" }, { name: "pagePath" }],
    metrics: [{ name: "activeUsers" }],
    limit: 100,
    returnPropertyQuota: true,
  }),
);
printMetadata("activeUsers 세분화", risky.metadata);

section(`04. (other) row 탐지 — 고카디널리티 dimension`);
const otherRows = (risky.rows ?? []).filter((row) =>
  row.dimensionValues?.some((d) => d.value === "(other)"),
);
console.log(`(other) 값을 가진 row: ${otherRows.length}건`);
console.log(
  otherRows.length
    ? `→ (other) 집계 재현됨. dataLossFromOtherRow 값과 함께 기록.`
    : `→ (other) 미재현. Property 카디널리티가 낮을 수 있음 — 사실대로 기록.`,
);
printQuota(risky.propertyQuota);
