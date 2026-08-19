export type Ga4Credentials =
  | { type: "adc_path"; path: string }
  | { type: "inline_json"; credentials: { client_email: string; private_key: string } };

/**
 * credential 해석 우선순위 (docs/06 §4, docs/10 §2):
 *   1. GOOGLE_APPLICATION_CREDENTIALS (방식 A — 파일 경로)
 *   2. METRIC_ATLAS_GA4_SERVICE_ACCOUNT_JSON_BASE64 (방식 B — base64 JSON)
 * 에러 메시지에 secret 내용을 절대 포함하지 않는다 (docs/09).
 */
export function resolveGa4Credentials(
  env: Record<string, string | undefined>,
): Ga4Credentials {
  const adcPath = env.GOOGLE_APPLICATION_CREDENTIALS;
  if (adcPath) {
    return { type: "adc_path", path: adcPath };
  }

  const base64 = env.METRIC_ATLAS_GA4_SERVICE_ACCOUNT_JSON_BASE64;
  if (base64) {
    let credentials: { client_email: string; private_key: string };
    try {
      credentials = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
    } catch {
      throw new Error(
        "METRIC_ATLAS_GA4_SERVICE_ACCOUNT_JSON_BASE64를 디코드할 수 없습니다. base64로 인코딩된 Service Account JSON인지 확인하세요.",
      );
    }
    return { type: "inline_json", credentials };
  }

  throw new Error(
    "GA4 credential이 설정되지 않았습니다. GOOGLE_APPLICATION_CREDENTIALS 또는 METRIC_ATLAS_GA4_SERVICE_ACCOUNT_JSON_BASE64를 설정하세요.",
  );
}
