import assert from "node:assert/strict";
import test from "node:test";

import { getDashboardLiveCopy } from "@/i18n/dashboard-live-copy";
import { CANONICAL_EOD_PIPELINE_STAGE_ORDER } from "@/lib/eod-pipeline-status";
import {
  getDashboardProcessResolvedMarketDate,
  resolveDashboardProcessPipelineStatus,
} from "@/lib/dashboard-process-market-date";
import type {
  AgentFeedbackProgressResponseDto,
  DartFundamentalsDailyRunDto,
  EodFreshnessResponseDto,
  EodFreshnessStageDto,
  EodMarketRiskFiltersResponseDto,
  EodMomentumFactorsResponseDto,
  EodPipelineStageDto,
  EodPipelineStatusResponseDto,
  EodPiotroskiFilterResultsResponseDto,
  EodValueFactorsResponseDto,
  MarketSnapshotResponseDto,
} from "@/types/trading-api";

import {
  buildAgentRoleCards,
  getDailyProcessDependencyWaitState,
  buildEodStageCard,
  buildFilteringCardModel,
  buildMarketSnapshotPresentation,
  buildProcessMonitorModel,
  buildScoringCardModel,
  formatEodSymbolCount,
  getActionFreshnessStage,
  getAgentFeedbackProgressPollDelayMs,
  getEodPipelineStatusPollDelayMs,
  getMarketSnapshotFlow,
  getMarketSnapshotFlowAmount,
  getMarketSnapshotFxRate,
  getMarketSnapshotFxValue,
  getMarketSnapshotIndex,
  getMarketSnapshotIndexLevel,
  getFundamentalsFailureDetails,
  getFundamentalsStageStatusLabel,
  getFundamentalsStatusLabel,
  getFundamentalsUpdatedActivityModel,
  getFundamentalsUpdatedCountLabel,
  getFundamentalsUpdatedSymbolsDetail,
  getFundamentalsCheckedCount,
  getFundamentalsFreshnessStage,
  getPipelineStageResolvedStatusDate,
  hasLivePipelineRunningState,
  getMarketSnapshotPollDelayMs,
  getPriceFreshnessStage,
  getResolvedAgentProgressRunStatus,
  getSignalDeciderFeedbackPollDelayMs,
  getTechnicalFreshnessStage,
  markAgentFeedbackProgressStopped,
  maskAgentRoleCardsAsWaiting,
  maskFilteringCardModelAsWaiting,
  maskFutureEodStageCardsWhilePipelineRunning,
  mergeRunningPipelineStage,
  resolveFundamentalsPollingPresentation,
  shouldRevalidateFilteringFallback,
  shouldShowAgentRoleProgress,
  shouldShowSignalDeciderCurrentCycleContext,
  shouldTreatAgentFeedbackStopDisconnectAsAccepted,
} from "./live-dashboard-derived-state";

function buildStage(status: string): EodFreshnessStageDto {
  return {
    status,
    symbols_total: 3583,
    symbols_succeeded: 1,
    symbols_failed: 0,
  };
}

function buildFundamentalsRun(overrides: Partial<DartFundamentalsDailyRunDto> = {}): DartFundamentalsDailyRunDto {
  return {
    id: 17,
    market_date: "2026-04-21",
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
    updated_entries_summary: null,
    updated_entries: null,
    error_message: null,
    run_metadata: {},
    started_at: "2026-04-21T08:56:58+09:00",
    completed_at: "2026-04-21T09:11:08+09:00",
    ...overrides,
  };
}

function buildMarketSnapshot(): MarketSnapshotResponseDto {
  return {
    market_date: "2026-04-21",
    as_of: "2026-04-21T15:30:00+09:00",
    indices: {
      kospi: {
        level: 2648.3,
        change: 12.4,
        change_rate: 0.47,
      },
    },
    summary: {
      line: "Large-cap breadth improved into the close.",
    },
  };
}

function buildAgentFeedbackProgress({
  marketDate = "2026-04-21",
  symbols = null,
  totalSymbols,
}: {
  marketDate?: string;
  symbols?: string[] | null;
  totalSymbols: number;
}): AgentFeedbackProgressResponseDto {
  return {
    request: {
      market_date: marketDate,
      symbols,
      expected_agents: ["eod-summarizer"],
    },
    summary: {
      run_id: "run-filtering-count-test",
      run_status: "completed",
      run_table_status: "completed",
      is_live: false,
      run_started_at: "2026-04-21T09:00:00+09:00",
      run_completed_at: "2026-04-21T09:10:00+09:00",
      latest_feedback_at: "2026-04-21T09:10:00+09:00",
      seconds_since_last_feedback: 120,
      stalled_threshold_seconds: 300,
      total_symbols: totalSymbols,
      processed_symbols: totalSymbols,
      completed_symbols: totalSymbols,
      in_progress_symbols: 0,
      pending_symbols: 0,
      progress_ratio: 1,
      progress_percent: 100,
      failed_items: 0,
      completed_feedback_count: totalSymbols,
      expected_feedback_count: totalSymbols,
    },
    result: null,
  };
}

test("keeps the last usable market snapshot visible as stale while the latest snapshot load is errored", () => {
  const copy = getDashboardLiveCopy("en");
  const presentation = buildMarketSnapshotPresentation(copy, buildMarketSnapshot(), "HTTP 503");

  assert.equal(presentation.isReady, false);
  assert.equal(presentation.displaySnapshot?.market_date, "2026-04-21");
  assert.equal(presentation.status, "stale");
  assert.equal(presentation.statusLabel, copy.marketOverview.snapshotStale);
  assert.equal(presentation.statusTone, "warning");
  assert.equal(presentation.fallbackContextLabel, `${copy.marketOverview.snapshotStaleContext} HTTP 503`);
});

test("treats a missing market snapshot as unavailable when the snapshot load is errored", () => {
  const copy = getDashboardLiveCopy("en");
  const presentation = buildMarketSnapshotPresentation(copy, null, "HTTP 503");

  assert.equal(presentation.isReady, false);
  assert.equal(presentation.displaySnapshot, null);
  assert.equal(presentation.status, "unavailable");
  assert.equal(presentation.statusLabel, copy.marketOverview.snapshotUnavailable);
  assert.equal(presentation.statusTone, "warning");
  assert.equal(presentation.fallbackContextLabel, copy.marketOverview.snapshotDependencyPending);
});

test("keeps the market snapshot ready when present and the latest snapshot load has no error", () => {
  const copy = getDashboardLiveCopy("en");
  const snapshot: MarketSnapshotResponseDto = {
    ...buildMarketSnapshot(),
    indices: {
      kospi: {
        level: 2648.3,
        change: 12.4,
        change_rate: 0.47,
      },
      kosdaq: {
        level: 812.22,
        change: 3.1,
        change_rate: 0.38,
      },
    },
    fx: {
      usdkrw: {
        value: 1378.1,
        change: -2.4,
        change_rate: -0.17,
      },
    },
    flows: {
      foreign: {
        value: 124_000_000_000,
        unit: "KRW",
      },
      institutional: {
        value: -44_000_000_000,
        unit: "KRW",
      },
    },
  };
  const presentation = buildMarketSnapshotPresentation(copy, snapshot, null);

  assert.equal(presentation.isReady, true);
  assert.equal(presentation.displaySnapshot, snapshot);
  assert.equal(presentation.status, "ready");
  assert.equal(presentation.statusLabel, copy.marketOverview.snapshotReady);
  assert.equal(presentation.statusTone, "positive");
  assert.equal(presentation.fallbackContextLabel, copy.marketOverview.conditionNote);
});

test("renders partial-but-usable market snapshots instead of collapsing the full card state", () => {
  const copy = getDashboardLiveCopy("en");
  const snapshot: MarketSnapshotResponseDto = {
    status: "ready",
    market_date: "2026-04-21",
    as_of: "2026-04-21T15:30:00+09:00",
    indices: {
      kospi: {
        level: 2648.3,
        change: 12.4,
        change_rate: 0.47,
      },
    },
    fx: {
      usdkrw: {
        value: 1378.1,
      },
    },
    flows: {
      foreign: {
        value: 124_000_000_000,
        unit: "KRW",
      },
    },
    summary: {
      line: "Large-cap breadth improved into the close.",
    },
  };
  const presentation = buildMarketSnapshotPresentation(copy, snapshot, null);

  assert.equal(presentation.isReady, false);
  assert.equal(presentation.status, "partial");
  assert.equal(presentation.statusLabel, copy.marketOverview.snapshotPartial);
  assert.equal(presentation.statusTone, "info");
  assert.equal(presentation.displaySnapshot, snapshot);
  assert.deepEqual(presentation.missingFieldLabels, [copy.marketOverview.kosdaq, copy.marketOverview.institutionalFlow]);
  assert.match(presentation.fallbackContextLabel, /Partial market snapshot/);
  assert.match(presentation.fallbackContextLabel, /KOSDAQ/);
  assert.match(presentation.fallbackContextLabel, /Institutional flow/);
});

test("keeps explicit unavailable market snapshots unavailable when partial fragments exist", () => {
  const copy = getDashboardLiveCopy("en");
  const snapshot: MarketSnapshotResponseDto = {
    status: "unavailable",
    missing_fields: ["indices.kosdaq", "flows.institutional"],
    market_date: "2026-04-21",
    as_of: "2026-04-21T15:30:00+09:00",
    indices: {
      kospi: {
        level: 2648.3,
        change: 12.4,
        change_rate: 0.47,
      },
    },
    fx: {
      usdkrw: {
        value: 1378.1,
      },
    },
    flows: {
      foreign: {
        value: 124_000_000_000,
        unit: "KRW",
      },
    },
    summary: {
      line: "Large-cap breadth improved into the close.",
    },
  };
  const presentation = buildMarketSnapshotPresentation(copy, snapshot, null);

  assert.equal(presentation.isReady, false);
  assert.equal(presentation.status, "unavailable");
  assert.equal(presentation.statusLabel, copy.marketOverview.snapshotUnavailable);
  assert.equal(presentation.statusTone, "warning");
  assert.equal(presentation.displaySnapshot, null);
  assert.deepEqual(presentation.missingFieldLabels, [copy.marketOverview.kosdaq, copy.marketOverview.institutionalFlow]);
  assert.equal(presentation.fallbackContextLabel, copy.marketOverview.snapshotWaiting);
});

test("normalizes enveloped market snapshot responses before resolving presentation state", () => {
  const copy = getDashboardLiveCopy("en");
  const envelopedSnapshot = {
    status: "partial",
    data: {
      market_date: "2026-04-21",
      indices: [
        {
          symbol: "KOSPI",
          value: "2,648.30",
        },
      ],
      fx: [
        {
          pair: "USD/KRW",
          rate: "1,378.10",
        },
      ],
      flows: [
        {
          investor_type: "foreign",
          net_buy: "124000000000",
          unit: "KRW",
        },
      ],
    },
    meta: {
      source: "core",
    },
  } as unknown as MarketSnapshotResponseDto;
  const presentation = buildMarketSnapshotPresentation(copy, envelopedSnapshot, null);

  assert.equal(presentation.status, "partial");
  assert.equal(presentation.displaySnapshot?.market_date, "2026-04-21");
  assert.equal(presentation.displaySnapshot?.source, "core");
  assert.deepEqual(presentation.missingFieldLabels, [copy.marketOverview.kosdaq, copy.marketOverview.institutionalFlow]);
});

test("normalizes live Core markets and top-level usd_krw partial snapshots", () => {
  const copy = getDashboardLiveCopy("en");
  const liveCoreSnapshot = {
    status: "partial",
    market_date: "2026-04-30",
    as_of: "2026-04-30T16:15:00+09:00",
    markets: {
      kospi: {
        value: 6598.87,
        change: 12.41,
        change_rate: 0.19,
        foreign_net_value: 248_000_000_000,
        institution_net_value: -91_000_000_000,
        unit: "KRW",
      },
      kosdaq: {
        value: 1192.35,
        change: -3.22,
        change_rate: -0.27,
        foreign_net_value: 64_000_000_000,
        institution_net_value: 11_000_000_000,
        unit: "KRW",
      },
    },
    usd_krw: {
      status: "missing",
      stale_reason: "koreaexim_quota_exhausted",
    },
    freshness: {
      served_from_cache: true,
    },
  } as unknown as MarketSnapshotResponseDto;
  const presentation = buildMarketSnapshotPresentation(copy, liveCoreSnapshot, null);
  const displaySnapshot = presentation.displaySnapshot;

  assert.equal(presentation.status, "partial");
  assert.equal(presentation.statusLabel, copy.marketOverview.snapshotPartial);
  assert.equal(displaySnapshot?.market_date, "2026-04-30");
  assert.deepEqual(presentation.missingFieldLabels, [copy.marketOverview.usdKrw]);
  assert.equal(getMarketSnapshotIndexLevel(getMarketSnapshotIndex(displaySnapshot, "kospi")), 6598.87);
  assert.equal(getMarketSnapshotIndexLevel(getMarketSnapshotIndex(displaySnapshot, "kosdaq")), 1192.35);
  assert.equal(getMarketSnapshotFxValue(getMarketSnapshotFxRate(displaySnapshot)), null);
  assert.equal(getMarketSnapshotFlowAmount(getMarketSnapshotFlow(displaySnapshot, "foreign")), 312_000_000_000);
  assert.equal(getMarketSnapshotFlowAmount(getMarketSnapshotFlow(displaySnapshot, "institutional")), -80_000_000_000);
});

test("retries market snapshot outages faster than the idle polling cadence until recovery", () => {
  assert.equal(
    getMarketSnapshotPollDelayMs({
      hadError: true,
      consecutiveErrorCount: 1,
    }),
    5_000,
  );
  assert.equal(
    getMarketSnapshotPollDelayMs({
      hadError: true,
      consecutiveErrorCount: 2,
    }),
    15_000,
  );
  assert.equal(
    getMarketSnapshotPollDelayMs({
      hadError: true,
      consecutiveErrorCount: 3,
    }),
    30_000,
  );
  assert.equal(
    getMarketSnapshotPollDelayMs({
      hadError: true,
      consecutiveErrorCount: 12,
    }),
    30_000,
  );
  assert.equal(
    getMarketSnapshotPollDelayMs({
      hadError: false,
      consecutiveErrorCount: 0,
    }),
    60_000,
  );
});

test("moves the market snapshot presentation from outage fallback to ready after a valid retry", () => {
  const copy = getDashboardLiveCopy("en");
  const outagePresentation = buildMarketSnapshotPresentation(copy, null, "HTTP 503");

  assert.equal(outagePresentation.isReady, false);
  assert.equal(outagePresentation.statusLabel, copy.marketOverview.snapshotUnavailable);
  assert.equal(outagePresentation.displaySnapshot, null);

  const recoveredSnapshot: MarketSnapshotResponseDto = {
    ...buildMarketSnapshot(),
    indices: {
      kospi: { level: 2648.3 },
      kosdaq: { level: 812.22 },
    },
    fx: { usdkrw: { value: 1378.1 } },
    flows: {
      foreign: { value: 124_000_000_000, unit: "KRW" },
      institutional: { value: -44_000_000_000, unit: "KRW" },
    },
  };
  const recoveredPresentation = buildMarketSnapshotPresentation(copy, recoveredSnapshot, null);

  assert.equal(recoveredPresentation.isReady, true);
  assert.equal(recoveredPresentation.statusLabel, copy.marketOverview.snapshotReady);
  assert.equal(recoveredPresentation.displaySnapshot, recoveredSnapshot);
  assert.equal(recoveredPresentation.fallbackContextLabel, copy.marketOverview.conditionNote);
});

function buildPipelineStatus(overrides: Partial<EodPipelineStatusResponseDto> = {}): EodPipelineStatusResponseDto {
  return {
    market_date: "2026-04-21",
    fs_div: "CFS",
    status: "running",
    stage_order: ["price_collection", "technical_snapshots", "action_summaries", "fundamentals_daily_refresh"],
    stages: {},
    ...overrides,
  };
}

function buildPipelineStageDto(
  status: string,
  processed: number | null = null,
  total: number | null = null,
): EodPipelineStageDto {
  return {
    status,
    processed,
    total,
    failed: 0,
  };
}

test("treats active live pipeline tokens as running for the dashboard process gate", () => {
  for (const token of ["running", "in_progress", "started", "active"] as const) {
    assert.equal(hasLivePipelineRunningState(buildPipelineStatus({ status: token, stages: {} })), true, token);
    assert.equal(
      hasLivePipelineRunningState(
        buildPipelineStatus({
          status: "pending",
          stages: {
            price_collection: buildPipelineStageDto(token),
          },
        }),
      ),
      true,
      token,
    );
  }
});

test("keeps stale completed fundamentals coverage synced on an active trading day", () => {
  assert.equal(
    getFundamentalsStageStatusLabel(buildStage("ready"), "2026-04-21", "2026-04-18", false),
    "synced",
  );
});

test("masks future EOD stages as waiting while the daily pipeline is still running", () => {
  const copy = getDashboardLiveCopy("ko");
  const cards = [
    buildEodStageCard("price", copy.stage.price, buildStage("ready"), "2026-04-21", "2026-04-21", "2026-04-21", "2026-04-21", false, null, copy, "en-US"),
    buildEodStageCard("technical", copy.stage.technical, buildStage("running"), "2026-04-21", "2026-04-20", "2026-04-21", "2026-04-21", false, null, copy, "en-US"),
    buildEodStageCard("action", copy.stage.action, buildStage("ready"), "2026-04-21", "2026-04-20", "2026-04-20", "2026-04-21", false, null, copy, "en-US"),
    buildEodStageCard("fundamentals", copy.stage.fundamentals, buildStage("ready"), "2026-04-21", "2026-04-20", "2026-04-20", "2026-04-21", false, null, copy, "en-US"),
  ] as const;
  const pipelineStatus = buildPipelineStatus({
    stages: {
      price_collection: { status: "completed", processed: 3583, total: 3583, failed: 0 },
      technical_snapshots: { status: "running", processed: 1200, total: 3583, failed: 0 },
    },
  });

  const masked = maskFutureEodStageCardsWhilePipelineRunning(cards, pipelineStatus, "en-US");

  assert.equal(masked[0]?.statusLabel, "synced");
  assert.equal(masked[1]?.statusLabel, "running");
  assert.equal(masked[2]?.statusLabel, "waiting");
  assert.equal(masked[2]?.latestDate, null);
  assert.equal(masked[2]?.details.find((detail) => detail.key === "count")?.value, "0 / 3,583");
  assert.equal(masked[3]?.statusLabel, "waiting");
  assert.equal(masked[3]?.details.find((detail) => detail.key === "count")?.value, "0 / 3,583");
});

test("keeps recent EOD results visible when the daily pipeline is not running", () => {
  const copy = getDashboardLiveCopy("ko");
  const cards = [
    buildEodStageCard("price", copy.stage.price, buildStage("ready"), "2026-04-21", "2026-04-21", "2026-04-21", "2026-04-21", false, null, copy, "en-US"),
    buildEodStageCard("technical", copy.stage.technical, buildStage("ready"), "2026-04-21", "2026-04-20", "2026-04-20", "2026-04-21", false, null, copy, "en-US"),
  ] as const;
  const pipelineStatus = buildPipelineStatus({
    status: "completed",
    stages: {
      price_collection: { status: "completed", processed: 3583, total: 3583, failed: 0 },
      technical_snapshots: { status: "completed", processed: 3583, total: 3583, failed: 0 },
    },
  });

  const masked = maskFutureEodStageCardsWhilePipelineRunning(cards, pipelineStatus, "en-US");

  assert.equal(masked[1], cards[1]);
  assert.equal(masked[1]?.latestDate, "2026-04-20");
  assert.equal(masked[1]?.details.find((detail) => detail.key === "latest-date")?.value, "2026-04-20");
});

test("keeps stale fundamentals coverage in break-day state when the market is closed", () => {
  assert.equal(
    getFundamentalsStageStatusLabel(buildStage("ready"), "2026-04-21", "2026-04-18", true),
    "break day",
  );
});

test("hides signal-decider current-cycle context on break days", () => {
  assert.equal(
    shouldShowSignalDeciderCurrentCycleContext({
      currentMarketDate: "2026-05-09",
      isBreakDay: true,
      isLatestCompletedFallback: true,
    }),
    false,
  );
  assert.equal(
    shouldShowSignalDeciderCurrentCycleContext({
      currentMarketDate: "2026-05-09",
      isBreakDay: false,
      isLatestCompletedFallback: true,
    }),
    true,
  );
  assert.equal(
    shouldShowSignalDeciderCurrentCycleContext({
      currentMarketDate: null,
      isBreakDay: false,
      isLatestCompletedFallback: true,
    }),
    false,
  );
  assert.equal(
    shouldShowSignalDeciderCurrentCycleContext({
      currentMarketDate: "2026-05-09",
      isBreakDay: false,
      isLatestCompletedFallback: false,
    }),
    false,
  );
});

test("keeps partial fundamentals runs in a not-synced stage even when the run has a latest date", () => {
  const stage = getFundamentalsFreshnessStage(
    null,
    {
      latest_run: buildFundamentalsRun({
        market_date: "2026-04-18",
        status: "partial",
        symbols_checked: 3583,
        symbols_failed: 1406,
      }),
      runs: [],
    },
    "partial",
    "2026-04-18",
    false,
  );

  assert.equal(stage?.status, "missing");
  assert.equal(getFundamentalsStageStatusLabel(stage, "2026-04-21", "2026-04-18", false), "not synced");
});

test("surfaces a newer partial fundamentals run while keeping latest completed coverage synced", () => {
  const copy = getDashboardLiveCopy("en");
  const freshness = {
    today: {
      trade_date: "2026-04-30",
      fundamentals: {
        status: "missing",
        symbols_total: 2812,
        symbols_succeeded: 0,
        symbols_failed: 0,
      },
    },
    latest: {
      stage_details: {
        fundamentals: {
          market_date: "2026-04-29",
          status: "completed",
          symbols_total: 2812,
          symbols_checked: 2812,
          symbols_failed: 0,
        },
      },
    },
    fundamentals: {
      success: true,
      latest_date: "2026-04-29",
    },
  };
  const fundamentalsStatus = {
    latest_run: buildFundamentalsRun({
      market_date: "2026-04-30",
      status: "partial",
      symbols_total: 2812,
      symbols_checked: 0,
      symbols_failed: 0,
    }),
    runs: [],
  };

  const statusLabel = getFundamentalsStatusLabel(
    freshness,
    fundamentalsStatus,
    {
      tradeDate: "2026-04-29",
      status: "completed",
      symbolsTotal: 2812,
      symbolsChecked: 2812,
      symbolsFailed: 0,
      source: "freshness_latest",
    },
    { status: "completed", processed: 2812, total: 2812, failed: 0 },
  );
  const stage = getFundamentalsFreshnessStage(
    freshness,
    fundamentalsStatus,
    statusLabel,
    "2026-04-29",
    false,
  );
  const failureDetails = getFundamentalsFailureDetails(
    freshness,
    fundamentalsStatus,
    "2026-04-29",
    statusLabel,
    copy,
    "en-US",
  );

  assert.equal(statusLabel, "partial");
  assert.deepEqual(stage, {
    status: "ready",
    symbols_total: 2812,
    symbols_succeeded: 2812,
    symbols_failed: 0,
  });
  assert.equal(getFundamentalsStageStatusLabel(stage, "2026-04-30", "2026-04-29", false), "synced");
  assert.equal(failureDetails?.key, "17:2026-04-30:partial");
});

test("prefers a running today fundamentals stage over a stale completed inspect run", () => {
  const freshness = {
    today: {
      trade_date: "2026-04-21",
      fundamentals: {
        status: "running",
        symbols_total: 0,
        symbols_succeeded: 0,
        symbols_failed: 0,
      },
    },
    latest: null,
    fundamentals: {
      success: true,
      latest_date: "2026-04-18",
    },
  };
  const fundamentalsStatus = {
    latest_run: buildFundamentalsRun({
      market_date: "2026-04-18",
      status: "completed",
      symbols_checked: 3583,
      completed_at: "2026-04-18T18:00:00+09:00",
    }),
    runs: [],
  };

  assert.equal(
    getFundamentalsStatusLabel(
      freshness,
      fundamentalsStatus,
      {
        tradeDate: "2026-04-18",
        status: "completed",
        symbolsTotal: 3583,
        symbolsChecked: 3583,
        symbolsFailed: 0,
        source: "latest_run",
      },
      null,
    ),
    "running",
  );

  const stage = getFundamentalsFreshnessStage(freshness, fundamentalsStatus, "running", "2026-04-18", true);
  assert.equal(stage?.status, "running");
});

test("keeps same-day fundamentals coverage synced", () => {
  assert.equal(
    getFundamentalsStageStatusLabel(buildStage("ready"), "2026-04-21", "2026-04-21", false),
    "synced",
  );
});

test("uses live fundamentals pipeline counts and date while stored activity data is stale", () => {
  const copy = getDashboardLiveCopy("en");
  const freshness = {
    today: {
      trade_date: "2026-04-29",
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
          market_date: "2026-04-26",
          status: "completed",
          symbols_total: 3583,
          symbols_checked: 9,
          symbols_failed: 0,
        },
      },
    },
    fundamentals: {
      success: true,
      latest_date: "2026-04-26",
    },
  };
  const fundamentalsStatus = {
    latest_run: buildFundamentalsRun({
      market_date: "2026-04-26",
      symbols_checked: 9,
      symbols_refreshed: 9,
      updated_entries_summary: {
        updated_count: 9,
        visible_preview_limit: 3,
      },
      updated_entries: [
        {
          symbol: "005930",
          company_name: "Samsung Electronics",
          category_label: "Financial statement refresh",
        },
      ],
    }),
    runs: [],
  };
  const pipelineStage = {
    status: "running",
    processed: 247,
    total: 3583,
    failed: 1,
    current_step: "fundamentals_daily_refresh",
    current_activity: "sync_symbols",
    current_symbol: "000660",
  };
  const presentation = resolveFundamentalsPollingPresentation({
    latestFundamentalsDate: "2026-04-26",
    pipelineStage,
    processMarketDate: "2026-04-29",
    todayTradeDate: "2026-04-29",
  });
  const storedActivity = getFundamentalsUpdatedActivityModel(fundamentalsStatus, "2026-04-26", "en-US");
  const freshnessStage = getFundamentalsFreshnessStage(
    freshness,
    fundamentalsStatus,
    "running",
    "2026-04-26",
    true,
  );
  const liveStage = mergeRunningPipelineStage(freshnessStage, pipelineStage);
  const checkedCount = getFundamentalsCheckedCount(freshness, fundamentalsStatus, liveStage);
  const card = buildEodStageCard(
    "fundamentals",
    copy.stage.fundamentals,
    liveStage,
    "2026-04-29",
    presentation.latestDate,
    getPipelineStageResolvedStatusDate(pipelineStage, "2026-04-29", presentation.latestDate),
    "2026-04-26",
    false,
    pipelineStage,
    copy,
    "en-US",
    {
      label: copy.operational.checked,
      value: formatEodSymbolCount(checkedCount, "en-US"),
    },
    getFundamentalsStageStatusLabel,
  );

  assert.ok(storedActivity, "expected a stored structured activity snapshot to exist");
  assert.equal(presentation.useLivePollingView, true);
  assert.equal(presentation.showStoredActivity, false);
  assert.equal(presentation.latestDate, "2026-04-29");
  assert.equal(checkedCount, 247);
  assert.equal(card.statusLabel, "running");
  assert.equal(card.statusBadgeLabel, "Fundamentals Daily Refresh");
  assert.equal(card.details.find((detail) => detail.key === "count")?.value, "247");
  assert.equal(card.details.find((detail) => detail.key === "latest-date")?.value, "2026-04-29");
});

test("uses stage-specific technical and action counts instead of aggregate EOD totals", () => {
  const freshness = {
    today: null,
    latest: {
      summary: {
        market_date: "2026-04-27",
        status: "completed",
        symbols_total: 3583,
        symbols_succeeded: 3583,
        symbols_failed: 0,
      },
      stage_details: {
        technical_snapshots: {
          market_date: "2026-04-27",
          status: "completed",
          total: 120,
          processed: 120,
          failed: 0,
        },
        action_summaries: {
          market_date: "2026-04-27",
          status: "completed",
          total: 87,
          completed_count: 86,
          failed: 1,
        },
      },
    },
    technical: {
      success: true,
      latest_date: "2026-04-27",
    },
    action: {
      success: true,
      latest_date: "2026-04-27",
    },
  };

  const technicalStage = getTechnicalFreshnessStage(freshness, false);
  const actionStage = getActionFreshnessStage(freshness, false);

  assert.deepEqual(technicalStage, {
    status: "ready",
    symbols_total: 120,
    symbols_succeeded: 120,
    symbols_failed: 0,
  });
  assert.deepEqual(actionStage, {
    status: "ready",
    symbols_total: 87,
    symbols_succeeded: 86,
    symbols_failed: 1,
  });
});

test("keeps latest technical and action dates healthy when same-day layer status is empty", () => {
  const freshness = {
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
      technical_market_date: "2026-04-29",
      action_market_date: "2026-04-29",
    },
    technical: {
      success: false,
      latest_date: "2026-04-29",
    },
    action: {
      success: false,
      latest_date: "2026-04-29",
    },
  };

  const technicalStage = getTechnicalFreshnessStage(freshness, false);
  const actionStage = getActionFreshnessStage(freshness, false);

  assert.deepEqual(technicalStage, {
    status: "ready",
    symbols_total: null,
    symbols_succeeded: null,
    symbols_failed: null,
  });
  assert.deepEqual(actionStage, {
    status: "ready",
    symbols_total: null,
    symbols_succeeded: null,
    symbols_failed: null,
  });
});

test("resolves live pending current-day technical and action stages from latest completed pipeline", () => {
  const copy = getDashboardLiveCopy("en");
  const freshness: EodFreshnessResponseDto = {
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
  const effectivePipelineStatus = resolveDashboardProcessPipelineStatus({
    currentPipelineStatus,
    freshness,
    latestCompletedPipelineStatus,
    requestMarketDate: "2026-04-30",
  });
  const processMarketDate = getDashboardProcessResolvedMarketDate(effectivePipelineStatus, "2026-04-30");
  const technicalPipelineStage = effectivePipelineStatus?.stages.technical_snapshots ?? null;
  const actionPipelineStage = effectivePipelineStatus?.stages.action_summaries ?? null;
  const technicalStage = mergeRunningPipelineStage(
    getTechnicalFreshnessStage(freshness, false),
    technicalPipelineStage,
    { preferStageCountsOnCompleted: true },
  );
  const actionStage = mergeRunningPipelineStage(
    getActionFreshnessStage(freshness, false),
    actionPipelineStage,
    { preferStageCountsOnCompleted: true },
  );
  const technicalCard = buildEodStageCard(
    "technical",
    copy.stage.technical,
    technicalStage,
    processMarketDate,
    "2026-04-29",
    getPipelineStageResolvedStatusDate(technicalPipelineStage, processMarketDate, "2026-04-29"),
    "2026-04-29",
    false,
    technicalPipelineStage,
    copy,
    "en-US",
  );
  const actionCard = buildEodStageCard(
    "action",
    copy.stage.action,
    actionStage,
    processMarketDate,
    "2026-04-29",
    getPipelineStageResolvedStatusDate(actionPipelineStage, processMarketDate, "2026-04-29"),
    "2026-04-29",
    false,
    actionPipelineStage,
    copy,
    "en-US",
  );

  assert.equal(effectivePipelineStatus, latestCompletedPipelineStatus);
  assert.equal(processMarketDate, "2026-04-29");
  assert.equal(technicalCard.statusLabel, "synced");
  assert.equal(actionCard.statusLabel, "synced");
  assert.equal(technicalCard.details.find((detail) => detail.key === "count")?.value, "2,812 / 2,812");
  assert.equal(actionCard.details.find((detail) => detail.key === "count")?.value, "2,812 / 2,812");
  assert.equal(technicalCard.details.find((detail) => detail.key === "latest-date"), undefined);
  assert.equal(actionCard.details.find((detail) => detail.key === "latest-date"), undefined);
});

test("keeps pending latest patch stages out of ready state when numeric counts exist", () => {
  for (const status of ["pending", "queued", "not-started"]) {
    const stage = getTechnicalFreshnessStage(
      {
        today: null,
        latest: {
          stage_details: {
            technical_snapshots: {
              market_date: "2026-04-27",
              status,
              total: 100,
              processed: 100,
              failed: 0,
            },
          },
        },
        technical: {
          success: true,
          latest_date: "2026-04-27",
        },
      },
      false,
    );

    assert.equal(stage?.status, "pending", `${status} should remain pending`);
    assert.notEqual(stage?.status, "ready", `${status} should not be ready`);
    assert.equal(stage?.symbols_total, 100);
    assert.equal(stage?.symbols_succeeded, 100);
  }
});

test("keeps explicit latest patch ready running and missing statuses ahead of numeric counts", () => {
  const cases = [
    { status: "completed", expected: "ready" },
    { status: "running", expected: "running" },
    { status: "failed", expected: "missing" },
  ];

  for (const { status, expected } of cases) {
    const stage = getActionFreshnessStage(
      {
        today: null,
        latest: {
          stage_details: {
            action_summaries: {
              market_date: "2026-04-27",
              status,
              total: 100,
              completed_count: 100,
              failed: status === "failed" ? 1 : 0,
            },
          },
        },
        action: {
          success: true,
          latest_date: "2026-04-27",
        },
      },
      false,
    );

    assert.equal(stage?.status, expected, `${status} should resolve to ${expected}`);
    assert.equal(stage?.symbols_total, 100);
    assert.equal(stage?.symbols_succeeded, 100);
  }
});

test("completed pipeline merge preserves stage-local counts over aggregate totals", () => {
  const merged = mergeRunningPipelineStage(
    {
      status: "ready",
      symbols_total: 7,
      symbols_succeeded: 7,
      symbols_failed: 0,
    },
    {
      status: "completed",
      processed: 3583,
      total: 3583,
      failed: 0,
    },
    { preferStageCountsOnCompleted: true },
  );

  assert.deepEqual(merged, {
    status: "ready",
    symbols_total: 7,
    symbols_succeeded: 7,
    symbols_failed: 0,
  });
});

test("treats null-filled updated-entry rollout fields as absent structured payload", () => {
  const model = getFundamentalsUpdatedActivityModel(
    {
      latest_run: buildFundamentalsRun({
        symbols_refreshed: 41,
      }),
      runs: [],
    },
    "2026-04-21",
    "en-US",
  );

  assert.equal(model, null);
});

test("keeps the legacy Updated today fallback when rollout fields are null", () => {
  const copy = getDashboardLiveCopy("en");

  const detail = getFundamentalsUpdatedSymbolsDetail(
    {
      latest_run: buildFundamentalsRun({
        symbols_refreshed: 41,
        run_metadata: {
          refreshed_symbols_sample: ["005930", "000660", "035420"],
        },
      }),
      runs: [],
    },
    "2026-04-21",
    copy,
    "en-US",
  );

  assert.deepEqual(detail, {
    key: "updated-symbols",
    label: copy.operational.updatedToday,
    value: "41 (005930, 000660, 035420 +38)",
    tone: "text",
    layout: "stacked",
  });
});

test("keeps the legacy updated-symbol fallback visible for the latest fundamentals run after date rollover", () => {
  const copy = getDashboardLiveCopy("en");

  const detail = getFundamentalsUpdatedSymbolsDetail(
    {
      latest_run: buildFundamentalsRun({
        market_date: "2026-04-21",
        symbols_refreshed: 2,
        run_metadata: {
          refreshed_symbols_sample: ["005930", "000660"],
        },
      }),
      runs: [],
    },
    "2026-04-21",
    copy,
    "en-US",
    "2026-04-22",
  );

  assert.deepEqual(detail, {
    key: "updated-symbols",
    label: copy.operational.updatedRecently,
    value: "2 (005930, 000660)",
    tone: "text",
    layout: "stacked",
  });
});

test("uses a structured zero-count fundamentals activity payload without preview rows", () => {
  const model = getFundamentalsUpdatedActivityModel(
    {
      latest_run: buildFundamentalsRun({
        updated_entries_summary: {
          updated_count: 0,
          visible_preview_limit: 3,
        },
        updated_entries: [],
      }),
      runs: [],
    },
    "2026-04-21",
    "en-US",
  );

  assert.deepEqual(model, {
    key: "17:2026-04-21:0:0",
    countLabel: "0",
    previewItems: [],
    allItems: [],
    canExpand: false,
  });
});

test("keeps structured fundamentals activity visible for the latest run date after process date rollover", () => {
  const copy = getDashboardLiveCopy("en");
  const model = getFundamentalsUpdatedActivityModel(
    {
      latest_run: buildFundamentalsRun({
        market_date: "2026-04-21",
        updated_entries_summary: {
          updated_count: 1,
          visible_preview_limit: 3,
        },
        updated_entries: [
          {
            symbol: "005930",
            company_name: "Samsung Electronics",
            category_label: "Financial statement refresh",
          },
        ],
      }),
      runs: [],
    },
    "2026-04-21",
    "en-US",
  );

  assert.equal(model?.countLabel, "1");
  assert.equal(
    getFundamentalsUpdatedCountLabel("2026-04-21", "2026-04-22", copy),
    copy.operational.updatedRecently,
  );
  assert.deepEqual(model?.previewItems.map((item) => item.companyName), ["Samsung Electronics"]);
});

test("builds a one-item fundamentals activity preview from the structured updated-entry payload", () => {
  const model = getFundamentalsUpdatedActivityModel(
    {
      latest_run: buildFundamentalsRun({
        updated_entries_summary: {
          updated_count: 1,
          visible_preview_limit: 3,
        },
        updated_entries: [
          {
            symbol: "005930",
            company_name: "Samsung Electronics",
            category_label: "Financial statement refresh",
          },
        ],
      }),
      runs: [],
    },
    "2026-04-21",
    "en-US",
  );

  assert.equal(model?.countLabel, "1");
  assert.equal(model?.canExpand, false);
  assert.deepEqual(model?.previewItems, [
    {
      key: "005930:Financial statement refresh:0",
      symbol: "005930",
      companyName: "Samsung Electronics",
      categoryLabel: "Financial statement refresh",
    },
  ]);
});

test("uses updated_entries_preview when the structured full list is not present yet", () => {
  const model = getFundamentalsUpdatedActivityModel(
    {
      latest_run: buildFundamentalsRun({
        updated_entries_summary: {
          updated_count: 2,
          visible_preview_limit: 3,
          visible_preview_count: 2,
          has_more: false,
          remaining_count: 0,
          full_list_available: true,
        },
        updated_entries_preview: [
          {
            symbol: "005930",
            company_name: "Samsung Electronics",
            category_label: "Financial statement refresh",
          },
          {
            symbol: "000660",
            company_name: "SK hynix",
            category_label: "Quarterly filing capture",
          },
        ],
        updated_entries: null,
      }),
      runs: [],
    },
    "2026-04-21",
    "en-US",
  );

  assert.equal(model?.countLabel, "2");
  assert.equal(model?.canExpand, false);
  assert.deepEqual(model?.previewItems.map((item) => item.companyName), ["Samsung Electronics", "SK hynix"]);
  assert.deepEqual(model?.allItems.map((item) => item.companyName), ["Samsung Electronics", "SK hynix"]);
});

test("enables More when preview-only fundamentals entries exceed the visible preview limit", () => {
  const model = getFundamentalsUpdatedActivityModel(
    {
      latest_run: buildFundamentalsRun({
        updated_entries_summary: {
          updated_count: 4,
          visible_preview_limit: 3,
          visible_preview_count: 4,
          has_more: true,
          remaining_count: 1,
          full_list_available: false,
        },
        updated_entries_preview: [
          {
            symbol: "005930",
            company_name: "Samsung Electronics",
            category_label: "Financial statement refresh",
          },
          {
            symbol: "000660",
            company_name: "SK hynix",
            category_label: "Quarterly filing capture",
          },
          {
            symbol: "035420",
            company_name: "NAVER",
            category_label: "Correction filing refresh",
          },
          {
            symbol: "005380",
            company_name: "Hyundai Motor",
            category_label: "Annual filing capture",
          },
        ],
        updated_entries: null,
      }),
      runs: [],
    },
    "2026-04-21",
    "en-US",
  );

  assert.equal(model?.previewItems.length, 3);
  assert.equal(model?.allItems.length, 4);
  assert.equal(model?.canExpand, true);
  assert.deepEqual(model?.previewItems.map((item) => item.companyName), [
    "Samsung Electronics",
    "SK hynix",
    "NAVER",
  ]);
});

test("keeps exactly three structured fundamentals preview rows without showing expansion", () => {
  const model = getFundamentalsUpdatedActivityModel(
    {
      latest_run: buildFundamentalsRun({
        updated_entries_summary: {
          updated_count: 3,
          visible_preview_limit: 3,
        },
        updated_entries: [
          {
            symbol: "005930",
            company_name: "Samsung Electronics",
            category_label: "Financial statement refresh",
          },
          {
            symbol: "000660",
            company_name: "SK hynix",
            category_label: "Quarterly filing capture",
          },
          {
            symbol: "035420",
            company_name: "NAVER",
            category_label: "Correction filing refresh",
          },
        ],
      }),
      runs: [],
    },
    "2026-04-21",
    "en-US",
  );

  assert.equal(model?.countLabel, "3");
  assert.equal(model?.previewItems.length, 3);
  assert.equal(model?.allItems.length, 3);
  assert.equal(model?.canExpand, false);
});

test("caps fundamentals preview rows at three and enables More when additional structured entries exist", () => {
  const model = getFundamentalsUpdatedActivityModel(
    {
      latest_run: buildFundamentalsRun({
        updated_entries_summary: {
          updated_count: 5,
          visible_preview_limit: 5,
        },
        updated_entries: [
          {
            symbol: "005930",
            company_name: "Samsung Electronics",
            category_label: "Financial statement refresh",
          },
          {
            symbol: "000660",
            company_name: "SK hynix",
            category_label: "Quarterly filing capture",
          },
          {
            symbol: "035420",
            company_name: "NAVER",
            update_category: "correction_filing_refresh",
          },
          {
            symbol: "005380",
            company_name: "Hyundai Motor",
            category_label: "Annual filing capture",
          },
          {
            symbol: "012450",
            company_name: "Hanwha Aerospace",
            category_label: "Financial statement refresh",
          },
        ],
      }),
      runs: [],
    },
    "2026-04-21",
    "en-US",
  );

  assert.equal(model?.countLabel, "5");
  assert.equal(model?.previewItems.length, 3);
  assert.equal(model?.allItems.length, 5);
  assert.equal(model?.canExpand, true);
  assert.equal(model?.previewItems[2]?.categoryLabel, "Correction Filing Refresh");
});

test("keeps running stage badge, title, and tone mapping stable", () => {
  const copy = getDashboardLiveCopy("en");
  const card = buildEodStageCard(
    "price",
    copy.stage.price,
    buildStage("running"),
    "2026-04-21",
    "2026-04-18",
    "2026-04-18",
    "2026-04-18",
    false,
    {
      status: "running",
      current_step: "price_collection",
      current_activity: "sync_symbols",
      current_symbol: "005930",
      processed: 120,
      total: 3583,
      failed: 3,
    },
    copy,
    "en-US",
  );

  assert.equal(card.statusLabel, "running");
  assert.equal(card.statusBadgeLabel, "Price Collection");
  assert.equal(card.statusBadgeTitle, "Price Collection · Sync Symbols · Symbol 005930");
  assert.equal(card.tone, "info");
});

test("hides repeated latest-date detail when a stage matches the primary latest cycle date", () => {
  const copy = getDashboardLiveCopy("en");
  const card = buildEodStageCard(
    "price",
    copy.stage.price,
    buildStage("ready"),
    "2026-04-21",
    "2026-04-18",
    "2026-04-18",
    "2026-04-18",
    false,
    null,
    copy,
    "en-US",
  );

  assert.equal(card.details.find((detail) => detail.key === "latest-date"), undefined);
});

test("keeps latest-date detail when a stage differs from the primary latest cycle date", () => {
  const copy = getDashboardLiveCopy("en");
  const card = buildEodStageCard(
    "action",
    copy.stage.action,
    buildStage("ready"),
    "2026-04-21",
    "2026-04-17",
    "2026-04-17",
    "2026-04-18",
    false,
    null,
    copy,
    "en-US",
  );

  assert.equal(card.details.find((detail) => detail.key === "latest-date")?.value, "2026-04-17");
});

test("treats a pipeline-completed stage as synced while keeping the stale stored latest date visible", () => {
  const copy = getDashboardLiveCopy("en");
  const card = buildEodStageCard(
    "technical",
    copy.stage.technical,
    buildStage("ready"),
    "2026-04-27",
    "2026-04-24",
    "2026-04-27",
    "2026-04-27",
    false,
    {
      status: "completed",
      processed: 3583,
      total: 3583,
      failed: 0,
    },
    copy,
    "en-US",
  );

  assert.equal(card.statusLabel, "synced");
  assert.equal(card.details.find((detail) => detail.key === "latest-date")?.value, "2026-04-24");
});

test("builds the Piotroski filtering card with the resolved latest-available note", () => {
  const copy = getDashboardLiveCopy("en");
  const piotroskiStatus: EodPiotroskiFilterResultsResponseDto = {
    market_date: "2026-04-18",
    requested_market_date: "2026-04-21",
    resolved_market_date: "2026-04-18",
    is_latest_fallback: true,
    summary: {
      entries: 3200,
      requested_symbol: null,
      matched_symbols: [],
      missing_symbols: [],
      passed_count: 14,
      not_passed_count: 3186,
    },
    items: [],
  };
  const marketRiskStatus: EodMarketRiskFiltersResponseDto = {
    market_date: "2026-04-18",
    requested_market_date: "2026-04-21",
    resolved_market_date: "2026-04-18",
    is_latest_fallback: true,
    summary: {
      entries: 3200,
      requested_symbol: null,
      matched_symbols: [],
      missing_symbols: [],
      passed_count: 2900,
      watchlist_count: 200,
      failed_count: 100,
    },
    items: [],
  };
  const model = buildFilteringCardModel({
    copy,
    marketRiskStatus,
    marketRiskStatusError: null,
    marketRiskStatusLoadState: "ready",
    numberLocale: "en-US",
    piotroskiStatus,
    piotroskiStatusError: null,
    piotroskiStatusLoadState: "ready",
    piotroskiMarketDate: "2026-04-21",
  });
  const piotroskiStage = model.stages.find((stage) => stage.key === "piotroski");
  const marketRiskStage = model.stages.find((stage) => stage.key === "kis-risk");

  assert.equal(model.piotroskiDisplayMarketDate, "2026-04-18");
  assert.equal(piotroskiStage?.displayMarketDate, "2026-04-18");
  assert.equal(piotroskiStage?.displayMarketDateLabel, "2026-04-18");
  assert.equal(piotroskiStage?.status, "completed");
  assert.equal(piotroskiStage?.statusTone, "positive");
  assert.equal(piotroskiStage?.statusLabel, copy.piotroski.completed);
  assert.equal(piotroskiStage?.filteredCountLabel, "14");
  assert.deepEqual(piotroskiStage?.metrics, [
    {
      key: "filtered",
      label: copy.operational.filtered,
      value: "14",
    },
  ]);
  assert.equal(
    piotroskiStage?.note,
    `${copy.piotroski.requestedDate} 2026-04-21 · ${copy.piotroski.latestAvailableDate} 2026-04-18`,
  );
  assert.equal(model.finalFilteredCountLabel, "2,900");
  assert.equal(marketRiskStage?.status, "completed");
  assert.deepEqual(marketRiskStage?.metrics, [
    {
      key: "filtered",
      label: copy.operational.filtered,
      value: "2,900",
    },
  ]);
  assert.equal(
    marketRiskStage?.note,
    `${copy.piotroski.requestedDate} 2026-04-21 · ${copy.piotroski.latestAvailableDate} 2026-04-18`,
  );
});

test("keeps the final filtering count tied to the feedback eligibility target instead of broad market-risk pass count", () => {
  const copy = getDashboardLiveCopy("en");
  const model = buildFilteringCardModel({
    agentFeedbackProgress: buildAgentFeedbackProgress({
      marketDate: "2026-04-21",
      symbols: ["005930", "000660", "035420"],
      totalSymbols: 42,
    }),
    copy,
    marketRiskStatus: {
      market_date: "2026-04-21",
      summary: {
        entries: 3200,
        requested_symbol: null,
        matched_symbols: [],
        missing_symbols: [],
        passed_count: 2900,
        watchlist_count: 200,
        failed_count: 100,
      },
      items: [],
    },
    marketRiskStatusError: null,
    marketRiskStatusLoadState: "ready",
    numberLocale: "en-US",
    piotroskiMarketDate: "2026-04-21",
    piotroskiStatus: null,
    piotroskiStatusError: null,
    piotroskiStatusLoadState: "idle",
  });

  assert.equal(model.finalFilteredCountLabel, "3");
});

test("builds a scoring card from non-agent pipeline scoring stages", () => {
  const copy = getDashboardLiveCopy("en");
  const model = buildScoringCardModel({
    copy,
    numberLocale: "en-US",
    pipelineStatus: {
      market_date: "2026-04-27",
      status: "running",
      stage_order: ["unified_value_scoring", "momentum_scoring"],
      stages: {
        unified_value_scoring: {
          status: "completed",
          processed: 3583,
          total: 3583,
          failed: 0,
        },
        momentum_scoring: {
          status: "running",
          processed: 1200,
          total: 3583,
          failed: 2,
          current_step: "momentum_scoring",
          current_activity: "rank_symbols",
          current_symbol: "005930",
        },
      },
    },
    scoringMarketDate: "2026-04-27",
  });

  assert.deepEqual(model.stages.map((stage) => stage.key), ["unified-value", "quality", "momentum"]);
  assert.equal(model.stages[0]?.label, copy.scoring.stages.unifiedValue);
  assert.equal(model.stages[0]?.status, "completed");
  assert.equal(model.stages[0]?.progressLabel, "3,583 / 3,583");
  assert.equal(model.stages[0]?.note, copy.scoring.notes.completed);
  assert.equal(model.stages[1]?.label, copy.scoring.stages.quality);
  assert.equal(model.stages[1]?.status, "waiting");
  assert.equal(model.stages[1]?.progressLabel, copy.scoring.statuses.waiting);
  assert.equal(model.stages[1]?.note, copy.scoring.notes.waiting);
  assert.equal(model.stages[2]?.status, "loading");
  assert.deepEqual(model.stages[2]?.metrics, [
    {
      key: "progress",
      label: copy.processMonitor.progress,
      value: "1,200 / 3,583",
    },
    {
      key: "failed",
      label: copy.operational.failed,
      value: "2",
    },
  ]);
  assert.equal(
    model.stages[2]?.note,
    `${copy.scoring.notes.running} Momentum Scoring · Rank Symbols · Symbol 005930`,
  );
});

test("uses latest-valid factor results when same-day scoring stages are absent", () => {
  const copy = getDashboardLiveCopy("en");
  const scoringValueFactors = {
    market_date: "2026-04-18",
    requested_market_date: "2026-04-21",
    resolved_market_date: "2026-04-18",
    is_latest_fallback: true,
    summary: {
      entries: 3,
      requested_symbol: null,
      matched_symbols: ["005930", "000660", "035420"],
      missing_symbols: [],
      scored_count: 2,
      invalid_per_count: 1,
      missing_metric_count: 0,
    },
    items: [
      {
        symbol: "005930",
        market_date: "2026-04-18",
        quality_score: 0.91,
        quality_status: "scored_complete",
        is_quality_score_complete: true,
      },
      {
        symbol: "000660",
        market_date: "2026-04-18",
        quality_score: 0.63,
        quality_status: "scored_partial",
        is_quality_score_complete: false,
      },
    ],
  } as EodValueFactorsResponseDto;
  const scoringMomentumFactors = {
    market_date: "2026-04-18",
    requested_market_date: "2026-04-21",
    resolved_market_date: "2026-04-18",
    is_latest_fallback: true,
    summary: {
      entries: 3,
      requested_symbols: [],
      matched_symbols: ["005930", "000660", "035420"],
      missing_symbols: [],
      ranked_symbols: 3,
      eligible_symbols: 2,
    },
    items: [],
  } as EodMomentumFactorsResponseDto;
  const model = buildScoringCardModel({
    copy,
    numberLocale: "en-US",
    pipelineStatus: {
      market_date: "2026-04-21",
      status: "completed",
      stage_order: ["price_collection", "technical_snapshots", "action_summaries"],
      stages: {},
    },
    scoringMarketDate: "2026-04-21",
    scoringMomentumFactors,
    scoringMomentumFactorsLoadState: "ready",
    scoringValueFactors,
    scoringValueFactorsLoadState: "ready",
  });

  assert.deepEqual(model.stages.map((stage) => stage.status), ["completed", "completed", "completed"]);
  assert.deepEqual(model.stages.map((stage) => stage.displayMarketDate), [
    "2026-04-18",
    "2026-04-18",
    "2026-04-18",
  ]);
  assert.equal(model.stages[0]?.progressLabel, "2 / 3");
  assert.deepEqual(model.stages[0]?.metrics, [
    {
      key: "progress",
      label: copy.processMonitor.progress,
      value: "2 / 3",
    },
    {
      key: "invalid",
      label: copy.scoring.metrics.invalid,
      value: "1",
    },
  ]);
  assert.deepEqual(model.stages[1]?.metrics, [
    {
      key: "progress",
      label: copy.processMonitor.progress,
      value: "2 / 3",
    },
    {
      key: "complete",
      label: copy.agentFeedback.metrics.complete,
      value: "1",
    },
    {
      key: "partial",
      label: copy.scoring.metrics.partial,
      value: "1",
    },
    {
      key: "missing",
      label: copy.scoring.metrics.missing,
      value: "1",
    },
  ]);
  assert.deepEqual(model.stages[2]?.metrics, [
    {
      key: "progress",
      label: copy.processMonitor.progress,
      value: "3 / 3",
    },
    {
      key: "eligible",
      label: copy.scoring.metrics.eligible,
      value: "2",
    },
  ]);
  assert.equal(
    model.stages[0]?.note,
    `${copy.scoring.notes.completed} ${copy.piotroski.requestedDate} 2026-04-21 · ${copy.piotroski.latestAvailableDate} 2026-04-18`,
  );
});

test("keeps quality pending when inspect data has no scorable rows", () => {
  const copy = getDashboardLiveCopy("en");
  const scoringValueFactors = {
    market_date: "2026-04-27",
    requested_market_date: "2026-04-27",
    resolved_market_date: "2026-04-27",
    is_latest_fallback: false,
    summary: {
      entries: 2,
      requested_symbol: null,
      matched_symbols: ["005930", "000660"],
      missing_symbols: [],
      scored_count: 0,
      invalid_per_count: 2,
      missing_metric_count: 0,
    },
    items: [
      {
        symbol: "005930",
        market_date: "2026-04-27",
      },
      {
        symbol: "000660",
        market_date: "2026-04-27",
      },
    ],
  } as EodValueFactorsResponseDto;
  const model = buildScoringCardModel({
    copy,
    numberLocale: "en-US",
    pipelineStatus: {
      market_date: "2026-04-27",
      status: "completed",
      stage_order: ["price_collection", "technical_snapshots", "action_summaries"],
      stages: {},
    },
    scoringMarketDate: "2026-04-27",
    scoringValueFactors,
    scoringValueFactorsLoadState: "ready",
  });
  const qualityStage = model.stages.find((stage) => stage.key === "quality");

  assert.equal(qualityStage?.status, "pending");
  assert.equal(qualityStage?.progressLabel, "0 / 2");
  assert.equal(qualityStage?.note, copy.scoring.notes.pending);
  assert.deepEqual(qualityStage?.metrics, [
    {
      key: "progress",
      label: copy.processMonitor.progress,
      value: "0 / 2",
    },
    {
      key: "missing",
      label: copy.scoring.metrics.missing,
      value: "2",
    },
  ]);
});

test("uses latest-completed scoring stages and keeps empty factor rows pending", () => {
  const copy = getDashboardLiveCopy("en");
  const pipelineStatus = buildPipelineStatus({
    market_date: "2026-05-04",
    status: "completed",
    stage_order: [
      "price_collection",
      "technical_snapshots",
      "action_summaries",
      "unified_value_factors",
      "quality_factors",
      "momentum_factors",
    ],
    stages: {
      unified_value_factors: {
        status: "completed",
        processed: 2_811,
        total: 2_811,
        failed: 0,
      },
      quality_factors: {
        status: "pending",
        processed: 0,
        total: 2_811,
        failed: 0,
      },
      momentum_factors: {
        status: "pending",
        processed: 0,
        total: 2_811,
        failed: 0,
      },
      technical_snapshots: {
        status: "completed",
        processed: 2_811,
        total: 2_811,
        failed: 0,
      },
      action_summaries: {
        status: "completed",
        processed: 2_811,
        total: 2_811,
        failed: 0,
      },
    },
  });

  const model = buildScoringCardModel({
    copy,
    numberLocale: "en-US",
    pipelineStatus,
    scoringMarketDate: "2026-05-05",
    scoringMomentumFactors: {
      market_date: "2026-05-04",
      requested_market_date: "2026-05-05",
      resolved_market_date: "2026-05-04",
      is_latest_fallback: true,
      summary: {
        entries: 2_811,
        requested_symbols: [],
        matched_symbols: [],
        missing_symbols: [],
        ranked_symbols: 0,
        eligible_symbols: 0,
      },
      items: [],
    } as EodMomentumFactorsResponseDto,
    scoringMomentumFactorsLoadState: "ready",
    scoringValueFactors: {
      market_date: "2026-05-04",
      requested_market_date: "2026-05-05",
      resolved_market_date: "2026-05-04",
      is_latest_fallback: true,
      summary: {
        entries: 2_811,
        requested_symbol: null,
        matched_symbols: [],
        missing_symbols: [],
        scored_count: 0,
        invalid_per_count: 0,
        missing_metric_count: 0,
      },
      items: [],
    } as EodValueFactorsResponseDto,
    scoringValueFactorsLoadState: "ready",
  });

  assert.deepEqual(model.stages.map((stage) => stage.status), ["completed", "pending", "pending"]);
  assert.deepEqual(model.stages.map((stage) => stage.displayMarketDate), ["2026-05-04", "2026-05-04", "2026-05-04"]);
  assert.equal(model.stages[0]?.progressLabel, "2,811 / 2,811");
  assert.equal(model.stages[1]?.progressLabel, "0 / 2,811");
  assert.equal(model.stages[2]?.progressLabel, "0 / 2,811");
});

test("forces filtering, scoring, and feedback cards to waiting while EOD is checking", () => {
  const copy = getDashboardLiveCopy("en");
  const eodStageCards = [
    buildEodStageCard(
      "price",
      copy.stage.price,
      { status: "running", symbols_total: 100, symbols_succeeded: 35, symbols_failed: 0 },
      "2026-04-27",
      "2026-04-26",
      "2026-04-27",
      "2026-04-27",
      false,
      { status: "running", processed: 35, total: 100, failed: 0 },
      copy,
      "en-US",
    ),
  ];
  const pipelineStatus = buildPipelineStatus({
    market_date: "2026-04-27",
    stages: {
      price_collection: { status: "running", processed: 35, total: 100, failed: 0 },
    },
  });
  const rawFilteringCardModel = buildFilteringCardModel({
    agentFeedbackProgress: buildAgentFeedbackProgress({ marketDate: "2026-04-27", totalSymbols: 90 }),
    copy,
    marketRiskStatus: {
      market_date: "2026-04-27",
      summary: {
        entries: 100,
        requested_symbol: null,
        matched_symbols: [],
        missing_symbols: [],
        passed_count: 90,
        watchlist_count: 8,
        failed_count: 2,
      },
      items: [],
    },
    marketRiskStatusError: null,
    marketRiskStatusLoadState: "ready",
    numberLocale: "en-US",
    piotroskiMarketDate: "2026-04-27",
    piotroskiStatus: null,
    piotroskiStatusError: null,
    piotroskiStatusLoadState: "idle",
  });
  const rawScoringCardModel = buildScoringCardModel({
    copy,
    numberLocale: "en-US",
    pipelineStatus,
    scoringMarketDate: "2026-04-27",
  });

  const waitState = getDailyProcessDependencyWaitState({
    eodStageCards,
    filteringCardModel: rawFilteringCardModel,
    pipelineStatus,
    scoringCardModel: rawScoringCardModel,
  });
  const filteringCardModel = maskFilteringCardModelAsWaiting(rawFilteringCardModel, copy);
  const scoringCardModel = buildScoringCardModel({
    copy,
    forceWaiting: true,
    numberLocale: "en-US",
    pipelineStatus,
    scoringMarketDate: "2026-04-27",
  });
  const agentRoleCards = maskAgentRoleCardsAsWaiting(
    buildAgentRoleCards(buildAgentFeedbackProgress({ marketDate: "2026-04-27", totalSymbols: 90 }), copy, "en-US"),
    "en-US",
  );

  assert.deepEqual(waitState, {
    filteringChecking: false,
    scoringChecking: false,
    waitForAgentFeedback: true,
    waitForFiltering: true,
    waitForScoring: true,
  });
  assert.deepEqual(filteringCardModel.stages.map((stage) => stage.status), ["waiting", "waiting"]);
  assert.equal(filteringCardModel.finalFilteredCountLabel, copy.piotroski.waiting);
  assert.deepEqual(scoringCardModel.stages.map((stage) => stage.status), ["waiting", "waiting", "waiting"]);
  assert.deepEqual(scoringCardModel.stages.map((stage) => stage.progressLabel), [
    copy.scoring.statuses.waiting,
    copy.scoring.statuses.waiting,
    copy.scoring.statuses.waiting,
  ]);
  assert.equal(agentRoleCards.length > 0, true);
  assert.equal(agentRoleCards.every((role) => role.status === "pending"), true);
  assert.equal(agentRoleCards.every((role) => role.progressPercent === 0), true);
  assert.equal(agentRoleCards.every((role) => role.metrics.length === 0), true);
});

test("keeps refreshed EOD data visible and does not treat delayed filtering fetches as active running", () => {
  const copy = getDashboardLiveCopy("en");
  const eodStageCards = [
    buildEodStageCard(
      "price",
      copy.stage.price,
      { status: "ready", symbols_total: 100, symbols_succeeded: 100, symbols_failed: 0 },
      "2026-04-27",
      "2026-04-27",
      "2026-04-27",
      "2026-04-27",
      false,
      { status: "completed", processed: 100, total: 100, failed: 0 },
      copy,
      "en-US",
    ),
  ];
  const pipelineStatus = buildPipelineStatus({
    market_date: "2026-04-27",
    status: "completed",
    stages: {
      price_collection: { status: "completed", processed: 100, total: 100, failed: 0 },
    },
  });
  const rawFilteringCardModel = buildFilteringCardModel({
    copy,
    marketRiskStatus: null,
    marketRiskStatusError: null,
    marketRiskStatusLoadState: "loading",
    numberLocale: "en-US",
    piotroskiMarketDate: "2026-04-27",
    piotroskiStatus: null,
    piotroskiStatusError: null,
    piotroskiStatusLoadState: "loading",
  });
  const rawScoringCardModel = buildScoringCardModel({
    copy,
    numberLocale: "en-US",
    pipelineStatus,
    scoringMarketDate: "2026-04-27",
  });

  const waitState = getDailyProcessDependencyWaitState({
    eodStageCards,
    filteringCardModel: rawFilteringCardModel,
    pipelineStatus,
    scoringCardModel: rawScoringCardModel,
  });

  assert.equal(eodStageCards[0]?.statusLabel, "synced");
  assert.equal(eodStageCards[0]?.details.find((detail) => detail.key === "count")?.value, "100 / 100");
  assert.deepEqual(waitState, {
    filteringChecking: false,
    scoringChecking: false,
    waitForAgentFeedback: false,
    waitForFiltering: false,
    waitForScoring: false,
  });
  assert.deepEqual(rawFilteringCardModel.stages.map((stage) => stage.status), ["pending", "pending"]);
});

test("maps pending filtering stages to waiting when daily process is running", () => {
  const copy = getDashboardLiveCopy("en");
  const filteringCardModel = buildFilteringCardModel({
    agentFeedbackProgress: buildAgentFeedbackProgress({
      marketDate: "2026-04-27",
      symbols: ["005930", "000660", "035420"],
      totalSymbols: 3,
    }),
    copy,
    pipelineStatus: buildPipelineStatus({
      status: "running",
      stages: {
        price_collection: { status: "running", processed: 100, total: 100, failed: 0 },
      },
    }),
    marketRiskStatus: {
      market_date: "2026-04-27",
      summary: {
        entries: 100,
        requested_symbol: null,
        matched_symbols: [],
        missing_symbols: [],
        passed_count: 10,
        watchlist_count: 2,
        failed_count: 2,
      },
      items: [],
    },
    marketRiskStatusError: null,
    marketRiskStatusLoadState: "loading",
    numberLocale: "en-US",
    piotroskiMarketDate: "2026-04-27",
    piotroskiStatus: null,
    piotroskiStatusError: null,
    piotroskiStatusLoadState: "loading",
  });

  assert.deepEqual(filteringCardModel.stages.map((stage) => stage.status), ["waiting", "waiting"]);
  assert.equal(filteringCardModel.stages[0]?.filteredCountLabel, copy.piotroski.waiting);
  assert.equal(filteringCardModel.stages[1]?.filteredCountLabel, copy.piotroski.waiting);
});

test("maps a running market risk pipeline stage to the filtering row before ready filter results", () => {
  const copy = getDashboardLiveCopy("en");
  const filteringCardModel = buildFilteringCardModel({
    copy,
    pipelineStatus: buildPipelineStatus({
      market_date: "2026-06-12",
      status: "running",
      current_stage: "market_risk_filter",
      stages: {
        signal_features: buildPipelineStageDto("completed", 2_802, 2_802),
        market_risk_filter: {
          ...buildPipelineStageDto("running", 0, 2_802),
          current_activity: "filtering market risk",
        },
      },
    }),
    marketRiskStatus: {
      market_date: "2026-06-12",
      summary: {
        entries: 2_802,
        requested_symbol: null,
        matched_symbols: [],
        missing_symbols: [],
        passed_count: 320,
        watchlist_count: 28,
        failed_count: 0,
      },
      items: [],
    },
    marketRiskStatusError: null,
    marketRiskStatusLoadState: "ready",
    numberLocale: "en-US",
    piotroskiMarketDate: "2026-06-12",
    piotroskiStatus: null,
    piotroskiStatusError: null,
    piotroskiStatusLoadState: "idle",
  });
  const piotroskiStage = filteringCardModel.stages.find((stage) => stage.key === "piotroski");
  const marketRiskStage = filteringCardModel.stages.find((stage) => stage.key === "kis-risk");

  assert.equal(piotroskiStage?.status, "waiting");
  assert.equal(marketRiskStage?.status, "loading");
  assert.equal(marketRiskStage?.statusLabel, copy.piotroski.loading);
  assert.equal(marketRiskStage?.filteredCountLabel, "0 / 2,802");
  assert.equal(marketRiskStage?.metrics[0]?.value, "0 / 2,802");
  assert.match(marketRiskStage?.note ?? "", /filtering market risk/);
});

test("keeps filter result errors ahead of completed non-running pipeline stages", () => {
  const copy = getDashboardLiveCopy("en");
  const filteringCardModel = buildFilteringCardModel({
    copy,
    pipelineStatus: buildPipelineStatus({
      market_date: "2026-06-12",
      status: "completed",
      stages: {
        market_risk_filter: buildPipelineStageDto("completed", 2_802, 2_802),
      },
    }),
    marketRiskStatus: null,
    marketRiskStatusError: "Market risk results unavailable",
    marketRiskStatusLoadState: "error",
    numberLocale: "en-US",
    piotroskiMarketDate: "2026-06-12",
    piotroskiStatus: null,
    piotroskiStatusError: null,
    piotroskiStatusLoadState: "idle",
  });
  const marketRiskStage = filteringCardModel.stages.find((stage) => stage.key === "kis-risk");

  assert.equal(marketRiskStage?.status, "needs-review");
  assert.equal(marketRiskStage?.statusTone, "warning");
  assert.equal(marketRiskStage?.statusLabel, copy.piotroski.needsReview);
  assert.equal(marketRiskStage?.note, "Market risk results unavailable");
});

test("maps pending scoring stages to waiting while daily process is running", () => {
  const copy = getDashboardLiveCopy("en");
  const scoringCardModel = buildScoringCardModel({
    copy,
    numberLocale: "en-US",
    pipelineStatus: buildPipelineStatus({ status: "running", stages: {} }),
    scoringMarketDate: "2026-04-27",
  });

  assert.deepEqual(scoringCardModel.stages.map((stage) => stage.status), ["waiting", "waiting", "waiting"]);
  assert.deepEqual(scoringCardModel.stages.map((stage) => stage.progressLabel), [
    copy.scoring.statuses.waiting,
    copy.scoring.statuses.waiting,
    copy.scoring.statuses.waiting,
  ]);
  assert.equal(scoringCardModel.stages[0]?.note, copy.scoring.notes.waiting);
});

test("maps a running non-filter pipeline stage to its card row before ready result data", () => {
  const copy = getDashboardLiveCopy("en");
  const scoringCardModel = buildScoringCardModel({
    copy,
    numberLocale: "en-US",
    pipelineStatus: buildPipelineStatus({
      market_date: "2026-06-12",
      status: "running",
      current_stage: "momentum_factors",
      stages: {
        market_risk_filter: buildPipelineStageDto("completed", 2_802, 2_802),
        momentum_factors: {
          ...buildPipelineStageDto("running", 18, 2_802),
          current_activity: "ranking momentum factors",
        },
      },
    }),
    scoringMarketDate: "2026-06-12",
    scoringMomentumFactors: {
      market_date: "2026-06-12",
      requested_market_date: "2026-06-12",
      resolved_market_date: "2026-06-12",
      is_latest_fallback: false,
      summary: {
        entries: 2_802,
        requested_symbols: [],
        matched_symbols: [],
        missing_symbols: [],
        ranked_symbols: 320,
        eligible_symbols: 320,
      },
      items: [],
    } as EodMomentumFactorsResponseDto,
    scoringMomentumFactorsLoadState: "ready",
  });
  const momentumStage = scoringCardModel.stages.find((stage) => stage.key === "momentum");

  assert.equal(momentumStage?.status, "loading");
  assert.equal(momentumStage?.statusLabel, copy.scoring.statuses.running);
  assert.equal(momentumStage?.progressLabel, "18 / 2,802");
  assert.match(momentumStage?.note ?? "", /ranking momentum factors/);
});

test("keeps EOD and filtering visible while scoring is checking and makes feedback wait", () => {
  const copy = getDashboardLiveCopy("en");
  const eodStageCards = [
    buildEodStageCard(
      "price",
      copy.stage.price,
      { status: "ready", symbols_total: 100, symbols_succeeded: 100, symbols_failed: 0 },
      "2026-04-27",
      "2026-04-27",
      "2026-04-27",
      "2026-04-27",
      false,
      { status: "completed", processed: 100, total: 100, failed: 0 },
      copy,
      "en-US",
    ),
  ];
  const rawFilteringCardModel = buildFilteringCardModel({
    copy,
    marketRiskStatus: {
      market_date: "2026-04-27",
      summary: {
        entries: 100,
        requested_symbol: null,
        matched_symbols: [],
        missing_symbols: [],
        passed_count: 90,
        watchlist_count: 8,
        failed_count: 2,
      },
      items: [],
    },
    marketRiskStatusError: null,
    marketRiskStatusLoadState: "ready",
    numberLocale: "en-US",
    piotroskiMarketDate: "2026-04-27",
    piotroskiStatus: null,
    piotroskiStatusError: null,
    piotroskiStatusLoadState: "idle",
  });
  const pipelineStatus = buildPipelineStatus({
    market_date: "2026-04-27",
    status: "running",
    stage_order: ["price_collection", "fundamentals_daily_refresh", "unified_value_scoring"],
    stages: {
      price_collection: { status: "completed", processed: 100, total: 100, failed: 0 },
      fundamentals_daily_refresh: { status: "completed", processed: 100, total: 100, failed: 0 },
      unified_value_scoring: { status: "running", processed: 35, total: 90, failed: 0 },
    },
  });
  const rawScoringCardModel = buildScoringCardModel({
    copy,
    numberLocale: "en-US",
    pipelineStatus,
    scoringMarketDate: "2026-04-27",
  });

  const waitState = getDailyProcessDependencyWaitState({
    eodStageCards,
    filteringCardModel: rawFilteringCardModel,
    pipelineStatus,
    scoringCardModel: rawScoringCardModel,
  });
  const agentRoleCards = maskAgentRoleCardsAsWaiting(
    buildAgentRoleCards(buildAgentFeedbackProgress({ marketDate: "2026-04-27", totalSymbols: 90 }), copy, "en-US"),
    "en-US",
  );

  assert.equal(eodStageCards[0]?.statusLabel, "synced");
  assert.equal(rawFilteringCardModel.stages[1]?.status, "completed");
  assert.deepEqual(rawScoringCardModel.stages.map((stage) => stage.status), ["loading", "waiting", "waiting"]);
  assert.deepEqual(waitState, {
    filteringChecking: false,
    scoringChecking: true,
    waitForAgentFeedback: true,
    waitForFiltering: false,
    waitForScoring: false,
  });
  assert.equal(agentRoleCards.length > 0, true);
  assert.equal(agentRoleCards.every((role) => role.status === "pending"), true);
  assert.equal(agentRoleCards.every((role) => role.progressPercent === 0), true);
});

test("builds grouped daily process monitor state from patch, filter, scoring, and agent feedback cards", () => {
  const copy = getDashboardLiveCopy("en");
  const eodStageCards = [
    buildEodStageCard(
      "price",
      copy.stage.price,
      {
        status: "ready",
        symbols_total: 100,
        symbols_succeeded: 100,
        symbols_failed: 0,
      },
      "2026-04-27",
      "2026-04-27",
      "2026-04-27",
      "2026-04-27",
      false,
      null,
      copy,
      "en-US",
    ),
    buildEodStageCard(
      "technical",
      copy.stage.technical,
      {
        status: "running",
        symbols_total: 100,
        symbols_succeeded: 40,
        symbols_failed: 0,
      },
      "2026-04-27",
      "2026-04-26",
      "2026-04-27",
      "2026-04-27",
      false,
      {
        status: "running",
        current_step: "technical_snapshots",
        processed: 40,
        total: 100,
        failed: 0,
      },
      copy,
      "en-US",
    ),
  ];
  const filteringCardModel = buildFilteringCardModel({
    copy,
    marketRiskStatus: {
      market_date: "2026-04-27",
      summary: {
        entries: 100,
        requested_symbol: null,
        matched_symbols: [],
        missing_symbols: [],
        passed_count: 90,
        watchlist_count: 8,
        failed_count: 2,
      },
      items: [],
    },
    marketRiskStatusError: null,
    marketRiskStatusLoadState: "ready",
    numberLocale: "en-US",
    piotroskiMarketDate: "2026-04-27",
    piotroskiStatus: null,
    piotroskiStatusError: "Piotroski unavailable",
    piotroskiStatusLoadState: "error",
  });
  const agentRoleCards = buildAgentRoleCards(
    {
      request: {
        market_date: "2026-04-27",
        symbols: null,
        expected_agents: ["eod-summarizer", "technical-summarizer"],
      },
      summary: {
        run_id: "run-370",
        run_status: "running",
        run_table_status: "running",
        cycle_status: "running",
        is_live: true,
        run_started_at: "2026-04-27T17:00:00+09:00",
        run_completed_at: null,
        current_role: "technical-summarizer",
        completed_roles: ["eod-summarizer"],
        remaining_roles: ["technical-summarizer"],
        parallel_per_role: 1,
        latest_feedback_at: "2026-04-27T17:10:05+09:00",
        seconds_since_last_feedback: 2,
        stalled_threshold_seconds: 60,
        total_symbols: 100,
        processed_symbols: 52,
        completed_symbols: 51,
        in_progress_symbols: 1,
        pending_symbols: 48,
        progress_ratio: 0.52,
        progress_percent: 52,
        failed_items: 0,
        completed_feedback_count: 51,
        expected_feedback_count: 100,
      },
      result: null,
    },
    copy,
    "en-US",
  );
  const scoringCardModel = buildScoringCardModel({
    copy,
    numberLocale: "en-US",
    pipelineStatus: null,
    scoringMarketDate: "2026-04-27",
  });

  const model = buildProcessMonitorModel({
    agentRoleCards,
    copy,
    eodStageCards,
    filteringCardModel,
    numberLocale: "en-US",
    patchDate: "2026-04-27",
    scoringCardModel,
  });

  assert.deepEqual(model.groups.map((group) => group.key), ["patch", "filter", "scoring", "agent-feedback"]);
  assert.equal(model.patchDate, "2026-04-27");
  assert.equal(model.status, "error");
  assert.equal(model.currentGroupLabel, copy.processMonitor.groups.filter);
  assert.equal(model.currentStepLabel, copy.operational.piotroskiSectionTitle);
  assert.equal(model.progressLabel, "3 / 9");
  assert.equal(model.groups[0]?.status, "running");
  assert.equal(model.groups[0]?.currentStepLabel, copy.stage.technical);
  assert.equal(model.groups[1]?.status, "error");
  assert.equal(model.groups[1]?.steps.find((step) => step.key === "piotroski")?.note, "Piotroski unavailable");
  assert.equal(model.groups[2]?.status, "pending");
  assert.equal(model.groups[2]?.steps.find((step) => step.key === "unified-value")?.label, copy.scoring.stages.unifiedValue);
  assert.equal(model.groups[3]?.status, "running");
});

test("uses canonical pipeline progress when grouped process monitor rollup is complete but full pipeline is partial", () => {
  const copy = getDashboardLiveCopy("en");
  const completedPipelineStageKeys = new Set([
    "master_refresh",
    "pykrx_universe_refresh",
    "price_collection",
    "pykrx_enrichment",
    "technical_snapshots",
    "action_summaries",
    "trending_ranks",
    "signal_features",
    "market_risk_filter",
    "fundamentals_daily_refresh",
    "piotroski_filter",
    "momentum_factors",
    "unified_value_factors",
    "quality_factors",
    "agent_feedback_summaries",
  ]);
  const pipelineStatus = buildPipelineStatus({
    status: "partial",
    stage_order: [...CANONICAL_EOD_PIPELINE_STAGE_ORDER],
    stages: Object.fromEntries(
      CANONICAL_EOD_PIPELINE_STAGE_ORDER.map((stageKey) => {
        const isCompleted = completedPipelineStageKeys.has(stageKey);
        return [
          stageKey,
          buildPipelineStageDto(
            isCompleted ? "completed" : "pending",
            isCompleted ? 100 : null,
            isCompleted ? 100 : null,
          ),
        ];
      }),
    ),
  });
  const completedFreshnessStage = {
    status: "ready",
    symbols_total: 100,
    symbols_succeeded: 100,
    symbols_failed: 0,
  };
  const eodStageCards = [
    buildEodStageCard(
      "price",
      copy.stage.price,
      completedFreshnessStage,
      "2026-04-27",
      "2026-04-27",
      "2026-04-27",
      "2026-04-27",
      false,
      pipelineStatus.stages.price_collection,
      copy,
      "en-US",
    ),
    buildEodStageCard(
      "technical",
      copy.stage.technical,
      completedFreshnessStage,
      "2026-04-27",
      "2026-04-27",
      "2026-04-27",
      "2026-04-27",
      false,
      pipelineStatus.stages.technical_snapshots,
      copy,
      "en-US",
    ),
    buildEodStageCard(
      "action",
      copy.stage.action,
      completedFreshnessStage,
      "2026-04-27",
      "2026-04-27",
      "2026-04-27",
      "2026-04-27",
      false,
      pipelineStatus.stages.action_summaries,
      copy,
      "en-US",
    ),
    buildEodStageCard(
      "fundamentals",
      copy.stage.fundamentals,
      completedFreshnessStage,
      "2026-04-27",
      "2026-04-27",
      "2026-04-27",
      "2026-04-27",
      false,
      pipelineStatus.stages.fundamentals_daily_refresh,
      copy,
      "en-US",
    ),
  ];
  const filteringCardModel = buildFilteringCardModel({
    copy,
    marketRiskStatus: {
      market_date: "2026-04-27",
      summary: {
        entries: 100,
        requested_symbol: null,
        matched_symbols: [],
        missing_symbols: [],
        passed_count: 90,
        watchlist_count: 10,
        failed_count: 0,
      },
      items: [],
    },
    marketRiskStatusError: null,
    marketRiskStatusLoadState: "ready",
    numberLocale: "en-US",
    piotroskiMarketDate: "2026-04-27",
    piotroskiStatus: {
      market_date: "2026-04-27",
      summary: {
        entries: 100,
        requested_symbol: null,
        matched_symbols: [],
        missing_symbols: [],
        passed_count: 40,
        not_passed_count: 60,
      },
      items: [],
    },
    piotroskiStatusError: null,
    piotroskiStatusLoadState: "ready",
  });
  const completedScoringStage = {
    displayMarketDate: "2026-04-27",
    displayMarketDateLabel: "2026-04-27",
    metrics: [{ key: "progress", label: copy.processMonitor.progress, value: "100 / 100" }],
    note: null,
    progressLabel: "100 / 100",
    status: "completed" as const,
    statusLabel: copy.scoring.statuses.completed,
    statusTone: "positive" as const,
  };
  const scoringCardModel = {
    stages: [
      { ...completedScoringStage, key: "unified-value" as const, label: copy.scoring.stages.unifiedValue },
      { ...completedScoringStage, key: "quality" as const, label: copy.scoring.stages.quality },
      { ...completedScoringStage, key: "momentum" as const, label: copy.scoring.stages.momentum },
    ],
  };
  const agentRoleCards = buildAgentRoleCards(
    buildAgentFeedbackProgress({ marketDate: "2026-04-27", totalSymbols: 100 }),
    copy,
    "en-US",
  );

  const model = buildProcessMonitorModel({
    agentRoleCards,
    copy,
    eodStageCards,
    filteringCardModel,
    numberLocale: "en-US",
    patchDate: "2026-04-27",
    pipelineStatus,
    scoringCardModel,
  });

  assert.deepEqual(model.groups.map((group) => group.status), ["completed", "completed", "completed", "completed"]);
  assert.equal(model.pipeline.status, "partial");
  assert.equal(model.pipeline.progressLabel, "15 / 24");
  assert.equal(model.pipeline.currentStage, null);
  assert.equal(model.status, "partial");
  assert.equal(model.statusLabel, copy.processMonitor.statuses.partial);
  assert.equal(model.summarySource, "canonical-pipeline");
  assert.equal(model.progressLabel, "15 / 24");
  assert.equal(model.completedCount, 15);
  assert.equal(model.totalCount, 24);

  const blockedTopLevelOnlyPipelineStatus = buildPipelineStatus({
    status: "blocked",
    stage_order: [...CANONICAL_EOD_PIPELINE_STAGE_ORDER],
    stages: {},
    total_stages: CANONICAL_EOD_PIPELINE_STAGE_ORDER.length,
    display_completed_stages: 0,
  });
  const blockedTopLevelOnlyModel = buildProcessMonitorModel({
    agentRoleCards,
    copy,
    eodStageCards,
    filteringCardModel,
    numberLocale: "en-US",
    patchDate: "2026-04-27",
    pipelineStatus: blockedTopLevelOnlyPipelineStatus,
    scoringCardModel,
  });
  assert.deepEqual(blockedTopLevelOnlyModel.groups.map((group) => group.status), [
    "completed",
    "completed",
    "completed",
    "completed",
  ]);
  assert.equal(blockedTopLevelOnlyModel.pipeline.hasLiveStatus, true);
  assert.equal(blockedTopLevelOnlyModel.pipeline.status, "blocked");
  assert.equal(blockedTopLevelOnlyModel.pipeline.currentStage, null);
  assert.equal(
    blockedTopLevelOnlyModel.pipeline.stages.every(
      (stage) =>
        stage.progressSource === "fallback_inference" &&
        stage.sourceStatus === null &&
        stage.startedAt === null &&
        stage.updatedAt === null &&
        stage.completedAt === null &&
        stage.rowsPersisted === null &&
        stage.expectedRows === null &&
        stage.sourceRunIds.length === 0,
    ),
    true,
  );
  assert.equal(blockedTopLevelOnlyModel.status, "partial");
  assert.equal(blockedTopLevelOnlyModel.statusLabel, copy.processMonitor.statuses.partial);
  assert.equal(blockedTopLevelOnlyModel.summarySource, "canonical-pipeline");
  assert.equal(blockedTopLevelOnlyModel.progressLabel, "0 / 24");
  assert.equal(blockedTopLevelOnlyModel.completedCount, 0);
  assert.equal(blockedTopLevelOnlyModel.totalCount, 24);

  const pendingTopLevelModel = buildProcessMonitorModel({
    agentRoleCards,
    copy,
    eodStageCards,
    filteringCardModel,
    numberLocale: "en-US",
    patchDate: "2026-04-27",
    pipelineStatus: { ...pipelineStatus, status: "pending" },
    scoringCardModel,
  });
  assert.equal(pendingTopLevelModel.pipeline.status, "pending");
  assert.equal(pendingTopLevelModel.status, "partial");
  assert.equal(pendingTopLevelModel.statusLabel, copy.processMonitor.statuses.partial);
  assert.equal(pendingTopLevelModel.progressLabel, "15 / 24");

  const completedTopLevelModel = buildProcessMonitorModel({
    agentRoleCards,
    copy,
    eodStageCards,
    filteringCardModel,
    numberLocale: "en-US",
    patchDate: "2026-04-27",
    pipelineStatus: { ...pipelineStatus, status: "completed" },
    scoringCardModel,
  });
  assert.equal(completedTopLevelModel.pipeline.status, "completed");
  assert.equal(completedTopLevelModel.status, "partial");
  assert.equal(completedTopLevelModel.statusLabel, copy.processMonitor.statuses.partial);
  assert.equal(completedTopLevelModel.summarySource, "canonical-pipeline");
  assert.equal(completedTopLevelModel.progressLabel, "15 / 24");

  const fullyCompletedPipelineStatus = buildPipelineStatus({
    status: "completed",
    stage_order: [...CANONICAL_EOD_PIPELINE_STAGE_ORDER],
    stages: Object.fromEntries(
      CANONICAL_EOD_PIPELINE_STAGE_ORDER.map((stageKey) => [
        stageKey,
        buildPipelineStageDto("completed", 100, 100),
      ]),
    ),
  });
  const fullyCompletedModel = buildProcessMonitorModel({
    agentRoleCards,
    copy,
    eodStageCards,
    filteringCardModel,
    numberLocale: "en-US",
    patchDate: "2026-04-27",
    pipelineStatus: fullyCompletedPipelineStatus,
    scoringCardModel,
  });
  assert.deepEqual(fullyCompletedModel.groups.map((group) => group.status), [
    "completed",
    "completed",
    "completed",
    "completed",
  ]);
  assert.equal(fullyCompletedModel.pipeline.status, "completed");
  assert.equal(fullyCompletedModel.status, "completed");
  assert.equal(fullyCompletedModel.statusLabel, copy.processMonitor.statuses.completed);
  assert.equal(fullyCompletedModel.summarySource, "canonical-pipeline");
  assert.equal(fullyCompletedModel.progressLabel, "24 / 24");
  assert.equal(fullyCompletedModel.completedCount, 24);
  assert.equal(fullyCompletedModel.totalCount, 24);
});

test("keeps fallback-only canonical pipeline progress secondary to grouped process evidence", () => {
  const copy = getDashboardLiveCopy("ko");
  const completedFreshnessStage = {
    status: "ready",
    symbols_total: 2802,
    symbols_succeeded: 2802,
    symbols_failed: 0,
  };
  const eodStageCards = [
    buildEodStageCard(
      "price",
      copy.stage.price,
      completedFreshnessStage,
      "2026-06-29",
      "2026-06-29",
      "2026-06-29",
      "2026-06-29",
      false,
      null,
      copy,
      "ko-KR",
    ),
    buildEodStageCard(
      "technical",
      copy.stage.technical,
      completedFreshnessStage,
      "2026-06-29",
      "2026-06-29",
      "2026-06-29",
      "2026-06-29",
      false,
      null,
      copy,
      "ko-KR",
    ),
    buildEodStageCard(
      "action",
      copy.stage.action,
      completedFreshnessStage,
      "2026-06-29",
      "2026-06-29",
      "2026-06-29",
      "2026-06-29",
      false,
      null,
      copy,
      "ko-KR",
    ),
    buildEodStageCard(
      "fundamentals",
      copy.stage.fundamentals,
      completedFreshnessStage,
      "2026-06-29",
      "2026-06-29",
      "2026-06-29",
      "2026-06-29",
      false,
      null,
      copy,
      "ko-KR",
    ),
  ];
  const filteringCardModel = buildFilteringCardModel({
    copy,
    marketRiskStatus: null,
    marketRiskStatusError: "KIS risk timeout",
    marketRiskStatusLoadState: "error",
    numberLocale: "ko-KR",
    piotroskiMarketDate: "2026-06-29",
    piotroskiStatus: null,
    piotroskiStatusError: "Piotroski timeout",
    piotroskiStatusLoadState: "error",
  });
  const pipelineStatus = buildPipelineStatus({
    market_date: null,
    status: "pending",
    stage_order: [...CANONICAL_EOD_PIPELINE_STAGE_ORDER],
    stages: {},
    total_stages: 24,
    display_completed_stages: 0,
  });
  const scoringCardModel = buildScoringCardModel({
    copy,
    numberLocale: "ko-KR",
    pipelineStatus,
    scoringMarketDate: "2026-06-29",
  });
  const agentRoleCards = [
    {
      role: "eod-summarizer",
      label: copy.agentFeedback.roles.eod,
      status: "pending" as const,
      progressPercent: 0,
      progressLabel: "0 / 2,802",
      metrics: [],
      detailHref: null,
    },
    {
      role: "technical-summarizer",
      label: copy.agentFeedback.roles.technical,
      status: "pending" as const,
      progressPercent: 0,
      progressLabel: "0 / 2,802",
      metrics: [],
      detailHref: null,
    },
    {
      role: "fundamental-summarizer",
      label: copy.agentFeedback.roles.fundamental,
      status: "pending" as const,
      progressPercent: 0,
      progressLabel: "0 / 2,802",
      metrics: [],
      detailHref: null,
    },
  ];

  const model = buildProcessMonitorModel({
    agentRoleCards,
    copy,
    eodStageCards,
    filteringCardModel,
    numberLocale: "ko-KR",
    patchDate: "2026-06-29",
    pipelineStatus,
    scoringCardModel,
  });

  assert.equal(model.pipeline.hasLiveStatus, true);
  assert.equal(model.pipeline.currentStage, null);
  assert.equal(model.pipeline.progressLabel, "0 / 24");
  assert.equal(model.pipeline.stages.every((stage) => stage.progressSource === "fallback_inference"), true);
  assert.equal(model.summarySource, "grouped-rollup");
  assert.equal(model.status, "error");
  assert.equal(model.statusLabel, copy.processMonitor.statuses.error);
  assert.equal(model.currentGroupLabel, copy.processMonitor.groups.filter);
  assert.equal(model.currentStepLabel, copy.operational.piotroskiSectionTitle);
  assert.equal(model.progressLabel, "4 / 12");
  assert.equal(model.completedCount, 4);
  assert.equal(model.totalCount, 12);
  assert.deepEqual(model.groups.map((group) => group.status), ["completed", "error", "pending", "pending"]);
  assert.equal(model.groups[0]?.steps.find((step) => step.key === "price")?.progressLabel, "2,802 / 2,802");
});

test("marks fallback-only pipeline status unavailable when the status read fails", () => {
  const copy = getDashboardLiveCopy("en");
  const filteringCardModel = buildFilteringCardModel({
    copy,
    marketRiskStatus: null,
    marketRiskStatusError: null,
    marketRiskStatusLoadState: "idle",
    numberLocale: "en-US",
    piotroskiMarketDate: null,
    piotroskiStatus: null,
    piotroskiStatusError: null,
    piotroskiStatusLoadState: "idle",
  });
  const scoringCardModel = buildScoringCardModel({
    copy,
    numberLocale: "en-US",
    pipelineStatus: null,
    scoringMarketDate: null,
  });
  const pipelineStatus = buildPipelineStatus({
    market_date: null,
    status: "pending",
    stage_order: [...CANONICAL_EOD_PIPELINE_STAGE_ORDER],
    stages: {},
    total_stages: 24,
    display_completed_stages: 0,
  });

  const model = buildProcessMonitorModel({
    agentRoleCards: [],
    copy,
    eodStageCards: [],
    filteringCardModel,
    numberLocale: "en-US",
    pipelineStatus,
    pipelineStatusError: "HTTP 504 for /api/trading/eod/pipeline/status",
    scoringCardModel,
  });

  assert.equal(model.status, "unavailable");
  assert.equal(model.statusLabel, copy.processMonitor.statuses.unavailable);
  assert.equal(model.summarySource, "canonical-pipeline");
  assert.equal(model.progressLabel, copy.processMonitor.progressLabels.unavailable);
  assert.equal(model.completedCount, 0);
  assert.equal(model.totalCount, 0);
  assert.equal(model.currentGroupLabel, null);
  assert.equal(model.currentStepLabel, null);
  assert.equal(model.pipeline.progressLabel, "0 / 24");
  assert.equal(model.pipeline.stages.every((stage) => stage.progressSource === "fallback_inference"), true);
  assert.equal(model.pipelineAvailability.status, "unavailable");
  assert.equal(model.pipelineAvailability.hideFallbackStages, true);
  assert.match(model.pipelineAvailability.reason ?? "", /Pipeline status read unavailable/);
});

test("marks pipeline status degraded when a refresh fails but previous stage evidence exists", () => {
  const copy = getDashboardLiveCopy("en");
  const filteringCardModel = buildFilteringCardModel({
    copy,
    marketRiskStatus: null,
    marketRiskStatusError: null,
    marketRiskStatusLoadState: "idle",
    numberLocale: "en-US",
    piotroskiMarketDate: null,
    piotroskiStatus: null,
    piotroskiStatusError: null,
    piotroskiStatusLoadState: "idle",
  });
  const pipelineStatus = buildPipelineStatus({
    status: "running",
    stage_order: [...CANONICAL_EOD_PIPELINE_STAGE_ORDER],
    stages: {
      price_collection: {
        status: "running",
        processed: 4,
        total: 10,
        failed: 0,
        current_step: "price_collection",
      },
    },
    current_stage: "price_collection",
    total_stages: 24,
    display_completed_stages: 0,
  });
  const scoringCardModel = buildScoringCardModel({
    copy,
    numberLocale: "en-US",
    pipelineStatus,
    scoringMarketDate: "2026-04-21",
  });

  const model = buildProcessMonitorModel({
    agentRoleCards: [],
    copy,
    eodStageCards: [],
    filteringCardModel,
    numberLocale: "en-US",
    pipelineStatus,
    pipelineStatusError: "signal is aborted without reason",
    scoringCardModel,
  });

  assert.equal(model.status, "degraded");
  assert.equal(model.statusLabel, copy.processMonitor.statuses.degraded);
  assert.equal(model.progressLabel, "0 / 24");
  assert.equal(model.pipeline.currentStage?.key, "price_collection");
  assert.equal(model.pipelineAvailability.status, "degraded");
  assert.equal(model.pipelineAvailability.hideFallbackStages, false);
  assert.match(model.pipelineAvailability.reason ?? "", /Pipeline status refresh is degraded/);
});

test("localizes raw partial pipeline reasons in the Korean process monitor model", () => {
  const copy = getDashboardLiveCopy("ko");
  const filteringCardModel = buildFilteringCardModel({
    copy,
    marketRiskStatus: null,
    marketRiskStatusError: null,
    marketRiskStatusLoadState: "idle",
    numberLocale: "ko-KR",
    piotroskiMarketDate: null,
    piotroskiStatus: null,
    piotroskiStatusError: null,
    piotroskiStatusLoadState: "idle",
  });
  const scoringCardModel = buildScoringCardModel({
    copy,
    numberLocale: "ko-KR",
    pipelineStatus: null,
    scoringMarketDate: null,
  });
  const pipelineStatus = buildPipelineStatus({
    market_date: "2026-06-01",
    status: "running",
    stage_order: [...CANONICAL_EOD_PIPELINE_STAGE_ORDER],
    total_stages: 24,
    display_completed_stages: 20,
    current_stage: "market_risk_filter",
    stages: {
      market_risk_filter: {
        ...buildPipelineStageDto("partial", 20, 24),
        label: "KIS market-risk filter compute",
        details: {
          rows_persisted: 20,
          expected_rows: 24,
          progress_source: "stored_rows",
          reason: "row_count_partial_above_min_coverage",
          missing_count: 1,
          missing_symbols_sample: ["175140"],
        },
      },
    },
  });

  const model = buildProcessMonitorModel({
    agentRoleCards: [],
    copy,
    eodStageCards: [],
    filteringCardModel,
    numberLocale: "ko-KR",
    patchDate: "2026-06-01",
    pipelineStatus,
    scoringCardModel,
  });
  const currentStage = model.pipeline.currentStage;
  const primaryStageText = [
    currentStage?.label,
    currentStage?.progressLabel,
    currentStage?.progressSourceLabel,
    currentStage?.reason,
  ].join(" ");

  assert.equal(currentStage?.key, "market_risk_filter");
  assert.equal(currentStage?.progressLabel, "20 / 24");
  assert.equal(currentStage?.progressSourceLabel, copy.processMonitor.sourceLabels.storedRows);
  assert.match(primaryStageText, /누락 종목 1개: 175140/);
  assert.doesNotMatch(primaryStageText, /row_count_partial_above_min_coverage/);
  assert.doesNotMatch(primaryStageText, /Missing 1 symbol/i);
  assert.doesNotMatch(primaryStageText, /stored rows/i);
});

test("keeps the full daily process monitor completed from latest available data when today is empty", () => {
  const copy = getDashboardLiveCopy("en");
  const freshness = {
    today: {
      trade_date: "2026-04-30",
      price: {
        status: "missing",
        symbols_total: 2812,
        symbols_succeeded: 0,
        symbols_failed: 0,
      },
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
      fundamentals: {
        status: "missing",
        symbols_total: 2812,
        symbols_succeeded: 0,
        symbols_failed: 0,
      },
    },
    latest: {
      summary: {
        market_date: "2026-04-29",
        status: "completed",
        symbols_total: 2812,
        symbols_succeeded: 2812,
        symbols_failed: 0,
      },
      stage_details: {
        price: {
          market_date: "2026-04-29",
          status: "completed",
          symbols_total: 2812,
          symbols_succeeded: 2812,
          symbols_failed: 0,
        },
        technical_snapshots: {
          market_date: "2026-04-29",
          status: "completed",
          total: 2812,
          processed: 2812,
          failed: 0,
        },
        action_summaries: {
          market_date: "2026-04-29",
          status: "completed",
          total: 2812,
          completed_count: 2812,
          failed: 0,
        },
        fundamentals: {
          market_date: "2026-04-29",
          status: "completed",
          symbols_total: 2812,
          symbols_checked: 2812,
          symbols_failed: 0,
        },
      },
    },
    technical: {
      success: false,
      latest_date: "2026-04-29",
    },
    action: {
      success: false,
      latest_date: "2026-04-29",
    },
    fundamentals: {
      success: true,
      latest_date: "2026-04-29",
    },
  };
  const fundamentalsStatus = {
    latest_run: buildFundamentalsRun({
      market_date: "2026-04-30",
      status: "partial",
      symbols_total: 2812,
      symbols_checked: 0,
      symbols_failed: 0,
    }),
    runs: [],
  };
  const pipelineStatus = buildPipelineStatus({
    market_date: "2026-04-29",
    status: "completed",
    stage_order: ["price_collection", "technical_snapshots", "action_summaries", "fundamentals_daily_refresh"],
    stages: {
      price_collection: { status: "completed", processed: 2812, total: 2812, failed: 0 },
      technical_snapshots: { status: "completed", processed: 2812, total: 2812, failed: 0 },
      action_summaries: { status: "completed", processed: 2812, total: 2812, failed: 0 },
      fundamentals_daily_refresh: { status: "completed", processed: 2812, total: 2812, failed: 0 },
    },
  });
  const latestCoverage = {
    tradeDate: "2026-04-29",
    status: "completed",
    symbolsTotal: 2812,
    symbolsChecked: 2812,
    symbolsFailed: 0,
    source: "freshness_latest" as const,
  };
  const fundamentalsStatusLabel = getFundamentalsStatusLabel(
    freshness,
    fundamentalsStatus,
    latestCoverage,
    pipelineStatus.stages.fundamentals_daily_refresh ?? null,
  );
  const eodStageCards = [
    buildEodStageCard(
      "price",
      copy.stage.price,
      getPriceFreshnessStage(freshness, false),
      "2026-04-30",
      "2026-04-29",
      "2026-04-29",
      "2026-04-29",
      false,
      pipelineStatus.stages.price_collection,
      copy,
      "en-US",
    ),
    buildEodStageCard(
      "technical",
      copy.stage.technical,
      getTechnicalFreshnessStage(freshness, false),
      "2026-04-30",
      "2026-04-29",
      "2026-04-29",
      "2026-04-29",
      false,
      pipelineStatus.stages.technical_snapshots,
      copy,
      "en-US",
    ),
    buildEodStageCard(
      "action",
      copy.stage.action,
      getActionFreshnessStage(freshness, false),
      "2026-04-30",
      "2026-04-29",
      "2026-04-29",
      "2026-04-29",
      false,
      pipelineStatus.stages.action_summaries,
      copy,
      "en-US",
    ),
    buildEodStageCard(
      "fundamentals",
      copy.stage.fundamentals,
      getFundamentalsFreshnessStage(freshness, fundamentalsStatus, fundamentalsStatusLabel, "2026-04-29", false),
      "2026-04-30",
      "2026-04-29",
      "2026-04-29",
      "2026-04-29",
      false,
      pipelineStatus.stages.fundamentals_daily_refresh,
      copy,
      "en-US",
      {
        label: copy.operational.checked,
        value: "2,812",
      },
      getFundamentalsStageStatusLabel,
    ),
  ];
  const filteringCardModel = buildFilteringCardModel({
    copy,
    marketRiskStatus: {
      market_date: "2026-04-29",
      requested_market_date: "2026-04-30",
      resolved_market_date: "2026-04-29",
      is_latest_fallback: true,
      summary: {
        entries: 2812,
        requested_symbol: null,
        matched_symbols: [],
        missing_symbols: [],
        passed_count: 2400,
        watchlist_count: 200,
        failed_count: 0,
      },
      items: [],
    },
    marketRiskStatusError: null,
    marketRiskStatusLoadState: "ready",
    numberLocale: "en-US",
    piotroskiMarketDate: "2026-04-30",
    piotroskiStatus: {
      market_date: "2026-04-29",
      requested_market_date: "2026-04-30",
      resolved_market_date: "2026-04-29",
      is_latest_fallback: true,
      summary: {
        entries: 2812,
        requested_symbol: null,
        matched_symbols: [],
        missing_symbols: [],
        passed_count: 42,
        not_passed_count: 2770,
      },
      items: [],
    },
    piotroskiStatusError: null,
    piotroskiStatusLoadState: "ready",
  });
  const scoringCardModel = buildScoringCardModel({
    copy,
    numberLocale: "en-US",
    pipelineStatus,
    scoringMarketDate: "2026-04-30",
    scoringMomentumFactors: {
      market_date: "2026-04-29",
      requested_market_date: "2026-04-30",
      resolved_market_date: "2026-04-29",
      is_latest_fallback: true,
      summary: {
        entries: 2812,
        requested_symbols: [],
        matched_symbols: [],
        missing_symbols: [],
        ranked_symbols: 2812,
        eligible_symbols: 2400,
      },
      items: [],
    } as EodMomentumFactorsResponseDto,
    scoringMomentumFactorsLoadState: "ready",
    scoringValueFactors: {
      market_date: "2026-04-29",
      requested_market_date: "2026-04-30",
      resolved_market_date: "2026-04-29",
      is_latest_fallback: true,
      summary: {
        entries: 2812,
        requested_symbol: null,
        matched_symbols: [],
        missing_symbols: [],
        scored_count: 1,
        invalid_per_count: 0,
        missing_metric_count: 2811,
      },
      items: [
        {
          symbol: "005930",
          market_date: "2026-04-29",
          quality_score: 0.87,
          quality_status: "scored_complete",
          is_quality_score_complete: true,
        },
      ],
    } as EodValueFactorsResponseDto,
    scoringValueFactorsLoadState: "ready",
  });
  const agentRoleCards = buildAgentRoleCards(
    buildAgentFeedbackProgress({ marketDate: "2026-04-29", totalSymbols: 2400 }),
    copy,
    "en-US",
  );

  const model = buildProcessMonitorModel({
    agentRoleCards,
    copy,
    eodStageCards,
    filteringCardModel,
    numberLocale: "en-US",
    patchDate: "2026-04-29",
    scoringCardModel,
  });

  assert.equal(model.patchDate, "2026-04-29");
  assert.equal(model.status, "completed");
  assert.equal(model.progressLabel, "10 / 10");
  assert.deepEqual(model.groups.map((group) => group.status), ["completed", "completed", "completed", "completed"]);
  assert.deepEqual(model.groups[0]?.steps.map((step) => step.status), [
    "completed",
    "completed",
    "completed",
    "completed",
  ]);
  assert.deepEqual(model.groups[2]?.steps.map((step) => step.status), ["completed", "completed", "completed"]);
  assert.match(model.groups[1]?.steps[0]?.note ?? "", /Requested 2026-04-30/);
  assert.match(model.groups[2]?.steps[0]?.note ?? "", /Latest available 2026-04-29/);
});

test("keeps a running EOD process monitor step below complete progress when count reaches total", () => {
  const copy = getDashboardLiveCopy("en");
  const runningStageCard = buildEodStageCard(
    "technical",
    copy.stage.technical,
    {
      status: "running",
      symbols_total: 100,
      symbols_succeeded: 100,
      symbols_failed: 0,
    },
    "2026-04-27",
    "2026-04-27",
    "2026-04-27",
    "2026-04-27",
    false,
    {
      status: "running",
      current_step: "technical_snapshots",
      processed: 100,
      total: 100,
      failed: 0,
    },
    copy,
    "en-US",
  );
  const completedStageCard = buildEodStageCard(
    "action",
    copy.stage.action,
    {
      status: "ready",
      symbols_total: 100,
      symbols_succeeded: 100,
      symbols_failed: 0,
    },
    "2026-04-27",
    "2026-04-27",
    "2026-04-27",
    "2026-04-27",
    false,
    null,
    copy,
    "en-US",
  );
  const filteringCardModel = buildFilteringCardModel({
    copy,
    marketRiskStatus: null,
    marketRiskStatusError: null,
    marketRiskStatusLoadState: "idle",
    numberLocale: "en-US",
    piotroskiMarketDate: null,
    piotroskiStatus: null,
    piotroskiStatusError: null,
    piotroskiStatusLoadState: "idle",
  });
  const scoringCardModel = buildScoringCardModel({
    copy,
    numberLocale: "en-US",
    pipelineStatus: null,
    scoringMarketDate: null,
  });

  const model = buildProcessMonitorModel({
    agentRoleCards: [],
    copy,
    eodStageCards: [runningStageCard, completedStageCard],
    filteringCardModel,
    numberLocale: "en-US",
    scoringCardModel,
  });
  const runningStep = model.groups[0]?.steps.find((step) => step.key === "technical");
  const completedStep = model.groups[0]?.steps.find((step) => step.key === "action");

  assert.equal(runningStep?.status, "running");
  assert.equal(runningStep?.progressLabel, "100 / 100");
  assert.equal(runningStep?.progressPercent, 40);
  assert.equal(completedStep?.status, "completed");
  assert.equal(completedStep?.progressLabel, "100 / 100");
  assert.equal(completedStep?.progressPercent, 100);
});

test("keeps dashboard polling at the active cadence until a stop acceptance marks the run stalled", () => {
  const progress = {
    request: {
      market_date: "2026-04-21",
      symbols: null,
      expected_agents: ["eod-summarizer"],
    },
    summary: {
      run_id: "run-1",
      run_status: "running",
      run_table_status: "running",
      is_live: true,
      run_started_at: "2026-04-21T09:00:00+09:00",
      run_completed_at: null,
      current_role: "eod-summarizer",
      parallel_per_role: 1,
      latest_feedback_at: "2026-04-21T09:00:05+09:00",
      seconds_since_last_feedback: 1,
      stalled_threshold_seconds: 60,
      total_symbols: 10,
      processed_symbols: 3,
      completed_symbols: 2,
      in_progress_symbols: 1,
      pending_symbols: 7,
      progress_ratio: 0.3,
      progress_percent: 30,
      failed_items: 0,
      completed_feedback_count: 2,
      expected_feedback_count: 10,
      completed_feedback_per_minute: 20,
      completed_symbols_per_minute: 20,
      estimated_remaining_seconds: 21,
      estimated_completion_at: "2026-04-21T09:01:00+09:00",
      eta_confidence: "medium",
    },
    result: null,
  };

  const stopped = markAgentFeedbackProgressStopped(progress);

  assert.equal(getAgentFeedbackProgressPollDelayMs(progress), 1_000);
  assert.equal(stopped?.summary.run_status, "stalled");
  assert.equal(stopped?.summary.is_live, false);
  assert.equal(getAgentFeedbackProgressPollDelayMs(stopped ?? null), 30_000);
});

test("retries signal-decider feedback errors without polling completed successful reads", () => {
  const progress = {
    request: {
      market_date: "2026-04-21",
      symbols: null,
      expected_agents: ["signal-decider"],
    },
    summary: {
      run_id: "run-1",
      run_status: "running",
      run_table_status: "running",
      is_live: true,
      run_started_at: "2026-04-21T09:00:00+09:00",
      run_completed_at: null,
      current_role: "signal-decider",
      parallel_per_role: 1,
      latest_feedback_at: "2026-04-21T09:00:05+09:00",
      seconds_since_last_feedback: 1,
      stalled_threshold_seconds: 60,
      total_symbols: 10,
      processed_symbols: 3,
      completed_symbols: 2,
      in_progress_symbols: 1,
      pending_symbols: 7,
      progress_ratio: 0.3,
      progress_percent: 30,
      failed_items: 0,
      completed_feedback_count: 2,
      expected_feedback_count: 10,
    },
    result: null,
  };
  const completedProgress = {
    ...progress,
    summary: {
      ...progress.summary,
      run_status: "completed",
      run_table_status: "completed",
      is_live: false,
      run_completed_at: "2026-04-21T09:05:00+09:00",
      current_role: null,
      progress_percent: 100,
    },
  };

  assert.equal(getSignalDeciderFeedbackPollDelayMs({ progress, hadError: false }), 1_000);
  assert.equal(getSignalDeciderFeedbackPollDelayMs({ progress: completedProgress, hadError: false }), null);
  assert.equal(getSignalDeciderFeedbackPollDelayMs({ progress: completedProgress, hadError: true }), 5_000);
  assert.equal(getSignalDeciderFeedbackPollDelayMs({ progress: null, hadError: true }), 5_000);
});

test("treats disconnect-shaped stop errors as accepted while keeping real upstream failures visible", () => {
  assert.equal(shouldTreatAgentFeedbackStopDisconnectAsAccepted(new Error("fetch failed")), true);
  assert.equal(shouldTreatAgentFeedbackStopDisconnectAsAccepted(new Error("Failed to fetch")), true);
  assert.equal(shouldTreatAgentFeedbackStopDisconnectAsAccepted(new Error("HTTP 502 for /api/trading/agent-context/internal/core/control")), false);
});

test("keeps pipeline polling at the active cadence while the status or any stage is still running", () => {
  assert.equal(
    getEodPipelineStatusPollDelayMs({
      market_date: "2026-04-21",
      status: "running",
      stage_order: ["price_collection"],
      stages: {
        price_collection: {
          status: "completed",
          processed: 1,
          total: 1,
          failed: 0,
        },
      },
    }),
    1_000,
  );
  assert.equal(
    getEodPipelineStatusPollDelayMs({
      market_date: "2026-04-21",
      status: "completed",
      stage_order: ["price_collection"],
      stages: {
        price_collection: {
          status: "running",
          processed: 10,
          total: 100,
          failed: 0,
        },
      },
    }),
    1_000,
  );
  assert.equal(
    getEodPipelineStatusPollDelayMs({
      market_date: "2026-04-21",
      status: "completed",
      stage_order: ["price_collection"],
      stages: {
        price_collection: {
          status: "completed",
          processed: 100,
          total: 100,
          failed: 0,
        },
      },
    }),
    30_000,
  );
});

test("revalidates a requested-date filtering fallback while the active dashboard cycle is still running", () => {
  assert.equal(
    shouldRevalidateFilteringFallback({
      requestedMarketDate: "2026-04-27",
      piotroskiStatus: {
        requested_market_date: "2026-04-27",
        resolved_market_date: "2026-04-24",
        market_date: "2026-04-24",
        is_latest_fallback: true,
      },
      marketRiskStatus: null,
      pipelineStatus: {
        market_date: "2026-04-27",
        status: "running",
        stage_order: ["fundamentals_daily_refresh"],
        stages: {
          fundamentals_daily_refresh: {
            status: "running",
            processed: 120,
            total: 3583,
            failed: 0,
          },
        },
      },
      agentFeedbackProgress: null,
    }),
    true,
  );
});

test("keeps filtering fallback revalidation alive until the same-day response resolves", () => {
  const fallbackStatus = {
    requested_market_date: "2026-04-27",
    resolved_market_date: "2026-04-24",
    market_date: "2026-04-24",
    is_latest_fallback: true,
  };

  assert.equal(
    shouldRevalidateFilteringFallback({
      requestedMarketDate: "2026-04-27",
      piotroskiStatus: {
        requested_market_date: "2026-04-27",
        resolved_market_date: "2026-04-27",
        market_date: "2026-04-27",
        is_latest_fallback: false,
      },
      marketRiskStatus: null,
      pipelineStatus: {
        market_date: "2026-04-27",
        status: "running",
        stage_order: [],
        stages: {},
      },
      agentFeedbackProgress: null,
    }),
    false,
  );
  assert.equal(
    shouldRevalidateFilteringFallback({
      requestedMarketDate: "2026-04-27",
      piotroskiStatus: fallbackStatus,
      marketRiskStatus: null,
      pipelineStatus: {
        market_date: "2026-04-27",
        status: "completed",
        stage_order: ["fundamentals_daily_refresh"],
        stages: {
          fundamentals_daily_refresh: {
            status: "completed",
            processed: 3583,
            total: 3583,
            failed: 0,
          },
        },
      },
      agentFeedbackProgress: {
        request: {
          market_date: "2026-04-27",
          symbols: null,
          expected_agents: [],
        },
        summary: {
          run_id: "run-27",
          run_status: "completed",
          run_table_status: "completed",
          is_live: false,
          run_started_at: "2026-04-27T17:00:00+09:00",
          run_completed_at: "2026-04-27T17:45:00+09:00",
          latest_feedback_at: "2026-04-27T17:45:00+09:00",
          seconds_since_last_feedback: 30,
          stalled_threshold_seconds: 300,
          total_symbols: 3583,
          processed_symbols: 3583,
          completed_symbols: 3583,
          in_progress_symbols: 0,
          pending_symbols: 0,
          progress_ratio: 1,
          progress_percent: 100,
          failed_items: 0,
          completed_feedback_count: 0,
          expected_feedback_count: 0,
        },
        result: null,
      },
    }),
    true,
  );
});

test("keeps the active summarizer row running when top-level feedback summary says the cycle is live", () => {
  const copy = getDashboardLiveCopy("en");
  const progress = {
    request: {
      market_date: "2026-04-27",
      symbols: null,
      expected_agents: ["eod-summarizer", "technical-summarizer", "fundamental-summarizer"],
    },
    summary: {
      run_id: "feedback-cycle-2026-04-27-b41f820e31",
      run_status: "pending",
      run_table_status: "running",
      cycle_status: "running",
      is_live: true,
      run_started_at: "2026-04-27T17:00:00+09:00",
      run_completed_at: null,
      current_role: "technical-summarizer",
      completed_roles: ["eod-summarizer"],
      remaining_roles: ["technical-summarizer", "fundamental-summarizer"],
      parallel_per_role: 1,
      latest_feedback_at: "2026-04-27T17:10:05+09:00",
      seconds_since_last_feedback: 2,
      stalled_threshold_seconds: 60,
      total_symbols: 2812,
      processed_symbols: 97,
      completed_symbols: 97,
      in_progress_symbols: 1,
      pending_symbols: 2715,
      progress_ratio: 0.3,
      progress_percent: 30,
      failed_items: 0,
      completed_feedback_count: 136,
      expected_feedback_count: 2812,
      role_progress: {
        "eod-summarizer": {
          status: "partial",
          processed_symbols: 97,
          completed_symbols: 97,
        },
        "technical-summarizer": {
          status: "pending",
          processed_symbols: 39,
          completed_symbols: 39,
          total_symbols: 100,
          boundary_status: "pending",
        },
      },
    },
    result: null,
  };

  assert.equal(getAgentFeedbackProgressPollDelayMs(progress), 1_000);

  const roleCards = buildAgentRoleCards(progress, copy, "en-US");
  assert.deepEqual(
    roleCards.map((role) => [role.role, role.status]),
    [
      ["eod-summarizer", "completed"],
      ["technical-summarizer", "running"],
      ["fundamental-summarizer", "pending"],
    ],
  );
  assert.equal(roleCards[0]?.progressLabel, "100.00%");
  assert.equal(roleCards[1]?.progressLabel, "39.00%");
  assert.equal(roleCards[2]?.progressLabel, "0.00%");
  assert.deepEqual(roleCards[1]?.metrics, [
    {
      key: "progress",
      label: copy.agentFeedback.metrics.progress,
      value: "39.00%",
    },
    {
      key: "total",
      label: copy.agentFeedback.metrics.total,
      value: "100",
    },
    {
      key: "failed",
      label: copy.agentFeedback.metrics.failed,
      value: "0",
    },
    {
      key: "completed",
      label: copy.agentFeedback.metrics.completed,
      value: "39",
    },
  ]);
});

test("shows completed capped summarizer roles as fully complete while later roles continue", () => {
  const copy = getDashboardLiveCopy("en");
  const progress = {
    request: {
      market_date: "2026-06-12",
      symbols: null,
      expected_agents: [
        "eod-summarizer",
        "technical-summarizer",
        "fundamental-summarizer",
        "short-term-decider",
        "signal-decider",
      ],
    },
    summary: {
      run_id: "feedback-cycle-2026-06-12-role-cap",
      run_status: "running",
      run_table_status: "running",
      cycle_status: "running",
      is_live: true,
      run_started_at: "2026-06-12T16:44:32+09:00",
      run_completed_at: null,
      current_role: "short-term-decider",
      completed_roles: ["eod-summarizer", "technical-summarizer", "fundamental-summarizer"],
      remaining_roles: ["short-term-decider", "signal-decider"],
      parallel_per_role: 5,
      latest_feedback_at: "2026-06-12T19:46:46+09:00",
      seconds_since_last_feedback: 120,
      stalled_threshold_seconds: 300,
      total_symbols: 232,
      processed_symbols: 232,
      completed_symbols: 99,
      in_progress_symbols: 133,
      pending_symbols: 0,
      progress_ratio: 0.73,
      progress_percent: 73.23,
      failed_items: 1,
      completed_feedback_count: 620,
      expected_feedback_count: 848,
      role_progress: {
        "eod-summarizer": {
          status: "completed",
          completed_symbols: 232,
          total_symbols: 232,
          progress_percent: 100,
        },
        "technical-summarizer": {
          status: "partial",
          completed_symbols: 187,
          total_symbols: 232,
          pending_symbols: 45,
          progress_percent: 80.6,
        },
        "fundamental-summarizer": {
          status: "partial",
          completed_symbols: 163,
          total_symbols: 232,
          pending_symbols: 69,
          progress_percent: 70.26,
        },
        "short-term-decider": {
          status: "pending",
          completed_symbols: 38,
          total_symbols: 232,
          failed_items: 1,
          progress_percent: 16.81,
        },
      },
    },
    result: null,
  };

  const roleCards = buildAgentRoleCards(progress, copy, "en-US");
  const technicalRole = roleCards.find((role) => role.role === "technical-summarizer");
  const fundamentalRole = roleCards.find((role) => role.role === "fundamental-summarizer");
  const shortTermRole = roleCards.find((role) => role.role === "short-term-decider");

  assert.equal(technicalRole?.status, "completed");
  assert.equal(technicalRole?.progressLabel, "100.00%");
  assert.equal(fundamentalRole?.status, "completed");
  assert.equal(fundamentalRole?.progressLabel, "100.00%");
  assert.equal(shortTermRole?.status, "running");
  assert.equal(shortTermRole?.progressLabel, "16.81%");
});

test("preserves role-specific completed counts when the overall feedback cycle is completed", () => {
  const copy = getDashboardLiveCopy("en");
  const progress = {
    request: {
      market_date: "2026-04-27",
      symbols: null,
      expected_agents: ["technical-summarizer", "fundamental-summarizer", "signal-decider"],
    },
    summary: {
      run_id: "feedback-cycle-2026-04-27-completed",
      run_status: "completed",
      run_table_status: "completed",
      cycle_status: "completed",
      is_live: false,
      run_started_at: "2026-04-27T17:00:00+09:00",
      run_completed_at: "2026-04-27T17:45:00+09:00",
      current_role: null,
      completed_roles: ["technical-summarizer", "fundamental-summarizer", "signal-decider"],
      remaining_roles: [],
      parallel_per_role: 1,
      latest_feedback_at: "2026-04-27T17:45:00+09:00",
      seconds_since_last_feedback: 120,
      stalled_threshold_seconds: 60,
      total_symbols: 3583,
      processed_symbols: 3583,
      completed_symbols: 3583,
      in_progress_symbols: 0,
      pending_symbols: 0,
      progress_ratio: 1,
      progress_percent: 100,
      failed_items: 0,
      completed_feedback_count: 150,
      expected_feedback_count: 150,
      role_progress: {
        "technical-summarizer": {
          status: "completed",
          processed_symbols: 120,
        },
        "fundamental-summarizer": {
          status: "completed",
          completed_symbols: 7,
        },
      },
    },
    result: {
      market_date: "2026-04-27",
      roles: {
        "signal-decider": {
          requested_count: 23,
          completed_count: 23,
          error_count: 0,
        },
      },
    },
  };

  const roleCards = buildAgentRoleCards(progress, copy, "en-US");
  const technicalRole = roleCards.find((role) => role.role === "technical-summarizer");
  const fundamentalRole = roleCards.find((role) => role.role === "fundamental-summarizer");
  const signalDeciderRole = roleCards.find((role) => role.role === "signal-decider");

  assert.equal(technicalRole?.status, "completed");
  assert.equal(technicalRole?.progressLabel, "100.00%");
  assert.equal(technicalRole?.metrics.find((metric) => metric.key === "completed")?.value, "120");
  assert.notEqual(technicalRole?.metrics.find((metric) => metric.key === "completed")?.value, "3,583");
  assert.equal(fundamentalRole?.status, "completed");
  assert.equal(fundamentalRole?.progressLabel, "100.00%");
  assert.equal(fundamentalRole?.metrics.find((metric) => metric.key === "completed")?.value, "7");
  assert.notEqual(fundamentalRole?.metrics.find((metric) => metric.key === "completed")?.value, "3,583");
  assert.equal(signalDeciderRole?.metrics.find((metric) => metric.key === "completed")?.value, "23");
});

test("shows signal-decider metrics when a live cycle reaches the decider after summarizers", () => {
  const copy = getDashboardLiveCopy("en");
  const progress = {
    request: {
      market_date: "2026-04-27",
      symbols: null,
      expected_agents: ["eod-summarizer", "technical-summarizer", "fundamental-summarizer", "signal-decider"],
    },
    summary: {
      run_id: "feedback-cycle-2026-04-27-signal-decider",
      run_status: "pending",
      run_table_status: "running",
      cycle_status: "running",
      is_live: true,
      run_started_at: "2026-04-27T17:00:00+09:00",
      run_completed_at: null,
      current_role: "signal-decider",
      completed_roles: ["eod-summarizer", "technical-summarizer", "fundamental-summarizer"],
      remaining_roles: ["signal-decider"],
      parallel_per_role: 1,
      latest_feedback_at: "2026-04-27T17:28:05+09:00",
      seconds_since_last_feedback: 2,
      stalled_threshold_seconds: 60,
      total_symbols: 10,
      processed_symbols: 8,
      completed_symbols: 6,
      in_progress_symbols: 0,
      pending_symbols: 2,
      progress_ratio: 0.8,
      progress_percent: 80,
      failed_items: 2,
      completed_feedback_count: 206,
      expected_feedback_count: 210,
      role_progress: {
        "eod-summarizer": {
          status: "completed",
          processed_symbols: 10,
          completed_symbols: 10,
          total_symbols: 10,
          progress_percent: 100,
        },
        "technical-summarizer": {
          status: "completed",
          processed_symbols: 10,
          completed_symbols: 10,
          total_symbols: 10,
          progress_percent: 100,
        },
        "fundamental-summarizer": {
          status: "completed",
          processed_symbols: 10,
          completed_symbols: 10,
          total_symbols: 10,
          progress_percent: 100,
        },
        "signal-decider": {
          status: "running",
          processed_symbols: 8,
          completed_symbols: 6,
          total_symbols: 10,
          failed_items: 2,
          progress_percent: 80,
        },
      },
    },
    result: null,
  };

  const roleCards = buildAgentRoleCards(progress, copy, "en-US");
  assert.deepEqual(
    roleCards.map((role) => [role.role, role.status]),
    [
      ["eod-summarizer", "completed"],
      ["technical-summarizer", "completed"],
      ["fundamental-summarizer", "completed"],
      ["signal-decider", "running"],
    ],
  );

  const signalDeciderRole = roleCards.find((role) => role.role === "signal-decider");
  assert.equal(signalDeciderRole?.progressLabel, "80.00%");
  assert.deepEqual(signalDeciderRole?.metrics, [
    {
      key: "progress",
      label: copy.agentFeedback.metrics.progress,
      value: "80.00%",
    },
    {
      key: "total",
      label: copy.agentFeedback.metrics.total,
      value: "10",
    },
    {
      key: "failed",
      label: copy.agentFeedback.metrics.failed,
      value: "2",
    },
    {
      key: "completed",
      label: copy.agentFeedback.metrics.completed,
      value: "6",
    },
  ]);

  for (const summarizerRole of roleCards.filter((role) => role.role.includes("summarizer"))) {
    assert.deepEqual(summarizerRole.metrics, []);
  }
});

test("keeps signal-decider eligible for row progress bars after running metrics are replaced by results", () => {
  const copy = getDashboardLiveCopy("en");
  const progress = {
    request: {
      market_date: "2026-04-27",
      symbols: null,
      expected_agents: ["preflight-gate", "signal-decider"],
    },
    summary: {
      run_id: "feedback-cycle-2026-04-27-results",
      run_status: "completed",
      run_table_status: "completed",
      cycle_status: "completed",
      is_live: false,
      run_started_at: "2026-04-27T17:00:00+09:00",
      run_completed_at: "2026-04-27T17:30:00+09:00",
      current_role: null,
      completed_roles: ["preflight-gate", "signal-decider"],
      remaining_roles: [],
      parallel_per_role: 1,
      latest_feedback_at: "2026-04-27T17:30:00+09:00",
      seconds_since_last_feedback: 120,
      stalled_threshold_seconds: 60,
      total_symbols: 3,
      processed_symbols: 3,
      completed_symbols: 3,
      in_progress_symbols: 0,
      pending_symbols: 0,
      progress_ratio: 1,
      progress_percent: 100,
      failed_items: 0,
      completed_feedback_count: 5,
      expected_feedback_count: 5,
    },
    result: {
      market_date: "2026-04-27",
      roles: {
        "preflight-gate": {
          requested_count: 3,
          completed_count: 3,
          error_count: 0,
        },
        "signal-decider": {
          requested_count: 3,
          completed_count: 2,
          error_count: 0,
        },
      },
    },
  };

  const roleCards = buildAgentRoleCards(progress, copy, "en-US");
  const preflightRole = roleCards.find((role) => role.role === "preflight-gate");
  const signalDeciderRole = roleCards.find((role) => role.role === "signal-decider");

  assert.ok(preflightRole);
  assert.ok(signalDeciderRole);
  assert.deepEqual(signalDeciderRole.metrics.map((metric) => metric.key), ["completed", "errors"]);
  assert.equal(signalDeciderRole.metrics.some((metric) => metric.key === "progress"), false);
  assert.equal(shouldShowAgentRoleProgress(signalDeciderRole), true);
  assert.equal(shouldShowAgentRoleProgress(preflightRole), false);
});

test("shows short-term decider agent role progress alongside signal-decider result metrics", () => {
  const copy = getDashboardLiveCopy("en");
  const progress = {
    request: {
      market_date: "2026-04-27",
      symbols: null,
      expected_agents: ["signal-decider", "short-term-decider"],
    },
    summary: {
      run_id: "feedback-cycle-2026-04-27-deciders",
      run_status: "completed",
      run_table_status: "completed",
      cycle_status: "completed",
      is_live: false,
      run_started_at: "2026-04-27T17:00:00+09:00",
      run_completed_at: "2026-04-27T17:30:00+09:00",
      current_role: null,
      completed_roles: ["signal-decider", "short-term-decider"],
      remaining_roles: [],
      parallel_per_role: 1,
      latest_feedback_at: "2026-04-27T17:30:00+09:00",
      seconds_since_last_feedback: 120,
      stalled_threshold_seconds: 60,
      total_symbols: 6,
      processed_symbols: 6,
      completed_symbols: 6,
      in_progress_symbols: 0,
      pending_symbols: 0,
      progress_ratio: 1,
      progress_percent: 100,
      failed_items: 1,
      completed_feedback_count: 10,
      expected_feedback_count: 12,
    },
    result: {
      market_date: "2026-04-27",
      roles: {
        "signal-decider": {
          requested_count: 6,
          completed_count: 6,
          error_count: 0,
        },
        "short-term-decider": {
          requested_count: 6,
          completed_count: 5,
          error_count: 1,
        },
      },
    },
  };

  const roleCards = buildAgentRoleCards(progress, copy, "en-US");
  assert.deepEqual(
    roleCards.map((role) => role.role),
    ["signal-decider", "short-term-decider"],
  );

  const signalDeciderRole = roleCards.find((role) => role.role === "signal-decider");
  const shortTermDeciderRole = roleCards.find((role) => role.role === "short-term-decider");

  assert.ok(signalDeciderRole);
  assert.ok(shortTermDeciderRole);
  assert.equal(shortTermDeciderRole.label, copy.agentFeedback.roles.shortTermDecider);
  assert.deepEqual(signalDeciderRole.metrics, [
    {
      key: "completed",
      label: copy.agentFeedback.metrics.completed,
      value: "6",
    },
    {
      key: "errors",
      label: copy.agentFeedback.metrics.errors,
      value: "0",
    },
  ]);
  assert.deepEqual(shortTermDeciderRole.metrics, [
    {
      key: "completed",
      label: copy.agentFeedback.metrics.completed,
      value: "5",
    },
    {
      key: "errors",
      label: copy.agentFeedback.metrics.errors,
      value: "1",
    },
  ]);
  assert.equal(shouldShowAgentRoleProgress(shortTermDeciderRole), true);
});

test("does not treat a stale latest_feedback_at timestamp as active progress when the top-level summary is pending", () => {
  const progress = {
    request: {
      market_date: "2026-04-27",
      symbols: null,
      expected_agents: ["technical-summarizer"],
    },
    summary: {
      run_id: "feedback-cycle-2026-04-27-idle",
      run_status: "pending",
      run_table_status: null,
      cycle_status: null,
      is_live: false,
      run_started_at: "2026-04-27T17:00:00+09:00",
      run_completed_at: null,
      current_role: "technical-summarizer",
      completed_roles: [],
      remaining_roles: ["technical-summarizer"],
      parallel_per_role: 1,
      latest_feedback_at: "2026-04-27T17:10:05+09:00",
      seconds_since_last_feedback: 600,
      stalled_threshold_seconds: 60,
      total_symbols: 2812,
      processed_symbols: 0,
      completed_symbols: 0,
      in_progress_symbols: 0,
      pending_symbols: 2812,
      progress_ratio: 0,
      progress_percent: 0,
      failed_items: 0,
      completed_feedback_count: 0,
      expected_feedback_count: 2812,
    },
    result: null,
  };

  assert.equal(getResolvedAgentProgressRunStatus(progress), "pending");
  assert.equal(getAgentFeedbackProgressPollDelayMs(progress), 30_000);
});
