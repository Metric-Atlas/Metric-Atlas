import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  AnalyticsHealthReport,
  EventManifest,
  MockQueryFixture,
  classifyHealthItemBucket,
  type HealthSummary,
} from "../src/index.js";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

function loadFixture(name: string): unknown {
  const filePath = path.join(rootDir, "fixtures", name);
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

describe("Contract v0 fixtures (ADR-001)", () => {
  it("mock-manifest.json matches EventManifest", () => {
    expect(() => EventManifest.parse(loadFixture("mock-manifest.json"))).not.toThrow();
  });

  it("mock-ga4-health.json matches AnalyticsHealthReport", () => {
    expect(() =>
      AnalyticsHealthReport.parse(loadFixture("mock-ga4-health.json")),
    ).not.toThrow();
  });

  it("mock-query-result.json matches MockQueryFixture", () => {
    expect(() =>
      MockQueryFixture.parse(loadFixture("mock-query-result.json")),
    ).not.toThrow();
  });

  it("Health items with codeState=detected exist in the Manifest with the same eventKey", () => {
    const manifest = EventManifest.parse(loadFixture("mock-manifest.json"));
    const health = AnalyticsHealthReport.parse(loadFixture("mock-ga4-health.json"));
    const manifestEventKeys = new Set(manifest.events.map((e) => e.eventKey));

    for (const item of health.items) {
      if (item.codeState === "detected") {
        expect(manifestEventKeys.has(item.eventKey)).toBe(true);
      }
    }
  });

  it("Health items only include GA4 events (docs/20 §8)", () => {
    const manifest = EventManifest.parse(loadFixture("mock-manifest.json"));
    const health = AnalyticsHealthReport.parse(loadFixture("mock-ga4-health.json"));
    const ga4EventKeys = new Set(
      manifest.events
        .filter((e) => e.analyticsProvider === "ga4")
        .map((e) => e.eventKey),
    );

    for (const item of health.items) {
      if (item.codeState === "detected") {
        expect(ga4EventKeys.has(item.eventKey)).toBe(true);
      }
    }
  });

  it("HealthSummary matches the mutually-exclusive bucket priority (ADR-001)", () => {
    const health = AnalyticsHealthReport.parse(loadFixture("mock-ga4-health.json"));
    const buckets: HealthSummary = {
      healthy: 0,
      codeOnly: 0,
      ga4Only: 0,
      ga4Managed: 0,
      parameterRegistrationGap: 0,
      unresolved: 0,
    };

    for (const item of health.items) {
      buckets[classifyHealthItemBucket(item)] += 1;
    }

    expect(buckets).toEqual(health.summary);
  });

  it("QueryResult with metricType=comparison includes comparisonDateRange", () => {
    const fixture = MockQueryFixture.parse(loadFixture("mock-query-result.json"));
    if (fixture.result.metricType === "comparison") {
      expect(fixture.result.comparisonDateRange).toBeDefined();
    }
  });
});
