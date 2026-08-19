import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { AnalyticsHealthReport } from "@metric-atlas/contracts";
import { serveRuntime } from "../src/index.js";
import { HealthLiveError, type LiveHealthProvider } from "../src/health-live.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

const LIVE_REPORT: AnalyticsHealthReport = {
  generatedAt: "2026-08-19T12:00:00.000Z",
  provider: "ga4",
  propertyId: "550079255",
  reportingTimezone: "Asia/Seoul",
  summary: { healthy: 1, codeOnly: 0, ga4Only: 0, ga4Managed: 0, parameterRegistrationGap: 0, unresolved: 0 },
  items: [],
};

function fakeProvider(overrides: Partial<LiveHealthProvider> = {}): LiveHealthProvider {
  return {
    async getHealth() {
      return LIVE_REPORT;
    },
    ...overrides,
  };
}

describe("/__metric-atlas/api/health — live GA4 연결 (C-003)", () => {
  it("provider가 있으면 라이브 리포트를 반환한다", async () => {
    const root = await temporaryRoot();
    const runtime = await serveRuntime({ root, port: 0, healthProvider: fakeProvider() });
    try {
      const response = await fetch(healthUrl(runtime));
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.propertyId).toBe("550079255");
      expect(body.reportingTimezone).toBe("Asia/Seoul");
    } finally {
      await runtime.close();
    }
  });

  it("라이브 실패 시 정적 health.json이 있으면 fallback한다", async () => {
    const root = await temporaryRoot();
    await mkdir(path.join(root, ".metric-atlas"));
    await writeFile(
      path.join(root, ".metric-atlas", "health.json"),
      JSON.stringify({ provider: "ga4", servedFrom: "static-artifact" }),
    );
    const runtime = await serveRuntime({
      root,
      port: 0,
      healthProvider: fakeProvider({
        async getHealth() {
          throw new HealthLiveError("ga4_unauthorized", "no access");
        },
      }),
    });
    try {
      const response = await fetch(healthUrl(runtime));
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.servedFrom).toBe("static-artifact");
    } finally {
      await runtime.close();
    }
  });

  it("라이브 실패 + 정적 파일 없음이면 502와 에러 코드를 반환한다", async () => {
    const root = await temporaryRoot();
    const runtime = await serveRuntime({
      root,
      port: 0,
      healthProvider: fakeProvider({
        async getHealth() {
          throw new HealthLiveError("ga4_unauthorized", "no access");
        },
      }),
    });
    try {
      const response = await fetch(healthUrl(runtime));
      const body = await response.json();
      expect(response.status).toBe(502);
      expect(body.error.code).toBe("ga4_unauthorized");
    } finally {
      await runtime.close();
    }
  });

  it("healthProvider가 null이면 기존 정적 동작을 유지한다", async () => {
    const root = await temporaryRoot();
    await writeFile(path.join(root, "health.json"), JSON.stringify({ provider: "ga4", legacy: true }));
    const runtime = await serveRuntime({ root, port: 0, healthProvider: null });
    try {
      const response = await fetch(healthUrl(runtime));
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.legacy).toBe(true);
    } finally {
      await runtime.close();
    }
  });
});

function healthUrl(runtime: { host: string; port: number }): string {
  return `http://${runtime.host}:${runtime.port}/__metric-atlas/api/health`;
}

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "metric-atlas-runtime-live-"));
  temporaryDirectories.push(root);
  return root;
}
