import assert from "node:assert/strict";
import test from "node:test";

import {
  getFundamentalsStageDisplayCounts,
  getLatestAvailableFundamentalsCoverage,
  shouldUseTodayFundamentalsStageData,
  shouldUseTodayStageData,
} from "@/lib/dashboard-eod-stage-data";
import { getDashboardLiveCopy } from "@/i18n/dashboard-live-copy";
import type {
  DartFundamentalsDailyInspectResponseDto,
  EodFreshnessResponseDto,
  EodFreshnessStageDto,
  EodPipelineStageDto,
} from "@/types/trading-api";

import {
  buildEodStageCard,
  getFundamentalsStageStatusLabel,
  isBreakDayMarket,
} from "./live-dashboard-derived-state";

function buildFreshnessResponse(): EodFreshnessResponseDto {
  return {
    today: {
      trade_date: "2026-04-21",
      fundamentals: {
        status: "ready",
        symbols_total: 3583,
        symbols_succeeded: 0,
        symbols_failed: 0,
      },
    },
    latest: {
      stage_details: {
        fundamentals: {
          market_date: "2026-04-18",
          status: "completed",
          symbols_total: 3583,
          symbols_checked: 1,
          symbols_failed: 0,
        },
      },
    },
    fundamentals: {
      success: true,
      latest_date: "2026-04-18",
    },
  };
}

function buildStage(status: string): EodFreshnessStageDto {
  return {
    status,
    symbols_total: 3583,
    symbols_succeeded: 1,
    symbols_failed: 0,
  };
}

function buildPipelineStage(status: string, overrides: Partial<EodPipelineStageDto> = {}): EodPipelineStageDto {
  return {
    status,
    processed: null,
    total: null,
    failed: null,
    ...overrides,
  };
}

test("TC-DASH-001 latest-vs-today stage selection prefers latest coverage unless today still matches or latest is absent", () => {
  const idlePipelineStage = buildPipelineStage("completed");

  assert.equal(shouldUseTodayStageData("2026-04-21", "2026-04-18", idlePipelineStage), false);
  assert.equal(shouldUseTodayStageData("2026-04-21", "2026-04-21", idlePipelineStage), true);
  assert.equal(shouldUseTodayStageData("2026-04-21", null, idlePipelineStage), true);
});

test("TC-DASH-002 running override keeps today-stage semantics and preserves the running badge metadata", () => {
  const copy = getDashboardLiveCopy("en");
  const runningPipelineStage = buildPipelineStage("running", {
    current_step: "price_collection",
    current_activity: "sync_symbols",
    current_symbol: "005930",
    processed: 120,
    total: 3583,
    failed: 3,
  });

  assert.equal(shouldUseTodayStageData("2026-04-21", "2026-04-18", runningPipelineStage), true);

  const card = buildEodStageCard(
    "price",
    copy.stage.price,
    buildStage("running"),
    "2026-04-21",
    "2026-04-18",
    "2026-04-18",
    "2026-04-18",
    false,
    runningPipelineStage,
    copy,
    "en-US",
  );

  assert.equal(card.statusLabel, "running");
  assert.equal(card.statusBadgeLabel, "Price Collection");
  assert.equal(card.statusBadgeTitle, "Price Collection · Sync Symbols · Symbol 005930");
  assert.equal(card.tone, "info");
});

test("TC-DASH-003 weekend and market-break semantics only surface break day when the market context supports it", () => {
  const copy = getDashboardLiveCopy("en");

  assert.equal(
    isBreakDayMarket({
      state: "CLOSED",
      is_open: false,
      is_trading_day: null,
      server_time: "2026-04-18T09:00:00+09:00",
    }),
    true,
  );
  assert.equal(
    isBreakDayMarket({
      state: "MAINTENANCE",
      is_open: false,
      is_trading_day: null,
      reason: "Weekend batch window",
    }),
    true,
  );
  assert.equal(
    isBreakDayMarket({
      state: "CLOSED",
      is_open: false,
      is_trading_day: null,
      server_time: "2026-04-20T09:00:00+09:00",
    }),
    false,
  );

  const card = buildEodStageCard(
    "price",
    copy.stage.price,
    buildStage("ready"),
    "2026-04-21",
    "2026-04-18",
    "2026-04-18",
    "2026-04-18",
    true,
    buildPipelineStage("completed"),
    copy,
    "en-US",
  );

  assert.equal(card.statusLabel, "break day");
  assert.equal(card.tone, "neutral");
  assert.equal(card.details.find((item) => item.key === "latest-date"), undefined);
});

test("TC-DASH-004 fundamentals stale-ready labels stay not-synced on active days and break-day on market breaks", () => {
  const stage = buildStage("ready");

  assert.equal(getFundamentalsStageStatusLabel(stage, "2026-04-21", "2026-04-18", false), "not synced");
  assert.equal(getFundamentalsStageStatusLabel(stage, "2026-04-21", "2026-04-18", true), "break day");
  assert.equal(getFundamentalsStageStatusLabel(stage, "2026-04-21", "2026-04-21", false), "synced");
});

test("TC-DASH-005 fundamentals latest-available coverage prefers freshness latest over a newer partial run", () => {
  const freshness = buildFreshnessResponse();
  const fundamentalsStatus: DartFundamentalsDailyInspectResponseDto = {
    latest_run: {
      id: 21,
      market_date: "2026-04-21",
      trigger: "internal_ops_cli",
      status: "partial",
      fs_div: "CFS",
      force: false,
      symbol_limit: null,
      symbol_offset: 0,
      symbols_total: 3583,
      symbols_checked: 0,
      symbols_missing: 0,
      symbols_stale: 0,
      symbols_fresh: 0,
      symbols_refreshed: 0,
      symbols_failed: 1406,
      events_detected: 0,
      events_captured: 0,
      events_failed: 0,
      error_message: null,
      run_metadata: {},
      started_at: "2026-04-21T08:56:58+09:00",
      completed_at: "2026-04-21T09:11:08+09:00",
    },
    runs: [],
  };

  assert.deepEqual(getLatestAvailableFundamentalsCoverage(freshness, fundamentalsStatus), {
    tradeDate: "2026-04-18",
    status: "completed",
    symbolsTotal: 3583,
    symbolsChecked: 1,
    symbolsFailed: 0,
    source: "freshness_latest",
  });
  assert.deepEqual(
    getFundamentalsStageDisplayCounts(freshness, fundamentalsStatus, freshness.today?.fundamentals, false),
    {
      symbolsTotal: 3583,
      symbolsChecked: 1,
      symbolsFailed: 0,
    },
  );
  assert.equal(
    shouldUseTodayFundamentalsStageData(freshness, fundamentalsStatus, buildPipelineStage("completed")),
    false,
  );
});

test("TC-DASH-006 a newer completed fundamentals run becomes the latest available coverage when it outruns freshness latest", () => {
  const freshness = buildFreshnessResponse();
  const fundamentalsStatus: DartFundamentalsDailyInspectResponseDto = {
    latest_run: {
      id: 22,
      market_date: "2026-04-21",
      trigger: "internal_ops_cli",
      status: "completed",
      fs_div: "CFS",
      force: false,
      symbol_limit: null,
      symbol_offset: 0,
      symbols_total: 3583,
      symbols_checked: 42,
      symbols_missing: 0,
      symbols_stale: 0,
      symbols_fresh: 42,
      symbols_refreshed: 42,
      symbols_failed: 0,
      events_detected: 0,
      events_captured: 0,
      events_failed: 0,
      error_message: null,
      run_metadata: {},
      started_at: "2026-04-21T16:00:00+09:00",
      completed_at: "2026-04-21T16:40:00+09:00",
    },
    runs: [],
  };

  assert.deepEqual(getLatestAvailableFundamentalsCoverage(freshness, fundamentalsStatus), {
    tradeDate: "2026-04-21",
    status: "completed",
    symbolsTotal: 3583,
    symbolsChecked: 42,
    symbolsFailed: 0,
    source: "latest_run",
  });
});

test("TC-DASH-007 running fundamentals refresh keeps today-stage mode and in-flight counters while no latest coverage exists", () => {
  const freshness: EodFreshnessResponseDto = {
    today: {
      trade_date: "2026-04-21",
      fundamentals: {
        status: "running",
        symbols_total: 3583,
        symbols_succeeded: 1210,
        symbols_failed: 3,
      },
    },
    latest: {},
    fundamentals: {
      success: false,
      latest_date: null,
    },
  };
  const fundamentalsStatus: DartFundamentalsDailyInspectResponseDto = {
    latest_run: {
      id: 23,
      market_date: "2026-04-21",
      trigger: "internal_ops_cli",
      status: "running",
      fs_div: "CFS",
      force: false,
      symbol_limit: null,
      symbol_offset: 0,
      symbols_total: 3583,
      symbols_checked: 1210,
      symbols_missing: 0,
      symbols_stale: 0,
      symbols_fresh: 1205,
      symbols_refreshed: 1180,
      symbols_failed: 3,
      events_detected: 0,
      events_captured: 0,
      events_failed: 0,
      error_message: null,
      run_metadata: {},
      started_at: "2026-04-21T09:00:00+09:00",
      completed_at: null,
    },
    runs: [],
  };

  assert.equal(
    shouldUseTodayFundamentalsStageData(freshness, fundamentalsStatus, buildPipelineStage("running")),
    true,
  );
  assert.deepEqual(
    getFundamentalsStageDisplayCounts(freshness, fundamentalsStatus, freshness.today?.fundamentals, true),
    {
      symbolsTotal: 3583,
      symbolsChecked: 1180,
      symbolsFailed: 3,
    },
  );
});
