import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPortfolioSectionStates,
  buildPortfolioMetricModels,
  classifyPortfolioSummaryFailure,
  formatPortfolioMoney,
  formatPortfolioPercent,
  getPortfolioActivity,
  getPortfolioHoldings,
  getPortfolioLastSyncedAt,
  getPortfolioNoticeMessages,
  getPortfolioSyncMessage,
  resolvePortfolioSummaryState,
} from "./portfolio-display";
import type { PortfolioSummaryDto } from "@/types/trading-api";

test("formats backend money display values before raw numeric fallbacks", () => {
  assert.equal(formatPortfolioMoney({ amount: 1000, currency: "KRW", display: "₩1,000 settled" }), "₩1,000 settled");
  assert.equal(formatPortfolioMoney({ amount: 12500000, currency: "KRW" }), "₩12,500,000");
  assert.equal(formatPortfolioMoney({ amount: 120.5, currency: "USD" }), "$120.50");
  assert.equal(formatPortfolioMoney({ amount: null, currency: "KRW" }), "Unavailable");
});

test("formats signed portfolio percentages with stable unavailable fallback", () => {
  assert.equal(formatPortfolioPercent(2.345), "+2.35%");
  assert.equal(formatPortfolioPercent(-0.8), "-0.80%");
  assert.equal(formatPortfolioPercent(null), "Unavailable");
});

test("builds multi-account summary metrics without assuming one account", () => {
  const summary: PortfolioSummaryDto = {
    accounts: [
      {
        id: "kis-main",
        label: "KIS Main",
        summary: {
          totalAssets: { amount: 10_000_000, currency: "KRW" },
          buyingPower: { amount: 2_500_000, currency: "KRW" },
          pnl: {
            day: { amount: 120_000, currency: "KRW" },
            unrealized: { amount: -80_000, currency: "KRW" },
          },
        },
      },
      {
        id: "kis-isa",
        label: "KIS ISA",
        summary: {
          totalEquity: { amount: 5_000_000, currency: "KRW" },
          cash: { amount: 1_000_000, currency: "KRW" },
          pnl: {
            day: { amount: 30_000, currency: "KRW" },
            total: { amount: 40_000, currency: "KRW" },
          },
        },
      },
    ],
  };

  const metrics = buildPortfolioMetricModels(summary);

  assert.equal(metrics.find((metric) => metric.id === "total-assets")?.value, "₩15,000,000");
  assert.equal(metrics.find((metric) => metric.id === "day-pnl")?.value, "₩150,000");
  assert.equal(metrics.find((metric) => metric.id === "day-pnl")?.tone, "positive");
  assert.equal(metrics.find((metric) => metric.id === "unrealized-pnl")?.value, "-₩40,000");
  assert.equal(metrics.find((metric) => metric.id === "unrealized-pnl")?.tone, "negative");
  assert.equal(metrics.find((metric) => metric.id === "cash-buying-power")?.value, "₩3,500,000");
});

test("keeps mixed-currency account totals explicit instead of summing them", () => {
  const metrics = buildPortfolioMetricModels({
    accounts: [
      { id: "kr", label: "KR", summary: { totalAssets: { amount: 1_000_000, currency: "KRW" } } },
      { id: "us", label: "US", summary: { totalAssets: { amount: 1000, currency: "USD" } } },
      { id: "us-isa", label: "US ISA", summary: { totalAssets: { amount: 500, currency: "USD" } } },
    ],
  });

  assert.equal(metrics.find((metric) => metric.id === "total-assets")?.value, "2 currencies");
});

test("uses the newest account sync timestamp when top-level sync times are missing", () => {
  assert.equal(
    getPortfolioLastSyncedAt({
      accounts: [
        { id: "old", label: "Old", lastSyncedAt: "2026-04-27T12:00:00.000Z" },
        { id: "new", label: "New", lastSyncedAt: "2026-04-28T03:00:00.000Z" },
        { id: "middle", label: "Middle", lastSyncedAt: "2026-04-28T01:00:00.000Z" },
      ],
    }),
    "2026-04-28T03:00:00.000Z",
  );
});

test("flattens holdings and recent activity from every account", () => {
  const summary: PortfolioSummaryDto = {
    accounts: [
      {
        id: "one",
        label: "One",
        holdings: [{ symbol: "005930" }],
        recentActivity: [{ id: "fill-1", symbol: "005930", status: "filled" }],
      },
      {
        id: "two",
        label: "Two",
        holdings: [{ symbol: "000660" }],
        recentActivity: [{ id: "order-2", symbol: "000660", status: "submitted" }],
      },
    ],
  };

  assert.deepEqual(getPortfolioHoldings(summary).map((holding) => holding.symbol), ["005930", "000660"]);
  assert.deepEqual(getPortfolioActivity(summary).map((item) => item.id), ["fill-1", "order-2"]);
});

test("distinguishes portfolio summary loading, connectivity, empty, stale, partial, and synced states", () => {
  assert.equal(resolvePortfolioSummaryState({ loading: true, summary: null }), "loading");
  assert.equal(
    resolvePortfolioSummaryState({ error: "HTTP 404", failureKind: "endpoint-pending", summary: null }),
    "endpoint-pending",
  );
  assert.equal(
    resolvePortfolioSummaryState({ error: "TRADING_API_UPSTREAM_BASE_URL missing", failureKind: "not-configured", summary: null }),
    "not-configured",
  );
  assert.equal(
    resolvePortfolioSummaryState({
      summary: {
        sync: { status: "synced" },
        accounts: [{ id: "empty-account", label: "Empty Account", holdings: [] }],
      },
    }),
    "connected-empty",
  );
  assert.equal(
    resolvePortfolioSummaryState({
      summary: {
        sync: { status: "stale", message: "KIS balance sync is older than the latest market session." },
        accounts: [
          {
            id: "stale-account",
            label: "Stale Account",
            holdings: [{ symbol: "005930" }],
          },
        ],
      },
    }),
    "stale-sync",
  );
  assert.equal(
    resolvePortfolioSummaryState({
      summary: {
        sync: { status: "partial", message: "Holdings are delayed." },
        accounts: [
          {
            id: "partial-account",
            label: "Partial Account",
            holdings: [{ symbol: "005930" }],
          },
        ],
      },
    }),
    "partial-data",
  );
  assert.equal(
    resolvePortfolioSummaryState({
      summary: {
        sync: { status: "synced" },
        accounts: [
          {
            id: "ready-account",
            label: "Ready Account",
            holdings: [{ symbol: "005930" }],
          },
        ],
      },
    }),
    "fully-synced",
  );
});

test("preserves fetch failure state when a cached portfolio summary remains available", () => {
  const cachedEmptySummary: PortfolioSummaryDto = {
    sync: { status: "synced" },
    accounts: [{ id: "cached-empty", label: "Cached Empty", holdings: [] }],
  };
  const cachedSyncedSummary: PortfolioSummaryDto = {
    sync: { status: "synced" },
    accounts: [{ id: "cached-ready", label: "Cached Ready", holdings: [{ symbol: "005930" }] }],
  };

  assert.equal(
    resolvePortfolioSummaryState({
      error: "TRADING_API_UPSTREAM_BASE_URL is required for deployed trading proxy requests.",
      failureKind: "not-configured",
      summary: cachedEmptySummary,
    }),
    "not-configured",
  );
  assert.equal(
    resolvePortfolioSummaryState({
      error: "connect ECONNREFUSED",
      failureKind: "upstream-unavailable",
      summary: cachedSyncedSummary,
    }),
    "upstream-unavailable",
  );
  assert.equal(
    resolvePortfolioSummaryState({
      error: "Portfolio response did not match the expected shape.",
      failureKind: "invalid-response",
      summary: cachedSyncedSummary,
    }),
    "invalid-response",
  );
  assert.equal(
    resolvePortfolioSummaryState({
      error: "Network request failed",
      summary: cachedSyncedSummary,
    }),
    "upstream-unavailable",
  );
});

test("classifies portfolio summary fetch failures without flattening every failure into unavailable", () => {
  assert.equal(classifyPortfolioSummaryFailure({ status: 404, message: "not implemented" }), "endpoint-pending");
  assert.equal(
    classifyPortfolioSummaryFailure({
      status: 500,
      message: "TRADING_API_UPSTREAM_BASE_URL is required for deployed trading proxy requests.",
    }),
    "not-configured",
  );
  assert.equal(classifyPortfolioSummaryFailure({ status: 502, message: "connect ECONNREFUSED" }), "upstream-unavailable");
});

test("builds section-level states from the returned portfolio payload", () => {
  assert.deepEqual(
    buildPortfolioSectionStates(
      {
        sync: { status: "synced" },
        accounts: [
          {
            id: "cash-only",
            label: "Cash Only",
            holdings: [],
            summary: {
              cash: { amount: 1_000_000, currency: "KRW" },
              totalAssets: { amount: 1_000_000, currency: "KRW" },
            },
          },
        ],
      },
      "connected-empty",
    ),
    {
      "hero-metrics": "partial-data",
      accounts: "fully-synced",
      holdings: "empty",
      allocation: "empty",
      activity: "empty",
    },
  );

  assert.deepEqual(
    buildPortfolioSectionStates(
      {
        sync: { status: "partial" },
        accounts: [
          {
            id: "partial",
            label: "Partial",
            summary: {
              totalAssets: { amount: 1_000_000, currency: "KRW" },
            },
          },
        ],
      },
      "partial-data",
    ),
    {
      "hero-metrics": "partial-data",
      accounts: "partial-data",
      holdings: "partial-data",
      allocation: "partial-data",
      activity: "partial-data",
    },
  );
});

test("surfaces sync messages before notice fallbacks", () => {
  assert.equal(
    getPortfolioSyncMessage({
      sync: { message: "Account sync is stale." },
      notices: ["Notice fallback"],
    }),
    "Account sync is stale.",
  );
  assert.equal(getPortfolioSyncMessage({ notices: ["Notice fallback"] }), "Notice fallback");
});

test("keeps notice fallback messages visible when no sync banner renders them", () => {
  const summary: PortfolioSummaryDto = {
    sync: { status: "synced" },
    accounts: [
      {
        id: "ready-account",
        label: "Ready Account",
        holdings: [{ symbol: "005930" }],
      },
    ],
    notices: ["Account API returned cached balances.", "Tax lots are still pending."],
  };

  assert.equal(getPortfolioSyncMessage(summary), "Account API returned cached balances.");
  assert.deepEqual(getPortfolioNoticeMessages(summary, "ready"), [
    "Account API returned cached balances.",
    "Tax lots are still pending.",
  ]);
  assert.deepEqual(getPortfolioNoticeMessages({ ...summary, accounts: [] }, "connected-empty"), [
    "Account API returned cached balances.",
    "Tax lots are still pending.",
  ]);
});

test("suppresses only the notice actually rendered in the degraded sync banner", () => {
  const summary: PortfolioSummaryDto = {
    sync: { status: "stale" },
    accounts: [
      {
        id: "stale-account",
        label: "Stale Account",
        status: "stale",
        holdings: [{ symbol: "005930" }],
      },
    ],
    notices: [
      "KIS balance sync is older than the latest market session.",
      "Tax lots are still pending.",
      "KIS balance sync is older than the latest market session.",
    ],
  };

  assert.equal(getPortfolioSyncMessage(summary), "KIS balance sync is older than the latest market session.");
  assert.deepEqual(getPortfolioNoticeMessages(summary, "stale-sync"), [
    "Tax lots are still pending.",
    "KIS balance sync is older than the latest market session.",
  ]);
});
