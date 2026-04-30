import assert from "node:assert/strict";
import test from "node:test";

import type { EodFreshnessResponseDto, EodPipelineStatusResponseDto } from "@/types/trading-api";

import {
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
