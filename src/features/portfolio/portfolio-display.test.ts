import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPortfolioMetricModels,
  formatPortfolioMoney,
  formatPortfolioPercent,
  getPortfolioActivity,
  getPortfolioHoldings,
  getPortfolioLastSyncedAt,
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
