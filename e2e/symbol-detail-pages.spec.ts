import { devices, expect, test } from "@playwright/test";

test.use({ ...devices["iPhone 13"] });

const symbolSeed =
  "name=Samsung%20Electronics&market=KOSPI&standardCode=KR7005930003&marketDate=2026-04-10";

const detailPages = [
  {
    path: "action-summary",
    eyebrow: /Action Summary Detail/i,
    heading: /Deterministic action layer/i,
  },
  {
    path: "technical-analysis",
    eyebrow: /Technical Analysis Detail/i,
    heading: /Stored technical snapshot|Stored snapshot metrics/i,
  },
  {
    path: "fundamentals-history",
    eyebrow: /Fundamentals History Detail/i,
    heading: /DART fundamentals history|Stored DART filing history/i,
  },
  {
    path: "disclosure-coverage",
    eyebrow: /Disclosure & Coverage Detail/i,
    heading: /Recent DART disclosure coverage|Recent filing coverage/i,
  },
  {
    path: "system-freshness",
    eyebrow: /System Freshness Detail/i,
    heading: /Layer-specific freshness registry/i,
  },
];

test.describe("symbol detail mobile pages", () => {
  test("remaining Stitch detail pages render with mobile chrome and section tabs", async ({ page }) => {
    for (const detailPage of detailPages) {
      await page.goto(`/dashboard/symbol/005930/${detailPage.path}?${symbolSeed}`);

      await expect(page.locator("header.topbar")).toBeVisible();
      await expect(page.getByRole("navigation", { name: /Primary/i })).toBeVisible();
      await expect(page.getByText(detailPage.eyebrow)).toBeVisible();
      await expect(page.getByRole("heading", { name: detailPage.heading }).first()).toBeVisible();
      await expect(page.getByRole("link", { name: /Insights/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /Freshness/i })).toBeVisible();
    }
  });
});
