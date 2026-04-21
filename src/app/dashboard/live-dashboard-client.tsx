"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ComponentTag } from "@/components/dev/component-tag";
import { DevModeToggle } from "@/components/dev/dev-mode-toggle";
import { MobileAppChrome } from "@/components/mobile/mobile-app-chrome";
import { getAgentFeedbackProgressMarketDate } from "@/lib/agent-feedback-progress";
import {
  buildDartFundamentalsDailyInspectPath,
  DART_FUNDAMENTALS_DAILY_INSPECT_CLIENT_PATH,
  normalizeDartFundamentalsMarketDate,
} from "@/lib/dart-fundamentals-daily";
import { buildEodPipelineStatusPath, EOD_PIPELINE_STATUS_CLIENT_PATH } from "@/lib/eod-pipeline-status";
import { formatDisplayTimestamp, formatPrice, formatTurnover } from "@/lib/format";
import { resolveTradingApiClientPath } from "@/lib/trading-api-client-path";
import { getCachedTradingApiJson, seedTradingApiJsonCache } from "@/lib/trading-api-cache";
import type {
  AgentFeedbackProgressResponseDto,
  AgentFeedbackRunStatus,
  DartFundamentalsDailyInspectResponseDto,
  DartFundamentalsDailyRunDto,
  EodFreshnessLayerStatusDto,
  EodFreshnessResponseDto,
  EodFreshnessStageDto,
  EodPipelineStageDto,
  EodPipelineStageKey,
  EodPipelineStatusResponseDto,
} from "@/types/trading-api";

import styles from "./live-dashboard-client.module.css";

const UNKNOWN_LABEL = "[확인 필요]";
const TRACKED_QUOTES_RETRY_DELAYS_MS = [5_000, 15_000, 30_000] as const;
const EOD_PIPELINE_STATUS_RUNNING_POLL_MS = 1_000;
const EOD_PIPELINE_STATUS_IDLE_POLL_MS = 30_000;
const AGENT_FEEDBACK_PROGRESS_RUNNING_POLL_MS = 1_000;
const AGENT_FEEDBACK_PROGRESS_IDLE_POLL_MS = 30_000;
const AGENT_FEEDBACK_STOP_DIALOG_ID = "agent-feedback-stop-dialog";
const FUNDAMENTALS_UPDATED_SYMBOL_SAMPLE_LIMIT = 4;
const EOD_PIPELINE_STAGE_DEFINITIONS = [
  { key: "price_collection", label: "Price Collection", showWhenMissing: true },
  { key: "technical_snapshots", label: "Technical Snapshots", showWhenMissing: true },
  { key: "action_summaries", label: "Action Summaries", showWhenMissing: true },
  { key: "trending_ranks", label: "Trending Ranks", showWhenMissing: true },
  { key: "signal_features", label: "Signal Features", showWhenMissing: true },
  { key: "fundamentals_daily_refresh", label: "Fundamentals Daily Refresh", showWhenMissing: false },
] as const satisfies ReadonlyArray<{
  key: EodPipelineStageKey;
  label: string;
  showWhenMissing?: boolean;
}>;
const AGENT_PROGRESS_STATUS_LABELS = {
  pending: "에이전트 분석 대기",
  running: "에이전트 분석 중...",
  stalled: "에이전트 확인 필요",
  completed: "에이전트 분석 완료",
} satisfies Record<AgentFeedbackRunStatus, string>;
type KnownAgentRole = "eod-summarizer" | "technical-summarizer" | "fundamental-summarizer";
const AGENT_ROLE_LABELS = {
  "eod-summarizer": "EOD summarizer",
  "technical-summarizer": "Technical summarizer",
  "fundamental-summarizer": "Fundamental summarizer",
} satisfies Record<KnownAgentRole, string>;
const AGENT_ROLE_STATUS_LABELS = {
  completed: "확인 완료",
  running: "실행 중",
  pending: "대기",
} satisfies Record<AgentRoleStatus, string>;

export type CoreMarketStatus = {
  market?: string | null;
  state: string;
  is_trading_day?: boolean | null;
  is_open: boolean;
  server_time?: string | null;
  as_of?: string | null;
  session_open_at?: string | null;
  session_close_at?: string | null;
  reason?: string | null;
};

export type CoreTrackedQuote = {
  symbol: string;
  company_name?: string | null;
  name?: string | null;
  name_ko?: string | null;
  price: number | null;
  change: number | null;
  change_pct: number | null;
  volume: number | null;
  turnover: number | null;
  as_of: string | null;
  market_state: string;
  source: string;
  fallback: boolean;
  is_live: boolean;
  available: boolean;
  trade_date?: string | null;
  cached_at?: string | null;
  fallback_reason?: string | null;
  unavailable_reason?: string | null;
};

export type CoreTrackedQuotesResponse = {
  market_state: string;
  as_of: string;
  items: CoreTrackedQuote[];
};

type LiveDashboardClientProps = {
  initialError?: string | null;
  initialMarket: CoreMarketStatus;
  initialTracked: CoreTrackedQuotesResponse;
  initialFreshness: EodFreshnessResponseDto | null;
  initialFundamentalsStatus: DartFundamentalsDailyInspectResponseDto | null;
  initialPipelineStatus: EodPipelineStatusResponseDto | null;
  initialAgentFeedbackProgress: AgentFeedbackProgressResponseDto | null;
};

type DetailItem = {
  label: string;
  value: string;
};

type FundamentalsFailureDetails = {
  key: string;
  title: string;
  reason: string;
  details: DetailItem[];
  metadata: DetailItem[];
};

type SymbolMetadataItem = {
  symbol: string;
  company_name?: string | null;
  name?: string | null;
  name_ko?: string | null;
  market?: string | null;
  standard_code?: string | null;
};

type SymbolSearchResponse = {
  items: SymbolMetadataItem[];
};

type EodStageId = "price" | "technical" | "action" | "fundamentals";

type EodStageCard = {
  id: EodStageId;
  label: string;
  latestDate: string | null;
  statusLabel: "synced" | "running" | "break day" | "not synced";
  tone: "positive" | "info" | "neutral" | "warning";
  details: EodStageDetail[];
};

type EodStageDetail = {
  key: string;
  label: string;
  value: string;
  tone?: "count" | "text";
};

type PipelineStageCard = {
  key: EodPipelineStageKey;
  label: string;
  statusLabel: string;
  tone: "positive" | "info" | "neutral" | "warning";
  details: EodStageDetail[];
  isActive: boolean;
};

type AgentRoleStatus = "completed" | "running" | "pending";

type AgentRoleDependencyStatus = "confirmed" | "running" | "failed" | "pending";

type AgentRoleDependency = {
  key: string;
  label: string;
  status: AgentRoleDependencyStatus;
  failedCount: number | null;
};

type AgentRoleCard = {
  role: string;
  label: string;
  status: AgentRoleStatus;
  dependencies: AgentRoleDependency[];
};

function hasNumber(value: number | null | undefined): value is number {
  return typeof value === "number";
}

function formatSignedPercent(value: number | null | undefined, fallback = "Unavailable"): string {
  if (!hasNumber(value)) return fallback;
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatSignedNumber(value: number | null | undefined, fallback = "Unavailable"): string {
  if (!hasNumber(value)) return fallback;
  return `${value >= 0 ? "+" : ""}${value.toLocaleString("ko-KR")}`;
}

function getUsableCompanyName(symbol: string, ...values: Array<string | null | undefined>): string | null {
  const normalizedSymbol = symbol.trim().toUpperCase();
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed && trimmed.toUpperCase() !== normalizedSymbol) {
      return trimmed;
    }
  }

  return null;
}

function getQuoteCompanyName(item: CoreTrackedQuote | undefined): string | null {
  if (!item) return null;
  return getUsableCompanyName(item.symbol, item.company_name, item.name_ko, item.name);
}

function getMetadataCompanyName(
  item: CoreTrackedQuote,
  metadata: SymbolMetadataItem | null | undefined,
): string | null {
  return getUsableCompanyName(item.symbol, metadata?.name_ko, metadata?.name, metadata?.company_name);
}

function getCompanyName(item: CoreTrackedQuote | undefined, metadata?: SymbolMetadataItem | null): string {
  if (!item) return "N/A";
  return getQuoteCompanyName(item) ?? getMetadataCompanyName(item, metadata) ?? UNKNOWN_LABEL;
}

function pickSymbolMetadata(symbol: string, response: SymbolSearchResponse): SymbolMetadataItem | null {
  const normalizedSymbol = symbol.trim().toUpperCase();
  return response.items.find((item) => item.symbol.trim().toUpperCase() === normalizedSymbol) ?? null;
}

function getJson<T>(path: string): Promise<T> {
  return getCachedTradingApiJson<T>(resolveTradingApiClientPath(path));
}

function getDashboardLoadErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to refresh dashboard data.";
}

function isOfflineTrackedPlaceholder(tracked: CoreTrackedQuotesResponse) {
  return (
    tracked.market_state === "offline-placeholder" ||
    tracked.items.some((item) => item.source === "mock" || item.fallback_reason === "offline_placeholder")
  );
}

function getQuoteToneClass(value: number | null | undefined): string {
  if (!hasNumber(value)) return "";
  return value >= 0 ? styles.positive : styles.negative;
}

function describeQuoteSource(item: CoreTrackedQuote | undefined): string {
  if (!item) return "N/A";
  if (!item.available) {
    return item.unavailable_reason ? `Quote unavailable · ${item.unavailable_reason}` : "Quote unavailable";
  }
  if (!item.fallback) {
    return item.is_live ? "Live KIS quote" : item.source;
  }
  if (item.source === "daily_price_bar") {
    return item.trade_date ? `DB EOD fallback · ${item.trade_date}` : "DB EOD fallback";
  }
  if (item.source === "db_cache") {
    return "Same-day DB quote cache";
  }
  if (item.source === "cache") {
    return "Same-day memory cache";
  }
  return `${item.source} fallback`;
}

function getPriceFreshnessLabel(item: CoreTrackedQuote) {
  if (!item.available) return item.trade_date ?? "Unavailable";
  if (item.is_live) return "Live";
  if (item.trade_date) return item.trade_date;
  return formatDisplayTimestamp(item.as_of ?? item.cached_at, "Pending");
}

function getTechnicalFreshnessLabel(freshness: EodFreshnessResponseDto | null) {
  return freshness?.technical?.latest_date ?? freshness?.latest?.technical_market_date ?? "[확인 필요]";
}

function getFundamentalsFreshnessLayer(
  freshness: EodFreshnessResponseDto | null,
): EodFreshnessLayerStatusDto | null {
  return freshness?.fundamentals ?? freshness?.fundamental ?? null;
}

function getLatestFundamentalsRun(
  fundamentalsStatus: DartFundamentalsDailyInspectResponseDto | null,
): DartFundamentalsDailyRunDto | null {
  return fundamentalsStatus?.latest_run ?? fundamentalsStatus?.runs?.[0] ?? null;
}

function getDatePart(value: string | null | undefined) {
  if (!hasTextValue(value)) return null;
  return value.slice(0, 10);
}

function getFundamentalsRunDate(run: DartFundamentalsDailyRunDto | null) {
  return run?.market_date ?? getDatePart(run?.completed_at) ?? getDatePart(run?.started_at);
}

function getFundamentalsFreshnessDate(
  freshness: EodFreshnessResponseDto | null,
  fundamentalsStatus: DartFundamentalsDailyInspectResponseDto | null,
) {
  return (
    getFundamentalsFreshnessLayer(freshness)?.latest_date ??
    getFundamentalsRunDate(getLatestFundamentalsRun(fundamentalsStatus))
  );
}

function humanizeToken(value: string | null | undefined, fallback = UNKNOWN_LABEL) {
  if (!hasTextValue(value)) return fallback;
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function getFundamentalsStatusLabel(
  freshness: EodFreshnessResponseDto | null,
  fundamentalsStatus: DartFundamentalsDailyInspectResponseDto | null,
  latestFundamentalsDate: string | null,
  pipelineStage: EodPipelineStageDto | null,
) {
  if (normalizePipelineStageStatus(pipelineStage) === "running") return "Running";

  const runStatus = getLatestFundamentalsRun(fundamentalsStatus)?.status;
  if (hasTextValue(runStatus)) return humanizeToken(runStatus);

  const freshnessLayer = getFundamentalsFreshnessLayer(freshness);
  if (freshnessLayer?.success === true) return "Available";
  if (freshnessLayer?.success === false) return "Needs review";
  if (hasTextValue(latestFundamentalsDate)) return "Available";

  return UNKNOWN_LABEL;
}

function getHumanCount(value: number | null | undefined) {
  if (!hasNumber(value)) return UNKNOWN_LABEL;
  return value.toLocaleString("ko-KR");
}

function getFailureCountPhrase(count: number, singularLabel: string, pluralLabel: string) {
  const label = count === 1 ? singularLabel : pluralLabel;
  return `${count.toLocaleString("ko-KR")} ${label}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatMetadataValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return hasTextValue(value) ? value : null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getFailureMetadata(run: DartFundamentalsDailyRunDto | null): DetailItem[] {
  if (!isRecord(run?.run_metadata)) return [];

  return Object.entries(run.run_metadata)
    .filter(([key, value]) => /(error|fail|reason|exception|message|missing|stale)/i.test(key) && value !== null)
    .map(([key, value]) => ({
      label: humanizeToken(key, key),
      value: formatMetadataValue(value) ?? UNKNOWN_LABEL,
    }))
    .filter((item) => item.value !== UNKNOWN_LABEL)
    .slice(0, 8);
}

function hasFundamentalsFailureSignal(
  freshness: EodFreshnessResponseDto | null,
  run: DartFundamentalsDailyRunDto | null,
  statusLabel: string,
) {
  const normalizedStatus = statusLabel.toLowerCase();
  const symbolsFailed = run?.symbols_failed;
  const eventsFailed = run?.events_failed;
  return (
    normalizedStatus === "failed" ||
    normalizedStatus === "partial" ||
    normalizedStatus === "needs review" ||
    (hasNumber(symbolsFailed) && symbolsFailed > 0) ||
    (hasNumber(eventsFailed) && eventsFailed > 0) ||
    Boolean(hasTextValue(run?.error_message)) ||
    getFundamentalsFreshnessLayer(freshness)?.success === false
  );
}

function getFundamentalsFailureReason(
  freshness: EodFreshnessResponseDto | null,
  run: DartFundamentalsDailyRunDto | null,
  statusLabel: string,
) {
  if (hasTextValue(run?.error_message)) return run.error_message.trim();

  const failedCounts: string[] = [];
  const symbolsFailed = run?.symbols_failed;
  const eventsFailed = run?.events_failed;
  if (hasNumber(symbolsFailed) && symbolsFailed > 0) {
    failedCounts.push(getFailureCountPhrase(symbolsFailed, "failed symbol", "failed symbols"));
  }
  if (hasNumber(eventsFailed) && eventsFailed > 0) {
    failedCounts.push(getFailureCountPhrase(eventsFailed, "failed event", "failed events"));
  }

  if (failedCounts.length > 0) {
    return `Trading-core reported ${failedCounts.join(" and ")} for this fundamentals run.`;
  }

  if (getFundamentalsFreshnessLayer(freshness)?.success === false) {
    return "The freshness registry marked the fundamentals layer as unsuccessful.";
  }

  return `Trading-core marked this fundamentals run as ${statusLabel}.`;
}

function getFundamentalsFailureDetails(
  freshness: EodFreshnessResponseDto | null,
  fundamentalsStatus: DartFundamentalsDailyInspectResponseDto | null,
  latestFundamentalsDate: string | null,
  statusLabel: string,
): FundamentalsFailureDetails | null {
  const run = getLatestFundamentalsRun(fundamentalsStatus);

  if (!hasFundamentalsFailureSignal(freshness, run, statusLabel)) return null;

  const runDate = getFundamentalsRunDate(run) ?? latestFundamentalsDate ?? UNKNOWN_LABEL;

  return {
    key: `${run?.id ?? "freshness"}:${runDate}:${statusLabel}`,
    title: `DART fundamentals ${statusLabel.toLowerCase()}`,
    reason: getFundamentalsFailureReason(freshness, run, statusLabel),
    details: [
      { label: "Run date", value: runDate },
      { label: "Status", value: statusLabel },
      { label: "FS division", value: run?.fs_div ?? UNKNOWN_LABEL },
      { label: "Trigger", value: humanizeToken(run?.trigger) },
      { label: "Symbols total", value: getHumanCount(run?.symbols_total) },
      { label: "Symbols checked", value: getHumanCount(run?.symbols_checked) },
      { label: "Symbols missing", value: getHumanCount(run?.symbols_missing) },
      { label: "Symbols stale", value: getHumanCount(run?.symbols_stale) },
      { label: "Symbols fresh", value: getHumanCount(run?.symbols_fresh) },
      { label: "Symbols refreshed", value: getHumanCount(run?.symbols_refreshed) },
      { label: "Symbols failed", value: getHumanCount(run?.symbols_failed) },
      { label: "Events detected", value: getHumanCount(run?.events_detected) },
      { label: "Events captured", value: getHumanCount(run?.events_captured) },
      { label: "Events failed", value: getHumanCount(run?.events_failed) },
      { label: "Started", value: formatDisplayTimestamp(run?.started_at, UNKNOWN_LABEL) },
      { label: "Completed", value: formatDisplayTimestamp(run?.completed_at, UNKNOWN_LABEL) },
    ],
    metadata: getFailureMetadata(run),
  };
}

function hasTextValue(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasEodReadinessSignal(freshness: EodFreshnessResponseDto | null) {
  return (
    hasTextValue(freshness?.latest?.price_trade_date) ||
    hasNumber(getEodSymbolsSucceeded(freshness)) ||
    hasNumber(getEodSymbolsTotal(freshness))
  );
}

function formatEodSymbolCount(value: number | null | undefined) {
  if (!hasNumber(value)) return UNKNOWN_LABEL;
  return value.toLocaleString("ko-KR");
}

function getEodSymbolsSucceeded(freshness: EodFreshnessResponseDto | null) {
  return (
    freshness?.today?.price?.symbols_succeeded ??
    freshness?.today?.symbols_succeeded ??
    freshness?.latest?.symbols_succeeded
  );
}

function getEodSymbolsTotal(freshness: EodFreshnessResponseDto | null) {
  return (
    freshness?.today?.price?.symbols_total ??
    freshness?.today?.symbols_total ??
    freshness?.latest?.symbols_total
  );
}

function getEodSymbolsFailed(freshness: EodFreshnessResponseDto | null) {
  return (
    freshness?.today?.price?.symbols_failed ??
    freshness?.today?.symbols_failed ??
    freshness?.latest?.symbols_failed
  );
}

function buildStage(
  status: string | null,
  symbolsTotal: number | null | undefined,
  symbolsSucceeded: number | null | undefined,
  symbolsFailed: number | null | undefined,
): EodFreshnessStageDto | null {
  if (!hasTextValue(status)) return null;

  return {
    status,
    symbols_total: symbolsTotal ?? null,
    symbols_succeeded: symbolsSucceeded ?? null,
    symbols_failed: symbolsFailed ?? null,
  };
}

function normalizeStageStatus(stage: EodFreshnessStageDto | null | undefined) {
  return stage?.status?.trim().toLowerCase() ?? null;
}

function normalizePipelineStatus(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? null;
}

function normalizePipelineStageStatus(stage: EodPipelineStageDto | null | undefined) {
  return normalizePipelineStatus(stage?.status);
}

function getPipelineStage(
  pipelineStatus: EodPipelineStatusResponseDto | null,
  key: EodPipelineStageKey,
) {
  return pipelineStatus?.stages?.[key] ?? null;
}

function mergeRunningPipelineStage(
  stage: EodFreshnessStageDto | null,
  pipelineStage: EodPipelineStageDto | null | undefined,
) {
  if (normalizePipelineStageStatus(pipelineStage) !== "running") return stage;

  return buildStage(
    "running",
    pipelineStage?.total ?? stage?.symbols_total,
    pipelineStage?.processed ?? stage?.symbols_succeeded,
    pipelineStage?.failed ?? stage?.symbols_failed,
  );
}

function hasRunningDashboardPipelineStage(pipelineStatus: EodPipelineStatusResponseDto | null) {
  if (normalizePipelineStatus(pipelineStatus?.status) === "running") return true;

  return Object.values(pipelineStatus?.stages ?? {}).some(
    (stage) => normalizePipelineStageStatus(stage) === "running",
  );
}

function getEodPipelineStatusPollDelayMs(pipelineStatus: EodPipelineStatusResponseDto | null) {
  return hasRunningDashboardPipelineStage(pipelineStatus)
    ? EOD_PIPELINE_STATUS_RUNNING_POLL_MS
    : EOD_PIPELINE_STATUS_IDLE_POLL_MS;
}

function normalizeMarketState(value: string | null | undefined) {
  return value?.trim().toUpperCase().replace(/[\s-]+/g, "_") ?? null;
}

function getIsoDatePart(value: string | null | undefined) {
  return value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
}

function isWeekendIsoDate(value: string | null | undefined) {
  const datePart = getIsoDatePart(value);
  if (!datePart) return false;

  const [year, month, day] = datePart.split("-").map(Number);
  if (!year || !month || !day) return false;

  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
}

function hasBreakDayText(value: string | null | undefined) {
  const normalizedValue = value?.trim().toLowerCase() ?? "";
  return (
    normalizedValue.includes("weekend") ||
    normalizedValue.includes("holiday") ||
    normalizedValue.includes("break_day") ||
    normalizedValue.includes("break day") ||
    normalizedValue.includes("휴장") ||
    normalizedValue.includes("휴일")
  );
}

function isBreakDayMarket(market: CoreMarketStatus) {
  if (market.is_trading_day === false) return true;
  if (market.is_trading_day === true) return false;
  if (hasBreakDayText(market.state) || hasBreakDayText(market.reason)) return true;

  const state = normalizeMarketState(market.state);
  const canUseWeekendFallback = state === "CLOSED" || state === "WEEKEND";
  return canUseWeekendFallback && isWeekendIsoDate(market.server_time ?? market.as_of);
}

function getPriceFreshnessStage(freshness: EodFreshnessResponseDto | null): EodFreshnessStageDto | null {
  if (freshness?.today?.price) return freshness.today.price;

  const status = freshness?.today?.eod_status ?? freshness?.latest?.eod_status ?? null;
  const normalizedStatus = status?.trim().toLowerCase() ?? null;
  const resolvedStatus =
    normalizedStatus === "running"
      ? "running"
      : hasEodReadinessSignal(freshness)
        ? "ready"
        : hasTextValue(freshness?.today?.trade_date)
          ? "missing"
          : null;

  return buildStage(
    resolvedStatus,
    getEodSymbolsTotal(freshness),
    getEodSymbolsSucceeded(freshness),
    getEodSymbolsFailed(freshness),
  );
}

function getTechnicalFreshnessStage(freshness: EodFreshnessResponseDto | null): EodFreshnessStageDto | null {
  if (freshness?.today?.technical_analysis) return freshness.today.technical_analysis;

  if (freshness?.technical?.success === false) {
    return buildStage("missing", null, null, null);
  }

  const hasTechnicalDate =
    hasTextValue(freshness?.technical?.latest_date) || hasTextValue(freshness?.latest?.technical_market_date);
  return hasTechnicalDate ? buildStage("ready", null, null, null) : null;
}

function getActionFreshnessStage(freshness: EodFreshnessResponseDto | null): EodFreshnessStageDto | null {
  if (freshness?.today?.action_summary) return freshness.today.action_summary;

  return hasTextValue(freshness?.latest?.action_market_date) ? buildStage("ready", null, null, null) : null;
}

function getFundamentalsFreshnessStage(
  freshness: EodFreshnessResponseDto | null,
  fundamentalsStatusLabel: string,
  latestFundamentalsDate: string | null,
): EodFreshnessStageDto | null {
  if (freshness?.today?.fundamentals) return freshness.today.fundamentals;

  const normalizedStatus = fundamentalsStatusLabel.trim().toLowerCase();
  if (normalizedStatus === "running") return buildStage("running", null, null, null);
  if (["completed", "available", "ready"].includes(normalizedStatus) || hasTextValue(latestFundamentalsDate)) {
    return buildStage("ready", null, null, null);
  }
  if (["failed", "partial", "needs review"].includes(normalizedStatus)) {
    return buildStage("missing", null, null, null);
  }

  return null;
}

function getEodStageStatusLabel(
  stage: EodFreshnessStageDto | null,
  todayTradeDate: string | null,
  latestDate: string | null,
  canShowBreakDay: boolean,
): EodStageCard["statusLabel"] {
  const status = normalizeStageStatus(stage);
  if (status === "running") return "running";
  const hasStaleDate =
    hasTextValue(todayTradeDate) && hasTextValue(latestDate) && todayTradeDate.trim() !== latestDate.trim();
  const hasMatchingDates =
    hasTextValue(todayTradeDate) && hasTextValue(latestDate) && todayTradeDate.trim() === latestDate.trim();
  if (status === "ready" && hasMatchingDates) return "synced";
  if (status === "ready" && canShowBreakDay && hasStaleDate) return "break day";
  return "not synced";
}

function getEodStageTone(statusLabel: EodStageCard["statusLabel"]): EodStageCard["tone"] {
  if (statusLabel === "synced") return "positive";
  if (statusLabel === "running") return "info";
  if (statusLabel === "break day") return "neutral";
  return "warning";
}

function buildEodStageCard(
  id: EodStageId,
  label: string,
  stage: EodFreshnessStageDto | null,
  todayTradeDate: string | null,
  latestDate: string | null,
  canShowBreakDay: boolean,
  countDetail: Pick<EodStageDetail, "label" | "value"> = {
    label: "Succeeded",
    value: `${formatEodSymbolCount(stage?.symbols_succeeded)} / ${formatEodSymbolCount(stage?.symbols_total)}`,
  },
): EodStageCard {
  const statusLabel = getEodStageStatusLabel(stage, todayTradeDate, latestDate, canShowBreakDay);
  const details: EodStageDetail[] = [{ key: "count", tone: "count", ...countDetail }];

  if (hasTextValue(todayTradeDate) && hasTextValue(latestDate) && todayTradeDate !== latestDate) {
    details.push({ key: "latest-date", label: "Latest date", value: latestDate, tone: "text" });
  }

  return {
    id,
    label,
    latestDate,
    statusLabel,
    tone: getEodStageTone(statusLabel),
    details,
  };
}

function getPipelineStageLabel(key: EodPipelineStageKey) {
  return EOD_PIPELINE_STAGE_DEFINITIONS.find((item) => item.key === key)?.label ?? humanizeToken(key, key);
}

function getPipelineStageTone(status: string | null | undefined): PipelineStageCard["tone"] {
  const normalizedStatus = normalizePipelineStatus(status);
  if (normalizedStatus === "running") return "info";
  if (
    normalizedStatus === "ready" ||
    normalizedStatus === "completed" ||
    normalizedStatus === "success" ||
    normalizedStatus === "succeeded"
  ) {
    return "positive";
  }
  if (
    normalizedStatus === "failed" ||
    normalizedStatus === "error" ||
    normalizedStatus === "partial" ||
    normalizedStatus === "stalled"
  ) {
    return "warning";
  }
  return "neutral";
}

function formatPipelineDetailText(value: string | null | undefined) {
  if (!hasTextValue(value)) return null;

  const trimmed = value.trim();
  return /[_-]/.test(trimmed) && !trimmed.includes(" ") ? humanizeToken(trimmed, trimmed) : trimmed;
}

function buildPipelineStageDetails(stage: EodPipelineStageDto | null | undefined) {
  const details: EodStageDetail[] = [];
  const currentActivity = formatPipelineDetailText(stage?.current_activity);
  const currentStep = formatPipelineDetailText(stage?.current_step);
  const currentSymbol = stage?.current_symbol?.trim() || null;

  if (currentActivity) {
    details.push({ key: "activity", label: "Current activity", value: currentActivity, tone: "text" });
  }
  if (currentStep) {
    details.push({ key: "step", label: "Current step", value: currentStep, tone: "text" });
  }
  if (currentSymbol) {
    details.push({ key: "symbol", label: "Current symbol", value: currentSymbol, tone: "text" });
  }
  if (hasNumber(stage?.processed) || hasNumber(stage?.total)) {
    details.push({
      key: "progress",
      label: "Progress",
      value: `${formatEodSymbolCount(stage?.processed)} / ${formatEodSymbolCount(stage?.total)}`,
      tone: "count",
    });
  }
  if (hasNumber(stage?.failed) && stage.failed > 0) {
    details.push({
      key: "failed",
      label: "Failed",
      value: formatEodSymbolCount(stage.failed),
      tone: "count",
    });
  }

  return details;
}

function shouldDisplayPipelineStage(
  pipelineStatus: EodPipelineStatusResponseDto | null,
  definition: (typeof EOD_PIPELINE_STAGE_DEFINITIONS)[number],
) {
  if (definition.showWhenMissing) return true;

  const stageOrder = pipelineStatus?.stage_order ?? [];
  return stageOrder.includes(definition.key) || Boolean(getPipelineStage(pipelineStatus, definition.key));
}

function getVisiblePipelineStageKeys(pipelineStatus: EodPipelineStatusResponseDto | null) {
  if (!pipelineStatus) return [];

  const stageKeys: EodPipelineStageKey[] = [];
  const seen = new Set<EodPipelineStageKey>();
  const stageOrder = pipelineStatus?.stage_order ?? [];
  const knownStageKeys = new Set(EOD_PIPELINE_STAGE_DEFINITIONS.map((item) => item.key));

  const addStageKey = (key: EodPipelineStageKey) => {
    if (seen.has(key) || !knownStageKeys.has(key)) return;
    seen.add(key);
    stageKeys.push(key);
  };

  stageOrder.forEach(addStageKey);
  EOD_PIPELINE_STAGE_DEFINITIONS.forEach((definition) => {
    if (shouldDisplayPipelineStage(pipelineStatus, definition)) {
      addStageKey(definition.key);
    }
  });

  return stageKeys;
}

function getActivePipelineStageKey(pipelineStatus: EodPipelineStatusResponseDto | null) {
  const visibleStageKeys = getVisiblePipelineStageKeys(pipelineStatus);

  for (const key of visibleStageKeys) {
    if (normalizePipelineStageStatus(getPipelineStage(pipelineStatus, key)) === "running") {
      return key;
    }
  }

  if (normalizePipelineStatus(pipelineStatus?.status) !== "running") return null;

  for (const key of visibleStageKeys) {
    const stage = getPipelineStage(pipelineStatus, key);
    if (hasTextValue(stage?.current_activity) || hasTextValue(stage?.current_step)) {
      return key;
    }
  }

  return null;
}

function buildPipelineStageCards(pipelineStatus: EodPipelineStatusResponseDto | null): PipelineStageCard[] {
  const activeStageKey = getActivePipelineStageKey(pipelineStatus);

  return getVisiblePipelineStageKeys(pipelineStatus).map((key) => {
    const stage = getPipelineStage(pipelineStatus, key);

    return {
      key,
      label: getPipelineStageLabel(key),
      statusLabel: humanizeToken(stage?.status, "Not Reported"),
      tone: getPipelineStageTone(stage?.status),
      details: buildPipelineStageDetails(stage),
      isActive: key === activeStageKey,
    };
  });
}

function getFundamentalsCheckedCount(
  fundamentalsStatus: DartFundamentalsDailyInspectResponseDto | null,
  stage: EodFreshnessStageDto | null,
) {
  const latestRun = getLatestFundamentalsRun(fundamentalsStatus);
  return latestRun?.symbols_checked ?? stage?.symbols_succeeded ?? stage?.symbols_total ?? null;
}

function getSymbolCodeFromSampleItem(item: unknown): string | null {
  if (typeof item === "string") {
    return hasTextValue(item) ? item.trim() : null;
  }

  if (!isRecord(item)) return null;

  for (const key of ["symbol", "stock_code", "stockCode"]) {
    const value = item[key];
    if (typeof value === "string" && hasTextValue(value)) {
      return value.trim();
    }
  }

  return null;
}

function getSymbolCodesFromSample(value: unknown) {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const symbols: string[] = [];

  for (const item of value) {
    const symbol = getSymbolCodeFromSampleItem(item);
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    symbols.push(symbol);
  }

  return symbols;
}

function getFundamentalsUpdatedSymbolSample(run: DartFundamentalsDailyRunDto | null) {
  const metadata = run?.run_metadata;
  if (!isRecord(metadata)) return [];

  const directSample = getSymbolCodesFromSample(metadata.refreshed_symbols_sample);
  if (directSample.length > 0) return directSample;

  const samples = metadata.samples;
  if (!isRecord(samples)) return [];

  return getSymbolCodesFromSample(samples.refreshed_symbols);
}

function getFundamentalsUpdatedSymbolsDetail(
  fundamentalsStatus: DartFundamentalsDailyInspectResponseDto | null,
  todayTradeDate: string | null,
): EodStageDetail | null {
  const latestRun = getLatestFundamentalsRun(fundamentalsStatus);
  const latestRunDate = getFundamentalsRunDate(latestRun);

  if (!hasTextValue(todayTradeDate) || latestRunDate !== todayTradeDate) return null;

  const refreshedCount = latestRun?.symbols_refreshed;
  const symbolSample = getFundamentalsUpdatedSymbolSample(latestRun);

  if (!hasNumber(refreshedCount) && symbolSample.length === 0) return null;

  const visibleSymbols = symbolSample.slice(0, FUNDAMENTALS_UPDATED_SYMBOL_SAMPLE_LIMIT);
  const remainingSymbols = hasNumber(refreshedCount)
    ? Math.max(0, refreshedCount - visibleSymbols.length)
    : Math.max(0, symbolSample.length - visibleSymbols.length);
  const countLabel = formatEodSymbolCount(refreshedCount ?? symbolSample.length);
  const symbolLabel =
    visibleSymbols.length > 0
      ? ` (${visibleSymbols.join(", ")}${remainingSymbols > 0 ? ` +${formatEodSymbolCount(remainingSymbols)}` : ""})`
      : "";

  return {
    key: "updated-symbols",
    label: "Updated today",
    value: `${countLabel}${symbolLabel}`,
    tone: "text",
  };
}

function formatAgentProgressCountLabel(value: number | null | undefined) {
  if (!hasNumber(value)) return UNKNOWN_LABEL;
  return `${value.toLocaleString("ko-KR")}개`;
}

function formatAgentProgressPercentLabel(progress: AgentFeedbackProgressResponseDto | null) {
  const percent = progress?.summary?.progress_percent;
  if (!hasNumber(percent)) return UNKNOWN_LABEL;
  return `${Math.max(0, Math.min(100, percent)).toLocaleString("ko-KR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}%`;
}

function getAgentProgressPercentValue(progress: AgentFeedbackProgressResponseDto | null) {
  const percent = progress?.summary?.progress_percent;
  if (!hasNumber(percent)) return 0;
  return Math.max(0, Math.min(100, percent));
}

function normalizeAgentProgressRunStatus(status: unknown): AgentFeedbackRunStatus | null {
  if (typeof status !== "string") return null;
  const normalized = status.trim().toLowerCase();
  return normalized in AGENT_PROGRESS_STATUS_LABELS ? (normalized as AgentFeedbackRunStatus) : null;
}

function isAgentFeedbackProgressRunning(progress: AgentFeedbackProgressResponseDto | null) {
  if (!progress) return false;

  const summary = progress.summary;
  const runStatus = normalizeAgentProgressRunStatus(summary.run_status);
  if (runStatus) return runStatus === "running";

  return summary.is_live;
}

function getAgentFeedbackProgressPollDelayMs(progress: AgentFeedbackProgressResponseDto | null) {
  return isAgentFeedbackProgressRunning(progress)
    ? AGENT_FEEDBACK_PROGRESS_RUNNING_POLL_MS
    : AGENT_FEEDBACK_PROGRESS_IDLE_POLL_MS;
}

function getAgentProgressStatusLabel(progress: AgentFeedbackProgressResponseDto | null, error: string | null) {
  if (!progress) return error ? "에이전트 확인 필요" : UNKNOWN_LABEL;

  const summary = progress.summary;
  const runStatus = normalizeAgentProgressRunStatus(summary.run_status);
  if (runStatus) return AGENT_PROGRESS_STATUS_LABELS[runStatus];

  if (summary.is_live) return AGENT_PROGRESS_STATUS_LABELS.running;
  if (summary.failed_items > 0) return AGENT_PROGRESS_STATUS_LABELS.stalled;
  if (summary.progress_percent >= 100) return AGENT_PROGRESS_STATUS_LABELS.completed;
  return AGENT_PROGRESS_STATUS_LABELS.pending;
}

function normalizeAgentRole(role: string | null | undefined) {
  return role?.trim().toLowerCase() ?? null;
}

function getAgentRoleLabel(role: string) {
  const normalizedRole = normalizeAgentRole(role);
  if (normalizedRole && normalizedRole in AGENT_ROLE_LABELS) {
    return AGENT_ROLE_LABELS[normalizedRole as keyof typeof AGENT_ROLE_LABELS];
  }

  return humanizeToken(role, role);
}

function getOrderedAgentRoles(progress: AgentFeedbackProgressResponseDto | null) {
  const roles: string[] = [];
  const seenRoles = new Set<string>();
  const addRole = (role: string | null | undefined) => {
    if (!hasTextValue(role)) return;

    const normalizedRole = normalizeAgentRole(role);
    if (!normalizedRole || seenRoles.has(normalizedRole)) return;

    seenRoles.add(normalizedRole);
    roles.push(normalizedRole);
  };

  progress?.request?.expected_agents?.forEach(addRole);
  addRole(progress?.summary?.current_role);

  return roles;
}

function getAgentRoleStatus(role: string, orderedRoles: string[], currentRole: string | null): AgentRoleStatus {
  if (currentRole === normalizeAgentRole(role)) return "running";
  if (!currentRole) return "pending";

  const roleIndex = orderedRoles.findIndex((candidate) => normalizeAgentRole(candidate) === normalizeAgentRole(role));
  const currentRoleIndex = orderedRoles.findIndex((candidate) => normalizeAgentRole(candidate) === currentRole);

  if (roleIndex >= 0 && currentRoleIndex >= 0 && roleIndex < currentRoleIndex) return "completed";
  return "pending";
}

function getStageFailedCount(stage: EodFreshnessStageDto | null | undefined) {
  const failedCount = stage?.symbols_failed;
  return hasNumber(failedCount) && failedCount > 0 ? failedCount : null;
}

function canShowStageFailedCount(stage: EodFreshnessStageDto | null | undefined) {
  const stageStatus = normalizeStageStatus(stage);
  return (
    stageStatus === "ready" ||
    stageStatus === "completed" ||
    stageStatus === "completed_with_errors" ||
    stageStatus === "failed" ||
    stageStatus === "partial"
  );
}

function buildAgentRoleDependency(
  key: string,
  label: string,
  stage: EodFreshnessStageDto | null | undefined,
): AgentRoleDependency {
  const stageStatus = normalizeStageStatus(stage);
  if (stageStatus === "running") {
    return { key, label, failedCount: null, status: "running" };
  }

  const failedCount = getStageFailedCount(stage);
  if (failedCount !== null && canShowStageFailedCount(stage)) {
    return { key, label, failedCount, status: "failed" };
  }

  if (stageStatus === "ready") {
    return { key, label, failedCount: null, status: "confirmed" };
  }

  return { key, label, failedCount: null, status: "pending" };
}

function getAgentRoleDependencies(
  role: string,
  eodStage: EodFreshnessStageDto | null,
  technicalStage: EodFreshnessStageDto | null,
) {
  const normalizedRole = normalizeAgentRole(role) ?? "";
  const dependencies: AgentRoleDependency[] = [];

  if (normalizedRole.includes("technical") || normalizedRole.includes("fundamental")) {
    dependencies.push(buildAgentRoleDependency("eod", "EOD", eodStage));
  }
  if (normalizedRole.includes("fundamental")) {
    dependencies.push(buildAgentRoleDependency("technical", "Tech", technicalStage));
  }

  return dependencies;
}

function buildAgentRoleCards(
  progress: AgentFeedbackProgressResponseDto | null,
  eodStage: EodFreshnessStageDto | null,
  technicalStage: EodFreshnessStageDto | null,
): AgentRoleCard[] {
  if (!isAgentFeedbackProgressRunning(progress)) return [];

  const orderedRoles = getOrderedAgentRoles(progress);
  const currentRole = normalizeAgentRole(progress?.summary?.current_role);

  return orderedRoles.map((role) => ({
    role,
    label: getAgentRoleLabel(role),
    status: getAgentRoleStatus(role, orderedRoles, currentRole),
    dependencies: getAgentRoleDependencies(role, eodStage, technicalStage),
  }));
}

function getAgentRoleDependencyIcon(status: AgentRoleDependencyStatus) {
  if (status === "confirmed") return "✓";
  if (status === "pending") return "·";
  return "";
}

function getAgentRoleDependencyText(dependency: AgentRoleDependency) {
  if (dependency.status === "failed") {
    return `${dependency.label} -- 실패 ${formatEodSymbolCount(dependency.failedCount)}`;
  }
  if (dependency.status === "confirmed") return `${dependency.label} 확인`;
  if (dependency.status === "running") return `${dependency.label} 진행 중`;
  return `${dependency.label} 확인 필요`;
}

function buildTrackedDetailHref(item: CoreTrackedQuote, metadata?: SymbolMetadataItem | null) {
  const params = new URLSearchParams();
  const companyName = getQuoteCompanyName(item) ?? getMetadataCompanyName(item, metadata);
  if (companyName) {
    params.set("name", companyName);
  }

  const query = params.toString();
  return `/dashboard/symbol/${encodeURIComponent(item.symbol)}${query ? `?${query}` : ""}`;
}

export function LiveDashboardClient({
  initialError = null,
  initialMarket,
  initialTracked,
  initialFreshness,
  initialFundamentalsStatus,
  initialPipelineStatus,
  initialAgentFeedbackProgress,
}: LiveDashboardClientProps) {
  const [market, setMarket] = useState<CoreMarketStatus>(initialMarket);
  const [tracked, setTracked] = useState<CoreTrackedQuotesResponse>(initialTracked);
  const [freshness, setFreshness] = useState<EodFreshnessResponseDto | null>(initialFreshness);
  const [fundamentalsStatus, setFundamentalsStatus] = useState<DartFundamentalsDailyInspectResponseDto | null>(
    initialFundamentalsStatus,
  );
  const [pipelineStatus, setPipelineStatus] = useState<EodPipelineStatusResponseDto | null>(initialPipelineStatus);
  const pipelineStatusRef = useRef<EodPipelineStatusResponseDto | null>(initialPipelineStatus);
  const marketServerTimeRef = useRef<string | null>(initialMarket.server_time ?? null);
  const freshnessTradeDateRef = useRef<string | null>(initialFreshness?.today?.trade_date ?? null);
  const [agentFeedbackProgress, setAgentFeedbackProgress] = useState<AgentFeedbackProgressResponseDto | null>(
    initialAgentFeedbackProgress,
  );
  const agentFeedbackProgressRef = useRef<AgentFeedbackProgressResponseDto | null>(initialAgentFeedbackProgress);
  const [agentFeedbackProgressError, setAgentFeedbackProgressError] = useState<string | null>(null);
  const [symbolMetaBySymbol, setSymbolMetaBySymbol] = useState<Record<string, SymbolMetadataItem | null>>({});
  const [agentFeedbackStopDialogOpen, setAgentFeedbackStopDialogOpen] = useState(false);
  const [openFundamentalsFailureKey, setOpenFundamentalsFailureKey] = useState<string | null>(null);
  const [marketError, setMarketError] = useState<string | null>(initialError);
  const [trackedError, setTrackedError] = useState<string | null>(initialError);
  const fundamentalsMarketDate = normalizeDartFundamentalsMarketDate(
    freshness?.today?.trade_date ?? market.server_time,
  );
  const fundamentalsInspectPath = useMemo(
    () => buildDartFundamentalsDailyInspectPath(DART_FUNDAMENTALS_DAILY_INSPECT_CLIENT_PATH, fundamentalsMarketDate),
    [fundamentalsMarketDate],
  );
  const pipelineStatusPath = useMemo(
    () => buildEodPipelineStatusPath(EOD_PIPELINE_STATUS_CLIENT_PATH, fundamentalsMarketDate),
    [fundamentalsMarketDate],
  );

  useEffect(() => {
    seedTradingApiJsonCache("/api/trading/eod/freshness", initialFreshness);
    seedTradingApiJsonCache(
      buildDartFundamentalsDailyInspectPath(
        DART_FUNDAMENTALS_DAILY_INSPECT_CLIENT_PATH,
        initialFreshness?.today?.trade_date ?? initialMarket.server_time,
      ),
      initialFundamentalsStatus,
    );
  }, [initialFreshness, initialFundamentalsStatus, initialMarket.server_time]);

  useEffect(() => {
    let active = true;
    let retryIndex = 0;
    let retryTimer: number | null = null;

    function clearRetryTimer() {
      if (retryTimer === null) return;
      window.clearTimeout(retryTimer);
      retryTimer = null;
    }

    function scheduleRetry() {
      if (!active || retryIndex >= TRACKED_QUOTES_RETRY_DELAYS_MS.length) return;
      const retryDelayMs = TRACKED_QUOTES_RETRY_DELAYS_MS[retryIndex];
      retryIndex += 1;
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        void loadTracked();
      }, retryDelayMs);
    }

    async function loadTracked() {
      try {
        const trackedData = await getJson<CoreTrackedQuotesResponse>("/api/trading/quotes/tracked");
        if (!active) return;
        clearRetryTimer();
        setTracked(trackedData);
        setTrackedError(null);
      } catch (loadError) {
        console.error("Dashboard tracked quote load failed", loadError);
        if (!active) return;
        setTrackedError(getDashboardLoadErrorMessage(loadError));
        scheduleRetry();
      }
    }

    void loadTracked();

    return () => {
      active = false;
      clearRetryTimer();
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadMarket = async () => {
      try {
        const marketData = await getJson<CoreMarketStatus>("/api/trading/market/status");
        if (!active) return;
        const nextServerTime = marketData.server_time ?? null;
        marketServerTimeRef.current = nextServerTime;
        const nextMarketDate = normalizeDartFundamentalsMarketDate(freshnessTradeDateRef.current ?? nextServerTime);
        if (pipelineStatusRef.current?.market_date !== nextMarketDate) {
          pipelineStatusRef.current = null;
          setPipelineStatus((current) => (current?.market_date === nextMarketDate ? current : null));
        }
        setMarket(marketData);
        setMarketError(null);
      } catch (loadError) {
        console.error("Dashboard market status polling failed", loadError);
        if (!active) return;
        setMarketError(getDashboardLoadErrorMessage(loadError));
      }
    };

    void loadMarket();
    const timer = window.setInterval(loadMarket, 60_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const symbolsNeedingCompanyName = useMemo(
    () =>
      Array.from(
        new Set(
          tracked.items.filter((item) => !getQuoteCompanyName(item)).map((item) => item.symbol),
        ),
      ),
    [tracked.items],
  );
  const symbolMetadataLookupKey = symbolsNeedingCompanyName.join("|");

  useEffect(() => {
    if (!symbolMetadataLookupKey) return;

    let active = true;
    const symbols = symbolMetadataLookupKey.split("|").filter(Boolean);

    const loadSymbolMetadata = async () => {
      const entries = await Promise.all(
        symbols.map(async (symbol) => {
          try {
            const data = await getJson<SymbolSearchResponse>(
              `/api/trading/symbols/search?q=${encodeURIComponent(symbol)}&limit=8`,
            );
            return [symbol, pickSymbolMetadata(symbol, data)] as const;
          } catch (metadataError) {
            console.error("Dashboard symbol metadata load failed", metadataError);
            return [symbol, null] as const;
          }
        }),
      );

      if (!active) return;
      setSymbolMetaBySymbol((current) => {
        const next = { ...current };
        for (const [symbol, metadata] of entries) {
          next[symbol] = metadata;
        }
        return next;
      });
    };

    void loadSymbolMetadata();

    return () => {
      active = false;
    };
  }, [symbolMetadataLookupKey]);

  useEffect(() => {
    let active = true;

    const loadFreshness = async () => {
      try {
        const data = await getJson<EodFreshnessResponseDto>("/api/trading/eod/freshness");
        if (!active) return;
        const nextTradeDate = data?.today?.trade_date ?? null;
        freshnessTradeDateRef.current = nextTradeDate;
        const nextMarketDate = normalizeDartFundamentalsMarketDate(nextTradeDate ?? marketServerTimeRef.current);
        if (pipelineStatusRef.current?.market_date !== nextMarketDate) {
          pipelineStatusRef.current = null;
          setPipelineStatus((current) => (current?.market_date === nextMarketDate ? current : null));
        }
        setFreshness(data);
      } catch (freshnessError) {
        console.error("Dashboard freshness load failed", freshnessError);
        if (!active) return;
        setFreshness((current) => current);
      }
    };

    loadFreshness();
    const timer = window.setInterval(loadFreshness, 30_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;
    let timer: number | null = null;

    if (pipelineStatusRef.current?.market_date !== fundamentalsMarketDate) {
      pipelineStatusRef.current = null;
    }

    function clearTimer() {
      if (timer === null) return;
      window.clearTimeout(timer);
      timer = null;
    }

    function scheduleNextLoad(nextPipelineStatus: EodPipelineStatusResponseDto | null) {
      if (!active) return;
      clearTimer();
      timer = window.setTimeout(loadPipelineStatus, getEodPipelineStatusPollDelayMs(nextPipelineStatus));
    }

    async function loadPipelineStatus() {
      try {
        const data = await getJson<EodPipelineStatusResponseDto>(pipelineStatusPath);
        if (!active) return;
        pipelineStatusRef.current = data;
        setPipelineStatus(data);
        scheduleNextLoad(data);
      } catch (pipelineStatusError) {
        console.error("Dashboard EOD pipeline status load failed", pipelineStatusError);
        if (!active) return;
        scheduleNextLoad(pipelineStatusRef.current);
      }
    }

    void loadPipelineStatus();

    return () => {
      active = false;
      clearTimer();
    };
  }, [fundamentalsMarketDate, pipelineStatusPath]);

  useEffect(() => {
    let active = true;

    const loadFundamentalsStatus = async () => {
      try {
        const data = await getJson<DartFundamentalsDailyInspectResponseDto>(
          fundamentalsInspectPath,
        );
        if (!active) return;
        setFundamentalsStatus(data);
      } catch (fundamentalsStatusError) {
        console.error("Dashboard fundamentals status load failed", fundamentalsStatusError);
        if (!active) return;
        setFundamentalsStatus((current) => current);
      }
    };

    loadFundamentalsStatus();
    const timer = window.setInterval(loadFundamentalsStatus, 60_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [fundamentalsInspectPath]);

  const agentProgressMarketDate = getAgentFeedbackProgressMarketDate(freshness);

  useEffect(() => {
    if (!agentProgressMarketDate) return;

    let active = true;
    const progressPath = `/api/trading/agent-context/feedback/progress?market_date=${encodeURIComponent(
      agentProgressMarketDate,
    )}`;
    let timer: number | null = null;

    if (agentFeedbackProgressRef.current?.request.market_date !== agentProgressMarketDate) {
      agentFeedbackProgressRef.current = null;
    }

    function clearTimer() {
      if (timer === null) return;
      window.clearTimeout(timer);
      timer = null;
    }

    function scheduleNextLoad(progress: AgentFeedbackProgressResponseDto | null) {
      if (!active) return;
      clearTimer();
      timer = window.setTimeout(loadAgentFeedbackProgress, getAgentFeedbackProgressPollDelayMs(progress));
    }

    async function loadAgentFeedbackProgress() {
      try {
        const data = await getJson<AgentFeedbackProgressResponseDto>(progressPath);
        if (!active) return;
        agentFeedbackProgressRef.current = data;
        setAgentFeedbackProgress(data);
        setAgentFeedbackProgressError(null);
        scheduleNextLoad(data);
      } catch (progressError) {
        console.error("Dashboard agent feedback progress load failed", progressError);
        if (!active) return;
        setAgentFeedbackProgressError(getDashboardLoadErrorMessage(progressError));
        scheduleNextLoad(agentFeedbackProgressRef.current);
      }
    }

    loadAgentFeedbackProgress();

    return () => {
      active = false;
      clearTimer();
    };
  }, [agentProgressMarketDate]);

  const liveCount = tracked.items.filter((item) => item.is_live).length;
  const fallbackCount = tracked.items.filter((item) => item.fallback).length;
  const unavailableCount = tracked.items.filter((item) => !item.available).length;
  const latestFundamentalsDate = getFundamentalsFreshnessDate(freshness, fundamentalsStatus);
  const pricePipelineStage = getPipelineStage(pipelineStatus, "price_collection");
  const technicalPipelineStage = getPipelineStage(pipelineStatus, "technical_snapshots");
  const fundamentalsPipelineStage = getPipelineStage(pipelineStatus, "fundamentals_daily_refresh");
  const fundamentalsStatusLabel = getFundamentalsStatusLabel(
    freshness,
    fundamentalsStatus,
    latestFundamentalsDate,
    fundamentalsPipelineStage,
  );
  const fundamentalsFreshnessStage = getFundamentalsFreshnessStage(
    freshness,
    fundamentalsStatusLabel,
    latestFundamentalsDate,
  );
  const fundamentalsFailureDetails = getFundamentalsFailureDetails(
    freshness,
    fundamentalsStatus,
    latestFundamentalsDate,
    fundamentalsStatusLabel,
  );
  const movers = useMemo(
    () =>
      [...tracked.items]
        .filter((item) => item.available && hasNumber(item.change_pct))
        .sort((left, right) => Math.abs((right.change_pct ?? 0)) - Math.abs((left.change_pct ?? 0)))
        .slice(0, 3),
    [tracked.items],
  );

  const todayTradeDate = freshness?.today?.trade_date ?? null;
  const eodMarketDate = todayTradeDate ?? UNKNOWN_LABEL;
  const isBreakDay = isBreakDayMarket(market);
  const priceFreshnessStage = mergeRunningPipelineStage(getPriceFreshnessStage(freshness), pricePipelineStage);
  const technicalFreshnessStage = mergeRunningPipelineStage(
    getTechnicalFreshnessStage(freshness),
    technicalPipelineStage,
  );
  const actionPipelineStage = getPipelineStage(pipelineStatus, "action_summaries");
  const actionFreshnessStage = mergeRunningPipelineStage(getActionFreshnessStage(freshness), actionPipelineStage);
  const fundamentalsFreshnessWithPipelineStage = mergeRunningPipelineStage(
    fundamentalsFreshnessStage,
    fundamentalsPipelineStage,
  );
  const pipelineStageCards = buildPipelineStageCards(pipelineStatus);
  const activePipelineStage = pipelineStageCards.find((stage) => stage.isActive) ?? null;
  const pipelineStatusLabel = hasTextValue(pipelineStatus?.status) ? humanizeToken(pipelineStatus.status) : null;
  const pipelineStatusTone = getPipelineStageTone(pipelineStatus?.status);
  const fundamentalsUpdatedSymbolsDetail = getFundamentalsUpdatedSymbolsDetail(fundamentalsStatus, todayTradeDate);
  const fundamentalsStageCard = buildEodStageCard(
    "fundamentals",
    "Fundamentals",
    fundamentalsFreshnessWithPipelineStage,
    todayTradeDate,
    latestFundamentalsDate,
    isBreakDay,
    {
      label: "Checked",
      value: formatEodSymbolCount(
        getFundamentalsCheckedCount(fundamentalsStatus, fundamentalsFreshnessWithPipelineStage),
      ),
    },
  );
  const eodStageCards = [
    buildEodStageCard(
      "price",
      "Price Fetch",
      priceFreshnessStage,
      todayTradeDate,
      freshness?.latest?.price_trade_date ?? null,
      isBreakDay,
    ),
    buildEodStageCard(
      "technical",
      "Technical Analysis",
      technicalFreshnessStage,
      todayTradeDate,
      freshness?.technical?.latest_date ?? freshness?.latest?.technical_market_date ?? null,
      isBreakDay,
    ),
    buildEodStageCard(
      "action",
      "Action Summary",
      actionFreshnessStage,
      todayTradeDate,
      freshness?.latest?.action_market_date ?? null,
      isBreakDay,
    ),
    fundamentalsUpdatedSymbolsDetail
      ? {
          ...fundamentalsStageCard,
          details: [...fundamentalsStageCard.details, fundamentalsUpdatedSymbolsDetail],
        }
      : fundamentalsStageCard,
  ] as const;
  const displayedAgentFeedbackProgress =
    agentProgressMarketDate && agentFeedbackProgress?.request?.market_date === agentProgressMarketDate
      ? agentFeedbackProgress
      : null;
  const displayedAgentFeedbackProgressError = agentProgressMarketDate ? agentFeedbackProgressError : null;
  const agentProgressStatusLabel = getAgentProgressStatusLabel(
    displayedAgentFeedbackProgress,
    displayedAgentFeedbackProgressError,
  );
  const agentProgressPercent = formatAgentProgressPercentLabel(displayedAgentFeedbackProgress);
  const agentProgressPercentValue = getAgentProgressPercentValue(displayedAgentFeedbackProgress);
  const agentProgressTotal = formatAgentProgressCountLabel(displayedAgentFeedbackProgress?.summary?.total_symbols);
  const agentProgressFailed = formatAgentProgressCountLabel(displayedAgentFeedbackProgress?.summary?.failed_items);
  const agentProgressCompleted = formatAgentProgressCountLabel(
    displayedAgentFeedbackProgress?.summary?.completed_symbols,
  );
  const agentProgressInProgress = formatAgentProgressCountLabel(
    displayedAgentFeedbackProgress?.summary?.in_progress_symbols,
  );
  const agentProgressCompletedFeedback = formatAgentProgressCountLabel(
    displayedAgentFeedbackProgress?.summary?.completed_feedback_count,
  );
  const agentProgressExpectedFeedback = formatAgentProgressCountLabel(
    displayedAgentFeedbackProgress?.summary?.expected_feedback_count,
  );
  const agentProgressDate =
    displayedAgentFeedbackProgress?.request?.market_date ?? agentProgressMarketDate ?? UNKNOWN_LABEL;
  const showAgentProgressDetails = isAgentFeedbackProgressRunning(displayedAgentFeedbackProgress);
  const agentRoleCards = buildAgentRoleCards(
    displayedAgentFeedbackProgress,
    priceFreshnessStage,
    technicalFreshnessStage,
  );
  const marketBadgeLabel = market.is_open ? "Market Open" : "Market Closed";
  const coreUnavailable =
    market.state === "OFFLINE PLACEHOLDER" ||
    isOfflineTrackedPlaceholder(tracked) ||
    Boolean(marketError || trackedError);
  const error = trackedError ?? marketError;
  const fundamentalsDialogOpen =
    Boolean(fundamentalsFailureDetails) && openFundamentalsFailureKey === fundamentalsFailureDetails?.key;
  const dialogOpen = fundamentalsDialogOpen || agentFeedbackStopDialogOpen;

  useEffect(() => {
    if (!dialogOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (agentFeedbackStopDialogOpen) {
          setAgentFeedbackStopDialogOpen(false);
          return;
        }
        setOpenFundamentalsFailureKey(null);
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [agentFeedbackStopDialogOpen, dialogOpen, fundamentalsDialogOpen]);

  return (
    <MobileAppChrome
      activeNav="dashboard"
      header={
        <>
          <div className={styles.appHeaderBrand}>
            <div className={styles.brandMark}>K</div>
            <div>
              <strong className={styles.brandTitle}>Trading Dashboard</strong>
            </div>
          </div>

          <div className={styles.appHeaderActions}>
            <span className={`pill ${styles.marketStatusPill} ${market.is_open ? "positive" : styles.marketStatusClosedPill}`}>
              {marketBadgeLabel}
            </span>
            <DevModeToggle />
          </div>
        </>
      }
    >
      <div className={`${styles.stack} ${styles.dashboardWideShell}`}>
        {coreUnavailable ? (
          <section className={`${styles.panel} ${styles.alertPanel}`}>
            <ComponentTag label="dashboard.core-unavailable" api="/api/trading/market/status + /api/trading/quotes/tracked" />
            <p className={styles.sectionEyebrow}>Core unavailable</p>
            <strong className={styles.alertTitle}>Offline placeholder active</strong>
            <p className="clamp-3">
              {error ?? "Core feed unreachable. Showing placeholder values until the upstream endpoints recover."}
            </p>
          </section>
        ) : null}

        <section className={`${styles.panel} ${styles.integrityPanel}`} id="dashboard-freshness">
          <ComponentTag
            label="dashboard.operational-integrity"
            api="/api/trading/eod/freshness + /api/trading/eod/pipeline/status + /api/trading/market/status + /api/trading/agent-context/feedback/progress + /api/trading/disclosures/dart/fundamentals/daily/inspect"
          />

          <div className={styles.panelHeader}>
            <div>
              <p className={styles.sectionEyebrow}>Market Freshness Registry</p>
              <h1 className={styles.heroTitle}>Operational Integrity</h1>
              <p className={styles.marketContext}>
                Server time {formatDisplayTimestamp(market.server_time)}
              </p>
            </div>
          </div>

          <div className={styles.integrityGrid}>
            <article className={`${styles.integrityStat} ${styles.eodStatusCard}`}>
              <div className={styles.eodStatusHeader}>
                <div>
                  <span>EOD Status</span>
                  <strong>Market date {eodMarketDate}</strong>
                </div>
              </div>

              <div className={styles.eodStageGrid}>
                {eodStageCards.map((stage) => {
                  const statusClass =
                    stage.statusLabel === "synced"
                      ? styles.syncedStatusPill
                      : stage.statusLabel === "running"
                        ? styles.runningStatusPill
                        : "";

                  return (
                    <div
                      key={stage.id}
                      className={styles.eodStageCard}
                      aria-label={`${stage.label} freshness`}
                      data-stage={stage.id}
                      data-status={stage.statusLabel}
                    >
                      <div className={styles.eodStageTop}>
                        <span className={styles.eodStageTitle}>{stage.label}</span>
                        <span className={`pill ${stage.tone} ${statusClass}`}>{stage.statusLabel}</span>
                      </div>
                      <div className={styles.eodStageDetails}>
                        {stage.details.map((detail) => (
                          <span
                            key={detail.key}
                            className={styles.eodStageDetailLine}
                            data-detail-tone={detail.tone ?? "text"}
                          >
                            <span>{detail.label}</span>{" "}
                            <span className={styles.eodStageDetailValue}>{detail.value}</span>
                          </span>
                        ))}
                        {stage.id === "fundamentals" &&
                        hasTextValue(fundamentalsStatusLabel) &&
                        fundamentalsStatusLabel !== UNKNOWN_LABEL ? (
                          <span>Run status {fundamentalsStatusLabel}</span>
                        ) : null}
                        {stage.id === "fundamentals" && fundamentalsFailureDetails ? (
                          <button
                            type="button"
                            className={`pill warning ${styles.statusButton}`}
                            aria-label="Review fundamentals run details"
                            aria-haspopup="dialog"
                            aria-expanded={fundamentalsDialogOpen}
                            aria-controls="fundamentals-failure-dialog"
                            onClick={() => setOpenFundamentalsFailureKey(fundamentalsFailureDetails.key)}
                          >
                            Review run
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              {pipelineStageCards.length > 0 ? (
                <div className={styles.pipelineActivitySection}>
                  <div className={styles.pipelineActivityHeader}>
                    <div>
                      <span>Pipeline activity</span>
                      <strong>
                        {activePipelineStage
                          ? `${activePipelineStage.label} in progress`
                          : pipelineStatusLabel
                            ? `Pipeline ${pipelineStatusLabel}`
                            : "Pipeline detail"}
                      </strong>
                    </div>
                    {pipelineStatusLabel ? (
                      <span
                        className={`pill ${pipelineStatusTone} ${pipelineStatusTone === "info" ? styles.runningStatusPill : ""}`}
                      >
                        {pipelineStatusLabel}
                      </span>
                    ) : null}
                  </div>

                  <div className={styles.pipelineStageList} role="list" aria-label="EOD pipeline stages">
                    {pipelineStageCards.map((stage) => {
                      const statusClass = stage.tone === "info" ? styles.runningStatusPill : "";

                      return (
                        <div
                          key={stage.key}
                          className={styles.pipelineStageRow}
                          role="listitem"
                          data-active={stage.isActive}
                          aria-label={`${stage.label} pipeline stage`}
                        >
                          <div className={styles.pipelineStageTop}>
                            <span className={styles.pipelineStageTitle}>{stage.label}</span>
                            <span className={`pill ${stage.tone} ${statusClass}`}>{stage.statusLabel}</span>
                          </div>
                          {stage.details.length > 0 ? (
                            <div className={styles.pipelineStageDetails}>
                              {stage.details.map((detail) => (
                                <span
                                  key={`${stage.key}-${detail.key}`}
                                  className={styles.eodStageDetailLine}
                                  data-detail-tone={detail.tone ?? "text"}
                                >
                                  <span>{detail.label}</span>{" "}
                                  <span className={styles.eodStageDetailValue}>{detail.value}</span>
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </article>

            <article className={`${styles.integrityStat} ${styles.agentFeedbackCard}`}>
              <span>Agent Feedback</span>
              <strong>{agentProgressStatusLabel}</strong>
              <div className={styles.agentProgressTrack} aria-hidden="true">
                <i style={{ width: `${agentProgressPercentValue}%` }} />
              </div>
              {agentRoleCards.length > 0 ? (
                <div className={styles.agentRoleList} role="list" aria-label="Agent role progress">
                  {agentRoleCards.map((role) => (
                    <div
                      key={role.role}
                      className={styles.agentRoleRow}
                      data-role-status={role.status}
                      role="listitem"
                      aria-label={`${role.label} ${AGENT_ROLE_STATUS_LABELS[role.status]}`}
                    >
                      <span className={styles.agentRoleStatusIcon} data-role-icon={role.status} aria-hidden="true" />
                      <div className={styles.agentRoleContent}>
                        <span className={styles.agentRoleName}>{role.label}</span>
                        <span className={styles.agentRoleStatusText}>{AGENT_ROLE_STATUS_LABELS[role.status]}</span>
                        {role.dependencies.length > 0 ? (
                          <span className={styles.agentRoleDependencies}>
                            {role.dependencies.map((dependency) => (
                              <span
                                key={dependency.key}
                                className={styles.agentRoleDependency}
                                data-dependency-status={dependency.status}
                              >
                                <span className={styles.agentRoleDependencyIcon} aria-hidden="true">
                                  {getAgentRoleDependencyIcon(dependency.status)}
                                </span>
                                {getAgentRoleDependencyText(dependency)}
                              </span>
                            ))}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
              {showAgentProgressDetails ? (
                <p className={styles.eodStatusDetails}>
                  기준일 {agentProgressDate}
                  <br />
                  진행률 {agentProgressPercent}
                  <br />
                  전체 대상 {agentProgressTotal}
                  <br />
                  실패 {agentProgressFailed}
                  <br />
                  완료 {agentProgressCompleted} · 진행 중 {agentProgressInProgress}
                  <br />
                  피드백 완료 {agentProgressCompletedFeedback} / {agentProgressExpectedFeedback}
                  <br />
                  마지막 적재 {formatDisplayTimestamp(displayedAgentFeedbackProgress?.summary?.latest_feedback_at, UNKNOWN_LABEL)}
                  <br />
                  무응답 경과 {displayedAgentFeedbackProgress?.summary?.seconds_since_last_feedback ?? UNKNOWN_LABEL}s
                  <br />
                  Run ID {displayedAgentFeedbackProgress?.summary?.run_id ?? UNKNOWN_LABEL}
                </p>
              ) : null}
              <div className={styles.agentFeedbackActions}>
                <button
                  type="button"
                  className={styles.agentFeedbackStopButton}
                  aria-label="중단"
                  aria-haspopup="dialog"
                  aria-expanded={agentFeedbackStopDialogOpen}
                  aria-controls={AGENT_FEEDBACK_STOP_DIALOG_ID}
                  onClick={() => setAgentFeedbackStopDialogOpen(true)}
                >
                  중단
                </button>
              </div>
            </article>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.trackedPanel}`} id="tracked-symbols">
          <div className={styles.sectionHeaderRow}>
            <div>
              <p className={styles.sectionEyebrow}>Tracked Symbols</p>
              <h2 className={styles.sectionTitle}>Today&apos;s ledger recommendations</h2>
            </div>
            <Link href="/my-symbols" className={styles.sectionLink} aria-label="Open the full My Symbols screen">
              More
            </Link>
          </div>

          <div className={styles.trackedList}>
            {tracked.items.map((item) => (
              <Link
                key={item.symbol}
                href={buildTrackedDetailHref(item, symbolMetaBySymbol[item.symbol])}
                className={`${styles.trackedCard} ${!item.available ? styles.trackedCardMuted : ""}`.trim()}
              >
                <ComponentTag label={`dashboard.symbol-card.${item.symbol}`} api="/api/trading/quotes/tracked" />

                <div className={styles.trackedCardTop}>
                  <div>
                    <strong className={styles.companyName}>
                      {getCompanyName(item, symbolMetaBySymbol[item.symbol])}
                    </strong>
                    <p className={`clamp-3 ${styles.symbolCode}`}>{item.symbol}</p>
                  </div>
                  <span className={`pill ${item.available ? (item.change_pct ?? 0) >= 0 ? "positive" : "negative" : "warning"}`}>
                    {item.available ? (item.is_live ? "Live" : "Fallback") : "Unavailable"}
                  </span>
                </div>

                <div className={styles.priceBlock}>
                  <strong>{item.available ? `₩${formatPrice(item.price)}` : "N/A"}</strong>
                  <span className={getQuoteToneClass(item.change_pct)}>
                    {item.available
                      ? `${formatSignedPercent(item.change_pct)} · ${formatSignedNumber(item.change)}`
                      : item.unavailable_reason ?? "No fresh quote source"}
                  </span>
                </div>

                <div className={styles.cardMeta}>
                  <div>
                    <span>Price Freshness</span>
                    <strong>{getPriceFreshnessLabel(item)}</strong>
                  </div>
                  <div>
                    <span>TA Freshness</span>
                    <strong>{getTechnicalFreshnessLabel(freshness)}</strong>
                  </div>
                </div>

                <div className={styles.cardFooter}>
                  <span className="clamp-3">{describeQuoteSource(item)}</span>
                  <span className="clamp-3">Turnover {formatTurnover(item.turnover)}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.supportGrid}>
          <section className={`${styles.panel} ${styles.supportPanel}`}>
            <ComponentTag label="dashboard.momentum-board" api="/api/trading/quotes/tracked" />
            <p className={styles.sectionEyebrow}>Global Sentiment Distribution</p>
            <h2 className={styles.sectionTitle}>Highest absolute movers</h2>
            <div className={styles.supportList}>
              {movers.length > 0 ? (
                movers.map((item) => {
                  const companyName = getCompanyName(item, symbolMetaBySymbol[item.symbol]);

                  return (
                    <Link
                      key={item.symbol}
                      href={buildTrackedDetailHref(item, symbolMetaBySymbol[item.symbol])}
                      className={styles.supportRow}
                    >
                      <div>
                        <strong>{companyName}</strong>
                        <p className="clamp-3">{item.symbol}</p>
                      </div>
                      <span className={getQuoteToneClass(item.change_pct)}>{formatSignedPercent(item.change_pct)}</span>
                    </Link>
                  );
                })
              ) : (
                <div className={styles.emptyState}>Tracked momentum is waiting for live quote coverage.</div>
              )}
            </div>
          </section>

          <section className={`${styles.panel} ${styles.supportPanel}`}>
            <ComponentTag label="dashboard.coverage-note" api="/api/trading/eod/freshness + /api/trading/quotes/tracked" />
            <p className={styles.sectionEyebrow}>Coverage Notes</p>
            <h2 className={styles.sectionTitle}>Ledger coverage notes</h2>
            <div className={styles.noteStack}>
              <article className={styles.noteCard}>
                <strong>{unavailableCount > 0 ? `${unavailableCount} symbol(s) need attention` : "Fallback pressure is contained"}</strong>
                <p className="clamp-3">
                  {unavailableCount > 0
                    ? "Unavailable quotes stay explicit instead of collapsing to zero, so gaps are visible before action."
                    : `${fallbackCount} symbol(s) are on fallback paths, but live coverage is still present for ${liveCount} names.`}
                </p>
              </article>
              <article className={styles.noteCard}>
                <strong>Freshness stays layer-specific</strong>
                <p className="clamp-3">
                  Price latest {freshness?.latest?.price_trade_date ?? "[확인 필요]"} · Technical latest{" "}
                  {freshness?.technical?.latest_date ?? freshness?.latest?.technical_market_date ?? "[확인 필요]"} · Action latest{" "}
                  {freshness?.latest?.action_market_date ?? "[확인 필요]"}.
                </p>
              </article>
            </div>
          </section>
        </section>
      </div>

      {fundamentalsDialogOpen && fundamentalsFailureDetails
        ? createPortal(
            <div className={styles.dialogBackdrop} onMouseDown={() => setOpenFundamentalsFailureKey(null)}>
              <section
                id="fundamentals-failure-dialog"
                className={styles.failureDialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby="fundamentals-failure-title"
                aria-describedby="fundamentals-failure-reason"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className={styles.dialogHeader}>
                  <div>
                    <p className={styles.sectionEyebrow}>D2 Fundamentals</p>
                    <h2 id="fundamentals-failure-title" className={styles.dialogTitle}>
                      {fundamentalsFailureDetails.title}
                    </h2>
                  </div>
                  <button
                    type="button"
                    className={styles.dialogCloseButton}
                    onClick={() => setOpenFundamentalsFailureKey(null)}
                    aria-label="Close fundamentals failure details"
                    autoFocus
                  >
                    Close
                  </button>
                </div>

                <p id="fundamentals-failure-reason" className={styles.failureReason}>
                  {fundamentalsFailureDetails.reason}
                </p>

                <dl className={styles.failureDetailGrid}>
                  {fundamentalsFailureDetails.details.map((item) => (
                    <div key={item.label} className={styles.failureDetailItem}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>

                {fundamentalsFailureDetails.metadata.length > 0 ? (
                  <div className={styles.metadataBlock}>
                    <strong>Failure metadata</strong>
                    <dl>
                      {fundamentalsFailureDetails.metadata.map((item) => (
                        <div key={item.label}>
                          <dt>{item.label}</dt>
                          <dd>{item.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ) : null}
              </section>
            </div>,
            document.body,
          )
        : null}

      {agentFeedbackStopDialogOpen
        ? createPortal(
            <div className={styles.dialogBackdrop} onMouseDown={() => setAgentFeedbackStopDialogOpen(false)}>
              <section
                id={AGENT_FEEDBACK_STOP_DIALOG_ID}
                className={`${styles.failureDialog} ${styles.confirmationDialog}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="agent-feedback-stop-title"
                aria-describedby="agent-feedback-stop-description"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className={styles.dialogHeader}>
                  <div>
                    <p className={styles.sectionEyebrow}>Agent Feedback</p>
                    <h2 id="agent-feedback-stop-title" className={styles.dialogTitle}>
                      중단하시겠습니까?
                    </h2>
                  </div>
                  <button
                    type="button"
                    className={styles.dialogCloseButton}
                    onClick={() => setAgentFeedbackStopDialogOpen(false)}
                    aria-label="Close agent feedback stop confirmation"
                  >
                    Close
                  </button>
                </div>

                <p id="agent-feedback-stop-description" className={styles.confirmationMessage}>
                  예 또는 아니요를 선택하면 확인창이 닫히며 실제 중단 동작은 추후 연결할 예정입니다.
                </p>

                <div className={styles.dialogActions}>
                  <button
                    type="button"
                    className={`${styles.dialogActionButton} ${styles.dialogActionSecondary}`}
                    onClick={() => setAgentFeedbackStopDialogOpen(false)}
                    autoFocus
                  >
                    아니요
                  </button>
                  <button
                    type="button"
                    className={`${styles.dialogActionButton} ${styles.dialogActionDanger}`}
                    onClick={() => setAgentFeedbackStopDialogOpen(false)}
                  >
                    예
                  </button>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </MobileAppChrome>
  );
}
