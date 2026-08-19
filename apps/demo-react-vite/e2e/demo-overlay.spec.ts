import { expect, test } from "@playwright/test";

test("shows the dashboard and a live Metric Atlas overlay from the real manifest", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Analytics Health 요약" })).toBeVisible();
  await expect(page.locator("metric-atlas-overlay")).toHaveCount(1);
  await expect(page.locator("#demo-purchase")).toHaveAttribute(
    "data-atlas-id",
    /^atlas_/,
  );
  await expect(page.locator("#demo-lead-form")).toHaveAttribute(
    "data-atlas-id",
    /^atlas_/,
  );
  await expect(page.getByText("manifest: runtime")).toBeVisible();
  await expect(page.getByText("health: fixture")).toBeVisible();

  const overlay = page.locator("metric-atlas-overlay");
  const coverage = await overlay.evaluate((element) =>
    (element as HTMLElement & {
      measureCoverage(): {
        injectCandidateCount: number;
        domMatchedCount: number;
        domMissingCount: number;
      };
    }).measureCoverage(),
  );
  expect(coverage).toEqual({
    injectCandidateCount: 2,
    domMatchedCount: 2,
    domMissingCount: 0,
    bindingCoverage: 1,
  });

  await overlay.locator("#launcher").click();
  await page.locator("#demo-purchase").hover();
  await expect(overlay.locator("#details")).toContainText("demo_purchase_click");
  await expect(overlay.locator("#details")).toContainText("Provider: ga4");
});
