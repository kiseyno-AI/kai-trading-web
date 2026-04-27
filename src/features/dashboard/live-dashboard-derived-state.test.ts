import assert from "node:assert/strict";
import test from "node:test";

import { getDashboardLiveCopy } from "@/i18n/dashboard-live-copy";
import type {
  DartFundamentalsDailyRunDto,
  EodFreshnessStageDto,
  EodMarketRiskFiltersResponseDto,
  EodPiotroskiFilterResultsResponseDto,
} from "@/types/trading-api";

import {
  buildAgentRoleCards,
  buildEodStageCard,
  buildFilteringCardModel,
  buildTrackedSymbolCardModel,
  getAgentFeedbackProgressPollDelayMs,
  getEodPipelineStatusPollDelayMs,
  getFundamentalsStageStatusLabel,
  getFundamentalsUpdatedActivityModel,
  getFundamentalsUpdatedSymbolsDetail,
  getResolvedAgentProgressRunStatus,
  getSignalDeciderFeedbackPollDelayMs,
  markAgentFeedbackProgressStopped,
  shouldRevalidateFilteringFallback,
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
  assert.equal(piotroskiStage?.statusTone, "positive");
  assert.equal(piotroskiStage?.statusLabel, copy.piotroski.completed);
  assert.equal(piotroskiStage?.checkedCountLabel, "3,200");
  assert.equal(piotroskiStage?.metrics.find((metric) => metric.key === "pass")?.value, "14");
  assert.equal(
    piotroskiStage?.note,
    `${copy.piotroski.requestedDate} 2026-04-21 · ${copy.piotroski.latestAvailableDate} 2026-04-18`,
  );
  assert.equal(marketRiskStage?.metrics.find((metric) => metric.key === "watchlist")?.value, "200");
  assert.equal(marketRiskStage?.metrics.find((metric) => metric.key === "fail")?.value, "100");
  assert.equal(
    marketRiskStage?.note,
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
  assert.equal(roleCards[1]?.metrics.length > 0, true);
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
