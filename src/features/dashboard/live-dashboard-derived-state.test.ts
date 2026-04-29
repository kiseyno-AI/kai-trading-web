import assert from "node:assert/strict";
import test from "node:test";

import { getDashboardLiveCopy } from "@/i18n/dashboard-live-copy";
import type {
  AgentFeedbackProgressResponseDto,
  DartFundamentalsDailyRunDto,
  EodFreshnessStageDto,
  EodMarketRiskFiltersResponseDto,
  EodPipelineStatusResponseDto,
  EodPiotroskiFilterResultsResponseDto,
  MarketSnapshotResponseDto,
} from "@/types/trading-api";

import {
  UNKNOWN_LABEL,
  buildAgentRoleCards,
  getDailyProcessDependencyWaitState,
  buildEodStageCard,
  buildFilteringCardModel,
  buildMarketSnapshotPresentation,
  buildProcessMonitorModel,
  buildScoringCardModel,
  formatEodSymbolCount,
  getAgentFeedbackProgressPollDelayMs,
  getEodPipelineStatusPollDelayMs,
  getFundamentalsStageStatusLabel,
  getFundamentalsStatusLabel,
  getFundamentalsUpdatedActivityModel,
  getFundamentalsUpdatedCountLabel,
  getFundamentalsUpdatedSymbolsDetail,
  getFundamentalsCheckedCount,
  getFundamentalsFreshnessStage,
  getPipelineStageResolvedStatusDate,
  getMarketSnapshotPollDelayMs,
  getResolvedAgentProgressRunStatus,
  getSignalDeciderFeedbackPollDelayMs,
  markAgentFeedbackProgressStopped,
  maskAgentRoleCardsAsWaiting,
  maskFilteringCardModelAsWaiting,
  maskFutureEodStageCardsWhilePipelineRunning,
  mergeRunningPipelineStage,
  resolveFundamentalsPollingPresentation,
  shouldRevalidateFilteringFallback,
  shouldShowAgentRoleProgress,
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

test("treats a stale market snapshot as unavailable while the latest snapshot load is errored", () => {
  const copy = getDashboardLiveCopy("en");
  const presentation = buildMarketSnapshotPresentation(copy, buildMarketSnapshot(), "HTTP 503");

  assert.equal(presentation.isReady, false);
  assert.equal(presentation.displaySnapshot, null);
  assert.equal(presentation.statusLabel, copy.marketOverview.snapshotUnavailable);
  assert.equal(presentation.statusTone, "warning");
  assert.equal(presentation.fallbackContextLabel, copy.marketOverview.snapshotDependencyPending);
});

test("keeps the market snapshot ready when present and the latest snapshot load has no error", () => {
  const copy = getDashboardLiveCopy("en");
  const snapshot = buildMarketSnapshot();
  const presentation = buildMarketSnapshotPresentation(copy, snapshot, null);

  assert.equal(presentation.isReady, true);
  assert.equal(presentation.displaySnapshot, snapshot);
  assert.equal(presentation.statusLabel, copy.marketOverview.snapshotReady);
  assert.equal(presentation.statusTone, "positive");
  assert.equal(presentation.fallbackContextLabel, copy.marketOverview.conditionNote);
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

  const recoveredSnapshot = buildMarketSnapshot();
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

test("uses the agent feedback target as the final filtering count when progress is available", () => {
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
  assert.equal(model.stages[1]?.status, "pending");
  assert.equal(model.stages[1]?.progressLabel, UNKNOWN_LABEL);
  assert.equal(model.stages[1]?.note, copy.scoring.notes.pending);
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
  assert.equal(filteringCardModel.finalFilteredCountLabel, UNKNOWN_LABEL);
  assert.deepEqual(scoringCardModel.stages.map((stage) => stage.status), ["waiting", "waiting", "waiting"]);
  assert.deepEqual(scoringCardModel.stages.map((stage) => stage.progressLabel), [
    UNKNOWN_LABEL,
    UNKNOWN_LABEL,
    UNKNOWN_LABEL,
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
  assert.deepEqual(rawScoringCardModel.stages.map((stage) => stage.status), ["loading", "pending", "pending"]);
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
  assert.deepEqual(roleCards[1]?.metrics, [
    {
      key: "progress",
      label: copy.agentFeedback.metrics.progress,
      value: "30.00%",
    },
    {
      key: "total",
      label: copy.agentFeedback.metrics.total,
      value: "2,812",
    },
    {
      key: "failed",
      label: copy.agentFeedback.metrics.failed,
      value: "0",
    },
    {
      key: "completed",
      label: copy.agentFeedback.metrics.completed,
      value: "97",
    },
  ]);
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
