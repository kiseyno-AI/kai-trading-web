import assert from "node:assert/strict";
import test from "node:test";

import { getDashboardLiveCopy } from "@/i18n/dashboard-live-copy";
import type { EodFreshnessStageDto } from "@/types/trading-api";

import {
  buildPiotroskiFilteringCardModel,
  buildTrackedSymbolCardModel,
  getFundamentalsStageStatusLabel,
} from "./live-dashboard-derived-state";

function buildStage(status: string): EodFreshnessStageDto {
  return {
    status,
    symbols_total: 3583,
    symbols_succeeded: 1,
    symbols_failed: 0,
  };
}

test("marks stale latest fundamentals coverage as not synced on an active trading day", () => {
  assert.equal(
    getFundamentalsStageStatusLabel(buildStage("ready"), "2026-04-21", "2026-04-18", false),
    "not synced",
  );
});

test("keeps stale fundamentals coverage in break-day state when the market is closed", () => {
  assert.equal(
    getFundamentalsStageStatusLabel(buildStage("ready"), "2026-04-21", "2026-04-18", true),
    "break day",
  );
});

test("keeps same-day fundamentals coverage synced", () => {
  assert.equal(
    getFundamentalsStageStatusLabel(buildStage("ready"), "2026-04-21", "2026-04-21", false),
    "synced",
  );
});

test("builds the Piotroski filtering card with the resolved latest-available note", () => {
  const copy = getDashboardLiveCopy("en");
  const model = buildPiotroskiFilteringCardModel({
    copy,
    numberLocale: "en-US",
    piotroskiBoard: {
      marketDate: "2026-04-18",
      requestedMarketDate: "2026-04-21",
      resolvedMarketDate: "2026-04-18",
      isLatestFallback: true,
      totalPassedCount: 14,
      summary: {
        entries: 3200,
        requested_symbol: null,
        matched_symbols: [],
        missing_symbols: [],
        passed_count: 14,
        not_passed_count: 3186,
      },
      items: [],
    },
    piotroskiBoardError: null,
    piotroskiBoardLoadState: "ready",
    piotroskiMarketDate: "2026-04-21",
  });

  assert.equal(model.displayMarketDate, "2026-04-18");
  assert.equal(model.displayMarketDateLabel, "2026-04-18");
  assert.equal(model.statusTone, "positive");
  assert.equal(model.statusLabel, copy.piotroski.completed);
  assert.equal(model.checkedCountLabel, "3,200");
  assert.equal(model.passCountLabel, "14");
  assert.equal(
    model.note,
    `${copy.piotroski.requestedDate} 2026-04-21 · ${copy.piotroski.latestAvailableDate} 2026-04-18`,
  );
});

test("builds tracked symbol cards from stable display values without raw DTO fallback logic in the view", () => {
  const copy = getDashboardLiveCopy("en");
  const model = buildTrackedSymbolCardModel(
    {
      symbol: "005930",
      price: null,
      change: null,
      change_pct: null,
      volume: null,
      turnover: null,
      as_of: null,
      market_state: "CLOSED",
      source: "db_cache",
      fallback: true,
      is_live: false,
      available: false,
      trade_date: "2026-04-18",
      unavailable_reason: "Quote cache waiting for confirmation",
    },
    {
      symbol: "005930",
      name_ko: "Samsung Electronics",
    },
    {
      technical: {
        latest_date: "2026-04-18",
      },
    },
    copy,
    "en-US",
  );

  assert.equal(model.companyName, "Samsung Electronics");
  assert.equal(model.href, "/dashboard/symbol/005930?name=Samsung+Electronics");
  assert.equal(model.availabilityLabel, copy.tracked.unavailable);
  assert.equal(model.availabilityTone, "warning");
  assert.equal(model.priceLabel, "N/A");
  assert.equal(model.changeLabel, "Quote cache waiting for confirmation");
  assert.equal(model.changeTone, null);
  assert.equal(model.priceFreshnessLabel, "2026-04-18");
  assert.equal(model.technicalFreshnessLabel, "2026-04-18");
  assert.equal(
    model.sourceLabel,
    `${copy.tracked.quoteUnavailable} · Quote cache waiting for confirmation`,
  );
  assert.equal(model.turnoverLabel, `${copy.operational.turnover} -`);
});
