import assert from "node:assert/strict";
import test from "node:test";

import { getDashboardLiveCopy } from "@/i18n/dashboard-live-copy";
import type {
  ExecutionRuntimeDailyBoardResponseDto,
  ExecutionRuntimeStatusResponseDto,
} from "@/types/trading-api/execution-runtime";

import {
  buildExecutionRuntimeDailyBoardModel,
  buildExecutionRuntimeSummaryModel,
} from "./execution-runtime-display";

const copy = getDashboardLiveCopy("en").executionRuntime;

test("marks ready execution runtime state as connected and healthy", () => {
  const status: ExecutionRuntimeStatusResponseDto = {
    status: "ready",
    mode: "paper",
    exec_connected: true,
    automation_enabled: true,
    paused: false,
    kill_switch_enabled: false,
    monitoring_alive: true,
    last_heartbeat_at: "2026-04-30T00:09:58Z",
    open_order_count: 0,
    active_execution_job_count: 0,
    issues: [],
  };

  const model = buildExecutionRuntimeSummaryModel({
    copy,
    error: null,
    nowMs: Date.parse("2026-04-30T00:10:00Z"),
    numberLocale: "en-US",
    status,
  });

  assert.equal(model.statusLabel, "Exec online");
  assert.equal(model.statusTone, "positive");
  assert.equal(model.connectionLabel, "Connected");
  assert.equal(model.monitoringLabel, "Heartbeat alive");
  assert.equal(model.automationLabel, "Automation enabled");
  assert.equal(model.contextLabel, null);
});

test("marks offline execution runtime state explicitly", () => {
  const status: ExecutionRuntimeStatusResponseDto = {
    status: "offline",
    mode: "paper",
    exec_connected: false,
    automation_enabled: false,
    paused: false,
    kill_switch_enabled: false,
    monitoring_alive: false,
    last_heartbeat_at: null,
    open_order_count: 0,
    active_execution_job_count: 0,
    issues: [{ code: "unavailable", message: "exec runtime unavailable" }],
  };

  const model = buildExecutionRuntimeSummaryModel({
    copy,
    error: null,
    nowMs: Date.parse("2026-04-30T00:10:00Z"),
    numberLocale: "en-US",
    status,
  });

  assert.equal(model.statusLabel, "Exec offline");
  assert.equal(model.statusTone, "warning");
  assert.equal(model.connectionLabel, "Disconnected");
  assert.equal(model.monitoringLabel, "Heartbeat missing");
  assert.equal(model.heartbeatLabel, "No heartbeat");
  assert.deepEqual(model.issueLabels, ["Unavailable: exec runtime unavailable"]);
});

test("keeps unavailable runtime reads separate from guessed online/offline payloads", () => {
  const model = buildExecutionRuntimeSummaryModel({
    copy,
    error: "Trading API upstream is unavailable.",
    nowMs: Date.parse("2026-04-30T00:10:00Z"),
    numberLocale: "en-US",
    status: null,
  });

  assert.equal(model.statusKey, "offline");
  assert.equal(model.statusLabel, "Runtime unavailable");
  assert.equal(model.statusTone, "warning");
  assert.equal(model.contextLabel, "Execution runtime read unavailable. Trading API upstream is unavailable.");
});

test("keeps degraded runtime status visible with stale heartbeat recency", () => {
  const status: ExecutionRuntimeStatusResponseDto = {
    status: "degraded",
    mode: "live",
    exec_connected: true,
    automation_enabled: true,
    paused: false,
    kill_switch_enabled: false,
    monitoring_alive: false,
    last_heartbeat_at: "2026-04-30T00:00:00Z",
    open_order_count: 2,
    active_execution_job_count: 1,
    issues: [{ code: "readiness_reason", message: "monitor loop stalled" }],
  };

  const model = buildExecutionRuntimeSummaryModel({
    copy,
    error: null,
    nowMs: Date.parse("2026-04-30T00:07:00Z"),
    numberLocale: "en-US",
    status,
  });

  assert.equal(model.statusLabel, "Exec degraded");
  assert.equal(model.statusTone, "warning");
  assert.equal(model.connectionLabel, "Connected");
  assert.equal(model.automationLabel, "Automation enabled");
  assert.equal(model.heartbeatLabel, "7m ago");
  assert.equal(model.openOrderCountLabel, "2");
  assert.equal(model.activeExecutionJobCountLabel, "1");
});

test("marks paused runtime status as a warning safety state", () => {
  const status: ExecutionRuntimeStatusResponseDto = {
    status: "paused",
    mode: "paper",
    exec_connected: true,
    automation_enabled: true,
    paused: true,
    kill_switch_enabled: false,
    monitoring_alive: true,
    last_heartbeat_at: "2026-04-30T00:09:58Z",
    open_order_count: 0,
    active_execution_job_count: 0,
    issues: [],
  };

  const model = buildExecutionRuntimeSummaryModel({
    copy,
    error: null,
    nowMs: Date.parse("2026-04-30T00:10:00Z"),
    numberLocale: "en-US",
    status,
  });

  assert.equal(model.statusLabel, "Automation paused");
  assert.equal(model.statusTone, "warning");
  assert.equal(model.automationLabel, "Paused");
  assert.equal(model.automationTone, "warning");
});

test("marks kill-switched runtime status as a warning safety state", () => {
  const status: ExecutionRuntimeStatusResponseDto = {
    status: "kill_switched",
    mode: "paper",
    exec_connected: true,
    automation_enabled: true,
    paused: false,
    kill_switch_enabled: true,
    monitoring_alive: true,
    last_heartbeat_at: "2026-04-30T00:09:58Z",
    open_order_count: 0,
    active_execution_job_count: 0,
    issues: [],
  };

  const model = buildExecutionRuntimeSummaryModel({
    copy,
    error: null,
    nowMs: Date.parse("2026-04-30T00:10:00Z"),
    numberLocale: "en-US",
    status,
  });

  assert.equal(model.statusLabel, "Kill switch active");
  assert.equal(model.statusTone, "warning");
  assert.equal(model.automationLabel, "Kill switch enabled");
  assert.equal(model.automationTone, "warning");
});

test("preserves partial board rows when summary or row fields are incomplete", () => {
  const board: ExecutionRuntimeDailyBoardResponseDto = {
    market_date: "2026-04-30",
    summary: {
      items_total: 2,
      filled: 1,
    },
    items: [
      {
        symbol: "005930",
        name: "Samsung Electronics",
        market: "KOSPI",
        intent: "next_open_buy",
        status: "partial",
        planned_quantity: null,
        filled_quantity: "5",
        planned_price: null,
        avg_fill_price: null,
        last_updated_at: null,
      },
      {
        symbol: "000660",
        name: null,
        market: null,
        intent: "next_open_buy",
        status: "failed",
        failure_reason: "broker rejected order",
        planned_quantity: 10,
        filled_quantity: 0,
      },
    ],
  };

  const model = buildExecutionRuntimeDailyBoardModel({
    board,
    copy,
    error: null,
    numberLocale: "en-US",
  });

  assert.equal(model.totalLabel, "2");
  assert.equal(model.summaryItems.find((item) => item.key === "partial")?.value, "1");
  assert.equal(model.summaryItems.find((item) => item.key === "failed")?.value, "1");
  assert.equal(model.rows[0].statusLabel, "Partially filled");
  assert.equal(model.rows[0].fillLabel, "5");
  assert.equal(model.rows[0].priceLabel, "Price unavailable");
  assert.equal(model.rows[1].nameLabel, "000660");
  assert.equal(model.rows[1].failureReason, "broker rejected order");
});
