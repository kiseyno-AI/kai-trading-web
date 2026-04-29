import { expect, test, type Page } from "@playwright/test";

async function mockSignalReviewCalendar(page: Page) {
  await page.route("**/api/trading/eod/freshness", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        today: {
          trade_date: "2026-04-27",
        },
        latest: {
          price_trade_date: "2026-04-27",
        },
      }),
    });
  });

  await page.route("**/api/trading/agent-context/feedback/progress?**", async (route) => {
    const url = new URL(route.request().url());
    const marketDate = url.searchParams.get("market_date") ?? "2026-04-27";

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        request: {
          market_date: marketDate,
          symbols: null,
          expected_agents: ["signal-decider"],
        },
        summary: {
          run_id: `feedback-cycle-${marketDate}`,
          run_status: marketDate === "2026-04-27" ? "completed" : "pending",
          run_table_status: marketDate === "2026-04-27" ? "completed" : "pending",
          is_live: false,
          run_started_at: "2026-04-27T06:50:00+00:00",
          run_completed_at: "2026-04-27T07:45:00+00:00",
          current_role: null,
          completed_roles: ["signal-decider"],
          remaining_roles: [],
          latest_feedback_at: "2026-04-27T07:45:00+00:00",
          seconds_since_last_feedback: 120,
          stalled_threshold_seconds: 300,
          total_symbols: marketDate === "2026-04-27" ? 2 : 0,
          processed_symbols: marketDate === "2026-04-27" ? 2 : 0,
          completed_symbols: marketDate === "2026-04-27" ? 2 : 0,
          in_progress_symbols: 0,
          pending_symbols: 0,
          progress_ratio: marketDate === "2026-04-27" ? 1 : 0,
          progress_percent: marketDate === "2026-04-27" ? 100 : 0,
          failed_items: 0,
          completed_feedback_count: marketDate === "2026-04-27" ? 2 : 0,
          expected_feedback_count: marketDate === "2026-04-27" ? 2 : 0,
        },
        result: {
          market_date: marketDate,
          roles: {
            "signal-decider": {
              requested_count: marketDate === "2026-04-27" ? 2 : 0,
              completed_count: marketDate === "2026-04-27" ? 2 : 0,
              error_count: 0,
            },
          },
        },
      }),
    });
  });

  await page.route("**/api/trading/agent-context/feedback?**", async (route) => {
    const url = new URL(route.request().url());
    const marketDate = url.searchParams.get("market_date") ?? "2026-04-27";
    const items =
      marketDate === "2026-04-27"
        ? [
            {
              id: 1,
              market_date: "2026-04-27",
              symbol: "005930",
              agent: {
                name: "signal-decider",
                run_id: "feedback-cycle-2026-04-27",
              },
              summary: {},
              feedback: {
                role: "signal-decider",
                symbol: "005930",
                market_date: "2026-04-27",
                preferred_action: "buy",
                next_day_open_action: "buy",
                target_price: 82000,
                stop_loss_price: 73500,
                confidence_score_10: 8,
                conviction_score_10: 7,
                thesis_summary: "Momentum and fundamentals align for a tactical next-day setup.",
                decision_risks: ["Gap-down open"],
                policy_version: "decider-policy-2026.04",
                evaluation: {
                  quality_verdict: "weak_buy",
                  quality_reason: "The buy worked intraday but failed the 3d realized hurdle.",
                  target_stop_result: "target_hit_first",
                  review_conclusion: "Target hit intraday first, but the multi-day hold weakened.",
                  realized_results: {
                    "1d": {
                      return_pct: 0.82,
                      verdict: "neutral",
                      close_price: 82600,
                    },
                    "3d": {
                      realized_return_pct: -1.44,
                      verdict: "weak_buy",
                      close_price: 80800,
                    },
                  },
                },
              },
              normalized_feedback: null,
              details: null,
              context: {
                symbol_day_context: {
                  company: {
                    name_ko: "Samsung Electronics",
                  },
                },
              },
              received_at: "2026-04-27T07:45:00+00:00",
            },
            {
              id: 2,
              market_date: "2026-04-27",
              symbol: "000660",
              agent: {
                name: "signal-decider",
                run_id: "feedback-cycle-2026-04-27",
              },
              summary: {},
              feedback: {
                role: "signal-decider",
                symbol: "000660",
                market_date: "2026-04-27",
                preferred_action: "wait",
                next_day_open_action: "wait",
                confidence_score_10: 6,
                conviction_score_10: 5,
                thesis_summary: "Wait for confirmation after the opening print.",
                risk_flags: ["Volume confirmation missing"],
                evaluation: {
                  quality_verdict: "missed_opportunity",
                  missed_opportunity: true,
                  quality_reason: "Price cleared the confirmation band before the 3d horizon.",
                  realized_results: {
                    "3d": {
                      return_pct: 4.18,
                      verdict: "missed_opportunity",
                    },
                  },
                },
              },
              normalized_feedback: null,
              details: null,
              context: {
                symbol_day_context: {
                  company: {
                    name_ko: "SK hynix",
                  },
                },
              },
              received_at: "2026-04-27T07:44:00+00:00",
            },
          ]
        : [];

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        request: {
          market_date: marketDate,
          symbols: [],
          agent_name: "signal-decider",
          limit: 200,
        },
        summary: {
          count: items.length,
        },
        items,
      }),
    });
  });
}

test("signal review calendar shows date metadata, selected decisions, and symbol replay detail", async ({ page }) => {
  await mockSignalReviewCalendar(page);

  await page.goto("/calendar?date=2026-04-27");

  await expect(page.getByRole("heading", { name: "Signal Review Calendar" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Calendar" }).first()).toBeVisible();
  await expect(page.getByText("Calendar index is not a dedicated Core contract yet.")).toBeVisible();

  const selectedDateCell = page.getByRole("button", { name: /2026-04-27/ });
  await expect(selectedDateCell).toContainText("2 decisions");
  await expect(selectedDateCell).toContainText("Buy 1 · Wait 1");

  await expect(page.getByText("Target 1 · Stop 0 · Unresolved 1")).toBeVisible();
  const samsungRow = page.locator("tr").filter({ hasText: "Samsung Electronics" });
  await expect(samsungRow).toContainText("Buy");
  await expect(samsungRow).toContainText("+0.82%");
  await expect(samsungRow).toContainText("-1.44%");
  await expect(samsungRow).toContainText("Target first");
  await expect(samsungRow).toContainText("Target hit intraday first");

  await samsungRow.getByRole("button", { name: "Review" }).click();
  const dialog = page.getByRole("dialog", { name: /Samsung Electronics/i });
  await expect(dialog).toContainText("Target hit intraday first, but the multi-day hold weakened.");
  await expect(dialog).toContainText("Following sessions");
  await expect(dialog).toContainText("Gap-down open");

  await dialog.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: /2026-04-26/ }).click();
  await expect(page).toHaveURL(/\/calendar\?date=2026-04-26/);
  await expect(page.getByText("No signal-decider decisions are stored for the selected date.").first()).toBeVisible();
});
