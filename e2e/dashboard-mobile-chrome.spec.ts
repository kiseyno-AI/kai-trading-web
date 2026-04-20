import { expect, test } from "@playwright/test";

import { RELEASE_DISPLAY_LABEL } from "@/lib/release-version";
import { chromiumIPhone13 } from "./devices";

test.use(chromiumIPhone13);

test.describe("dashboard mobile chrome", () => {
  test("dashboard top chrome is compact and fixed on mobile", async ({ page }) => {
    await page.goto("/dashboard");

    const topbar = page.locator("header.topbar");
    const bottomNav = page.getByRole("navigation", { name: /Primary/i });
    await expect(topbar).toBeVisible();

    await expect
      .poll(() => topbar.evaluate((element) => window.getComputedStyle(element).position))
      .toBe("fixed");

    const topbarBox = await topbar.boundingBox();
    expect(topbarBox).not.toBeNull();
    expect(topbarBox!.height).toBeLessThan(112);
    expect(topbarBox!.x).toBeGreaterThanOrEqual(0);

    await expect(bottomNav).toBeVisible();
    await expect(page.getByText(/Trading Dashboard/i)).toBeVisible();
    await expect(page.locator('[aria-label="Release version"]:visible')).toContainText(RELEASE_DISPLAY_LABEL);
    await expect(page.getByRole("heading", { name: /Operational Integrity/i })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "Search", exact: true })).toBeVisible();
    await expect(bottomNav.getByRole("link", { name: "My Symbols", exact: true })).toBeVisible();
    await expect(page.getByText(/Live Connection/i)).toHaveCount(0);
  });

  test("D2 EOD counts fit mobile cards with four-digit totals", async ({ page }) => {
    const now = "2026-04-16T09:10:00+09:00";

    await page.route("**/api/trading/market/status", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          state: "OPEN",
          is_open: true,
          server_time: now,
        }),
      });
    });
    await page.route("**/api/trading/quotes/tracked", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_state: "OPEN",
          as_of: now,
          items: [
            {
              symbol: "005930",
              company_name: "Samsung Electronics",
              price: 71500,
              change: 600,
              change_pct: 0.84,
              volume: 120000,
              turnover: 8580000000,
              as_of: now,
              market_state: "OPEN",
              source: "daily_price_bar",
              fallback: true,
              is_live: false,
              available: true,
              trade_date: "2026-04-16",
              fallback_reason: "daily_price_bar_current_trade_date",
              unavailable_reason: null,
            },
          ],
        }),
      });
    });
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: "2026-04-16",
            price: {
              status: "ready",
              symbols_total: 3583,
              symbols_succeeded: 3570,
              symbols_failed: 13,
            },
            technical_analysis: {
              status: "ready",
              symbols_total: 3583,
              symbols_succeeded: 3583,
              symbols_failed: 0,
            },
            action_summary: {
              status: "ready",
              symbols_total: 3583,
              symbols_succeeded: 3579,
              symbols_failed: 4,
            },
            fundamentals: {
              status: "ready",
              symbols_total: 3583,
              symbols_succeeded: 10,
              symbols_failed: 1406,
            },
          },
          latest: {
            price_trade_date: "2026-04-16",
            technical_market_date: "2026-04-16",
            action_market_date: "2026-04-16",
          },
        }),
      });
    });
    await page.route("**/api/trading/disclosures/dart/fundamentals/daily/inspect**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          latest_run: {
            id: 17,
            market_date: "2026-04-16",
            trigger: "internal_ops_cli",
            status: "completed",
            fs_div: "CFS",
            force: false,
            symbol_limit: null,
            symbol_offset: 0,
            symbols_total: 3583,
            symbols_checked: 3583,
            symbols_missing: 0,
            symbols_stale: 0,
            symbols_fresh: 3583,
            symbols_refreshed: 10,
            symbols_failed: 1406,
            events_detected: 13786,
            events_captured: 10,
            events_failed: 490,
            error_message: null,
            run_metadata: {},
            started_at: "2026-04-16T08:56:58.357390+09:00",
            completed_at: "2026-04-16T09:11:08.375335+09:00",
          },
          runs: [],
        }),
      });
    });
    await page.route("**/api/trading/agent-context/feedback/progress**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          request: {
            market_date: "2026-04-16",
            symbols: null,
            expected_agents: [],
          },
          summary: {
            run_status: "completed",
            is_live: false,
            latest_feedback_at: now,
            seconds_since_last_feedback: 120,
            stalled_threshold_seconds: 300,
            total_symbols: 3583,
            processed_symbols: 3583,
            completed_symbols: 3583,
            in_progress_symbols: 0,
            pending_symbols: 0,
            progress_ratio: 1,
            progress_percent: 100,
            failed_items: 0,
            completed_feedback_count: 3583,
            expected_feedback_count: 3583,
          },
        }),
      });
    });

    await page.goto("/dashboard");

    const priceStage = page.locator('[aria-label="Price Fetch freshness"]');
    const technicalStage = page.locator('[aria-label="Technical Analysis freshness"]');
    const actionStage = page.locator('[aria-label="Action Summary freshness"]');
    const fundamentalsStage = page.locator('[aria-label="Fundamentals freshness"]');

    await expect(priceStage).toContainText("Succeeded 3,570 / 3,583");
    await expect(technicalStage).toContainText("Succeeded 3,583 / 3,583");
    await expect(actionStage).toContainText("Succeeded 3,579 / 3,583");
    await expect(fundamentalsStage).toContainText("Checked 3,583");
    await expect(priceStage.getByText(/Failed/i)).toHaveCount(0);
    await expect(fundamentalsStage.getByText(/Succeeded|Failed|\//i)).toHaveCount(0);

    for (const stageCard of [priceStage, technicalStage, actionStage, fundamentalsStage]) {
      const overflow = await stageCard.evaluate((element) => {
        const cardRect = element.getBoundingClientRect();
        const tolerance = 1;
        const overflowedText = [...element.querySelectorAll("span, button")]
          .filter((child) => child.getClientRects().length > 0)
          .map((child) => {
            const childRect = child.getBoundingClientRect();
            const overflows =
              childRect.left < cardRect.left - tolerance ||
              childRect.right > cardRect.right + tolerance ||
              childRect.top < cardRect.top - tolerance ||
              childRect.bottom > cardRect.bottom + tolerance;

            return overflows ? child.textContent?.trim() ?? child.tagName : null;
          })
          .filter(Boolean);

        return {
          clientWidth: element.clientWidth,
          overflowedText,
          scrollWidth: element.scrollWidth,
        };
      });

      expect(overflow.overflowedText).toEqual([]);
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
    }
  });
});
