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
    await page.route("**/api/trading/eod/piotroski-filter-results?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_date: "2026-04-16",
          summary: {
            entries: 3583,
            requested_symbol: null,
            matched_symbols: Array.from({ length: 3583 }, (_, index) => `SYM${index + 1}`),
            missing_symbols: [],
            passed_count: 132,
            not_passed_count: 3451,
          },
          items: [],
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
            expected_agents: ["eod-summarizer", "technical-summarizer", "fundamental-summarizer"],
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
    const filteringCard = page.locator("#dashboard-freshness article").filter({ hasText: "Filtering" });
    const agentFeedbackCard = page.locator("#dashboard-freshness article").filter({ hasText: "Agent Feedback" });

    await expect(priceStage).toContainText(/Succeeded\s*3,570\s*\/\s*3,583/);
    await expect(technicalStage).toContainText(/Succeeded\s*3,583\s*\/\s*3,583/);
    await expect(actionStage).toContainText(/Succeeded\s*3,579\s*\/\s*3,583/);
    await expect(fundamentalsStage).toContainText(/Checked\s*3,583/);
    await expect(priceStage).toContainText(/Failed\s*13/);
    await expect(fundamentalsStage).toContainText(/Failed\s*1,406/);
    await expect(filteringCard).toContainText("Completed");
    await expect(filteringCard).toContainText(/Checked\s*3,583/);
    await expect(filteringCard).toContainText(/Pass\s*132/);
    await expect(agentFeedbackCard).not.toContainText("Latest Run");
    await expect(agentFeedbackCard).toContainText("에이전트 분석 완료");
    await expect(agentFeedbackCard).toContainText("EOD summarizer");
    await expect(agentFeedbackCard).toContainText("Technical summarizer");
    await expect(agentFeedbackCard).toContainText("Fundamental summarizer");
    await expect(agentFeedbackCard.getByText("Complete")).toHaveCount(3);
    await expect(agentFeedbackCard.getByText("3,583개")).toHaveCount(3);

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

      const titleToCountGap = await stageCard.evaluate((element) => {
        const title = element.querySelector("span");
        const countLine = element.querySelector('[data-detail-tone="count"]');

        if (!title || !countLine) return null;

        return countLine.getBoundingClientRect().top - title.getBoundingClientRect().bottom;
      });

      expect(titleToCountGap).not.toBeNull();
      expect(titleToCountGap!).toBeLessThanOrEqual(24);
    }
  });

  test("agent feedback stop confirmation posts the core control request on mobile", async ({ page }) => {
    const now = "2026-04-15T10:20:00+09:00";
    let stopControlRequestBody: Record<string, unknown> | null = null;

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
              trade_date: "2026-04-15",
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
              symbols_total: 250,
              symbols_succeeded: 250,
              symbols_failed: 0,
            },
            technical_analysis: {
              status: "ready",
              symbols_total: 250,
              symbols_succeeded: 250,
              symbols_failed: 0,
            },
            action_summary: {
              status: "ready",
              symbols_total: 250,
              symbols_succeeded: 250,
              symbols_failed: 0,
            },
            fundamentals: {
              status: "ready",
              symbols_total: 42,
              symbols_succeeded: 42,
              symbols_failed: 0,
            },
          },
          latest: {
            price_trade_date: "2026-04-15",
            symbols_total: 250,
            symbols_succeeded: 250,
            technical_market_date: "2026-04-15",
            action_market_date: "2026-04-15",
          },
        }),
      });
    });
    await page.route("**/api/trading/agent-context/feedback/progress?**", async (route) => {
      const url = new URL(route.request().url());
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          request: {
            market_date: url.searchParams.get("market_date"),
            symbols: null,
            expected_agents: [
              "preflight-gate",
              "eod-summarizer",
              "technical-summarizer",
              "fundamental-summarizer",
            ],
          },
          summary: {
            run_status: "running",
            is_live: false,
            latest_feedback_at: "2026-04-15T10:18:00+09:00",
            seconds_since_last_feedback: 15,
            stalled_threshold_seconds: 300,
            total_symbols: 250,
            processed_symbols: 126,
            completed_symbols: 88,
            in_progress_symbols: 38,
            pending_symbols: 124,
            progress_ratio: 0.504,
            progress_percent: 50.4,
            failed_items: 3,
            completed_feedback_count: 302,
            expected_feedback_count: 1000,
            current_role: "technical-summarizer",
          },
        }),
      });
    });
    await page.route("**/api/trading/eod/pipeline/status?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          market_date: "2026-04-15",
          status: "completed",
          stage_order: [],
          stages: {},
        }),
      });
    });
    await page.route("**/api/trading/disclosures/dart/fundamentals/daily/inspect?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          latest_run: null,
          runs: [],
        }),
      });
    });
    await page.route("**/api/trading/agent-context/internal/core/control", async (route) => {
      stopControlRequestBody = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          status: "killed",
          port: 8000,
          signal: "SIGKILL",
          pids: [12345],
          self_targeted: false,
        }),
      });
    });

    await page.goto("/dashboard");

    const stopButton = page.getByRole("button", { name: "중단" });
    await expect(stopButton).toBeVisible();
    await stopButton.click();

    const stopDialog = page.getByRole("dialog", { name: "중단하시겠습니까?" });
    await expect(stopDialog).toBeVisible();
    await expect(stopDialog.getByRole("button", { name: /close/i })).toHaveCount(0);
    await expect(stopDialog).not.toContainText("실제 중단 동작은 추후 연결할 예정입니다.");

    await stopDialog.getByRole("button", { name: "예" }).click();

    await expect.poll(() => JSON.stringify(stopControlRequestBody)).toBe(
      JSON.stringify({
        action: "kill",
        signal_name: "SIGKILL",
        port: 8000,
      }),
    );
    await expect(stopDialog).toHaveCount(0);
  });
});
