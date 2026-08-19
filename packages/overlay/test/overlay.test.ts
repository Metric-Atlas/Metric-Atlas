// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EventManifest } from "@metric-atlas/contracts";
import {
  METRIC_ATLAS_OVERLAY_TAG,
  mountMetricAtlasOverlay,
  type DomCoverage,
} from "../src/index.ts";

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function manifest(): EventManifest {
  return {
    version: "0.1",
    buildId: "overlay-test",
    generatedAt: "2026-08-18T00:00:00.000Z",
    events: [
      {
        eventKey: "ga4:purchase_click",
        implementationKey: "impl_purchase",
        eventName: "purchase_click",
        emitter: "ga4",
        analyticsProvider: "ga4",
        providerDetectionConfidence: "provider_exact",
        parameters: ["currency", "value"],
        source: { file: "src/Button.tsx", line: 8, column: 5 },
        overlaySupported: true,
      },
    ],
    bindings: [
      {
        atlasDomId: "atlas_present",
        eventKeys: ["ga4:purchase_click"],
        implementationKeys: ["impl_purchase"],
        element: { type: "button", file: "src/Button.tsx", line: 12 },
        bindingConfidence: "binding_exact",
      },
      {
        atlasDomId: "atlas_missing",
        eventKeys: ["ga4:purchase_click"],
        implementationKeys: ["impl_purchase"],
        element: { type: "button", file: "src/Missing.tsx", line: 2 },
        bindingConfidence: "binding_exact",
      },
    ],
    warnings: [],
  };
}

describe("MetricAtlasOverlayElement", () => {
  it("measures DOM coverage and renders event metadata on delegated hover", () => {
    const target = document.createElement("button");
    target.dataset.atlasId = "atlas_present";
    document.body.append(target);

    const overlay = mountMetricAtlasOverlay();
    let coverage: DomCoverage | undefined;
    overlay.addEventListener("metric-atlas:coverage", (event) => {
      coverage = (event as CustomEvent<DomCoverage>).detail;
    });
    overlay.setManifest(manifest());
    expect(coverage).toEqual({
      injectCandidateCount: 2,
      domMatchedCount: 1,
      domMissingCount: 1,
      bindingCoverage: 0.5,
    });

    overlay.shadowRoot!.querySelector<HTMLButtonElement>("#launcher")!.click();
    target.dispatchEvent(
      new PointerEvent("pointerover", { bubbles: true, composed: true }),
    );
    expect(overlay.shadowRoot!.textContent).toContain("purchase_click");
    expect(overlay.shadowRoot!.textContent).toContain("Emitter: ga4");
    expect(overlay.shadowRoot!.textContent).toContain("src/Button.tsx:8:5");
    expect(target.style.outline).toContain("#2563eb");
  });

  it("mounts once", () => {
    const first = mountMetricAtlasOverlay({ manifest: manifest() });
    const second = mountMetricAtlasOverlay();
    expect(second).toBe(first);
    expect(document.querySelectorAll(METRIC_ATLAS_OVERLAY_TAG)).toHaveLength(1);
  });

  it("rejects a fetched manifest that is missing Contract v0 fields", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          version: "0.1",
          buildId: "invalid",
          events: [{ eventKey: "ga4:missing-fields" }],
          bindings: [],
          warnings: [],
        }),
      }),
    );
    const overlay = mountMetricAtlasOverlay();

    await overlay.loadManifest("/__metric-atlas/api/manifest");

    expect(overlay.manifest).toBeNull();
    expect(overlay.shadowRoot!.querySelector("#status")!.textContent).toBe(
      "Manifest response has an invalid shape",
    );
  });
});
