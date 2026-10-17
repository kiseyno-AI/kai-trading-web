import assert from "node:assert/strict";
import test from "node:test";

import { getDashboardLiveCopy } from "@/i18n/dashboard-live-copy";
import type {
  ExecutionRuntimeDailyBoardResponseDto,
  ExecutionRuntimeMonitoredSymbolsResponseDto,
  ExecutionRuntimeStatusResponseDto,
} from "@/types/trading-api/execution-runtime";
import type { PortfolioSummaryDto } from "@/types/trading-api/portfolio-account";
import type { SignalDeciderFeedbackItem } from "@/lib/signal-decider-feedback";

import {
  buildDashboardDeciderOverviewModel,
  buildDashboardDeciderMoreHref,
  buildDashboardPortfolioOverviewModel,
} from "./dashboard-overview-cards";
import type { CoreMarketStatus, CoreTrackedQuotesResponse } from "./live-dashboard-types";

const copy = getDashboardLiveCopy("en");
const marketOpen = {
  is_open: true,
  server_time: "2026-05-22T10:00:00+09:00",
  state: "REGULAR",
} satisfies CoreMarketStatus;
const marketClosed = {
  is_open: false,
  server_time: "2026-05-22T18:00:00+09:00",
  state: "CLOSED",
} satisfies CoreMarketStatus;
const noLiveProcessStage = {
  availability: "available",
  label: null,
} as const;

test("builds market-open decider rows from monitored symbols without per-symbol fanout", () => {
  const monitoredSymbols = {
    market_date: "2026-05-22",
    items: [
      {
        symbol: "005930",
        name: "Samsung Electronics",
        market: "KRX",
        status: "watching_target_stop",
        monitoring_state: "watching_target_stop",
        planned_intents: ["buy"],
        target_price: 76000,
        stop_loss_price: 70000,
      },
    ],
  } satisfies ExecutionRuntimeMonitoredSymbolsResponseDto;
  const tracked = {
    as_of: "2026-05-22T10:00:00+09:00",
    market_state: "open",
    items: [
      {
        available: true,
        as_of: "2026-05-22T10:00:00+09:00",
        change: 500,
        change_pct: 0.7,
        company_name: "Samsung Electronics",
        fallback: false,
        is_live: true,
        market_state: "open",
        price: 71500,
        source: "kis",
        symbol: "005930",
        turnover: 1000,
        volume: 100,
      },
    ],
  } satisfies CoreTrackedQuotesResponse;

  const model = buildDashboardDeciderOverviewModel({
    board: null,
    copy,
    market: marketOpen,
    monitoredSymbols,
    numberLocale: "en-US",
    processStage: noLiveProcessStage,
    processStatus: "running",
    tracked,
  });

  assert.equal(model.mode, "market-open");
  assert.equal(model.detailMarketDate, "2026-05-22");
  assert.equal(model.rows.length, 1);
  assert.deepEqual(
    model.rows[0].prices.map((price) => [price.label, price.value]),
    [
      ["Stop-loss", "70,000"],
      ["Target", "76,000"],
      ["Current price", "71,500"],
    ],
  );
  assert.equal(model.rows[0].compactPriceLine, "Stop 70,000 · Target 76,000 · Now 71,500");
  assert.equal(
    model.rows[0].detailHref,
    "/dashboard/symbol/005930/action-summary?name=Samsung+Electronics&market=KRX&marketDate=2026-05-22&recommendationSource=execution-runtime&referencePriceKind=current&recommendationSymbol=005930&recommendationMarketDate=2026-05-22&executionAction=buy-monitoring&executionSource=monitored-symbols&stopLossPrice=70000&targetPrice=76000&referencePrice=71500",
  );
});

test("builds compact market-open decider price line with current-price fallback", () => {
  const monitoredSymbols = {
    market_date: "2026-05-22",
    items: [
      {
        symbol: "000660",
        name: "SK hynix",
        market: "KRX",
        status: "watching_target_stop",
        monitoring_state: "watching_target_stop",
        planned_intents: ["buy"],
        target_price: 184000,
        stop_loss_price: 174000,
      },
    ],
  } satisfies ExecutionRuntimeMonitoredSymbolsResponseDto;
  const tracked = {
    as_of: "2026-05-22T10:00:00+09:00",
    market_state: "open",
    items: [],
  } satisfies CoreTrackedQuotesResponse;

  const model = buildDashboardDeciderOverviewModel({
    board: null,
    copy,
    market: marketOpen,
    monitoredSymbols,
    numberLocale: "en-US",
    processStage: noLiveProcessStage,
    processStatus: "running",
    tracked,
  });

  assert.equal(model.mode, "market-open");
  assert.equal(model.rows.length, 1);
  assert.equal(model.rows[0].compactPriceLine, "Stop 174,000 · Target 184,000 · Now —");
  assert.deepEqual(
    model.rows[0].prices.map((price) => [price.label, price.value]),
    [
      ["Stop-loss", "174,000"],
      ["Target", "184,000"],
      ["Current price", "Unavailable"],
    ],
  );
});

test("sanitizes market-open monitored-symbol timeout while preserving diagnostics", () => {
  const rawTimeout =
    "Timed out after 5.0s while loading /execution/runtime/monitored-symbols?market_date=2026-05-22 from trading-core.";

  const model = buildDashboardDeciderOverviewModel({
    board: null,
    copy,
    market: marketOpen,
    monitoredSymbols: null,
    monitoredSymbolsError: rawTimeout,
    numberLocale: "en-US",
    processStage: noLiveProcessStage,
    processStatus: "running",
    tracked: null,
  });

  assert.equal(model.mode, "market-open");
  assert.equal(model.rows.length, 0);
  assert.equal(model.statusLabel, "Runtime delayed");
  assert.equal(model.statusTone, "warning");
  assert.equal(model.contextLabel?.includes("Runtime data is delayed."), true);
  assert.equal(model.emptyLabel, "Monitoring list is updating.");
  assert.deepEqual(model.diagnostics, [rawTimeout]);
  assert.doesNotMatch(
    [model.contextLabel, model.emptyLabel, model.statusLabel].filter(Boolean).join("\n"),
    /Timed out after 5\.0s|trading-core|\/execution\/runtime\/monitored-symbols/,
  );
});

test("uses in-progress copy only while the closed-market daily process is running", () => {
  const model = buildDashboardDeciderOverviewModel({
    board: null,
    copy,
    market: marketClosed,
    monitoredSymbols: null,
    numberLocale: "en-US",
    processStage: noLiveProcessStage,
    processStatus: "running",
    tracked: null,
  });

  assert.equal(model.mode, "closed-in-progress");
  assert.equal(model.rows.length, 0);
  assert.equal(model.statusLabel, "Daily process running");
  assert.equal(model.emptyLabel, "일별 프로세스 진행 중");
});

test("shows planned buy and sell rows when closed-market process is partial without a live stage", () => {
  const board = {
    market_date: "2026-05-22",
    items: [
      {
        symbol: "005930",
        name: "Samsung Electronics",
        market: "KRX",
        status: "planned",
        intent: "buy",
        target_price: 76000,
        stop_loss_price: 70000,
        market_close_price: 71500,
      },
      {
        symbol: "035420",
        name: "NAVER",
        market: "KRX",
        status: "scheduled",
        intent: "sell",
        market_close_price: 186000,
      },
    ],
  } satisfies ExecutionRuntimeDailyBoardResponseDto;

  const model = buildDashboardDeciderOverviewModel({
    board,
    copy,
    market: marketClosed,
    monitoredSymbols: null,
    numberLocale: "en-US",
    processStage: noLiveProcessStage,
    processStatus: "partial",
    tracked: null,
  });

  assert.equal(model.mode, "closed-planned");
  assert.equal(model.detailMarketDate, "2026-05-22");
  assert.equal(model.statusLabel, "Today's plan");
  assert.equal(model.emptyLabel, null);
  assert.equal(model.rows.length, 2);
  assert.equal(model.rows[0].intentLabel, "Planned buy today");
  assert.equal(model.rows[1].intentLabel, "Planned sell today");
  assert.equal(
    model.rows[0].detailHref,
    "/dashboard/symbol/005930/action-summary?name=Samsung+Electronics&market=KRX&marketDate=2026-05-22&recommendationSource=execution-runtime&referencePriceKind=close&recommendationSymbol=005930&recommendationMarketDate=2026-05-22&executionAction=planned-buy-today&executionSource=execution-board&stopLossPrice=70000&targetPrice=76000&referencePrice=71500",
  );
  assert.equal(
    model.contextLabel,
    "No live daily-process stage is reported. Rows show planned buy/sell stocks from the execution board.",
  );
  assert.doesNotMatch(model.contextLabel, /Live daily-process stage reported:/);
  assert.doesNotMatch([model.statusLabel, model.emptyLabel, model.contextLabel].filter(Boolean).join("\n"), /running|진행 중/i);
});

test("matches case- and whitespace-mismatched symbols before marking an execution/Signal Decider conflict", () => {
  const model = buildDashboardDeciderOverviewModel({
    board: {
      market_date: "2026-09-08",
      items: [
        {
          symbol: "aapl",
          name: "Apple",
          market: "NASDAQ",
          status: "planned",
          intent: "buy",
          stop_loss_price: 131000,
          target_price: 145000,
          market_close_price: 133000,
        },
      ],
    },
    copy,
    market: {
      is_open: false,
      server_time: "2026-09-08T07:30:00+09:00",
      state: "PREOPEN",
    },
    monitoredSymbols: null,
    numberLocale: "en-US",
    processStage: noLiveProcessStage,
    processStatus: "partial",
    signalDeciderItems: [
      {
        symbol: " AAPL ",
        marketDate: "2026-09-08",
        action: "wait",
        stopLossPrice: 123000,
        targetPrice: 135900,
      } as SignalDeciderFeedbackItem,
    ],
    tracked: null,
  });

  assert.equal(model.rows.length, 1);
  assert.equal(model.rows[0].sourceLabel, "Execution Runtime · Execution board");
  assert.equal(model.rows[0].intentLabel, "Planned buy today");
  assert.equal(model.rows[0].hasSourceConflict, true);
  assert.equal(
    model.rows[0].conflictLabel,
    "Same-date Signal Decider: Wait. Review both sources before acting.",
  );

  const detailUrl = new URL(model.rows[0].detailHref, "https://example.test");
  assert.equal(detailUrl.searchParams.get("recommendationSource"), "execution-runtime");
  assert.equal(detailUrl.searchParams.get("recommendationMarketDate"), "2026-09-08");
  assert.equal(detailUrl.searchParams.get("executionAction"), "planned-buy-today");
  assert.equal(detailUrl.searchParams.get("executionSource"), "execution-board");
  assert.equal(detailUrl.searchParams.get("recommendationSymbol"), "aapl");
  assert.equal(detailUrl.searchParams.get("stopLossPrice"), "131000");
  assert.equal(detailUrl.searchParams.get("signalDeciderAction"), "wait");
  assert.equal(detailUrl.searchParams.get("signalDeciderStopLossPrice"), "123000");
  assert.equal(detailUrl.searchParams.get("signalDeciderTargetPrice"), "135900");
});

test("reports the available live stage beside planned rows when the daily process is partial", () => {
  const model = buildDashboardDeciderOverviewModel({
    board: {
      market_date: "2026-05-22",
      items: [
        {
          symbol: "005930",
          name: "Samsung Electronics",
          status: "planned",
          intent: "buy",
        },
      ],
    },
    copy,
    market: marketClosed,
    monitoredSymbols: null,
    numberLocale: "en-US",
    processStage: {
      availability: "available",
      label: "PyKRX daily price collection",
    },
    processStatus: "partial",
    tracked: null,
  });

  assert.equal(
    model.contextLabel,
    "Live daily-process stage reported: PyKRX daily price collection. Rows show planned buy/sell stocks from the execution board.",
  );
  assert.doesNotMatch(model.contextLabel, /No live daily-process stage is reported/);
});

test("does not confirm a stale current-stage snapshot as live beside planned rows", () => {
  const model = buildDashboardDeciderOverviewModel({
    board: {
      market_date: "2026-05-22",
      items: [
        {
          symbol: "005930",
          name: "Samsung Electronics",
          status: "planned",
          intent: "buy",
        },
      ],
    },
    copy,
    market: marketClosed,
    monitoredSymbols: null,
    numberLocale: "en-US",
    processStage: {
      availability: "degraded",
      label: "PyKRX daily price collection",
    },
    processStatus: "partial",
    tracked: null,
  });

  assert.equal(
    model.contextLabel,
    "Daily-process stage status is stale or unavailable, so no live stage is confirmed. Rows show planned buy/sell stocks from the execution board.",
  );
  assert.doesNotMatch(model.contextLabel, /Live daily-process stage reported/);
});

test("labels target-date planned rows as today's plan before market open", () => {
  const board = {
    market_date: "2026-05-22",
    items: [
      {
        symbol: "005930",
        name: "Samsung Electronics",
        market: "KRX",
        status: "scheduled",
        intent: "next_open_buy",
        target_trade_date: "2026-05-25",
        target_price: 76000,
        stop_loss_price: 70000,
        market_close_price: 71500,
      },
      {
        symbol: "035420",
        name: "NAVER",
        market: "KRX",
        status: "scheduled",
        intent: "next_open_sell",
        target_trade_date: "2026-05-25",
        market_close_price: 186000,
      },
    ],
  } satisfies ExecutionRuntimeDailyBoardResponseDto;

  const model = buildDashboardDeciderOverviewModel({
    board,
    copy,
    market: {
      is_open: false,
      server_time: "2026-05-25T08:30:00+09:00",
      state: "PREOPEN",
    },
    monitoredSymbols: null,
    numberLocale: "en-US",
    processStage: noLiveProcessStage,
    processStatus: "partial",
    tracked: null,
  });

  assert.equal(model.mode, "closed-planned");
  assert.equal(model.statusLabel, "Today's plan");
  assert.equal(model.rows[0].intentLabel, "Planned buy today");
  assert.equal(model.rows[1].intentLabel, "Planned sell today");
});

test("uses an honest empty state when no planned rows exist and no process is running", () => {
  const model = buildDashboardDeciderOverviewModel({
    board: { market_date: "2026-05-22", items: [] },
    copy,
    market: marketClosed,
    monitoredSymbols: null,
    numberLocale: "en-US",
    processStage: noLiveProcessStage,
    processStatus: "partial",
    tracked: null,
  });

  assert.equal(model.mode, "closed-planned");
  assert.equal(model.rows.length, 0);
  assert.equal(model.statusLabel, "Partial");
  assert.equal(model.emptyLabel, "No planned buy/sell stocks returned.");
  assert.doesNotMatch([model.statusLabel, model.emptyLabel].join("\n"), /running|진행 중/i);
});

test("builds closed-market next-day exec rows with close prices when the daily process completed", () => {
  const board = {
    market_date: "2026-05-22",
    items: [
      {
        symbol: "000660",
        name: "SK hynix",
        market: "KRX",
        status: "scheduled",
        intent: "next_open_buy",
        target_price: 184000,
        stop_loss_price: 174000,
        market_close_price: 179500,
        source_market_date: "2026-05-21",
        target_trade_date: "2026-05-25",
      },
    ],
  } satisfies ExecutionRuntimeDailyBoardResponseDto;

  const model = buildDashboardDeciderOverviewModel({
    board,
    copy,
    market: marketClosed,
    monitoredSymbols: null,
    numberLocale: "en-US",
    processStage: noLiveProcessStage,
    processStatus: "completed",
    tracked: null,
  });

  assert.equal(model.mode, "closed-completed");
  assert.equal(model.detailMarketDate, "2026-05-21");
  assert.equal(model.rows.length, 1);
  assert.deepEqual(
    model.rows[0].prices.map((price) => [price.label, price.value]),
    [
      ["Stop-loss", "174,000"],
      ["Target", "184,000"],
      ["Close price", "179,500"],
    ],
  );
  assert.equal(
    model.rows[0].detailHref,
    "/dashboard/symbol/000660/action-summary?name=SK+hynix&market=KRX&marketDate=2026-05-21&recommendationSource=execution-runtime&referencePriceKind=close&recommendationSymbol=000660&recommendationMarketDate=2026-05-21&executionAction=planned-buy-next&executionSource=execution-board&stopLossPrice=174000&targetPrice=184000&referencePrice=179500",
  );
});

test("routes decider More link to visible recommendation source date", () => {
  const board = {
    market_date: "2026-07-19",
    items: [
      {
        symbol: "004080",
        name: "Kyungbang",
        market: "KRX",
        status: "scheduled",
        intent: "next_open_buy",
        target_price: 9500,
        stop_loss_price: 8700,
        market_close_price: 9100,
        source_market_date: "2026-07-16",
        target_trade_date: "2026-07-20",
      },
    ],
  } satisfies ExecutionRuntimeDailyBoardResponseDto;

  const model = buildDashboardDeciderOverviewModel({
    board,
    copy,
    market: {
      is_open: false,
      server_time: "2026-07-19T00:10:00+09:00",
      state: "CLOSED",
    },
    monitoredSymbols: null,
    numberLocale: "en-US",
    processStage: noLiveProcessStage,
    processStatus: "completed",
    tracked: null,
  });

  assert.equal(model.detailMarketDate, "2026-07-16");
  assert.equal(
    model.rows[0].detailHref,
    "/dashboard/symbol/004080/action-summary?name=Kyungbang&market=KRX&marketDate=2026-07-16&recommendationSource=execution-runtime&referencePriceKind=close&recommendationSymbol=004080&recommendationMarketDate=2026-07-16&executionAction=planned-buy-next&executionSource=execution-board&stopLossPrice=8700&targetPrice=9500&referencePrice=9100",
  );
  assert.equal(
    buildDashboardDeciderMoreHref({
      fallbackHref: "/dashboard/signal-decider-feedback?marketDate=2026-07-19",
      model,
    }),
    "/dashboard/signal-decider-feedback?marketDate=2026-07-16",
  );
});

test("keeps fallback decider More href when no recommendation rows are visible", () => {
  const model = buildDashboardDeciderOverviewModel({
    board: { market_date: "2026-07-19", items: [] },
    copy,
    market: {
      is_open: false,
      server_time: "2026-07-19T00:10:00+09:00",
      state: "CLOSED",
    },
    monitoredSymbols: null,
    numberLocale: "en-US",
    processStage: noLiveProcessStage,
    processStatus: "completed",
    tracked: null,
  });

  assert.equal(model.detailMarketDate, null);
  assert.equal(
    buildDashboardDeciderMoreHref({
      fallbackHref: "/dashboard/signal-decider-feedback?marketDate=2026-07-19",
      model,
    }),
    "/dashboard/signal-decider-feedback?marketDate=2026-07-19",
  );
});

test("shows exec-approved monitoring rows from runtime monitored symbols with target profile", () => {
  const monitoredSymbols = {
    market_date: "2026-05-22",
    items: [
      {
        symbol: "004150",
        name: "Hansol Holdings",
        market: "KRX",
        monitoring_state: "watching_target_stop",
        exec_agent_approved: true,
        exec_monitoring_active: true,
        exec_agent_target_profile: "tactical_2pct",
        exec_agent_target_tag: "short_swing",
        approved_quantity: 12,
        approved_notional: { amount: 900_000, currency: "KRW" },
        target_price: 76000,
        stop_loss_price: 70000,
        current_price: 71500,
      },
    ],
  } satisfies ExecutionRuntimeMonitoredSymbolsResponseDto;

  const model = buildDashboardPortfolioOverviewModel({
    copy,
    executionStatus: { exec_connected: true, status: "ready" },
    executionStatusError: null,
    monitoredSymbols,
    monitoredSymbolsError: null,
    numberLocale: "en-US",
    portfolioState: "fully-synced",
    summary: null,
  });

  assert.equal(model.monitoringRows.length, 1);
  assert.equal(model.accountHoldingRows.length, 0);
  assert.equal(model.runtimeHoldingRows.length, 0);
  assert.deepEqual(model.monitoringRows[0].badges, ["Exec-approved", "Watching target/stop"]);
  assert.deepEqual(
    model.monitoringRows[0].values.map((value) => [value.label, value.value]),
    [
      ["Monitoring state", "Watching target/stop"],
      ["Target profile", "tactical_2pct / short_swing"],
      ["Current price", "71,500"],
      ["Target", "76,000"],
      ["Stop-loss", "70,000"],
      ["Approved qty", "12"],
      ["Approved notional", "₩900,000"],
    ],
  );
});

test("shows the current Exec safety and availability state instead of connection alone", () => {
  const cases: Array<{
    expectedLabel: string;
    expectedTone: "positive" | "warning";
    status: ExecutionRuntimeStatusResponseDto;
  }> = [
    {
      expectedLabel: "Exec online",
      expectedTone: "positive",
      status: { exec_connected: true, status: "ready" },
    },
    {
      expectedLabel: "Automation paused",
      expectedTone: "warning",
      status: { exec_connected: true, paused: true, status: "paused" },
    },
    {
      expectedLabel: "Automation paused",
      expectedTone: "warning",
      status: { exec_connected: true, status: "paused" },
    },
    {
      expectedLabel: "Kill switch active",
      expectedTone: "warning",
      status: { exec_connected: true, kill_switch_enabled: true, status: "ready" },
    },
    {
      expectedLabel: "Kill switch active",
      expectedTone: "warning",
      status: { exec_connected: true, status: "kill_switched" },
    },
    {
      expectedLabel: "Exec degraded",
      expectedTone: "warning",
      status: { exec_connected: true, status: "degraded" },
    },
    {
      expectedLabel: "Exec offline",
      expectedTone: "warning",
      status: { exec_connected: false, status: "offline" },
    },
  ];

  for (const current of cases) {
    const model = buildDashboardPortfolioOverviewModel({
      copy,
      executionStatus: current.status,
      executionStatusError: null,
      monitoredSymbols: { market_date: "2026-05-22", items: [] },
      monitoredSymbolsError: null,
      numberLocale: "en-US",
      portfolioState: "fully-synced",
      summary: null,
    });

    const execMetric = model.metrics.find((metric) => metric.key === "exec-connection");
    assert.equal(model.execConnectionLabel, current.expectedLabel);
    assert.equal(model.execConnectionTone, current.expectedTone);
    assert.equal(execMetric?.value, current.expectedLabel);
    assert.equal(execMetric?.tone, current.expectedTone);
  }
});

test("shows actual account holdings from the portfolio summary", () => {
  const summary = {
    sync: { status: "synced" },
    accounts: [
      {
        id: "account-1",
        label: "Primary",
        status: "synced",
        summary: {
          totalAssets: { amount: 1_000_000, currency: "KRW" },
          pnl: { day: { amount: 12_500, currency: "KRW" }, week: { amount: -600_000, currency: "KRW" } },
        },
        holdings: [
          {
            symbol: "005930",
            name: "Samsung Electronics",
            market: "KRX",
            quantity: 3,
            averagePrice: { amount: 71_000, currency: "KRW" },
            lastPrice: { amount: 72_500, currency: "KRW" },
            marketValue: { amount: 217_500, currency: "KRW" },
            unrealizedPnl: { amount: 4_500, currency: "KRW" },
          },
        ],
      },
    ],
  } satisfies PortfolioSummaryDto;

  const model = buildDashboardPortfolioOverviewModel({
    copy,
    executionStatus: { exec_connected: true, status: "ready" },
    executionStatusError: null,
    monitoredSymbols: { market_date: "2026-05-22", items: [] },
    monitoredSymbolsError: null,
    numberLocale: "en-US",
    portfolioState: "fully-synced",
    summary,
  });

  assert.equal(model.metrics.find((metric) => metric.key === "exec-connection")?.value, "Exec online");
  assert.equal(model.metrics.find((metric) => metric.key === "total-assets")?.value, "₩1,000,000");
  assert.equal(model.metrics.find((metric) => metric.key === "week-pnl")?.value, "-₩600,000");
  assert.equal(model.metrics.find((metric) => metric.key === "account-holdings")?.value, "1 holding");
  assert.equal(model.monitoringRows.length, 0);
  assert.equal(model.accountHoldingRows.length, 1);
  assert.equal(model.runtimeHoldingRows.length, 0);
  assert.deepEqual(model.accountHoldingRows[0].badges, ["Account held"]);
  assert.deepEqual(
    model.accountHoldingRows[0].values.map((value) => [value.label, value.value]),
    [
      ["Quantity", "3"],
      ["Average price", "₩71,000"],
      ["Current price", "₩72,500"],
      ["Market value", "₩217,500"],
      ["Unrealized P/L", "₩4,500"],
    ],
  );
});

test("masks cached portfolio summary values when the latest summary refresh is unavailable", () => {
  const summaryRefreshError = "trading-core portfolio API is unavailable.";
  const cachedSummary = {
    sync: { status: "synced" },
    accounts: [
      {
        id: "cached-account",
        label: "Cached account",
        status: "synced",
        summary: {
          totalAssets: { amount: 9_200_000, currency: "KRW" },
          pnl: { week: { amount: 125_000, currency: "KRW" } },
        },
        holdings: [],
      },
    ],
  } satisfies PortfolioSummaryDto;

  const model = buildDashboardPortfolioOverviewModel({
    copy,
    executionStatus: { exec_connected: true, status: "ready" },
    executionStatusError: null,
    monitoredSymbols: { market_date: "2026-05-22", items: [] },
    monitoredSymbolsError: null,
    numberLocale: "en-US",
    portfolioSummaryError: summaryRefreshError,
    portfolioState: "upstream-unavailable",
    summary: cachedSummary,
  });

  assert.equal(model.statusLabel, "Unavailable");
  assert.equal(model.statusTone, "warning");
  assert.equal(model.contextLabel?.includes(copy.portfolioState.unavailable), true);
  assert.deepEqual(model.diagnostics, [summaryRefreshError]);
  assert.equal(model.metrics.find((metric) => metric.key === "total-assets")?.value, "Unavailable");
  assert.equal(model.metrics.find((metric) => metric.key === "total-assets")?.tone, "warning");
  assert.equal(model.metrics.find((metric) => metric.key === "week-pnl")?.value, "Unavailable");
  assert.equal(model.metrics.find((metric) => metric.key === "account-holdings")?.value, "Unavailable");
  assert.equal(model.metrics.find((metric) => metric.key === "account-holdings")?.tone, "warning");
  assert.equal(model.accountHoldingRows.length, 0);
  assert.equal(model.accountHoldingStateLabel, "Account portfolio holdings unavailable.");
});

test("keeps explicitly stale portfolio summaries visible with degraded dashboard labeling", () => {
  const staleSummary = {
    sync: { status: "stale", message: "KIS balance sync is older than the latest market session." },
    accounts: [
      {
        id: "stale-account",
        label: "Stale account",
        status: "stale",
        summary: {
          totalAssets: { amount: 1_000_000, currency: "KRW" },
        },
        holdings: [
          {
            symbol: "005930",
            name: "Samsung Electronics",
            quantity: 3,
          },
        ],
      },
    ],
  } satisfies PortfolioSummaryDto;

  const model = buildDashboardPortfolioOverviewModel({
    copy,
    executionStatus: { exec_connected: true, status: "ready" },
    executionStatusError: null,
    monitoredSymbols: { market_date: "2026-05-22", items: [] },
    monitoredSymbolsError: null,
    numberLocale: "en-US",
    portfolioState: "stale-sync",
    summary: staleSummary,
  });

  assert.equal(model.statusLabel, "Stale/degraded");
  assert.equal(model.statusTone, "warning");
  assert.equal(model.contextLabel?.includes(copy.portfolioState.degradedSummary), true);
  assert.equal(model.metrics.find((metric) => metric.key === "total-assets")?.value, "₩1,000,000");
  assert.equal(model.metrics.find((metric) => metric.key === "account-holdings")?.value, "1 holding");
  assert.equal(model.accountHoldingRows.length, 1);
  assert.equal(model.accountHoldingStateLabel, null);
});

test("keeps portfolio asset snapshot weekly pnl ahead of exec weekly realized pnl", () => {
  const summary = {
    sync: { status: "synced" },
    accounts: [
      {
        id: "account-1",
        label: "Primary",
        status: "synced",
        summary: {
          totalAssets: { amount: 1_000_000, currency: "KRW" },
          pnl: { week: { amount: -600_000, currency: "KRW" } },
        },
      },
    ],
  } satisfies PortfolioSummaryDto;

  const model = buildDashboardPortfolioOverviewModel({
    copy,
    executionStatus: {
      exec_connected: true,
      status: "ready",
      weekly_pnl: {
        weekly_realized_pnl: "-29070.0000",
        pnl_method: "fifo_internal_fills",
      },
    },
    executionStatusError: null,
    monitoredSymbols: { market_date: "2026-05-22", items: [] },
    monitoredSymbolsError: null,
    numberLocale: "en-US",
    portfolioState: "fully-synced",
    summary,
  });

  const weekPnl = model.metrics.find((metric) => metric.key === "week-pnl");
  assert.equal(weekPnl?.value, "-₩600,000");
  assert.equal(weekPnl?.tone, "negative");
});

test("keeps account holdings separate from exec-monitored symbols without double-counting runtime quantity", () => {
  const summary = {
    sync: { status: "synced" },
    accounts: [
      {
        id: "account-1",
        label: "Primary",
        status: "synced",
        holdings: [
          {
            symbol: "005930",
            name: "Samsung Electronics",
            market: "KRX",
            quantity: 3,
            averagePrice: { amount: 71_000, currency: "KRW" },
          },
        ],
      },
    ],
  } satisfies PortfolioSummaryDto;
  const monitoredSymbols = {
    market_date: "2026-05-22",
    items: [
      {
        symbol: "005930",
        name: "Samsung Electronics",
        market: "KRX",
        monitoring_state: "watching_target_stop",
        exec_agent_approved: true,
        exec_monitoring_active: true,
        position_quantity: 3,
        target_price: 76000,
        stop_loss_price: 70000,
      },
    ],
  } satisfies ExecutionRuntimeMonitoredSymbolsResponseDto;

  const model = buildDashboardPortfolioOverviewModel({
    copy,
    executionStatus: { exec_connected: true, status: "ready" },
    executionStatusError: null,
    monitoredSymbols,
    monitoredSymbolsError: null,
    numberLocale: "en-US",
    portfolioState: "fully-synced",
    summary,
  });

  assert.equal(model.monitoringRows.length, 1);
  assert.equal(model.accountHoldingRows.length, 1);
  assert.equal(model.runtimeHoldingRows.length, 0);
  assert.deepEqual(model.monitoringRows[0].badges, ["Exec-approved", "Watching target/stop", "Account held"]);
  assert.equal(model.monitoringRows[0].values.find((value) => value.key === "quantity")?.value, "3");
  assert.equal(model.monitoringRows[0].values.find((value) => value.key === "average-price")?.value, "₩71,000");
  assert.equal(model.accountHoldingRows[0].values.find((value) => value.key === "quantity")?.value, "3");
});

test("keeps first-card planned rows while excluding core-only planned rows from the second card", () => {
  const board = {
    market_date: "2026-05-22",
    items: [
      {
        symbol: "005930",
        name: "Samsung Electronics",
        market: "KRX",
        status: "scheduled",
        intent: "next_open_buy",
        target_price: 76000,
        stop_loss_price: 70000,
        market_close_price: 71500,
      },
    ],
  } satisfies ExecutionRuntimeDailyBoardResponseDto;
  const deciderModel = buildDashboardDeciderOverviewModel({
    board,
    copy,
    market: marketClosed,
    monitoredSymbols: null,
    numberLocale: "en-US",
    processStage: noLiveProcessStage,
    processStatus: "partial",
    tracked: null,
  });
  const portfolioModel = buildDashboardPortfolioOverviewModel({
    copy,
    executionStatus: { exec_connected: true, status: "ready" },
    executionStatusError: null,
    monitoredSymbols: { market_date: "2026-05-22", items: [] },
    monitoredSymbolsError: null,
    numberLocale: "en-US",
    portfolioState: "fully-synced",
    summary: null,
  });

  assert.equal(deciderModel.rows.length, 1);
  assert.equal(deciderModel.rows[0].symbol, "005930");
  assert.equal(portfolioModel.monitoringRows.length, 0);
  assert.equal(portfolioModel.accountHoldingRows.length, 0);
  assert.equal(portfolioModel.runtimeHoldingRows.length, 0);
  assert.equal(portfolioModel.monitoringStateLabel, "No exec-approved monitoring symbols returned for today.");
});

test("excludes rejected or expired runtime rows unless they are held", () => {
  const monitoredSymbols = {
    market_date: "2026-05-22",
    items: [
      {
        symbol: "004150",
        name: "Hansol Holdings",
        market: "KRX",
        monitoring_state: "watching_target_stop",
        exec_agent_approved: true,
        exec_monitoring_active: true,
        status: "expired",
        target_price: 76000,
        stop_loss_price: 70000,
      },
      {
        symbol: "033530",
        name: "Sejong Industrial",
        market: "KRX",
        monitoring_state: "idle",
        status: "rejected",
        held_position: true,
        position_quantity: 5,
        position_average_price: 9200,
      },
    ],
  } satisfies ExecutionRuntimeMonitoredSymbolsResponseDto;

  const model = buildDashboardPortfolioOverviewModel({
    copy,
    executionStatus: { exec_connected: true, status: "ready" },
    executionStatusError: null,
    monitoredSymbols,
    monitoredSymbolsError: null,
    numberLocale: "en-US",
    portfolioState: "fully-synced",
    summary: null,
  });

  assert.equal(model.monitoringRows.length, 0);
  assert.equal(model.accountHoldingRows.length, 0);
  assert.equal(model.runtimeHoldingRows.length, 1);
  assert.equal(model.runtimeHoldingRows[0].symbol, "033530");
  assert.deepEqual(model.runtimeHoldingRows[0].badges, ["Runtime held"]);
  assert.equal(model.runtimeHoldingRows[0].values.find((value) => value.key === "quantity")?.value, "5");
});

test("preserves portfolio summary fields while runtime timeouts keep row states operator-safe", () => {
  const runtimeStatusTimeout =
    "Timed out after 5.0s while loading /execution/runtime/status from trading-core.";
  const monitoredSymbolsTimeout =
    "Timed out after 5.0s while loading /execution/runtime/monitored-symbols?market_date=2026-05-22 from trading-core.";
  const summary = {
    sync: { status: "synced" },
    accounts: [
      {
        id: "account-1",
        label: "Primary",
        status: "synced",
        summary: {
          totalAssets: { amount: 1_000_000, currency: "KRW" },
          pnl: {},
        },
        holdings: [
          {
            symbol: "005930",
            name: "Samsung Electronics",
            quantity: 3,
          },
        ],
      },
    ],
  } satisfies PortfolioSummaryDto;
  const executionStatus = {
    exec_connected: true,
    status: "ready",
  } satisfies ExecutionRuntimeStatusResponseDto;

  const model = buildDashboardPortfolioOverviewModel({
    copy,
    executionStatus,
    executionStatusError: runtimeStatusTimeout,
    monitoredSymbols: null,
    monitoredSymbolsError: monitoredSymbolsTimeout,
    numberLocale: "en-US",
    portfolioState: "fully-synced",
    summary,
  });

  assert.equal(model.metrics.find((metric) => metric.key === "exec-connection")?.value, "Unavailable");
  assert.equal(model.metrics.find((metric) => metric.key === "exec-connection")?.tone, "warning");
  assert.equal(model.metrics.find((metric) => metric.key === "total-assets")?.value, "₩1,000,000");
  assert.equal(model.metrics.find((metric) => metric.key === "week-pnl")?.value, "Weekly P/L pending");
  assert.equal(model.metrics.find((metric) => metric.key === "account-holdings")?.value, "1 holding");
  assert.equal(model.contextLabel?.includes("Runtime data is delayed."), true);
  assert.equal(model.monitoringStateLabel, "Monitored symbols unavailable.");
  assert.equal(model.accountHoldingStateLabel, null);
  assert.equal(model.accountHoldingRows.length, 1);
  assert.equal(model.runtimeHoldingStateLabel, "Runtime held positions unavailable.");
  assert.deepEqual(model.diagnostics, [runtimeStatusTimeout, monitoredSymbolsTimeout]);
  assert.notEqual(model.monitoringStateLabel, "Monitoring list is updating.");
  assert.notEqual(model.runtimeHoldingStateLabel, "Monitoring list is updating.");
  assert.doesNotMatch(
    [
      model.contextLabel,
      model.monitoringStateLabel,
      model.accountHoldingStateLabel,
      model.runtimeHoldingStateLabel,
      ...model.metrics.map((metric) => metric.value),
    ]
      .filter(Boolean)
      .join("\n"),
    /Timed out after 5\.0s|trading-core|\/execution\/runtime\/(?:status|monitored-symbols)/,
  );
});

test("preserves a cached Exec safety warning when the latest status refresh times out", () => {
  const runtimeStatusTimeout =
    "Timed out after 5.0s while loading /execution/runtime/status from trading-core.";

  const model = buildDashboardPortfolioOverviewModel({
    copy,
    executionStatus: {
      exec_connected: true,
      paused: true,
      status: "paused",
    },
    executionStatusError: runtimeStatusTimeout,
    monitoredSymbols: { market_date: "2026-05-22", items: [] },
    monitoredSymbolsError: null,
    numberLocale: "en-US",
    portfolioState: "fully-synced",
    summary: null,
  });

  assert.equal(model.execConnectionLabel, "Automation paused");
  assert.equal(model.execConnectionTone, "warning");
  assert.equal(model.metrics.find((metric) => metric.key === "exec-connection")?.value, "Automation paused");
  assert.equal(model.metrics.find((metric) => metric.key === "exec-connection")?.tone, "warning");
});

test("marks portfolio runtime rows unavailable when status times out with an empty monitored-symbol payload", () => {
  const runtimeStatusTimeout =
    "Timed out after 5.0s while loading /execution/runtime/status from trading-core.";
  const monitoredSymbols = {
    market_date: "2026-05-22",
    items: [],
  } satisfies ExecutionRuntimeMonitoredSymbolsResponseDto;

  const model = buildDashboardPortfolioOverviewModel({
    copy,
    executionStatus: null,
    executionStatusError: runtimeStatusTimeout,
    monitoredSymbols,
    monitoredSymbolsError: null,
    numberLocale: "en-US",
    portfolioState: "upstream-unavailable",
    summary: null,
  });

  assert.equal(model.contextLabel?.includes("Runtime data is delayed."), true);
  assert.equal(model.monitoringRows.length, 0);
  assert.equal(model.runtimeHoldingRows.length, 0);
  assert.equal(model.monitoringStateLabel, "Monitored symbols unavailable.");
  assert.equal(model.runtimeHoldingStateLabel, "Runtime held positions unavailable.");
  assert.notEqual(model.monitoringStateLabel, "Monitoring list is updating.");
  assert.notEqual(model.runtimeHoldingStateLabel, "Monitoring list is updating.");
  assert.notEqual(model.monitoringStateLabel, "No exec-approved monitoring symbols returned for today.");
  assert.notEqual(model.runtimeHoldingStateLabel, "No runtime held positions returned.");
  assert.deepEqual(model.diagnostics, [runtimeStatusTimeout]);
});

test("uses Korean unavailable copy for portfolio runtime rows after runtime timeout", () => {
  const koreanCopy = getDashboardLiveCopy("ko");
  const runtimeStatusTimeout =
    "Timed out after 5.0s while loading /execution/runtime/status from trading-core.";
  const monitoredSymbols = {
    market_date: "2026-05-22",
    items: [],
  } satisfies ExecutionRuntimeMonitoredSymbolsResponseDto;

  const model = buildDashboardPortfolioOverviewModel({
    copy: koreanCopy,
    executionStatus: null,
    executionStatusError: runtimeStatusTimeout,
    monitoredSymbols,
    monitoredSymbolsError: null,
    numberLocale: "ko-KR",
    portfolioState: "upstream-unavailable",
    summary: null,
  });

  assert.equal(model.monitoringStateLabel, "모니터링 종목을 사용할 수 없습니다.");
  assert.equal(model.runtimeHoldingStateLabel, "런타임 보유 포지션을 사용할 수 없습니다.");
  assert.notEqual(model.monitoringStateLabel, "모니터링 목록을 불러오는 중입니다.");
  assert.notEqual(model.runtimeHoldingStateLabel, "모니터링 목록을 불러오는 중입니다.");
});

test("ships Korean operator copy for delayed runtime and missing day P/L states", () => {
  const koreanCopy = getDashboardLiveCopy("ko");

  assert.equal(copy.dashboardOverview.moreRows, "More");
  assert.equal(copy.dashboardOverview.accountHoldings, "Account portfolio holdings");
  assert.equal(copy.dashboardOverview.execApprovedMonitoring, "Exec-approved runtime monitoring");
  assert.equal(copy.dashboardOverview.accountHeld, "Account held");
  assert.equal(copy.dashboardOverview.runtimeHeld, "Runtime held");
  assert.equal(koreanCopy.dashboardOverview.moreRows, "더 보기");
  assert.equal(koreanCopy.dashboardOverview.accountHoldings, "계좌 포트폴리오 보유");
  assert.equal(koreanCopy.dashboardOverview.execApprovedMonitoring, "승인된 exec 런타임 모니터링");
  assert.equal(koreanCopy.dashboardOverview.accountHeld, "계좌 보유");
  assert.equal(koreanCopy.dashboardOverview.runtimeHeld, "런타임 보유");
  assert.equal(koreanCopy.dashboardOverview.monitoringListUpdating, "모니터링 목록을 불러오는 중입니다.");
  assert.equal(koreanCopy.dashboardOverview.noExecApprovedMonitoringRows, "오늘 승인된 exec 모니터링 종목이 없습니다.");
  assert.equal(koreanCopy.dashboardOverview.runtimeHeldPositions, "런타임 보유 포지션 모니터링");
  assert.equal(koreanCopy.portfolioState.openDetail, "계좌 포트폴리오 열기");
  assert.equal(koreanCopy.portfolioState.dayPnlPending, "주간 손익 집계 대기 중");
});
