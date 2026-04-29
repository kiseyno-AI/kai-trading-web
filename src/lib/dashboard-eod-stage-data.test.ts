import assert from "node:assert/strict";
import test from "node:test";

import type {
  DartFundamentalsDailyInspectResponseDto,
  EodFreshnessResponseDto,
  EodPipelineStageDto,
} from "@/types/trading-api";

import {
  getFundamentalsStageDisplayCounts,
  getLatestAvailableFundamentalsCoverage,
  shouldUseTodayFundamentalsStageData,
} from "./dashboard-eod-stage-data";

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

function buildPipelineStage(status: string): EodPipelineStageDto {
  return {
    status,
    processed: null,
    total: null,
    failed: null,
  };
}

test("prefers latest available fundamentals coverage over a newer partial run", () => {
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

test("falls back to a newer completed latest run when freshness latest coverage lags", () => {
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

test("keeps today-stage behavior when the fundamentals pipeline is actively running", () => {
  const freshness = buildFreshnessResponse();

  assert.equal(
    shouldUseTodayFundamentalsStageData(freshness, { latest_run: null, runs: [] }, buildPipelineStage("running")),
    true,
  );
});

test("uses the running fundamentals latest-run counters while the current refresh is in flight", () => {
  const freshness = buildFreshnessResponse();
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

  assert.deepEqual(
    getFundamentalsStageDisplayCounts(freshness, fundamentalsStatus, freshness.today?.fundamentals, false),
    {
      symbolsTotal: 3583,
      symbolsChecked: 1180,
      symbolsFailed: 3,
    },
  );
});

test("prefers the active today current_run over a stale completed latest_run for fundamentals counts", () => {
  const freshness: EodFreshnessResponseDto = {
    today: {
      trade_date: "2026-04-21",
      fundamentals: {
        status: "running",
        symbols_total: 0,
        symbols_succeeded: 0,
        symbols_failed: 0,
        current_run: {
          status: "running",
          symbols_total: 3583,
          symbols_checked: 1210,
          symbols_refreshed: 1180,
          symbols_failed: 3,
        },
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
  const fundamentalsStatus: DartFundamentalsDailyInspectResponseDto = {
    latest_run: {
      id: 24,
      market_date: "2026-04-20",
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
      symbols_refreshed: 0,
      symbols_failed: 0,
      events_detected: 0,
      events_captured: 0,
      events_failed: 0,
      error_message: null,
      run_metadata: {},
      started_at: "2026-04-20T09:00:00+09:00",
      completed_at: "2026-04-20T10:00:00+09:00",
    },
    runs: [],
  };

  assert.equal(
    shouldUseTodayFundamentalsStageData(freshness, fundamentalsStatus, buildPipelineStage("completed")),
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
