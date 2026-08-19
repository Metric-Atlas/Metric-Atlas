/**
 * 검증 0: 환경 설정 + Service Account 최소 권한(Viewer) 연결 확인 (docs/17 검증 8)
 * 성공 시 Property 표시 이름과 timezone을 출력합니다.
 */
import { adminClient, getPropertyId, section, timed } from "./lib.js";

const propertyId = getPropertyId();
section(`00. Setup check — properties/${propertyId}`);

const admin = adminClient();
const [property] = await timed("admin.getProperty", () =>
  admin.getProperty({ name: `properties/${propertyId}` }),
);

console.log(`연결 성공 ✅`);
console.log(`displayName: ${property.displayName}`);
console.log(`timeZone(Reporting Time Zone): ${property.timeZone}`);
console.log(`currencyCode: ${property.currencyCode}`);
console.log(`createTime: ${property.createTime?.seconds ?? "?"}`);
console.log(
  `\n→ 이 출력이 보이면 Service Account가 Viewer 권한으로 Property에 연결된 것입니다.`,
);
