import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { v1beta as adminV1beta } from "@google-analytics/admin";

// spikes/ga4/.env 로드 (.env.example 참고)
config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".env") });

const PLACEHOLDER_PATTERN = /REPLACE_WITH|\/absolute\/path\/to\//;

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || PLACEHOLDER_PATTERN.test(value)) {
    console.error(
      `[설정 필요] ${name}이(가) 비어 있거나 placeholder입니다.\n` +
        `spikes/ga4/.env.example을 .env로 복사한 뒤 실제 값을 채우세요.`,
    );
    process.exit(1);
  }
  return value;
}

export function getPropertyId(): string {
  const id = requireEnv("METRIC_ATLAS_GA4_PROPERTY_ID");
  if (!/^\d+$/.test(id)) {
    console.error(`[설정 오류] Property ID는 숫자여야 합니다 (현재: ${id})`);
    process.exit(1);
  }
  return id;
}

export function assertCredentialFile(): void {
  const credPath = requireEnv("GOOGLE_APPLICATION_CREDENTIALS");
  if (!fs.existsSync(credPath)) {
    console.error(`[설정 오류] credential 파일이 없습니다: ${credPath}`);
    process.exit(1);
  }
}

export function dataClient(): BetaAnalyticsDataClient {
  assertCredentialFile();
  return new BetaAnalyticsDataClient();
}

export function adminClient() {
  assertCredentialFile();
  return new adminV1beta.AnalyticsAdminServiceClient();
}

/** 호출 latency 측정 (docs/17 검증 7) */
export async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    console.log(`⏱  ${label}: ${Math.round(performance.now() - start)}ms`);
  }
}

/** returnPropertyQuota 응답 요약 출력 (docs/17 검증 7) */
export function printQuota(quota: unknown): void {
  if (!quota) {
    console.log("quota: 응답에 propertyQuota 없음");
    return;
  }
  const q = quota as Record<string, { consumed?: number | null; remaining?: number | null }>;
  for (const key of [
    "tokensPerDay",
    "tokensPerHour",
    "concurrentRequests",
    "potentiallyThresholdedRequestsPerHour",
  ]) {
    const entry = q[key];
    if (entry) console.log(`quota.${key}: consumed=${entry.consumed} remaining=${entry.remaining}`);
  }
}

export function section(title: string): void {
  console.log(`\n${"=".repeat(60)}\n${title}\n${"=".repeat(60)}`);
}
