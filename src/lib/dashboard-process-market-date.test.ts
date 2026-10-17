import assert from "node:assert/strict";
import test from "node:test";

import type {
  EodFreshnessResponseDto,
  EodPipelineStatusResponseDto,
} from "@/types/trading-api";

import {
  getDashboardExecutionRuntimeMarketDate,
  getDashboardLatestCompletedPipelineMarketDate,
  getDashboardProcessResolvedMarketDate,
  resolveDashboardProcessPipelineStatus,
  shouldRequestLatestCompletedPipelineStatus,
} from "./dashboard-process-market-date";

function buildPipelineStatus(overrides: Partial<EodPipelineStatusResponseDto> = {}): EodPipelineStatusResponseDto {
  return {
    market_date: "2026-04-30",
    fs_div: "CFS",
    status: "pending",
    stage_order: ["price_collection", "technical_snapshots", "action_summaries", "fundamentals_daily_refresh"],
    stages: {},
    ...overrides,
  };
}

const liveRolloverFreshness: EodFreshnessResponseDto = {
  today: {
    trade_date: "2026-04-30",
    technical_analysis: {
      status: "missing",
      symbols_total: 2812,
      symbols_succeeded: 0,
      symbols_failed: 0,
    },
    action_summary: {
      status: "missing",
      symbols_total: 2812,
      symbols_succeeded: 0,
      symbols_failed: 0,
    },
  },
  latest: {
    trade_date: "2026-04-29",
    technical_market_date: "2026-04-29",
    action_market_date: "2026-04-29",
  },
};

const weekendRolloverFreshness: EodFreshnessResponseDto = {
  today: {
    trade_date: "2026-10-18",
    technical_analysis: {
      status: "missing",
      symbols_total: 2676,
      symbols_succeeded: 0,
      symbols_failed: 0,
    },
    action_summary: {
      status: "missing",
      symbols_total: 2676,
      symbols_succeeded: 0,
      symbols_failed: 0,
    },
  },
  latest: {
    trade_date: "2026-10-16",
    technical_market_date: "2026-10-16",
    action_market_date: "2026-10-16",
  },
};

function buildWeekendPartialPipelineStatus() {
  return {
    ...buildPipelineStatus({
      market_date: "2026-10-18",
      status: "partial",
      stage_order: [
        "master_refresh",
        "pykrx_universe_refresh",
        "price_collection",
        "technical_snapshots",
        "action_summaries",
        "macro_context_refresh",
      ],
      stages: {
        master_refresh: { status: "skipped", processed: 0, total: 0, failed: 0 },
        pykrx_universe_refresh: { status: "skipped", processed: 0, total: 0, failed: 0 },
        price_collection: { status: "pending", processed: 0, total: 0, failed: 0 },
        technical_snapshots: { status: "pending", processed: 0, total: 0, failed: 0 },
        action_summaries: { status: "pending", processed: 0, total: 0, failed: 0 },
        macro_context_refresh: {
          status: "completed",
          processed: 3,
          total: 3,
          failed: 0,
        },
      },
      total_stages: 26,
      completed_stages: 1,
      display_completed_stages: 3,
      partial_stages: 0,
      failed_stages: 0,
      blocked_stages: 0,
      running_stages: 0,
      pending_stages: 23,
      current_stage: "price_collection",
      current_stage_status: "pending",
    }),
    market_session: {
      requested_date: "2026-10-18",
      latest_valid_trading_date: "2026-10-16",
      is_trading_day: false,
      requested_date_is_trading_day: false,
      status: "weekend",
      recommendation_basis: "latest_completed_eod",
    },
  };
}

function buildFridayCompletedPipelineStatus() {
  return buildPipelineStatus({
    market_date: "2026-10-16",
    status: "completed",
    stages: {
      technical_snapshots: { status: "completed", processed: 2676, total: 2676, failed: 0 },
      action_summaries: { status: "completed", processed: 2676, total: 2676, failed: 0 },
    },
  });
}

test("uses the latest completed pipeline when the requested current-day pipeline is only pending", () => {
  const currentPipelineStatus = buildPipelineStatus({
    market_date: "2026-04-30",
    status: "pending",
    stages: {
      technical_snapshots: { status: "pending", processed: 0, total: 4455, failed: 0 },
      action_summaries: { status: "pending", processed: 0, total: 4455, failed: 0 },
    },
  });
  const latestCompletedPipelineStatus = buildPipelineStatus({
    market_date: "2026-04-29",
    status: "completed",
    stages: {
      technical_snapshots: { status: "completed", processed: 2812, total: 2812, failed: 0 },
      action_summaries: { status: "completed", processed: 2812, total: 2812, failed: 0 },
    },
  });

  assert.equal(
    getDashboardLatestCompletedPipelineMarketDate(liveRolloverFreshness, "2026-04-30"),
    "2026-04-29",
  );
  assert.equal(
    shouldRequestLatestCompletedPipelineStatus({
      currentPipelineStatus,
      freshness: liveRolloverFreshness,
      requestMarketDate: "2026-04-30",
    }),
    true,
  );

  const effectivePipelineStatus = resolveDashboardProcessPipelineStatus({
    currentPipelineStatus,
    freshness: liveRolloverFreshness,
    latestCompletedPipelineStatus,
    requestMarketDate: "2026-04-30",
  });

  assert.equal(effectivePipelineStatus, latestCompletedPipelineStatus);
  assert.equal(getDashboardProcessResolvedMarketDate(effectivePipelineStatus, "2026-04-30"), "2026-04-29");
});

test("keeps explicit current-run pipeline failures ahead of latest completed state", () => {
  const failedCurrentPipelineStatus = buildPipelineStatus({
    market_date: "2026-04-30",
    status: "failed",
    stages: {
      technical_snapshots: { status: "failed", processed: 12, total: 4455, failed: 12 },
      action_summaries: { status: "pending", processed: 0, total: 4455, failed: 0 },
    },
  });
  const latestCompletedPipelineStatus = buildPipelineStatus({
    market_date: "2026-04-29",
    status: "completed",
    stages: {
      technical_snapshots: { status: "completed", processed: 2812, total: 2812, failed: 0 },
      action_summaries: { status: "completed", processed: 2812, total: 2812, failed: 0 },
    },
  });

  assert.equal(
    shouldRequestLatestCompletedPipelineStatus({
      currentPipelineStatus: failedCurrentPipelineStatus,
      freshness: liveRolloverFreshness,
      requestMarketDate: "2026-04-30",
    }),
    false,
  );
  assert.equal(
    resolveDashboardProcessPipelineStatus({
      currentPipelineStatus: failedCurrentPipelineStatus,
      freshness: liveRolloverFreshness,
      latestCompletedPipelineStatus,
      requestMarketDate: "2026-04-30",
    }),
    failedCurrentPipelineStatus,
  );
});

test("does not use a latest pipeline response unless it is completed for the freshness latest date", () => {
  const currentPipelineStatus = buildPipelineStatus({
    market_date: "2026-04-30",
    status: "pending",
  });
  const wrongDateCompletedPipelineStatus = buildPipelineStatus({
    market_date: "2026-04-28",
    status: "completed",
  });
  const pendingLatestPipelineStatus = buildPipelineStatus({
    market_date: "2026-04-29",
    status: "pending",
  });

  assert.equal(
    resolveDashboardProcessPipelineStatus({
      currentPipelineStatus,
      freshness: liveRolloverFreshness,
      latestCompletedPipelineStatus: wrongDateCompletedPipelineStatus,
      requestMarketDate: "2026-04-30",
    }),
    currentPipelineStatus,
  );
  assert.equal(
    resolveDashboardProcessPipelineStatus({
      currentPipelineStatus,
      freshness: liveRolloverFreshness,
      latestCompletedPipelineStatus: pendingLatestPipelineStatus,
      requestMarketDate: "2026-04-30",
    }),
    currentPipelineStatus,
  );
});

test("uses Friday's completed pipeline when a weekend partial only completed macro context", () => {
  const currentPipelineStatus = buildWeekendPartialPipelineStatus();
  const latestCompletedPipelineStatus = buildFridayCompletedPipelineStatus();

  assert.equal(
    shouldRequestLatestCompletedPipelineStatus({
      currentPipelineStatus,
      freshness: weekendRolloverFreshness,
      requestMarketDate: "2026-10-18",
    }),
    true,
  );

  const effectivePipelineStatus = resolveDashboardProcessPipelineStatus({
    currentPipelineStatus,
    freshness: weekendRolloverFreshness,
    latestCompletedPipelineStatus,
    requestMarketDate: "2026-10-18",
  });

  assert.equal(effectivePipelineStatus, latestCompletedPipelineStatus);
  assert.equal(getDashboardProcessResolvedMarketDate(effectivePipelineStatus, "2026-10-18"), "2026-10-16");
});

test("keeps an active trading-day partial pipeline ahead of the latest completed state", () => {
  const currentPipelineStatus = {
    ...buildPipelineStatus({
      market_date: "2026-10-19",
      status: "partial",
      stages: {
        price_collection: { status: "completed", processed: 2676, total: 2676, failed: 0 },
        technical_snapshots: { status: "running", processed: 1200, total: 2676, failed: 0 },
        action_summaries: { status: "pending", processed: 0, total: 2676, failed: 0 },
      },
    }),
    market_session: {
      requested_date: "2026-10-19",
      latest_valid_trading_date: "2026-10-19",
      is_trading_day: true,
      requested_date_is_trading_day: true,
      status: "closed",
      recommendation_basis: "latest_completed_eod",
    },
  };

  assert.equal(
    shouldRequestLatestCompletedPipelineStatus({
      currentPipelineStatus,
      freshness: weekendRolloverFreshness,
      requestMarketDate: "2026-10-19",
    }),
    false,
  );
  assert.equal(
    resolveDashboardProcessPipelineStatus({
      currentPipelineStatus,
      freshness: weekendRolloverFreshness,
      latestCompletedPipelineStatus: buildFridayCompletedPipelineStatus(),
      requestMarketDate: "2026-10-19",
    }),
    currentPipelineStatus,
  );
});

test("keeps a non-trading partial pipeline when a stage reports a real problem", () => {
  const currentPipelineStatus = buildWeekendPartialPipelineStatus();
  currentPipelineStatus.stages.technical_snapshots = {
    status: "partial",
    processed: 2674,
    total: 2676,
    failed: 2,
  };

  assert.equal(
    shouldRequestLatestCompletedPipelineStatus({
      currentPipelineStatus,
      freshness: weekendRolloverFreshness,
      requestMarketDate: "2026-10-18",
    }),
    false,
  );
  assert.equal(
    resolveDashboardProcessPipelineStatus({
      currentPipelineStatus,
      freshness: weekendRolloverFreshness,
      latestCompletedPipelineStatus: buildFridayCompletedPipelineStatus(),
      requestMarketDate: "2026-10-18",
    }),
    currentPipelineStatus,
  );
});

test("uses the completed next-open plan target for execution runtime reads", () => {
  const completedPipelineStatus = buildPipelineStatus({
    market_date: "2026-10-16",
    status: "completed",
    stages: {
      next_open_execution_plan: {
        status: "completed",
        processed: 36,
        total: 36,
        failed: 0,
        details: {
          result_summary: {
            request: {
              target_trade_date: "2026-10-19",
            },
            summary: {
              target_trade_date: "2026-10-19",
              source_market_date: "2026-10-16",
            },
          },
        },
      },
    },
  });

  assert.equal(
    getDashboardExecutionRuntimeMarketDate(completedPipelineStatus, "2026-10-16"),
    "2026-10-19",
  );
});

test("keeps the requested runtime date until the next-open plan is complete", () => {
  const runningPipelineStatus = buildPipelineStatus({
    market_date: "2026-10-19",
    status: "running",
    stages: {
      next_open_execution_plan: {
        status: "running",
        processed: 12,
        total: 36,
        failed: 0,
        details: {
          result_summary: {
            summary: {
              target_trade_date: "2026-10-20",
            },
          },
        },
      },
    },
  });

  assert.equal(
    getDashboardExecutionRuntimeMarketDate(runningPipelineStatus, "2026-10-19"),
    "2026-10-19",
  );
  assert.equal(getDashboardExecutionRuntimeMarketDate(null, "2026-10-19T09:00:00+09:00"), "2026-10-19");
});
