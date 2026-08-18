import { describe, expect, it } from "vitest";
import type { DetectedEvent, EventManifest } from "@metric-atlas/detector";
import { diffManifests, formatMarkdownReport } from "../src/diff.ts";

function event(
  eventKey: string,
  emitter: DetectedEvent["emitter"],
  provider: DetectedEvent["analyticsProvider"],
  parameters: string[] = [],
): DetectedEvent {
  return {
    eventKey,
    eventName: eventKey.split(":").slice(1).join(":"),
    emitter,
    analyticsProvider: provider,
    providerDetectionConfidence:
      provider === "unknown" ? "provider_unknown" : "provider_exact",
    parameters,
    source: { file: "src/App.tsx", line: 1 },
    overlaySupported: false,
  };
}

function manifest(events: DetectedEvent[], warningCodes: string[] = []): EventManifest {
  return {
    version: "0.1",
    buildId: "test",
    generatedAt: "2026-08-18T00:00:00.000Z",
    events,
    bindings: [],
    warnings: warningCodes.map((code) => ({ code })),
  };
}

describe("manifest diff", () => {
  it("reports semantic provider changes and GA4 parameter changes", () => {
    const base = manifest([
      event("gtm:purchase", "gtm", "unknown", ["old_parameter"]),
      event("ga4:removed", "ga4", "ga4"),
    ]);
    const head = manifest(
      [
        event("ga4:purchase", "ga4", "ga4", ["campaign_slot"]),
        event("ga4:added", "ga4", "ga4"),
      ],
      ["DYNAMIC_EVENT_NAME", "POSSIBLE_WRAPPER_USAGE"],
    );

    const diff = diffManifests(base, head);
    expect(diff.addedEvents).toEqual(["ga4:added"]);
    expect(diff.removedEvents).toEqual(["ga4:removed"]);
    expect(diff.changedEvents).toHaveLength(1);
    expect(diff.changedEvents[0]).toMatchObject({
      eventName: "purchase",
      fromProvider: "unknown",
      toProvider: "ga4",
    });
    expect(diff.addedParameters).toEqual([
      { eventKey: "ga4:purchase", parameter: "campaign_slot" },
    ]);
    expect(diff.warningCounts).toEqual({
      dynamicOrUnresolved: 1,
      possibleWrapperUsage: 1,
    });

    const markdown = formatMarkdownReport(diff);
    expect(markdown).toContain("Changed emitter/provider: 1");
    expect(markdown).toContain("GA4 custom parameter changes");
    expect(markdown).toContain("`campaign_slot`");
  });
});
