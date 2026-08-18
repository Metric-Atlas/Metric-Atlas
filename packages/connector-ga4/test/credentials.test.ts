import { describe, expect, test } from "vitest";
import { resolveGa4Credentials } from "../src/credentials.js";

const SAMPLE_SA = { client_email: "sa@test.iam.gserviceaccount.com", private_key: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n" };
const SAMPLE_B64 = Buffer.from(JSON.stringify(SAMPLE_SA)).toString("base64");

describe("resolveGa4Credentials (docs/06 §4 우선순위)", () => {
  test("방식 A: GOOGLE_APPLICATION_CREDENTIALS 경로가 있으면 adc_path 반환", () => {
    const result = resolveGa4Credentials({
      GOOGLE_APPLICATION_CREDENTIALS: "/secure/sa.json",
    });
    expect(result).toEqual({ type: "adc_path", path: "/secure/sa.json" });
  });

  test("방식 B: base64 JSON만 있으면 디코드해서 inline_json 반환", () => {
    const result = resolveGa4Credentials({
      METRIC_ATLAS_GA4_SERVICE_ACCOUNT_JSON_BASE64: SAMPLE_B64,
    });
    expect(result).toEqual({ type: "inline_json", credentials: SAMPLE_SA });
  });

  test("A와 B가 둘 다 있으면 A가 우선", () => {
    const result = resolveGa4Credentials({
      GOOGLE_APPLICATION_CREDENTIALS: "/secure/sa.json",
      METRIC_ATLAS_GA4_SERVICE_ACCOUNT_JSON_BASE64: SAMPLE_B64,
    });
    expect(result.type).toBe("adc_path");
  });

  test("둘 다 없으면 설정 안내 에러", () => {
    expect(() => resolveGa4Credentials({})).toThrow(/GOOGLE_APPLICATION_CREDENTIALS/);
  });

  test("base64가 유효한 JSON이 아니면 에러 — 원문 내용을 메시지에 노출하지 않음", () => {
    const invalid = Buffer.from("secret-not-json").toString("base64");
    let message = "";
    try {
      resolveGa4Credentials({ METRIC_ATLAS_GA4_SERVICE_ACCOUNT_JSON_BASE64: invalid });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/METRIC_ATLAS_GA4_SERVICE_ACCOUNT_JSON_BASE64/);
    expect(message).not.toContain("secret-not-json");
    expect(message).not.toContain(invalid);
  });
});
