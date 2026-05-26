import assert from "node:assert/strict";
import test from "node:test";

import { getDashboardLiveCopy } from "@/i18n/dashboard-live-copy";
import type {
  ExecutionRuntimeDailyBoardResponseDto,
  ExecutionRuntimeMonitoredSymbolsResponseDto,
  ExecutionRuntimeStatusResponseDto,
  PortfolioSummaryDto,
} from "@/types/trading-api";

import {
  buildDashboardDeciderOverviewModel,
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
    processStatus: "running",
    tracked,
  });

  assert.equal(model.mode, "market-open");
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
    processStatus: "partial",
    tracked: null,
  });

  assert.equal(model.mode, "closed-planned");
  assert.equal(model.statusLabel, "Today's plan");
  assert.equal(model.emptyLabel, null);
  assert.equal(model.rows.length, 2);
  assert.equal(model.rows[0].intentLabel, "Planned buy today");
  assert.equal(model.rows[1].intentLabel, "Planned sell today");
  assert.doesNotMatch([model.statusLabel, model.emptyLabel, model.contextLabel].filter(Boolean).join("\n"), /running|진행 중/i);
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
    processStatus: "completed",
    tracked: null,
  });

  assert.equal(model.mode, "closed-completed");
  assert.equal(model.rows.length, 1);
  assert.deepEqual(
    model.rows[0].prices.map((price) => [price.label, price.value]),
    [
      ["Stop-loss", "174,000"],
      ["Target", "184,000"],
      ["Close price", "179,500"],
    ],
  );
});

test("maps portfolio status, held positions, and same-day bought/sold execution rows honestly", () => {
  const summary = {
    sync: { status: "synced" },
    accounts: [
      {
        id: "account-1",
        label: "Primary",
        status: "synced",
        summary: {
          totalAssets: { amount: 1_000_000, currency: "KRW" },
          pnl: { day: { amount: 12_500, currency: "KRW" } },
        },
        holdings: [
          {
            symbol: "005930",
            name: "Samsung Electronics",
            quantity: 3,
          },
        ],
        recentActivity: [
          {
            id: "sell-activity",
            symbol: "035420",
            side: "sell",
            realizedPnl: { amount: 8_000, currency: "KRW" },
            updatedAt: "2026-05-22T12:10:00+09:00",
          },
        ],
      },
    ],
  } satisfies PortfolioSummaryDto;
  const board = {
    market_date: "2026-05-22",
    items: [
      {
        symbol: "005930",
        name: "Samsung Electronics",
        market: "KRX",
        status: "filled",
        intent: "buy",
        target_price: 76000,
        stop_loss_price: 70000,
        trade_price: 71500,
      },
      {
        symbol: "035420",
        name: "NAVER",
        market: "KRX",
        status: "filled",
        intent: "sell",
      },
    ],
  } satisfies ExecutionRuntimeDailyBoardResponseDto;
  const executionStatus = {
    exec_connected: true,
    status: "ready",
  } satisfies ExecutionRuntimeStatusResponseDto;

  const model = buildDashboardPortfolioOverviewModel({
    board,
    boardError: null,
    copy,
    executionStatus,
    executionStatusError: null,
    marketDate: "2026-05-22",
    numberLocale: "en-US",
    portfolioState: "fully-synced",
    summary,
  });

  assert.equal(model.metrics.find((metric) => metric.key === "exec-connection")?.value, "Connected");
  assert.equal(model.metrics.find((metric) => metric.key === "total-assets")?.value, "₩1,000,000");
  assert.equal(model.metrics.find((metric) => metric.key === "day-pnl")?.value, "₩12,500");
  assert.equal(model.metrics.find((metric) => metric.key === "held-positions")?.value, "1 holding");
  assert.equal(model.planRows.length, 0);
  assert.deepEqual(
    model.buyRows[0].values.map((value) => [value.label, value.value]),
    [
      ["Target", "76,000"],
      ["Stop-loss", "70,000"],
      ["Trade price", "71,500"],
    ],
  );
  assert.equal(model.sellRows[0].values[0].value, "₩8,000");
});

test("renders monitored-only portfolio board rows once as a trading plan", () => {
  const board = {
    market_date: "2026-05-22",
    items: [
      {
        symbol: "005930",
        name: "Samsung Electronics",
        market: "KRX",
        status: "partial",
        monitoring_state: "watching_target_stop",
        planned_intents: ["buy", "target_sell", "stop_sell"],
        target_price: 76000,
        stop_loss_price: 70000,
      },
    ],
  } satisfies ExecutionRuntimeDailyBoardResponseDto;

  const model = buildDashboardPortfolioOverviewModel({
    board,
    boardError: null,
    copy,
    executionStatus: { exec_connected: true, status: "ready" },
    executionStatusError: null,
    marketDate: "2026-05-22",
    numberLocale: "en-US",
    portfolioState: "fully-synced",
    summary: null,
  });

  assert.equal(model.buyRows.length, 0);
  assert.equal(model.sellRows.length, 0);
  assert.equal(model.buyStateLabel, null);
  assert.equal(model.sellStateLabel, null);
  assert.equal(model.planRows.length, 1);
  assert.equal(model.planRows[0].symbol, "005930");
  assert.deepEqual(
    model.planRows[0].values.map((value) => [value.label, value.value]),
    [
      ["Buy target", "Unavailable"],
      ["Sell target", "76,000"],
      ["Stop-loss", "70,000"],
    ],
  );
});

test("deduplicates planned portfolio board rows by symbol and merges plan fields", () => {
  const board = {
    market_date: "2026-05-22",
    items: [
      {
        symbol: "005930",
        name: "Samsung Electronics",
        market: "KRX",
        status: "scheduled",
        intent: "buy",
        planned_price: 71500,
        stop_loss_price: 70000,
      },
      {
        symbol: "005930",
        name: "Samsung Electronics",
        market: "KRX",
        status: "scheduled",
        intent: "sell",
        target_price: 76000,
      },
    ],
  } satisfies ExecutionRuntimeDailyBoardResponseDto;

  const model = buildDashboardPortfolioOverviewModel({
    board,
    boardError: null,
    copy,
    executionStatus: { exec_connected: true, status: "ready" },
    executionStatusError: null,
    marketDate: "2026-05-22",
    numberLocale: "en-US",
    portfolioState: "fully-synced",
    summary: null,
  });

  assert.equal(model.buyRows.length, 0);
  assert.equal(model.sellRows.length, 0);
  assert.equal(model.planRows.length, 1);
  assert.deepEqual(
    model.planRows[0].values.map((value) => [value.label, value.value]),
    [
      ["Buy target", "71,500"],
      ["Sell target", "76,000"],
      ["Stop-loss", "70,000"],
    ],
  );
});

test("does not treat zero-quantity partial rows as bought executions", () => {
  const board = {
    market_date: "2026-05-22",
    items: [
      {
        symbol: "000660",
        name: "SK hynix",
        market: "KRX",
        status: "partial",
        intent: "buy",
        filled_quantity: 0,
        planned_price: 179500,
        target_price: 184000,
        stop_loss_price: 174000,
      },
    ],
  } satisfies ExecutionRuntimeDailyBoardResponseDto;

  const model = buildDashboardPortfolioOverviewModel({
    board,
    boardError: null,
    copy,
    executionStatus: { exec_connected: true, status: "ready" },
    executionStatusError: null,
    marketDate: "2026-05-22",
    numberLocale: "en-US",
    portfolioState: "fully-synced",
    summary: null,
  });

  assert.equal(model.buyRows.length, 0);
  assert.equal(model.planRows.length, 1);
  assert.deepEqual(
    model.planRows[0].values.map((value) => [value.label, value.value]),
    [
      ["Buy target", "179,500"],
      ["Sell target", "184,000"],
      ["Stop-loss", "174,000"],
    ],
  );
});

test("keeps clear same-day buy and sell executions split even when the symbol repeats", () => {
  const board = {
    market_date: "2026-05-22",
    items: [
      {
        symbol: "005930",
        name: "Samsung Electronics",
        market: "KRX",
        status: "filled",
        intent: "buy",
        target_price: 76000,
        stop_loss_price: 70000,
        trade_price: 71500,
      },
      {
        symbol: "005930",
        name: "Samsung Electronics",
        market: "KRX",
        status: "filled",
        intent: "sell",
        realized_pnl: { amount: 8000, currency: "KRW" },
      },
    ],
  } satisfies ExecutionRuntimeDailyBoardResponseDto;

  const model = buildDashboardPortfolioOverviewModel({
    board,
    boardError: null,
    copy,
    executionStatus: { exec_connected: true, status: "ready" },
    executionStatusError: null,
    marketDate: "2026-05-22",
    numberLocale: "en-US",
    portfolioState: "fully-synced",
    summary: null,
  });

  assert.equal(model.planRows.length, 0);
  assert.equal(model.buyRows.length, 1);
  assert.equal(model.sellRows.length, 1);
  assert.equal(model.buyRows[0].symbol, "005930");
  assert.equal(model.sellRows[0].symbol, "005930");
  assert.equal(model.buyRows[0].values.find((value) => value.key === "trade")?.value, "71,500");
  assert.equal(model.sellRows[0].values.find((value) => value.key === "realized-pnl")?.value, "₩8,000");
});

test("preserves portfolio summary fields while daily-board timeout and missing day P/L stay operator-safe", () => {
  const rawTimeout =
    "Timed out after 5.0s while loading /execution/runtime/daily-board?market_date=2026-05-22 from trading-core.";
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
    board: null,
    boardError: rawTimeout,
    copy,
    executionStatus,
    executionStatusError: null,
    marketDate: "2026-05-22",
    numberLocale: "en-US",
    portfolioState: "fully-synced",
    summary,
  });

  assert.equal(model.metrics.find((metric) => metric.key === "exec-connection")?.value, "Connected");
  assert.equal(model.metrics.find((metric) => metric.key === "total-assets")?.value, "₩1,000,000");
  assert.equal(model.metrics.find((metric) => metric.key === "day-pnl")?.value, "Today P/L pending");
  assert.equal(model.metrics.find((metric) => metric.key === "held-positions")?.value, "1 holding");
  assert.equal(model.executionBoardStateLabel, "Today's execution board is updating.");
  assert.equal(model.buyStateLabel, null);
  assert.equal(model.sellStateLabel, null);
  assert.deepEqual(model.diagnostics, [rawTimeout]);
  assert.doesNotMatch(
    [
      model.contextLabel,
      model.executionBoardStateLabel,
      model.buyStateLabel,
      model.sellStateLabel,
      ...model.metrics.map((metric) => metric.value),
    ]
      .filter(Boolean)
      .join("\n"),
    /Timed out after 5\.0s|trading-core|\/execution\/runtime\/daily-board/,
  );
});

test("ships Korean operator copy for delayed runtime and missing day P/L states", () => {
  const koreanCopy = getDashboardLiveCopy("ko");

  assert.equal(copy.dashboardOverview.moreRows, "More");
  assert.equal(copy.dashboardOverview.monitoringPlan, "Monitoring plan");
  assert.equal(koreanCopy.dashboardOverview.moreRows, "더 보기");
  assert.equal(koreanCopy.dashboardOverview.monitoringPlan, "모니터링 계획");
  assert.equal(koreanCopy.dashboardOverview.monitoringListUpdating, "모니터링 목록을 불러오는 중입니다.");
  assert.equal(koreanCopy.dashboardOverview.executionBoardUpdating, "금일 매수/매도 내역을 갱신 중입니다.");
  assert.equal(koreanCopy.portfolioState.dayPnlPending, "금일 손익 집계 대기 중");
});
