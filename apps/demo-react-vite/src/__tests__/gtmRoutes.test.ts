import { describe, expect, it } from "vitest";
import { manifest } from "../data";
import { resolveGtmRoutes } from "../gtmRoutes";

describe("resolveGtmRoutes", () => {
  it("matches dataLayer events to GA4 Event tags through custom event triggers", () => {
    const routes = resolveGtmRoutes(manifest, {
      containerVersion: {
        trigger: [
          {
            triggerId: "trigger-1",
            name: "Lead trigger",
            type: "customEvent",
            customEventFilter: [
              {
                parameter: [
                  { key: "arg0", value: "{{_event}}" },
                  { key: "arg1", value: "lead_submit" },
                ],
              },
            ],
          },
        ],
        tag: [
          {
            name: "Lead GA4 tag",
            type: "gaawe",
            parameter: [
              { key: "eventName", value: "lead_submit" },
              { key: "measurementId", value: "G-TEST" },
            ],
            firingTriggerId: ["trigger-1"],
          },
        ],
      },
    });

    expect(routes.get("gtm:lead_submit")).toMatchObject({
      triggerName: "Lead trigger",
      tagName: "Lead GA4 tag",
      destinationProvider: "ga4",
      measurementId: "G-TEST",
    });
  });

  it("does not invent a route when the GTM trigger event is absent from the manifest", () => {
    const routes = resolveGtmRoutes(manifest, {
      containerVersion: {
        trigger: [
          {
            triggerId: "trigger-1",
            type: "customEvent",
            customEventFilter: [
              {
                parameter: [
                  { key: "arg0", value: "{{_event}}" },
                  { key: "arg1", value: "missing_event" },
                ],
              },
            ],
          },
        ],
        tag: [{ name: "Missing", type: "gaawe", firingTriggerId: ["trigger-1"] }],
      },
    });

    expect(routes.size).toBe(0);
  });
});
