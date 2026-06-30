import { expect, test, type Page } from "@playwright/test";

type RuntimeRequestCounts = {
  dailyBoard: number;
  monitored: number;
  portfolio: number;
  runtimeStatus: number;
};

function buildMonitoredItems(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const rowNumber = index + 1;
    return {
      symbol: `D${rowNumber.toString().padStart(4, "0")}`,
      name: `Decider ${rowNumber}`,
      market: "KOSPI",
      monitoring_state: "watching_target_stop",
      exec_agent_approved: true,
      exec_monitoring_active: true,
      planned_intents: ["buy"],
      approved_quantity: rowNumber,
      exec_agent_target_profile: "standard_breakout",
      target_price: 76000 + rowNumber,
      stop_loss_price: 70000 + rowNumber,
      current_price: 71500 + rowNumber,
    };
  });
}

function buildRuntimeHeldItems(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const rowNumber = index + 1;
    return {
      symbol: `H${rowNumber.toString().padStart(4, "0")}`,
      name: `Runtime Held ${rowNumber}`,
      market: "KOSPI",
      monitoring_state: "idle",
      status: "expired",
      held_position: true,
      position_quantity: rowNumber,
      position_average_price: 71000 + rowNumber,
      current_price: 71500 + rowNumber,
    };
  });
}

function buildBoardItems({ buyCount, sellCount }: { buyCount: number; sellCount: number }) {
  const buyItems = Array.from({ length: buyCount }, (_, index) => {
    const rowNumber = index + 1;
    return {
      symbol: `B${rowNumber.toString().padStart(4, "0")}`,
      name: `Buy ${rowNumber}`,
      market: "KOSPI",
      intent: "buy",
      status: "filled",
      avg_fill_price: 71000 + rowNumber,
      execution_plan_id: `buy-${rowNumber}`,
      target_price: 76000 + rowNumber,
      stop_loss_price: 70000 + rowNumber,
    };
  });
  const sellItems = Array.from({ length: sellCount }, (_, index) => {
    const rowNumber = index + 1;
    return {
      symbol: `S${rowNumber.toString().padStart(4, "0")}`,
      name: `Sell ${rowNumber}`,
      market: "KOSPI",
      intent: "sell",
      status: "filled",
      execution_plan_id: `sell-${rowNumber}`,
      realized_pnl: { amount: 8000 + rowNumber, currency: "KRW" },
    };
  });

  return [...buyItems, ...sellItems];
}

async function mockDashboardRuntimeLists(
  page: Page,
  {
    boardItems,
    buyCount,
    holdings,
    monitoredItems,
    monitoredCount,
    monitoredError = false,
    sellCount,
  }: {
    boardItems?: unknown[];
    buyCount: number;
    holdings?: unknown[];
    monitoredItems?: unknown[];
    monitoredCount: number;
    monitoredError?: boolean;
    sellCount: number;
  },
) {
  const requestCounts: RuntimeRequestCounts = {
    dailyBoard: 0,
    monitored: 0,
    portfolio: 0,
    runtimeStatus: 0,
  };
  const now = "2026-04-30T10:15:00+09:00";

  await page.route("**/api/trading/market/status", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        state: "OPEN",
        is_open: true,
        is_trading_day: true,
        server_time: now,
      }),
    });
  });
  await page.route("**/api/trading/eod/freshness", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        today: {
          trade_date: "2026-04-30",
          price: { status: "ready", symbols_total: 10, symbols_succeeded: 10, symbols_failed: 0 },
          technical_analysis: { status: "ready", symbols_total: 10, symbols_succeeded: 10, symbols_failed: 0 },
          action_summary: { status: "ready", symbols_total: 10, symbols_succeeded: 10, symbols_failed: 0 },
          fundamentals: { status: "ready", symbols_total: 10, symbols_succeeded: 10, symbols_failed: 0 },
        },
        latest: {
          price_trade_date: "2026-04-30",
          technical_market_date: "2026-04-30",
          action_market_date: "2026-04-30",
        },
      }),
    });
  });
  await page.route("**/api/trading/quotes/tracked", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        as_of: now,
        market_state: "OPEN",
        items: [],
      }),
    });
  });
  await page.route("**/api/trading/portfolio/summary", async (route) => {
    requestCounts.portfolio += 1;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        sync: { status: "synced" },
        accounts: [
          {
            id: "account-1",
            label: "Primary",
            status: "synced",
            summary: {
              totalAssets: { amount: 1000000, currency: "KRW" },
              pnl: { day: { amount: 12500, currency: "KRW" } },
            },
            holdings: holdings ?? [{ symbol: "005930", name: "Samsung Electronics", quantity: 5 }],
            recentActivity: [],
          },
        ],
      }),
    });
  });
  await page.route("**/api/trading/execution/runtime/status**", async (route) => {
    requestCounts.runtimeStatus += 1;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        status: "ready",
        mode: "paper",
        exec_connected: true,
      }),
    });
  });
  await page.route("**/api/trading/execution/runtime/monitored-symbols**", async (route) => {
    requestCounts.monitored += 1;
    if (monitoredError) {
      await route.fulfill({
        status: 504,
        contentType: "application/json",
        body: JSON.stringify({ detail: "monitored symbols unavailable" }),
      });
      return;
    }

    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        market_date: "2026-04-30",
        items: monitoredItems ?? buildMonitoredItems(monitoredCount),
      }),
    });
  });
  await page.route("**/api/trading/execution/runtime/daily-board**", async (route) => {
    requestCounts.dailyBoard += 1;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        market_date: "2026-04-30",
        items: boardItems ?? buildBoardItems({ buyCount, sellCount }),
      }),
    });
  });

  return requestCounts;
}

function getPrimaryInsightCard(page: Page, headingName: RegExp) {
  return page.locator("#dashboard-freshness article").filter({
    has: page.getByRole("heading", { name: headingName }),
  });
}

test.describe("dashboard incremental lists", () => {
  test("limits primary dashboard row lists to five and expands each list independently", async ({ page }) => {
    const requestCounts = await mockDashboardRuntimeLists(page, {
      buyCount: 7,
      monitoredCount: 7,
      sellCount: 6,
    });

    await page.goto("/dashboard");

    const deciderCard = getPrimaryInsightCard(page, /Decider recommendations/i);
    const portfolioCard = getPrimaryInsightCard(page, /Portfolio status/i);

    await expect(deciderCard.getByTestId("dashboard-decider-row")).toHaveCount(5);
    await expect(deciderCard.getByText("Decider 6", { exact: true })).toHaveCount(0);
    await expect(deciderCard.getByTestId("dashboard-decider-more")).toHaveText("More (2)");

    await expect(portfolioCard.getByTestId("dashboard-exec-monitoring-row")).toHaveCount(5);
    await expect(portfolioCard.getByText("Buy 6", { exact: true })).toHaveCount(0);
    await expect(portfolioCard.getByText("Decider 6", { exact: true })).toHaveCount(0);
    await expect(portfolioCard.getByTestId("dashboard-exec-monitoring-more")).toHaveText("More (2)");

    await expect(portfolioCard.getByTestId("dashboard-account-holdings-row")).toHaveCount(1);
    await expect(portfolioCard.getByText("Samsung Electronics", { exact: true })).toBeVisible();
    await expect(portfolioCard.getByTestId("dashboard-account-holdings-more")).toHaveCount(0);
    await expect(portfolioCard.getByTestId("dashboard-runtime-held-positions-row")).toHaveCount(0);

    const countsBeforeMore = { ...requestCounts };
    await deciderCard.getByTestId("dashboard-decider-more").click();

    await expect(deciderCard.getByTestId("dashboard-decider-row")).toHaveCount(7);
    await expect(deciderCard.getByText("Decider 6", { exact: true })).toBeVisible();
    await expect(deciderCard.getByTestId("dashboard-decider-more")).toHaveCount(0);
    await expect(portfolioCard.getByTestId("dashboard-exec-monitoring-row")).toHaveCount(5);
    await expect(portfolioCard.getByTestId("dashboard-account-holdings-row")).toHaveCount(1);

    await page.waitForTimeout(250);
    expect(requestCounts).toEqual(countsBeforeMore);

    await portfolioCard.getByTestId("dashboard-exec-monitoring-more").click();

    await expect(portfolioCard.getByTestId("dashboard-exec-monitoring-row")).toHaveCount(7);
    await expect(portfolioCard.getByText("Decider 6", { exact: true })).toBeVisible();
    await expect(portfolioCard.getByTestId("dashboard-account-holdings-row")).toHaveCount(1);
  });

  test("distinguishes account portfolio holdings from many runtime held rows", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("trading-web.locale", JSON.stringify("ko"));
    });
    await mockDashboardRuntimeLists(page, {
      buyCount: 0,
      holdings: [
        { symbol: "033530", name: "SJG세종", quantity: 2 },
        { symbol: "003070", name: "코디", quantity: 1 },
      ],
      monitoredCount: 0,
      monitoredItems: buildRuntimeHeldItems(37),
      sellCount: 0,
    });

    await page.goto("/dashboard");

    const portfolioCard = getPrimaryInsightCard(page, /포트폴리오 상태/);
    const accountMetric = portfolioCard.locator('[data-portfolio-metric="account-holdings"]');
    await expect(accountMetric.getByText("계좌 포트폴리오 보유", { exact: true })).toBeVisible();
    await expect(accountMetric.getByText("2 보유", { exact: true })).toBeVisible();
    await expect(portfolioCard.getByText("런타임 보유 포지션 모니터링", { exact: true })).toBeVisible();
    await expect(portfolioCard.getByText("승인된 exec 런타임 모니터링", { exact: true })).toBeVisible();
    await expect(portfolioCard.getByText("계좌 지표와 보유 행은 포트폴리오 요약 기준이며", { exact: false })).toBeVisible();

    const accountSection = portfolioCard.locator("section").filter({
      has: page.getByRole("heading", { name: "계좌 포트폴리오 보유", exact: true }),
    });
    const runtimeSection = portfolioCard.locator("section").filter({
      has: page.getByRole("heading", { name: "런타임 보유 포지션 모니터링", exact: true }),
    });

    await expect(accountSection.getByTestId("dashboard-account-holdings-row")).toHaveCount(2);
    await expect(accountSection.getByText("SJG세종", { exact: true })).toBeVisible();
    await expect(accountSection.getByText("코디", { exact: true })).toBeVisible();
    await expect(runtimeSection.getByTestId("dashboard-runtime-held-positions-row")).toHaveCount(5);
    await expect(runtimeSection.getByText("Runtime Held 1", { exact: true })).toBeVisible();
    await expect(runtimeSection.getByText("SJG세종", { exact: true })).toHaveCount(0);
    await expect(runtimeSection.getByTestId("dashboard-runtime-held-positions-more")).toHaveText("더 보기 (32)");
    await expect(portfolioCard.getByRole("link", { name: "계좌 포트폴리오 열기" })).toHaveAttribute(
      "href",
      "/portfolio",
    );
  });

  test("keeps mobile empty and error states unchanged without More controls", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockDashboardRuntimeLists(page, {
      buyCount: 0,
      holdings: [],
      monitoredCount: 0,
      monitoredError: true,
      sellCount: 0,
    });

    await page.goto("/dashboard");

    const deciderCard = getPrimaryInsightCard(page, /Decider recommendations/i);
    const portfolioCard = getPrimaryInsightCard(page, /Portfolio status/i);

    await expect(deciderCard.getByText("Monitoring list is updating.", { exact: true })).toBeVisible();
    await expect(deciderCard.getByTestId("dashboard-decider-row")).toHaveCount(0);
    await expect(deciderCard.getByTestId("dashboard-decider-more")).toHaveCount(0);

    await expect(portfolioCard.getByText("Monitored symbols unavailable.", { exact: true })).toBeVisible();
    await expect(portfolioCard.getByText("Runtime held positions unavailable.", { exact: true })).toBeVisible();
    await expect(portfolioCard.getByText("Monitoring list is updating.", { exact: true })).toHaveCount(0);
    await expect(portfolioCard.getByText("No account portfolio holdings returned.", { exact: true })).toBeVisible();
    await expect(portfolioCard.getByTestId("dashboard-exec-monitoring-row")).toHaveCount(0);
    await expect(portfolioCard.getByTestId("dashboard-account-holdings-row")).toHaveCount(0);
    await expect(portfolioCard.getByTestId("dashboard-runtime-held-positions-row")).toHaveCount(0);
    await expect(portfolioCard.getByTestId("dashboard-exec-monitoring-more")).toHaveCount(0);
    await expect(portfolioCard.getByTestId("dashboard-account-holdings-more")).toHaveCount(0);
    await expect(portfolioCard.getByTestId("dashboard-runtime-held-positions-more")).toHaveCount(0);
  });

  test("shows exec-approved monitoring rows and excludes core-only planned rows on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockDashboardRuntimeLists(page, {
      boardItems: [
        {
          symbol: "005930",
          name: "Samsung Electronics",
          market: "KOSPI",
          status: "partial",
          monitoring_state: "watching_target_stop",
          planned_intents: ["buy", "target_sell", "stop_sell"],
          target_price: 76000,
          stop_loss_price: 70000,
        },
        {
          symbol: "005930",
          name: "Samsung Electronics",
          market: "KOSPI",
          status: "scheduled",
          intent: "buy",
          planned_price: 71500,
        },
      ],
      buyCount: 0,
      holdings: [],
      monitoredCount: 0,
      monitoredItems: [
        {
          symbol: "004150",
          name: "Hansol Holdings",
          market: "KOSPI",
          monitoring_state: "watching_target_stop",
          exec_agent_approved: true,
          exec_monitoring_active: true,
          exec_agent_target_profile: "tactical_2pct",
          exec_agent_target_tag: "short_swing",
          approved_quantity: 12,
          target_price: 76000,
          stop_loss_price: 70000,
          current_price: 71500,
        },
      ],
      sellCount: 0,
    });

    await page.goto("/dashboard");

    const portfolioCard = getPrimaryInsightCard(page, /Portfolio status/i);
    const monitoringSection = portfolioCard.locator("section").filter({
      has: page.getByRole("heading", { name: "Exec-approved runtime monitoring", exact: true }),
    });

    await expect(monitoringSection).toBeVisible();
    await expect(monitoringSection.getByTestId("dashboard-exec-monitoring-row")).toHaveCount(1);
    await expect(monitoringSection.getByText("Hansol Holdings", { exact: true })).toBeVisible();
    await expect(monitoringSection.getByText("Exec-approved", { exact: true })).toBeVisible();
    await expect(monitoringSection.getByText("Target profile", { exact: true })).toBeVisible();
    await expect(monitoringSection.getByText("tactical_2pct / short_swing", { exact: true })).toBeVisible();
    await expect(monitoringSection.getByText("Approved qty", { exact: true })).toBeVisible();
    await expect(monitoringSection.getByText("12", { exact: true })).toBeVisible();
    await expect(portfolioCard.getByText("Samsung Electronics", { exact: true })).toHaveCount(0);
    await expect(portfolioCard.getByTestId("dashboard-account-holdings-row")).toHaveCount(0);
    await expect(portfolioCard.getByTestId("dashboard-runtime-held-positions-row")).toHaveCount(0);
  });
});
