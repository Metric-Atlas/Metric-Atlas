import { EventManifest } from "@metric-atlas/contracts";
import { describe, expect, it } from "vitest";
import { analyzeSource, createManifest } from "../src/index.js";

describe("Event Manifest producer contract", () => {
  it("emits a Contract v0 manifest with required implementation keys", () => {
    const analysis = analyzeSource(
      `export const App = () => (
        <button onClick={() => gtag("event", "contract_click", { slot: "hero" })}>
          Track
        </button>
      );`,
      { file: "src/App.tsx", buildId: "contract-build" },
    );

    const manifest = createManifest(analysis, {
      buildId: "contract-build",
      generatedAt: "2026-08-19T00:00:00.000Z",
    });

    expect(() => EventManifest.parse(manifest)).not.toThrow();
    expect(manifest.events[0]?.implementationKey).toMatch(/^impl_/);
    expect(manifest.bindings[0]?.implementationKeys).toEqual([
      manifest.events[0]?.implementationKey,
    ]);
  });
});
