/**
 * 검증 6: Admin API Custom Dimension 목록 + Data API Metadata로
 * ParameterState 4상태(builtin | registered_custom_dimension | not_registered | unknown)
 * 판정 가능성 확인 (docs/17 검증 6, docs/06 §6)
 */
import { adminClient, dataClient, getPropertyId, section, timed } from "./lib.js";

const propertyId = getPropertyId();

section(`05a. Admin API listCustomDimensions`);
const admin = adminClient();
const [customDimensions] = await timed("admin.listCustomDimensions", () =>
  admin.listCustomDimensions({ parent: `properties/${propertyId}` }),
);
console.log(`등록된 Custom Dimension: ${customDimensions.length}건`);
for (const dimension of customDimensions) {
  console.log(`  parameterName=${dimension.parameterName} scope=${dimension.scope} displayName=${dimension.displayName}`);
}

section(`05b. Data API getMetadata — built-in dimension 목록`);
const client = dataClient();
const [metadata] = await timed("data.getMetadata", () =>
  client.getMetadata({ name: `properties/${propertyId}/metadata` }),
);
const builtin = (metadata.dimensions ?? []).filter((d) => !d.customDefinition);
const custom = (metadata.dimensions ?? []).filter((d) => d.customDefinition);
console.log(`built-in dimension: ${builtin.length}건, custom(Metadata 기준): ${custom.length}건`);
console.log(`built-in 예시: ${builtin.slice(0, 10).map((d) => d.apiName).join(", ")} ...`);

section(`05c. ParameterState 판정 시뮬레이션`);
// mock-manifest의 파라미터로 4상태 판정을 시연 — 실제 판정 로직의 원형
const sampleParameters = ["value", "currency", "campaign_slot", "form_type"];
const customParameterNames = new Set(
  customDimensions.map((d) => d.parameterName).filter(Boolean),
);
const builtinApiNames = new Set(builtin.map((d) => d.apiName?.toLowerCase()));

for (const parameter of sampleParameters) {
  let state: string;
  if (customParameterNames.has(parameter)) state = "registered_custom_dimension";
  // GA4 built-in 판정 기준은 Spike에서 확정 필요: apiName 직접 매칭이 아니라
  // 예약 파라미터 목록(currency 등) 대조가 필요할 수 있음 → 결과 문서에 기록
  else if (builtinApiNames.has(parameter.toLowerCase())) state = "builtin";
  else state = "not_registered";
  console.log(`  ${parameter} → ${state}`);
}
console.log(
  `\n→ 확인 포인트: 'currency' 같은 예약 파라미터가 Metadata apiName으로 판정 가능한지,` +
    `\n  아니면 별도 예약 파라미터 목록이 필요한지 기록 (builtin 판정 규칙의 핵심).`,
);
