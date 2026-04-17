import { expect, test } from "@playwright/test";

import { chromiumIPhone13 } from "./devices";

test.use(chromiumIPhone13);

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

      const topbar = page.locator("header.topbar");
      await expect(topbar).toBeVisible();
      await expect(topbar).toContainText("Samsung Electronics");
      await expect(topbar).not.toContainText("005930");
      await expect(page.getByRole("navigation", { name: /Primary/i })).toBeVisible();
      await expect(page.getByText(detailPage.eyebrow)).toBeVisible();
      await expect(page.getByRole("heading", { name: detailPage.heading }).first()).toBeVisible();
      await expect(page.getByRole("link", { name: /Insights/i })).toBeVisible();
      await expect(page.getByRole("link", { name: /Freshness/i })).toBeVisible();
    }
  });

  test("disclosure detail requests the same row cap it can render", async ({ page }) => {
    const aggregateRequest = page.waitForRequest((request) => {
      const url = request.url();
      return url.includes("/api/trading/agent-context/symbol-day") && url.includes("disclosures_limit=8");
    });

    await page.goto(`/dashboard/symbol/005930/disclosure-coverage?${symbolSeed}`);
    await expect(page.getByText(/Disclosure & Coverage Detail/i)).toBeVisible();
    await aggregateRequest;
  });
});
