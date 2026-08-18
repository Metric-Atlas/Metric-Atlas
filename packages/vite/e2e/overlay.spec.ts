import { expect, test } from "@playwright/test";

test("detects, injects, reports unsupported patterns, and displays overlay metadata", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page.locator("metric-atlas-overlay")).toHaveCount(1);

  await expect(page.locator("#purchase")).toHaveAttribute(
    "data-atlas-id",
    /^atlas_/,
  );
  await expect(page.locator("#lead")).toHaveAttribute("data-atlas-id", /^atlas_/);
  await expect(page.locator("#custom-component")).not.toHaveAttribute(
    "data-atlas-id",
    /.+/,
  );
  await expect(page.locator("#dynamic")).not.toHaveAttribute("data-atlas-id", /.+/);
  await expect(page.locator("#wrapper")).not.toHaveAttribute("data-atlas-id", /.+/);
  await expect(page.locator("#portal")).not.toHaveAttribute("data-atlas-id", /.+/);

  const manifest = await page.evaluate(async () => {
    const response = await fetch("/__metric-atlas/api/manifest");
    return response.json();
  });
  expect(manifest.events.map((event: { eventName: string }) => event.eventName)).toEqual(
    expect.arrayContaining([
      "purchase_click",
      "lead_submit",
      "custom_component_click",
      "portal_click",
    ]),
  );
  expect(manifest.events).toHaveLength(4);
  expect(
    manifest.events.find(
      (event: { eventName: string }) => event.eventName === "lead_submit",
    ),
  ).toMatchObject({
    emitter: "gtm",
    analyticsProvider: "unknown",
    providerDetectionConfidence: "provider_unknown",
  });
  expect(manifest.warnings.map((warning: { code: string }) => warning.code)).toEqual(
    expect.arrayContaining([
      "DYNAMIC_EVENT_NAME",
      "POSSIBLE_WRAPPER_USAGE",
      "CUSTOM_COMPONENT_OVERLAY_UNSUPPORTED",
      "PORTAL_OVERLAY_UNSUPPORTED",
    ]),
  );

  const coverage = await page.locator("metric-atlas-overlay").evaluate((element) =>
    (element as HTMLElement & { measureCoverage(): unknown }).measureCoverage(),
  );
  expect(coverage).toMatchObject({
    injectCandidateCount: 2,
    domMatchedCount: 2,
    domMissingCount: 0,
    bindingCoverage: 1,
  });

  await page.locator("metric-atlas-overlay #launcher").click();
  await page.locator("#purchase").hover();
  const overlayText = page.locator("metric-atlas-overlay #details");
  await expect(overlayText).toContainText("purchase_click");
  await expect(overlayText).toContainText("Emitter: ga4");
  await expect(overlayText).toContainText("Provider: ga4");
  await expect(overlayText).toContainText("currency, value");
  await expect(page.locator("#purchase")).toHaveCSS(
    "outline-style",
    "solid",
  );

  await page.locator("#purchase").click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        window.__atlasCalls.some(
          (call) => call.eventName === "purchase_click" && call.emitter === "ga4",
        ),
      ),
    )
    .toBe(true);
  expect(pageErrors).toEqual([]);
});
