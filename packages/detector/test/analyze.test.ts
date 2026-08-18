import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { analyzeSource } from "../src/index.ts";

const fixture = (name: string): Promise<string> =>
  readFile(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");

describe("analyzeSource", () => {
  it("detects direct events, binds native JSX, and injects only transformed output", async () => {
    const source = await fixture("supported.tsx");
    const result = analyzeSource(source, {
      file: "src/SupportedPatterns.tsx",
      buildId: "test-build",
    });

    expect(result.events).toHaveLength(5);
    expect(result.bindings).toHaveLength(2);
    expect(result.transform.changed).toBe(true);
    expect(source).not.toContain("data-atlas-id");
    expect(result.transform.code.match(/data-atlas-id/g)).toHaveLength(2);

    const purchases = result.events.filter(
      (event) => event.eventKey === "ga4:purchase_click",
    );
    expect(purchases).toHaveLength(2);
    expect(new Set(purchases.map((event) => event.implementationKey)).size).toBe(2);
    expect(purchases.every((event) => event.overlaySupported)).toBe(true);
    expect(purchases.map((event) => event.parameters)).toEqual([
      ["currency", "value"],
      ["placement"],
    ]);

    const gtm = result.events.find((event) => event.eventKey === "gtm:lead_submit");
    expect(gtm).toMatchObject({
      emitter: "gtm",
      analyticsProvider: "unknown",
      providerDetectionConfidence: "provider_unknown",
      parameters: ["form_type"],
      overlaySupported: true,
    });
    expect(result.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining([
        "DYNAMIC_PARAMETER_KEY",
        "CUSTOM_COMPONENT_OVERLAY_UNSUPPORTED",
        "PORTAL_OVERLAY_UNSUPPORTED",
      ]),
    );
    expect(
      result.events.find((event) => event.eventName === "custom_card_click"),
    ).toMatchObject({ overlaySupported: false });
    expect(
      result.events.find((event) => event.eventName === "portal_click"),
    ).toMatchObject({ overlaySupported: false });
  });

  it("records a dynamic event and wrapper likelihood without inventing an event", async () => {
    const result = analyzeSource(await fixture("wrapper.ts"), {
      file: "src/wrapper.ts",
      buildId: "test-build",
    });
    expect(result.events).toEqual([]);
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      "DYNAMIC_EVENT_NAME",
      "POSSIBLE_WRAPPER_USAGE",
    ]);
  });

  it("keeps unresolved direct calls in the manifest for dashboard review", () => {
    const result = analyzeSource('gtag("event", "page_ready", { route: "/" });', {
      file: "src/bootstrap.ts",
      buildId: "test-build",
    });
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      eventKey: "ga4:page_ready",
      overlaySupported: false,
    });
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: "UNRESOLVED_EVENT_BINDING" }),
    );
  });

  it("preserves an existing data-atlas-id and reports the collision", () => {
    const source = `
      export const Button = () => (
        <button data-atlas-id="owned" onClick={() => gtag("event", "click")}>Click</button>
      );
    `;
    const result = analyzeSource(source, {
      file: "src/Button.tsx",
      buildId: "test-build",
    });
    expect(result.bindings).toEqual([]);
    expect(result.transform.changed).toBe(false);
    expect(result.warnings).toContainEqual(
      expect.objectContaining({ code: "ATLAS_ATTRIBUTE_CONFLICT" }),
    );
  });

  it("keeps other direct emitter adapters provider-specific", () => {
    const source = `
      export const Actions = () => <div>
        <button onClick={() => mixpanel.track("mix_click")}>Mix</button>
        <button onClick={() => fbq("trackCustom", "meta_click")}>Meta</button>
        <button onClick={() => posthog.capture("posthog_click")}>PostHog</button>
        <button onClick={() => amplitude.track("amplitude_click")}>Amplitude</button>
      </div>;
    `;
    const result = analyzeSource(source, {
      file: "src/Actions.tsx",
      buildId: "test-build",
    });
    expect(result.events.map((event) => event.eventKey)).toEqual([
      "mixpanel:mix_click",
      "meta:meta_click",
      "posthog:posthog_click",
      "amplitude:amplitude_click",
    ]);
    expect(result.bindings).toHaveLength(4);
  });

  it("supports TypeScript const assertions and unique same-line occurrences", () => {
    const source = `
      export const Actions = () => <button onClick={() => {
        gtag("event", ("same_line" as const), ({ value: 1 } as const)); gtag("event", ("same_line" satisfies string));
      }}>Action</button>;
    `;
    const result = analyzeSource(source, {
      file: "src/Actions.tsx",
      buildId: "test-build",
    });
    expect(result.events).toHaveLength(2);
    expect(result.events.map((event) => event.eventName)).toEqual([
      "same_line",
      "same_line",
    ]);
    expect(new Set(result.events.map((event) => event.implementationKey)).size).toBe(2);
    expect(result.events[0]!.parameters).toEqual(["value"]);
  });
});
