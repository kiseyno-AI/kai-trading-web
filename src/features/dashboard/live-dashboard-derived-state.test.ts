import assert from "node:assert/strict";
import test from "node:test";

import { getDashboardLiveCopy } from "@/i18n/dashboard-live-copy";
import type { EodFreshnessStageDto } from "@/types/trading-api";

import {
  buildEodStageCard,
  buildPiotroskiFilteringCardModel,
  buildTrackedSymbolCardModel,
  getAgentFeedbackProgressPollDelayMs,
  getEodPipelineStatusPollDelayMs,
  getFundamentalsStageStatusLabel,
  markAgentFeedbackProgressStopped,
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

test("keeps running stage badge, title, and tone mapping stable", () => {
  const copy = getDashboardLiveCopy("en");
  const card = buildEodStageCard(
    "price",
    copy.stage.price,
    buildStage("running"),
    "2026-04-21",
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
    "2026-04-18",
    false,
    null,
    copy,
    "en-US",
  );

  assert.equal(card.details.find((detail) => detail.key === "latest-date")?.value, "2026-04-17");
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
