import { expect, test } from "@playwright/test";

import { RELEASE_VERSION_LABEL } from "@/lib/release-version";

test.describe("dashboard desktop", () => {
  test("dashboard labels match currently wired core data", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.getByText(/Trading Dashboard/i)).toBeVisible();
    await expect(page.getByRole("navigation", { name: /Primary desktop/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Operational Integrity/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Today's ledger recommendations/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Highest absolute movers/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Ledger coverage notes/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /Layer sync events/i })).toBeVisible();

    await expect(page.getByText(/Market Freshness Registry/i)).toBeVisible();
    await expect(page.getByText(/Manage Feed/i)).toBeVisible();
    await expect(page.locator('[aria-label="Release version"]:visible')).toContainText(RELEASE_VERSION_LABEL);

    await expect(page.getByText(/Readiness and breadth/i)).toHaveCount(0);
    await expect(page.getByText(/Top movers/i)).toHaveCount(0);
    await expect(page.getByText(/Connection and timing/i)).toHaveCount(0);
    await expect(page.getByText(/Live Connection/i)).toHaveCount(0);
  });

  test("dashboard quote surfaces use symbol metadata when quote payload names fall back to the symbol", async ({ page }) => {
    const now = "2026-04-15T09:10:00+09:00";
    const searchRequests: string[] = [];

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
              symbol: "123456",
              company_name: "123456",
              price: 42100,
              change: 300,
              change_pct: 0.72,
              volume: 1200,
              turnover: 50520000,
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
    await page.route("**/api/trading/symbols/search?**", async (route) => {
      const url = new URL(route.request().url());
      const query = url.searchParams.get("q") ?? "";
      searchRequests.push(query);
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          query,
          count: query === "123456" ? 1 : 0,
          items:
            query === "123456"
              ? [
                  {
                    symbol: "123456",
                    standard_code: "KR7123456000",
                    name_ko: "Acme Precision",
                    market: "KOSPI",
                  },
                ]
              : [],
        }),
      });
    });

    await page.goto("/dashboard");

    const symbolCard = page
      .locator("a")
      .filter({ hasText: "123456" })
      .filter({ hasText: "Acme Precision" })
      .first();
    await expect(symbolCard).toBeVisible();
    await expect(symbolCard.getByText("123456", { exact: true })).toHaveCount(1);

    const momentumRow = page.locator("article").filter({ hasText: "123456" }).filter({ hasText: "+0.72%" });
    await expect(momentumRow).toBeVisible();
    await expect(momentumRow).toContainText("Acme Precision");
    await expect(momentumRow).not.toContainText("[확인 필요]");

    await expect.poll(() => searchRequests).toContain("123456");
  });

  test("tracked symbol cards keep quote content inside the card during desktop resizes", async ({ page }) => {
    const now = "2026-04-15T09:10:00+09:00";

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
            eod_status: "completed",
            symbols_total: 250,
            symbols_succeeded: 250,
            symbols_failed: 0,
            received: true,
          },
          latest: {
            price_trade_date: "2026-04-15",
            symbols_total: 250,
            symbols_succeeded: 250,
            technical_market_date: "2026-04-15",
            action_market_date: "2026-04-15",
          },
          technical: {
            success: true,
            latest_date: "2026-04-15",
          },
        }),
      });
    });
    await page.route("**/api/trading/disclosures/dart/fundamentals/daily/inspect?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          runs: [],
          latest_run: null,
        }),
      });
    });
    await page.route("**/api/trading/agent-context/feedback/progress?**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          request: {
            market_date: "2026-04-15",
            symbols: null,
            expected_agents: [],
          },
          summary: {
            total_symbols: 1,
            processed_symbols: 1,
            completed_symbols: 1,
            in_progress_symbols: 0,
            pending_symbols: 0,
            progress_ratio: 1,
            progress_percent: 100,
            failed_items: 0,
            completed_feedback_count: 3,
            expected_feedback_count: 3,
          },
        }),
      });
    });

    await page.setViewportSize({ width: 1920, height: 980 });
    await page.goto("/dashboard");

    const symbolCard = page
      .locator("a")
      .filter({ hasText: "005930" })
      .filter({ hasText: "Samsung Electronics" })
      .first();
    await expect(symbolCard).toBeVisible();

    for (const width of [1920, 1500, 1280, 1024]) {
      await page.setViewportSize({ width, height: 980 });
      await symbolCard.scrollIntoViewIfNeeded();
      await expect(symbolCard).toBeVisible();

      const metrics = await symbolCard.evaluate((card) => {
        const cardRect = card.getBoundingClientRect();
        const tolerance = 1;
        const overflowingChildren = Array.from(card.children)
          .filter((child) => !child.classList.contains("component-tag"))
          .map((child) => {
            const rect = child.getBoundingClientRect();
            return {
              tag: child.tagName.toLowerCase(),
              left: rect.left - cardRect.left,
              right: rect.right - cardRect.right,
              top: rect.top - cardRect.top,
              bottom: rect.bottom - cardRect.bottom,
            };
          })
          .filter(
            (rect) =>
              rect.left < -tolerance ||
              rect.right > tolerance ||
              rect.top < -tolerance ||
              rect.bottom > tolerance,
          );

        return {
          clientHeight: card.clientHeight,
          clientWidth: card.clientWidth,
          overflowingChildren,
          scrollHeight: card.scrollHeight,
          scrollWidth: card.scrollWidth,
        };
      });

      expect(metrics.overflowingChildren).toEqual([]);
      expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
      expect(metrics.scrollHeight).toBeLessThanOrEqual(metrics.clientHeight + 1);
    }
  });

  test("D2 EOD status uses core freshness update flag and symbol counts", async ({ page }) => {
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: "2026-04-13",
            eod_status: "missing",
            symbols_total: 250,
            symbols_succeeded: 237,
            symbols_failed: null,
            received: false,
          },
          latest: {
            price_trade_date: "2026-04-10",
            technical_market_date: "2026-04-10",
            action_market_date: "2026-04-10",
          },
        }),
      });
    });

    await page.goto("/dashboard");

    const eodStatusCard = page.locator("#dashboard-freshness article").filter({ hasText: "EOD Status" });
    await expect(eodStatusCard).toBeVisible();
    await expect(eodStatusCard.getByText("Not received")).toBeVisible();
    await expect(eodStatusCard.getByText("Market date 2026-04-13")).toBeVisible();
    await expect(eodStatusCard.getByText("Latest EOD date 2026-04-10")).toBeVisible();
    await expect(eodStatusCard.getByText("Success count 237")).toBeVisible();
    await expect(eodStatusCard.getByText("Total count 250")).toBeVisible();
  });

  test("D2 EOD status uses freshness values when received flag is absent", async ({ page }) => {
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: "2026-04-13",
            eod_status: null,
            symbols_total: 250,
            symbols_succeeded: 237,
            symbols_failed: null,
            received: null,
          },
          latest: {
            price_trade_date: "2026-04-10",
            technical_market_date: "2026-04-10",
            action_market_date: "2026-04-10",
          },
        }),
      });
    });

    await page.goto("/dashboard");

    const eodStatusCard = page.locator("#dashboard-freshness article").filter({ hasText: "EOD Status" });
    await expect(eodStatusCard).toBeVisible();
    await expect(eodStatusCard.getByText("Freshness available")).toBeVisible();
    await expect(eodStatusCard.getByText("Market date 2026-04-13")).toBeVisible();
    await expect(eodStatusCard.getByText("Latest EOD date 2026-04-10")).toBeVisible();
    await expect(eodStatusCard.getByText("Success count 237")).toBeVisible();
    await expect(eodStatusCard.getByText("Total count 250")).toBeVisible();
    await expect(eodStatusCard.getByText("[확인 필요]")).toHaveCount(0);
  });

  test("D2 EOD status uses latest symbol counts when today's run has not happened", async ({ page }) => {
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: "2026-04-14",
            eod_status: null,
            symbols_failed: null,
            received: null,
          },
          latest: {
            price_trade_date: "2026-04-13",
            symbols_total: 250,
            symbols_succeeded: 248,
            technical_market_date: "2026-04-13",
            action_market_date: "2026-04-13",
          },
        }),
      });
    });

    await page.goto("/dashboard");

    const eodStatusCard = page.locator("#dashboard-freshness article").filter({ hasText: "EOD Status" });
    await expect(eodStatusCard).toBeVisible();
    await expect(eodStatusCard.getByText("Freshness available")).toBeVisible();
    await expect(eodStatusCard.getByText("Market date 2026-04-14")).toBeVisible();
    await expect(eodStatusCard.getByText("Latest EOD date 2026-04-13")).toBeVisible();
    await expect(eodStatusCard.getByText("Success count 248")).toBeVisible();
    await expect(eodStatusCard.getByText("Total count 250")).toBeVisible();
    await expect(eodStatusCard.getByText("[확인 필요]")).toHaveCount(0);
  });

  test("D2 agent feedback progress uses the latest price trade date", async ({ page }) => {
    const now = "2026-04-15T10:20:00+09:00";
    let requestedMarketDate: string | null = null;

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
            eod_status: null,
            symbols_total: null,
            symbols_succeeded: null,
            symbols_failed: null,
            received: null,
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
      requestedMarketDate = url.searchParams.get("market_date");
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          request: {
            market_date: requestedMarketDate,
            symbols: null,
            expected_agents: ["eod-summarizer", "technical-summarizer", "fundamental-summarizer"],
          },
          summary: {
            total_symbols: 250,
            processed_symbols: 126,
            completed_symbols: 88,
            in_progress_symbols: 38,
            pending_symbols: 124,
            progress_ratio: 0.504,
            progress_percent: 50.4,
            failed_items: 3,
            completed_feedback_count: 302,
            expected_feedback_count: 750,
          },
        }),
      });
    });

    await page.goto("/dashboard");

    await expect.poll(() => requestedMarketDate).toBe("2026-04-15");
    await expect(page.locator("#dashboard-freshness").getByText("Market state OPEN")).toBeVisible();
    await expect(page.locator("#dashboard-freshness").getByText(/Server time/)).toBeVisible();

    const progressCard = page.locator("#dashboard-freshness article").filter({ hasText: "Agent Feedback" });
    await expect(progressCard).toBeVisible();
    await expect(progressCard).toContainText("에이전트 분석 중...");
    await expect(progressCard).toContainText("기준일 2026-04-15");
    await expect(progressCard).toContainText("진행률 50%");
    await expect(progressCard).toContainText("전체 대상 250개");
    await expect(progressCard).toContainText("실패 3개");
    await expect(progressCard).toContainText("완료 88개 · 진행 중 38개");
  });

  test("D2 fundamentals row shows the latest update date from freshness status", async ({ page }) => {
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: "2026-04-13",
            eod_status: "completed",
            symbols_total: 250,
            symbols_succeeded: 250,
            symbols_failed: 0,
            received: true,
          },
          latest: {
            price_trade_date: "2026-04-10",
            technical_market_date: "2026-04-10",
            action_market_date: "2026-04-10",
          },
          fundamental: {
            success: true,
            latest_date: "2026-04-10",
          },
        }),
      });
    });
    await page.route("**/api/trading/disclosures/dart/fundamentals/daily/inspect**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          latest_run: null,
          runs: [],
        }),
      });
    });

    await page.goto("/dashboard");

    const fundamentalsRow = page.locator("#dashboard-freshness article").filter({ hasText: "Fundamentals" });
    await expect(fundamentalsRow).toBeVisible();
    await expect(fundamentalsRow).toContainText("Latest fundamentals update date");
    await expect(fundamentalsRow).toContainText("2026-04-10");
    await expect(fundamentalsRow.getByText("Available")).toBeVisible();
    await expect(fundamentalsRow.getByText("[확인 필요]")).toHaveCount(0);
  });

  test("D2 fundamentals row uses daily inspect status when freshness lacks a fundamentals date", async ({ page }) => {
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: "2026-04-13",
            eod_status: "completed",
            symbols_total: 250,
            symbols_succeeded: 250,
            symbols_failed: 0,
            received: true,
          },
          latest: {
            price_trade_date: "2026-04-10",
            technical_market_date: "2026-04-10",
            action_market_date: "2026-04-10",
          },
        }),
      });
    });
    await page.route("**/api/trading/disclosures/dart/fundamentals/daily/inspect**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          latest_run: {
            id: 7,
            market_date: "2026-04-14",
            trigger: "internal_ops_cli",
            status: "partial",
            fs_div: "CFS",
            force: false,
            symbol_limit: null,
            symbol_offset: 0,
            symbols_total: 3583,
            symbols_checked: 3583,
            symbols_missing: 1388,
            symbols_stale: 100,
            symbols_fresh: 2095,
            symbols_refreshed: 10,
            symbols_failed: 1406,
            events_detected: 13786,
            events_captured: 10,
            events_failed: 490,
            error_message: null,
            run_metadata: {},
            started_at: "2026-04-14T08:56:58.357390+09:00",
            completed_at: "2026-04-14T09:11:08.375335+09:00",
          },
          runs: [],
        }),
      });
    });

    await page.goto("/dashboard");

    const fundamentalsRow = page.locator("#dashboard-freshness article").filter({ hasText: "Fundamentals" });
    await expect(fundamentalsRow).toBeVisible();
    await expect(fundamentalsRow).toContainText("2026-04-14");
    await expect(fundamentalsRow.getByText("Partial")).toBeVisible();
    await expect(fundamentalsRow.getByText("[확인 필요]")).toHaveCount(0);
  });

  test("D2 fundamentals running status uses readable pill colors", async ({ page }) => {
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: "2026-04-14",
            eod_status: "completed",
            symbols_total: 250,
            symbols_succeeded: 250,
            symbols_failed: 0,
            received: true,
          },
          latest: {
            price_trade_date: "2026-04-14",
            technical_market_date: "2026-04-14",
            action_market_date: "2026-04-14",
          },
        }),
      });
    });
    await page.route("**/api/trading/disclosures/dart/fundamentals/daily/inspect**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          latest_run: {
            id: 9,
            market_date: "2026-04-14",
            trigger: "internal_ops_cli",
            status: "running",
            fs_div: "CFS",
            force: false,
            symbol_limit: null,
            symbol_offset: 0,
            symbols_total: 3583,
            symbols_checked: 2400,
            symbols_missing: 0,
            symbols_stale: 0,
            symbols_fresh: 2400,
            symbols_refreshed: 0,
            symbols_failed: 0,
            events_detected: 0,
            events_captured: 0,
            events_failed: 0,
            error_message: null,
            run_metadata: {},
            started_at: "2026-04-14T08:56:58.357390+09:00",
            completed_at: null,
          },
          runs: [],
        }),
      });
    });

    await page.goto("/dashboard");

    const fundamentalsRow = page.locator("#dashboard-freshness article").filter({ hasText: "Fundamentals" });
    const runningPill = fundamentalsRow.locator(".pill").filter({ hasText: "Running" });

    await expect(fundamentalsRow).toBeVisible();
    await expect(runningPill).toBeVisible();
    await expect(runningPill).toHaveCSS("color", "rgb(243, 247, 255)");
    await expect(runningPill).toHaveCSS("background-color", "rgba(127, 184, 255, 0.24)");
    await expect(runningPill).toHaveCSS("border-top-color", "rgba(127, 184, 255, 0.45)");
  });

  test("D2 module rows keep content inside cards at the narrow desktop breakpoint", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: "2026-04-14",
            eod_status: "completed",
            symbols_total: 250,
            symbols_succeeded: 250,
            symbols_failed: 0,
            received: true,
          },
          latest: {
            price_trade_date: "2026-04-14",
            technical_market_date: "2026-04-14",
            action_market_date: "2026-04-14",
          },
          fundamental: {
            success: true,
            latest_date: "2026-04-14",
          },
        }),
      });
    });
    await page.route("**/api/trading/disclosures/dart/fundamentals/daily/inspect**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          latest_run: null,
          runs: [],
        }),
      });
    });

    await page.goto("/dashboard");

    for (const label of ["Technical Analysis", "Action Summary", "Fundamentals"]) {
      const moduleRow = page.locator("#dashboard-freshness article").filter({ hasText: label });
      await expect(moduleRow).toBeVisible();
      await expect(moduleRow).toContainText("2026-04-14");

      const overflowedText = await moduleRow.evaluate((element) => {
        const rowRect = element.getBoundingClientRect();
        const tolerance = 1;

        return [...element.querySelectorAll("strong, p, span, button")]
          .filter((child) => child.getClientRects().length > 0)
          .map((child) => {
            const childRect = child.getBoundingClientRect();
            const overflows =
              childRect.left < rowRect.left - tolerance ||
              childRect.right > rowRect.right + tolerance ||
              childRect.top < rowRect.top - tolerance ||
              childRect.bottom > rowRect.bottom + tolerance;

            return overflows ? child.textContent?.trim() ?? child.tagName : null;
          })
          .filter(Boolean);
      });

      expect(overflowedText).toEqual([]);
    }
  });

  test("D2 fundamentals failed control opens the 2026-04-14 failure reason dialog", async ({ page }) => {
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: "2026-04-14",
            eod_status: "completed",
            symbols_total: 250,
            symbols_succeeded: 250,
            symbols_failed: 0,
            received: true,
          },
          latest: {
            price_trade_date: "2026-04-14",
            technical_market_date: "2026-04-14",
            action_market_date: "2026-04-14",
          },
        }),
      });
    });
    await page.route("**/api/trading/disclosures/dart/fundamentals/daily/inspect**", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          latest_run: {
            id: 85,
            market_date: "2026-04-14",
            trigger: "internal_ops_cli",
            status: "failed",
            fs_div: "CFS",
            force: false,
            symbol_limit: null,
            symbol_offset: 0,
            symbols_total: 3583,
            symbols_checked: 3583,
            symbols_missing: 1388,
            symbols_stale: 100,
            symbols_fresh: 2095,
            symbols_refreshed: 10,
            symbols_failed: 1406,
            events_detected: 13786,
            events_captured: 10,
            events_failed: 490,
            error_message: null,
            run_metadata: {
              failure_reason: "DART fundamentals capture reported failed symbols and events.",
            },
            started_at: "2026-04-14T08:56:58.357390+09:00",
            completed_at: "2026-04-14T09:11:08.375335+09:00",
          },
          runs: [],
        }),
      });
    });

    await page.goto("/dashboard");

    const fundamentalsRow = page.locator("#dashboard-freshness article").filter({ hasText: "Fundamentals" });
    await expect(fundamentalsRow).toBeVisible();

    await fundamentalsRow.getByRole("button", { name: "Failed" }).click();

    const dialog = page.getByRole("dialog", { name: /DART fundamentals failed/i });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Trading-core reported 1,406 failed symbols and 490 failed events");
    await expect(dialog).toContainText("Run date");
    await expect(dialog).toContainText("2026-04-14");
    await expect(dialog).toContainText("Symbols failed");
    await expect(dialog).toContainText("1,406");
    await expect(dialog).toContainText("Events failed");
    await expect(dialog).toContainText("490");
    await expect(dialog).toContainText("Failure Reason");
    await expect(dialog).toContainText("DART fundamentals capture reported failed symbols and events.");

    await dialog.getByRole("button", { name: /Close/i }).click();
    await expect(dialog).toHaveCount(0);
  });

  test("D2 EOD status does not mark a market-date-only stub as available", async ({ page }) => {
    await page.route("**/api/trading/eod/freshness", async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          today: {
            trade_date: "2026-04-13",
            eod_status: null,
            symbols_total: null,
            symbols_succeeded: null,
            symbols_failed: null,
            received: null,
          },
          latest: {
            price_trade_date: null,
            technical_market_date: null,
            action_market_date: null,
          },
        }),
      });
    });

    await page.goto("/dashboard");

    const eodStatusCard = page.locator("#dashboard-freshness article").filter({ hasText: "EOD Status" });
    await expect(eodStatusCard).toBeVisible();
    await expect(eodStatusCard.getByText("Freshness available")).toHaveCount(0);
    await expect(eodStatusCard.locator("strong").filter({ hasText: "[확인 필요]" })).toBeVisible();
    await expect(eodStatusCard).toContainText("Market date 2026-04-13");
    await expect(eodStatusCard).toContainText("Latest EOD date [확인 필요]");
    await expect(eodStatusCard).toContainText("Success count [확인 필요]");
    await expect(eodStatusCard).toContainText("Total count [확인 필요]");
  });
});
