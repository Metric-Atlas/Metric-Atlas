import { describe, expect, it } from "vitest";
import { health, joinRows, loadDashboardData, manifest } from "../data";

describe("health join by eventKey", () => {
  const rows = joinRows();

  it("joins manifest events with health items and keeps health-only events", () => {
    expect(rows).toHaveLength(manifest.events.length + 1);
    const pageView = rows.find((r) => r.eventKey === "ga4:page_view");
    expect(pageView?.event).toBeNull();
    expect(pageView?.health?.ga4ManagedState).toBe("managed");
  });

  it("assigns mutually exclusive buckets by priority", () => {
    const byKey = new Map(rows.map((r) => [r.eventKey, r.bucket]));
    expect(byKey.get("ga4:purchase_click")).toBe("parameterRegistrationGap");
    expect(byKey.get("ga4:signup_complete")).toBe("codeOnly");
    expect(byKey.get("ga4:page_view")).toBe("ga4Managed");
    expect(byKey.get("gtm:lead_submit")).toBe("noHealth");
  });

  it("agrees with the fixture summary for the buckets it covers", () => {
    const counts = rows.reduce<Record<string, number>>((acc, r) => {
      acc[r.bucket] = (acc[r.bucket] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts.parameterRegistrationGap).toBe(health.summary.parameterRegistrationGap);
    expect(counts.codeOnly).toBe(health.summary.codeOnly);
    expect(counts.ga4Managed).toBe(health.summary.ga4Managed);
  });

  it("keeps original event names and keys untranslated", () => {
    expect(rows.map((r) => r.eventName)).toContain("purchase_click");
    expect(rows.map((r) => r.eventKey)).toContain("ga4:purchase_click");
  });
});


describe("dashboard runtime data fallback", () => {
  it("uses runtime manifest and fixture health when runtime health is not compatible", async () => {
    const runtimeManifest = { ...manifest, buildId: "runtime-build" };
    const fetcher = async (url: RequestInfo | URL) => {
      const path = String(url);
      if (path.endsWith("/manifest")) return jsonResponse(runtimeManifest);
      if (path.endsWith("/health")) return jsonResponse({ ok: true, mode: "local-node-runtime" });
      throw new Error(`unexpected url ${path}`);
    };

    const data = await loadDashboardData(fetcher as typeof fetch);

    expect(data.manifest.buildId).toBe("runtime-build");
    expect(data.manifestSource).toBe("runtime");
    expect(data.healthSource).toBe("fixture");
    expect(data.runtimeAvailable).toBe(true);
    expect(data.fallbackReasons).toContain("GA4 health runtime response shape mismatch");
  });

  it("falls back to fixture data when runtime is unavailable", async () => {
    const fetcher = async () => {
      throw new Error("connect ECONNREFUSED");
    };

    const data = await loadDashboardData(fetcher as typeof fetch);

    expect(data.manifestSource).toBe("fixture");
    expect(data.healthSource).toBe("fixture");
    expect(data.runtimeAvailable).toBe(false);
  });
});

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}
