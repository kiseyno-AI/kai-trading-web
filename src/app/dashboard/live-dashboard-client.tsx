"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ComponentTag } from "@/components/dev/component-tag";
import { DevModeToggle } from "@/components/dev/dev-mode-toggle";
import { MobileAppChrome } from "@/components/mobile/mobile-app-chrome";
import { getAgentFeedbackProgressMarketDate } from "@/lib/agent-feedback-progress";
import {
  getDashboardProcessRequestMarketDate,
  getDashboardProcessResolvedMarketDate,
} from "@/lib/dashboard-process-market-date";
import {
  buildDartFundamentalsDailyInspectPath,
  DART_FUNDAMENTALS_DAILY_INSPECT_CLIENT_PATH,
} from "@/lib/dart-fundamentals-daily";
import { buildEodPipelineStatusPath, EOD_PIPELINE_STATUS_CLIENT_PATH } from "@/lib/eod-pipeline-status";
import { formatDisplayTimestamp, formatPrice, formatTurnover } from "@/lib/format";
import {
  MOBILE_TOOLBAR_MARKET_STATUS_PATH,
  MOBILE_TOOLBAR_TRACKED_QUOTES_PATH,
  warmMobileToolbarViewData,
} from "@/lib/mobile-toolbar-data";
import {
  buildPiotroskiListHref,
  loadPiotroskiPassList,
  type PiotroskiPassListResult,
} from "@/lib/piotroski-pass-list";
import {
  getEodSymbolsFailed,
  getEodSymbolsSucceeded,
  getEodSymbolsTotal,
  getFundamentalsStageDisplayCounts,
  getLatestEodSymbolsFailed,
  getLatestEodSymbolsSucceeded,
  getLatestEodSymbolsTotal,
  isRunningPipelineStage,
  shouldUseTodayStageData,
} from "@/lib/dashboard-eod-stage-data";
import { resolveTradingApiClientPath } from "@/lib/trading-api-client-path";
import {
  getCachedTradingApiJson,
  seedTradingApiJsonCache,
  seedTradingApiJsonSnapshot,
} from "@/lib/trading-api-cache";
import type {
  AgentContextCoreControlRequestDto,
  AgentContextCoreControlResponseDto,
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
const AGENT_FEEDBACK_STOP_ERROR_ID = "agent-feedback-stop-error";
const AGENT_FEEDBACK_STOP_CONTROL_CLIENT_PATH = "/api/trading/agent-context/internal/core/control";
const FUNDAMENTALS_UPDATED_SYMBOL_SAMPLE_LIMIT = 4;
const DEFAULT_AGENT_ROLE_ORDER = [
  "eod-summarizer",
  "technical-summarizer",
  "fundamental-summarizer",
] as const;
const AGENT_FEEDBACK_STOP_REQUEST = {
  action: "kill",
  signal_name: "SIGKILL",
  port: 8000,
} satisfies AgentContextCoreControlRequestDto;
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
  completed: "완료",
  running: "실행 중",
  pending: "대기",
  attention: "확인 필요",
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
  statusBadgeLabel: string;
  statusBadgeTitle: string | null;
  tone: "positive" | "info" | "neutral" | "warning";
  details: EodStageDetail[];
};

type EodStageDetail = {
  key: string;
  label: string;
  value: string;
  tone?: "count" | "text";
  layout?: "inline" | "stacked";
};

type AgentRoleStatus = "completed" | "running" | "pending" | "attention";

type AgentRoleMetric = {
  key: string;
  label: string;
  value: string;
};

type AgentRoleCard = {
  role: string;
  label: string;
  status: AgentRoleStatus;
  progressPercent: number;
  progressLabel: string;
  metrics: AgentRoleMetric[];
};

type AgentRoleProgressSnapshot = {
  role: string;
  status: AgentRoleStatus;
  completedCount: number | null;
  progressPercent: number | null;
};

type AgentRoleResultSnapshot = {
  role: string;
  requestedCount: number | null;
  completedCount: number | null;
  errorCount: number | null;
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

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const resolvedPath = resolveTradingApiClientPath(path);
  const response = await fetch(resolvedPath, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const responseText = await response.text();
  let parsedBody: unknown = null;

  if (responseText) {
    try {
      parsedBody = JSON.parse(responseText) as T;
    } catch (error) {
      throw new Error(`Failed to parse JSON for ${path}: ${getDashboardLoadErrorMessage(error)}`);
    }
  }

  if (!response.ok) {
    if (
      parsedBody &&
      typeof parsedBody === "object" &&
      "message" in parsedBody &&
      typeof parsedBody.message === "string"
    ) {
      throw new Error(parsedBody.message);
    }

    if (
      parsedBody &&
      typeof parsedBody === "object" &&
      "detail" in parsedBody &&
      typeof parsedBody.detail === "string"
    ) {
      throw new Error(parsedBody.detail);
    }

    throw new Error(`HTTP ${response.status} for ${path}`);
  }

  return parsedBody as T;
}

function getDashboardLoadErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to refresh dashboard data.";
}

function shouldTreatAgentFeedbackStopDisconnectAsAccepted(error: unknown) {
  // Only accept hard disconnects that can happen when the control endpoint kills its own process.
  // Generic 502 responses can still represent real upstream kill failures that operators need to see.
  const normalizedMessage = getDashboardLoadErrorMessage(error).trim().toLowerCase();

  return normalizedMessage === "fetch failed" || normalizedMessage === "failed to fetch";
}

function markAgentFeedbackProgressStopped(
  progress: AgentFeedbackProgressResponseDto | null,
): AgentFeedbackProgressResponseDto | null {
  if (!progress) return null;

  return {
    ...progress,
    summary: {
      ...progress.summary,
      is_live: false,
      run_status: "stalled",
    },
  };
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
  return getFirstTextValue(freshness?.technical?.latest_date, freshness?.latest?.technical_market_date) ?? UNKNOWN_LABEL;
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

function getFirstTextValue(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (hasTextValue(value)) return value.trim();
  }

  return null;
}

function getFundamentalsFreshnessDate(
  freshness: EodFreshnessResponseDto | null,
  fundamentalsStatus: DartFundamentalsDailyInspectResponseDto | null,
) {
  return getFirstTextValue(
    getFundamentalsFreshnessLayer(freshness)?.latest_date,
    getFundamentalsRunDate(getLatestFundamentalsRun(fundamentalsStatus)),
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
  if (!isRunningPipelineStage(pipelineStage)) return stage;

  return buildStage(
    "running",
    pipelineStage?.total ?? stage?.symbols_total,
    pipelineStage?.processed ?? stage?.symbols_succeeded,
    pipelineStage?.failed ?? stage?.symbols_failed,
  );
}

function hasRunningDashboardPipelineStage(pipelineStatus: EodPipelineStatusResponseDto | null) {
  if (normalizePipelineStatus(pipelineStatus?.status) === "running") return true;

  return Object.values(pipelineStatus?.stages ?? {}).some((stage) => isRunningPipelineStage(stage));
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

function getTodayPriceFreshnessStage(freshness: EodFreshnessResponseDto | null): EodFreshnessStageDto | null {
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

function getLatestPriceFreshnessStage(freshness: EodFreshnessResponseDto | null): EodFreshnessStageDto | null {
  const status = freshness?.latest?.eod_status ?? null;
  const normalizedStatus = status?.trim().toLowerCase() ?? null;
  const hasLatestSnapshot =
    hasNumber(getLatestEodSymbolsSucceeded(freshness)) ||
    hasNumber(getLatestEodSymbolsTotal(freshness)) ||
    hasNumber(getLatestEodSymbolsFailed(freshness));
  const hasReadyLatestStatus =
    normalizedStatus === "ready" || normalizedStatus === "completed" || normalizedStatus === "available";
  const hasFailedLatestStatus =
    normalizedStatus === "failed" || normalizedStatus === "missing" || normalizedStatus === "partial";
  const resolvedStatus =
    normalizedStatus === "running"
      ? "running"
      : hasFailedLatestStatus
        ? "missing"
        : hasReadyLatestStatus || hasLatestSnapshot
        ? "ready"
        : null;

  return buildStage(
    resolvedStatus,
    getLatestEodSymbolsTotal(freshness),
    getLatestEodSymbolsSucceeded(freshness),
    getLatestEodSymbolsFailed(freshness),
  );
}

function getPriceFreshnessStage(
  freshness: EodFreshnessResponseDto | null,
  useTodayStage: boolean,
): EodFreshnessStageDto | null {
  return useTodayStage
    ? getTodayPriceFreshnessStage(freshness) ?? getLatestPriceFreshnessStage(freshness)
    : getLatestPriceFreshnessStage(freshness) ?? getTodayPriceFreshnessStage(freshness);
}

function getLatestTechnicalFreshnessStage(freshness: EodFreshnessResponseDto | null): EodFreshnessStageDto | null {
  if (freshness?.technical?.success === false) {
    return buildStage(
      "missing",
      getLatestEodSymbolsTotal(freshness),
      getLatestEodSymbolsSucceeded(freshness),
      getLatestEodSymbolsFailed(freshness),
    );
  }

  const hasTechnicalDate =
    getFirstTextValue(freshness?.technical?.latest_date, freshness?.latest?.technical_market_date) !== null;
  const hasLatestCounts =
    hasNumber(getLatestEodSymbolsSucceeded(freshness)) ||
    hasNumber(getLatestEodSymbolsTotal(freshness)) ||
    hasNumber(getLatestEodSymbolsFailed(freshness));
  return hasTechnicalDate && (freshness?.technical?.success === true || hasLatestCounts)
    ? buildStage(
        "ready",
        getLatestEodSymbolsTotal(freshness),
        getLatestEodSymbolsSucceeded(freshness),
        getLatestEodSymbolsFailed(freshness),
      )
    : null;
}

function getTechnicalFreshnessStage(
  freshness: EodFreshnessResponseDto | null,
  useTodayStage: boolean,
): EodFreshnessStageDto | null {
  if (useTodayStage && freshness?.today?.technical_analysis) return freshness.today.technical_analysis;

  return getLatestTechnicalFreshnessStage(freshness) ?? freshness?.today?.technical_analysis ?? null;
}

function getLatestActionFreshnessStage(freshness: EodFreshnessResponseDto | null): EodFreshnessStageDto | null {
  if (freshness?.action?.success === false) {
    return buildStage(
      "missing",
      getLatestEodSymbolsTotal(freshness),
      getLatestEodSymbolsSucceeded(freshness),
      getLatestEodSymbolsFailed(freshness),
    );
  }

  const latestActionDate = getFirstTextValue(freshness?.action?.latest_date, freshness?.latest?.action_market_date);
  const hasLatestCounts =
    hasNumber(getLatestEodSymbolsSucceeded(freshness)) ||
    hasNumber(getLatestEodSymbolsTotal(freshness)) ||
    hasNumber(getLatestEodSymbolsFailed(freshness));
  return latestActionDate && (freshness?.action?.success === true || hasLatestCounts)
    ? buildStage(
        "ready",
        getLatestEodSymbolsTotal(freshness),
        getLatestEodSymbolsSucceeded(freshness),
        getLatestEodSymbolsFailed(freshness),
      )
    : null;
}

function getActionFreshnessStage(
  freshness: EodFreshnessResponseDto | null,
  useTodayStage: boolean,
): EodFreshnessStageDto | null {
  if (useTodayStage && freshness?.today?.action_summary) return freshness.today.action_summary;

  return getLatestActionFreshnessStage(freshness) ?? freshness?.today?.action_summary ?? null;
}

function getFundamentalsFreshnessStage(
  freshness: EodFreshnessResponseDto | null,
  fundamentalsStatus: DartFundamentalsDailyInspectResponseDto | null,
  fundamentalsStatusLabel: string,
  latestFundamentalsDate: string | null,
  useTodayStage: boolean,
): EodFreshnessStageDto | null {
  if (useTodayStage && freshness?.today?.fundamentals) return freshness.today.fundamentals;

  const { symbolsTotal, symbolsChecked, symbolsFailed } = getFundamentalsStageDisplayCounts(
    fundamentalsStatus,
    freshness?.today?.fundamentals,
    useTodayStage,
  );
  const normalizedStatus = fundamentalsStatusLabel.trim().toLowerCase();
  if (normalizedStatus === "running") return buildStage("running", symbolsTotal, symbolsChecked, symbolsFailed);
  if (["completed", "available", "ready"].includes(normalizedStatus) || hasTextValue(latestFundamentalsDate)) {
    return buildStage("ready", symbolsTotal, symbolsChecked, symbolsFailed);
  }
  if (["failed", "partial", "needs review"].includes(normalizedStatus)) {
    return buildStage("missing", symbolsTotal, symbolsChecked, symbolsFailed);
  }

  return freshness?.today?.fundamentals ?? null;
}

function getEodStageStatusLabel(
  stage: EodFreshnessStageDto | null,
  todayTradeDate: string | null,
  latestDate: string | null,
  canShowBreakDay: boolean,
): EodStageCard["statusLabel"] {
  const status = normalizeStageStatus(stage);
  if (status === "running") return "running";
  const hasLatestDate = hasTextValue(latestDate);
  const hasStaleDate =
    hasTextValue(todayTradeDate) && hasLatestDate && todayTradeDate.trim() !== latestDate.trim();
  if (status === "ready" && canShowBreakDay && hasStaleDate) return "break day";
  if (status === "ready" && hasLatestDate) return "synced";
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
  pipelineStage: EodPipelineStageDto | null | undefined,
  countDetail: Pick<EodStageDetail, "label" | "value"> = {
    label: "",
    value: `${formatEodSymbolCount(stage?.symbols_succeeded)} / ${formatEodSymbolCount(stage?.symbols_total)}`,
  },
): EodStageCard {
  const statusLabel = getEodStageStatusLabel(stage, todayTradeDate, latestDate, canShowBreakDay);
  const { label: statusBadgeLabel, title: statusBadgeTitle } = getEodStageStatusBadge(statusLabel, pipelineStage);
  const details: EodStageDetail[] = [
    {
      key: "count",
      tone: "count",
      ...countDetail,
    },
  ];

  if (hasTextValue(todayTradeDate) && hasTextValue(latestDate) && todayTradeDate !== latestDate) {
    details.push({ key: "latest-date", label: "Latest date", value: latestDate, tone: "text" });
  }
  if (hasNumber(stage?.symbols_failed) && stage.symbols_failed > 0) {
    details.push({
      key: "failed",
      label: "Failed",
      value: formatEodSymbolCount(stage.symbols_failed),
      tone: "count",
    });
  }

  return {
    id,
    label,
    latestDate,
    statusLabel,
    statusBadgeLabel,
    statusBadgeTitle,
    tone: getEodStageTone(statusLabel),
    details,
  };
}

function formatPipelineDetailText(value: string | null | undefined) {
  if (!hasTextValue(value)) return null;

  const trimmed = value.trim();
  return /[_-]/.test(trimmed) && !trimmed.includes(" ") ? humanizeToken(trimmed, trimmed) : trimmed;
}

function getEodStageStatusBadge(
  statusLabel: EodStageCard["statusLabel"],
  pipelineStage: EodPipelineStageDto | null | undefined,
) {
  if (statusLabel !== "running") {
    return { label: statusLabel, title: null };
  }

  const currentStep = formatPipelineDetailText(pipelineStage?.current_step);
  const currentActivity = formatPipelineDetailText(pipelineStage?.current_activity);
  const currentSymbol = pipelineStage?.current_symbol?.trim() || null;
  const label = currentStep ?? currentActivity ?? statusLabel;
  const titleParts = [currentStep, currentActivity, currentSymbol ? `Symbol ${currentSymbol}` : null].filter(Boolean);

  return {
    label,
    title: titleParts.length > 0 ? titleParts.join(" · ") : null,
  };
}

function isIconOnlyEodStageStatus(statusLabel: EodStageCard["statusLabel"]) {
  return statusLabel === "synced" || statusLabel === "running" || statusLabel === "not synced";
}

function getEodStageStatusAriaLabel(stage: EodStageCard) {
  if (stage.statusLabel !== "running" || stage.statusBadgeLabel === stage.statusLabel) {
    return stage.statusBadgeLabel;
  }

  return `${stage.statusLabel} · ${stage.statusBadgeLabel}`;
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
    layout: "stacked",
  };
}

function formatAgentProgressCountLabel(value: number | null | undefined) {
  if (!hasNumber(value)) return UNKNOWN_LABEL;
  return `${value.toLocaleString("ko-KR")}개`;
}

function clampAgentProgressPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function formatAgentProgressPercentValueLabel(value: number | null | undefined) {
  const percent = value;
  if (!hasNumber(percent)) return UNKNOWN_LABEL;
  return `${clampAgentProgressPercent(percent).toLocaleString("ko-KR", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}%`;
}

function formatAgentProgressPercentLabel(progress: AgentFeedbackProgressResponseDto | null) {
  return formatAgentProgressPercentValueLabel(progress?.summary?.progress_percent);
}

function getAgentProgressPercentValue(progress: AgentFeedbackProgressResponseDto | null) {
  const percent = progress?.summary?.progress_percent;
  if (!hasNumber(percent)) return 0;
  return clampAgentProgressPercent(percent);
}

function getAgentProgressPercentFromCounts(
  completedCount: number | null | undefined,
  totalCount: number | null | undefined,
) {
  if (!hasNumber(completedCount) || !hasNumber(totalCount) || totalCount <= 0) return null;
  return clampAgentProgressPercent((completedCount / totalCount) * 100);
}

function getAgentProgressPercentFromRecord(record: Record<string, unknown>) {
  const percent = getRecordNumberValue(record, [
    "progress_percent",
    "percent",
    "completion_percent",
    "completed_percent",
  ]);
  if (hasNumber(percent)) return clampAgentProgressPercent(percent);

  const ratio = getRecordNumberValue(record, ["progress_ratio", "ratio", "completion_ratio", "completed_ratio"]);
  if (!hasNumber(ratio)) return null;

  return clampAgentProgressPercent(ratio <= 1 ? ratio * 100 : ratio);
}

function normalizeAgentProgressRunStatus(status: unknown): AgentFeedbackRunStatus | null {
  if (typeof status !== "string") return null;
  const normalized = status.trim().toLowerCase();
  return normalized in AGENT_PROGRESS_STATUS_LABELS ? (normalized as AgentFeedbackRunStatus) : null;
}

function getResolvedAgentProgressRunStatus(progress: AgentFeedbackProgressResponseDto | null) {
  if (!progress) return null;

  const summary = progress.summary;
  const runStatus = normalizeAgentProgressRunStatus(summary.run_status);
  if (runStatus) return runStatus;

  if (summary.is_live) return "running";
  if (summary.failed_items > 0) return "stalled";
  if (summary.progress_percent >= 100) return "completed";
  return "pending";
}

function isAgentFeedbackProgressRunning(progress: AgentFeedbackProgressResponseDto | null) {
  return getResolvedAgentProgressRunStatus(progress) === "running";
}

function getAgentFeedbackProgressPollDelayMs(progress: AgentFeedbackProgressResponseDto | null) {
  return isAgentFeedbackProgressRunning(progress)
    ? AGENT_FEEDBACK_PROGRESS_RUNNING_POLL_MS
    : AGENT_FEEDBACK_PROGRESS_IDLE_POLL_MS;
}

function getAgentProgressStatusLabel(progress: AgentFeedbackProgressResponseDto | null, error: string | null) {
  if (!progress) return error ? "에이전트 확인 필요" : UNKNOWN_LABEL;

  const runStatus = getResolvedAgentProgressRunStatus(progress);
  return runStatus ? AGENT_PROGRESS_STATUS_LABELS[runStatus] : AGENT_PROGRESS_STATUS_LABELS.pending;
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
  getAgentRoleResultSnapshots(progress).forEach((snapshot) => addRole(snapshot.role));
  addRole(progress?.summary?.current_role);

  if (roles.length > 0) return roles;

  return [...DEFAULT_AGENT_ROLE_ORDER];
}

function getAgentRoleStatus(role: string, orderedRoles: string[], currentRole: string | null): AgentRoleStatus {
  if (currentRole === normalizeAgentRole(role)) return "running";
  if (!currentRole) return "pending";

  const roleIndex = orderedRoles.findIndex((candidate) => normalizeAgentRole(candidate) === normalizeAgentRole(role));
  const currentRoleIndex = orderedRoles.findIndex((candidate) => normalizeAgentRole(candidate) === currentRole);

  if (roleIndex >= 0 && currentRoleIndex >= 0 && roleIndex < currentRoleIndex) return "completed";
  return "pending";
}

function buildAgentRoleMetrics(progress: AgentFeedbackProgressResponseDto | null): AgentRoleMetric[] {
  if (!isAgentFeedbackProgressRunning(progress)) return [];

  return [
    {
      key: "progress",
      label: "진행률",
      value: formatAgentProgressPercentLabel(progress),
    },
    {
      key: "total",
      label: "전체 대상",
      value: formatAgentProgressCountLabel(progress?.summary?.total_symbols),
    },
    {
      key: "failed",
      label: "실패",
      value: formatAgentProgressCountLabel(progress?.summary?.failed_items),
    },
    {
      key: "completed",
      label: "완료",
      value: formatAgentProgressCountLabel(
        getResolvedAgentProgressRunStatus(progress) === "running"
          ? progress?.summary?.processed_symbols
          : progress?.summary?.completed_symbols,
      ),
    },
  ];
}

function getRecordStringValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && hasTextValue(value)) return value.trim();
  }

  return null;
}

function getRecordNumberValue(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }

  return null;
}

function normalizeAgentRoleCardStatus(value: unknown): AgentRoleStatus | null {
  if (typeof value !== "string") return null;

  switch (value.trim().toLowerCase()) {
    case "completed":
    case "complete":
    case "done":
    case "ready":
      return "completed";
    case "running":
    case "in_progress":
    case "processing":
      return "running";
    case "pending":
    case "queued":
    case "idle":
      return "pending";
    case "stalled":
    case "failed":
    case "error":
    case "attention":
    case "needs_review":
    case "needs review":
      return "attention";
    default:
      return null;
  }
}

function extractAgentRoleSnapshot(role: string, value: unknown): AgentRoleProgressSnapshot | null {
  if (!isRecord(value)) return null;

  const completedCount = getRecordNumberValue(value, [
    "completed_symbols",
    "completed_count",
    "completed_feedback_count",
    "count",
  ]);
  const progressCount = getRecordNumberValue(value, [
    "processed_symbols",
    "processed_count",
    "completed_symbols",
    "completed_count",
    "completed_feedback_count",
    "count",
  ]);
  const totalCount = getRecordNumberValue(value, [
    "total_symbols",
    "expected_symbols",
    "total_count",
    "expected_count",
    "expected_feedback_count",
  ]);
  const status =
    normalizeAgentRoleCardStatus(
      getRecordStringValue(value, ["status", "run_status", "role_status", "progress_status"]),
    ) ?? "pending";
  const progressPercent =
    getAgentProgressPercentFromRecord(value) ?? getAgentProgressPercentFromCounts(progressCount, totalCount);

  return {
    role,
    status,
    completedCount,
    progressPercent,
  };
}

function extractAgentRoleResultSnapshot(role: string, value: unknown): AgentRoleResultSnapshot | null {
  if (!isRecord(value)) return null;

  const requestedCount = getRecordNumberValue(value, ["requested_count", "requestedCount"]);
  const completedCount = getRecordNumberValue(value, ["completed_count", "completedCount"]);
  const errorCount = getRecordNumberValue(value, ["error_count", "errorCount"]);

  if (requestedCount === null && completedCount === null && errorCount === null) return null;

  return {
    role,
    requestedCount,
    completedCount,
    errorCount,
  };
}

function getAgentRoleResultSnapshots(progress: AgentFeedbackProgressResponseDto | null) {
  if (!progress) return [];

  const progressRecord = isRecord(progress) ? (progress as Record<string, unknown>) : null;
  const resultRecord = isRecord(progressRecord?.result) ? (progressRecord.result as Record<string, unknown>) : null;
  const source = resultRecord?.roles;

  if (Array.isArray(source)) {
    return source
      .map((item) => {
        if (!isRecord(item)) return null;
        const role = getRecordStringValue(item, ["role", "agent", "name", "label"]);
        if (!role) return null;
        return extractAgentRoleResultSnapshot(role, item);
      })
      .filter((item): item is AgentRoleResultSnapshot => item !== null);
  }

  if (!isRecord(source)) return [];

  return Object.entries(source)
    .map(([role, value]) => extractAgentRoleResultSnapshot(role, value))
    .filter((item): item is AgentRoleResultSnapshot => item !== null);
}

function getAgentRoleProgressSnapshots(progress: AgentFeedbackProgressResponseDto | null) {
  if (!progress) return [];

  const progressRecord = isRecord(progress) ? (progress as Record<string, unknown>) : null;
  const summaryRecord = isRecord(progressRecord?.summary)
    ? (progressRecord.summary as Record<string, unknown>)
    : null;
  const sources = [
    progressRecord?.role_progress,
    progressRecord?.roles,
    summaryRecord?.role_progress,
    summaryRecord?.roles,
    summaryRecord?.role_statuses,
  ];

  for (const source of sources) {
    if (Array.isArray(source)) {
      const snapshots = source
        .map((item) => {
          if (!isRecord(item)) return null;
          const role = getRecordStringValue(item, ["role", "agent", "name", "label"]);
          if (!role) return null;
          return extractAgentRoleSnapshot(role, item);
        })
        .filter((item): item is AgentRoleProgressSnapshot => item !== null);
      if (snapshots.length > 0) return snapshots;
      continue;
    }

    if (!isRecord(source)) continue;

    const snapshots = Object.entries(source)
      .map(([role, value]) => extractAgentRoleSnapshot(role, value))
      .filter((item): item is AgentRoleProgressSnapshot => item !== null);
    if (snapshots.length > 0) return snapshots;
  }

  return [];
}

function buildAgentRoleResultMetrics(snapshot: AgentRoleResultSnapshot): AgentRoleMetric[] {
  return [
    {
      key: "completed",
      label: "Completed",
      value: formatAgentProgressCountLabel(snapshot.completedCount),
    },
    {
      key: "errors",
      label: "Errors",
      value: formatAgentProgressCountLabel(snapshot.errorCount),
    },
  ];
}

function isCompletedAgentRoleResult(snapshot: AgentRoleResultSnapshot) {
  return snapshot.errorCount === 0;
}

function getAgentRoleResultProgressPercent(snapshot: AgentRoleResultSnapshot) {
  if (isCompletedAgentRoleResult(snapshot)) return 100;
  if (!hasNumber(snapshot.requestedCount) || snapshot.requestedCount <= 0) return null;

  const completedCount = hasNumber(snapshot.completedCount) ? snapshot.completedCount : 0;
  const errorCount = hasNumber(snapshot.errorCount) ? snapshot.errorCount : 0;
  return clampAgentProgressPercent(((completedCount + errorCount) / snapshot.requestedCount) * 100);
}

function isSummarizerRole(role: string) {
  return (normalizeAgentRole(role) ?? "").includes("summarizer");
}

function shouldShowAgentRoleMetrics(role: string, status: AgentRoleStatus, fallbackRole: string | null) {
  if (!isSummarizerRole(role)) return false;
  if (status === "running") return true;
  return fallbackRole !== null && normalizeAgentRole(role) === fallbackRole;
}

function getNonRunningAgentRoleStatus(
  runStatus: AgentFeedbackRunStatus | null,
  role: string,
  orderedRoles: string[],
  currentRole: string | null,
): AgentRoleStatus {
  if (runStatus === "completed") return "completed";
  if (runStatus === "pending" || runStatus === null) return "pending";
  if (runStatus !== "stalled" || !currentRole) return "attention";

  const roleIndex = orderedRoles.findIndex((candidate) => normalizeAgentRole(candidate) === normalizeAgentRole(role));
  const currentRoleIndex = orderedRoles.findIndex((candidate) => normalizeAgentRole(candidate) === currentRole);

  if (roleIndex >= 0 && currentRoleIndex >= 0) {
    if (roleIndex < currentRoleIndex) return "completed";
    if (roleIndex === currentRoleIndex) return "attention";
    return "pending";
  }

  return "attention";
}

function getNonRunningAgentRoleCompletedCount(
  progress: AgentFeedbackProgressResponseDto | null,
  runStatus: AgentFeedbackRunStatus | null,
  role: string,
  orderedRoles: string[],
  currentRole: string | null,
) {
  const totalSymbols = progress?.summary.total_symbols ?? null;
  const completedSymbols = progress?.summary.completed_symbols ?? null;

  if (runStatus === "completed") {
    return totalSymbols ?? completedSymbols;
  }

  if (runStatus === "pending" || runStatus === null) {
    return 0;
  }

  if (runStatus !== "stalled" || !currentRole) {
    return completedSymbols;
  }

  const roleIndex = orderedRoles.findIndex((candidate) => normalizeAgentRole(candidate) === normalizeAgentRole(role));
  const currentRoleIndex = orderedRoles.findIndex((candidate) => normalizeAgentRole(candidate) === currentRole);

  if (roleIndex >= 0 && currentRoleIndex >= 0) {
    if (roleIndex < currentRoleIndex) return totalSymbols;
    if (roleIndex === currentRoleIndex) return completedSymbols;
    return 0;
  }

  return completedSymbols;
}

function getAgentRoleProgressPercent(
  progress: AgentFeedbackProgressResponseDto | null,
  status: AgentRoleStatus,
  completedCount: number | null | undefined,
  snapshot: AgentRoleProgressSnapshot | null | undefined,
) {
  if (hasNumber(snapshot?.progressPercent)) return snapshot.progressPercent;

  const totalSymbols = progress?.summary.total_symbols ?? null;
  const countedPercent = getAgentProgressPercentFromCounts(completedCount, totalSymbols);
  if (countedPercent !== null) return countedPercent;

  if (status === "completed") return 100;
  if (status === "pending") return 0;

  return getAgentProgressPercentValue(progress);
}

function buildAgentRoleCard(
  progress: AgentFeedbackProgressResponseDto | null,
  role: string,
  status: AgentRoleStatus,
  completedCount: number | null | undefined,
  snapshot: AgentRoleProgressSnapshot | null | undefined,
  metrics: AgentRoleMetric[],
  progressPercentOverride: number | null = null,
): AgentRoleCard {
  const progressPercent =
    progressPercentOverride ?? getAgentRoleProgressPercent(progress, status, completedCount, snapshot);

  return {
    role,
    label: getAgentRoleLabel(role),
    status,
    progressPercent,
    progressLabel: formatAgentProgressPercentValueLabel(progressPercent),
    metrics,
  };
}

function buildAgentRoleCards(progress: AgentFeedbackProgressResponseDto | null): AgentRoleCard[] {
  const orderedRoles = getOrderedAgentRoles(progress);
  if (orderedRoles.length === 0) return [];

  const currentRole = normalizeAgentRole(progress?.summary?.current_role);
  const runStatus = getResolvedAgentProgressRunStatus(progress);
  const roleResultSnapshots = getAgentRoleResultSnapshots(progress);
  const roleResultSnapshotByRole = new Map(
    roleResultSnapshots.map((snapshot) => [normalizeAgentRole(snapshot.role) ?? snapshot.role, snapshot] as const),
  );
  const roleSnapshots = getAgentRoleProgressSnapshots(progress);
  const roleSnapshotByRole = new Map(
    roleSnapshots.map((snapshot) => [normalizeAgentRole(snapshot.role) ?? snapshot.role, snapshot] as const),
  );

  if (!isAgentFeedbackProgressRunning(progress)) {
    return orderedRoles.map((role) => {
      const resultSnapshot = roleResultSnapshotByRole.get(normalizeAgentRole(role) ?? role);
      const snapshot = roleSnapshotByRole.get(normalizeAgentRole(role) ?? role);
      const fallbackStatus = getNonRunningAgentRoleStatus(runStatus, role, orderedRoles, currentRole);
      const status = resultSnapshot
        ? isCompletedAgentRoleResult(resultSnapshot)
          ? "completed"
          : fallbackStatus
        : snapshot?.status ?? fallbackStatus;
      const completedCount =
        resultSnapshot?.completedCount ??
        snapshot?.completedCount ??
        getNonRunningAgentRoleCompletedCount(progress, runStatus, role, orderedRoles, currentRole);
      const metrics = resultSnapshot
        ? buildAgentRoleResultMetrics(resultSnapshot)
        : [
            {
              key: "completed",
              label: "Complete",
              value: formatAgentProgressCountLabel(completedCount),
            },
          ];

      return buildAgentRoleCard(
        progress,
        role,
        status,
        completedCount,
        snapshot,
        metrics,
        resultSnapshot ? getAgentRoleResultProgressPercent(resultSnapshot) : null,
      );
    });
  }

  const metrics = buildAgentRoleMetrics(progress);
  // Keep run-level metrics visible for legacy/transient payloads that are live but omit current_role.
  const fallbackMetricsRole =
    currentRole === null
      ? normalizeAgentRole(orderedRoles.find((role) => isSummarizerRole(role)) ?? orderedRoles[0])
      : null;

  return orderedRoles.map((role) => {
    const snapshot = roleSnapshotByRole.get(normalizeAgentRole(role) ?? role);
    const status = snapshot?.status ?? getAgentRoleStatus(role, orderedRoles, currentRole);
    const roleMetrics = shouldShowAgentRoleMetrics(role, status, fallbackMetricsRole) ? metrics : [];

    return buildAgentRoleCard(
      progress,
      role,
      status,
      snapshot?.completedCount,
      snapshot,
      roleMetrics,
    );
  });
}

function hasCompletedDefaultAgentRoles(roleCards: AgentRoleCard[]) {
  const completedRoles = new Set(
    roleCards
      .filter((role) => role.status === "completed")
      .map((role) => normalizeAgentRole(role.role) ?? role.role),
  );

  return DEFAULT_AGENT_ROLE_ORDER.every((role) => completedRoles.has(role));
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
  const initialPipelineRequestMarketDate = getDashboardProcessRequestMarketDate(
    initialFreshness?.today?.trade_date,
    initialMarket.server_time,
  );
  const initialDashboardProcessMarketDate = getDashboardProcessResolvedMarketDate(
    initialPipelineStatus,
    initialPipelineRequestMarketDate,
  );
  const [market, setMarket] = useState<CoreMarketStatus>(initialMarket);
  const [tracked, setTracked] = useState<CoreTrackedQuotesResponse>(initialTracked);
  const [freshness, setFreshness] = useState<EodFreshnessResponseDto | null>(initialFreshness);
  const [fundamentalsStatus, setFundamentalsStatus] = useState<DartFundamentalsDailyInspectResponseDto | null>(
    initialFundamentalsStatus,
  );
  const [pipelineStatus, setPipelineStatus] = useState<EodPipelineStatusResponseDto | null>(initialPipelineStatus);
  const pipelineStatusRef = useRef<EodPipelineStatusResponseDto | null>(initialPipelineStatus);
  const pipelineStatusRequestDateRef = useRef<string | null>(initialPipelineRequestMarketDate);
  const marketServerTimeRef = useRef<string | null>(initialMarket.server_time ?? null);
  const freshnessTradeDateRef = useRef<string | null>(initialFreshness?.today?.trade_date ?? null);
  const [agentFeedbackProgress, setAgentFeedbackProgress] = useState<AgentFeedbackProgressResponseDto | null>(
    initialAgentFeedbackProgress,
  );
  const agentFeedbackProgressRef = useRef<AgentFeedbackProgressResponseDto | null>(initialAgentFeedbackProgress);
  const [agentFeedbackProgressError, setAgentFeedbackProgressError] = useState<string | null>(null);
  const [agentFeedbackStopPending, setAgentFeedbackStopPending] = useState(false);
  const [agentFeedbackStopError, setAgentFeedbackStopError] = useState<string | null>(null);
  const [symbolMetaBySymbol, setSymbolMetaBySymbol] = useState<Record<string, SymbolMetadataItem | null>>({});
  const [piotroskiBoard, setPiotroskiBoard] = useState<PiotroskiPassListResult | null>(null);
  const [piotroskiBoardError, setPiotroskiBoardError] = useState<string | null>(null);
  const [piotroskiBoardLoadState, setPiotroskiBoardLoadState] = useState<"idle" | "loading" | "ready" | "error">(
    initialDashboardProcessMarketDate ? "loading" : "idle",
  );
  const [agentFeedbackStopDialogOpen, setAgentFeedbackStopDialogOpen] = useState(false);
  const [openFundamentalsFailureKey, setOpenFundamentalsFailureKey] = useState<string | null>(null);
  const [marketError, setMarketError] = useState<string | null>(initialError);
  const [trackedError, setTrackedError] = useState<string | null>(initialError);
  const pipelineRequestMarketDate = getDashboardProcessRequestMarketDate(
    freshness?.today?.trade_date,
    market.server_time,
  );
  const dashboardProcessMarketDate = getDashboardProcessResolvedMarketDate(
    pipelineStatus,
    pipelineRequestMarketDate,
  );
  const fundamentalsInspectPath = useMemo(
    () => buildDartFundamentalsDailyInspectPath(DART_FUNDAMENTALS_DAILY_INSPECT_CLIENT_PATH, dashboardProcessMarketDate),
    [dashboardProcessMarketDate],
  );
  const pipelineStatusPath = useMemo(
    () => buildEodPipelineStatusPath(EOD_PIPELINE_STATUS_CLIENT_PATH, pipelineRequestMarketDate),
    [pipelineRequestMarketDate],
  );

  useEffect(() => {
    seedTradingApiJsonSnapshot(MOBILE_TOOLBAR_MARKET_STATUS_PATH, initialMarket);
    seedTradingApiJsonSnapshot(MOBILE_TOOLBAR_TRACKED_QUOTES_PATH, initialTracked);
    seedTradingApiJsonCache("/api/trading/eod/freshness", initialFreshness);
    seedTradingApiJsonCache(
      buildDartFundamentalsDailyInspectPath(
        DART_FUNDAMENTALS_DAILY_INSPECT_CLIENT_PATH,
        initialDashboardProcessMarketDate,
      ),
      initialFundamentalsStatus,
    );
    void warmMobileToolbarViewData("dashboard");
  }, [initialDashboardProcessMarketDate, initialFreshness, initialFundamentalsStatus, initialMarket, initialTracked]);

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
        seedTradingApiJsonSnapshot(MOBILE_TOOLBAR_TRACKED_QUOTES_PATH, trackedData);
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
        const nextRequestMarketDate = getDashboardProcessRequestMarketDate(
          freshnessTradeDateRef.current,
          nextServerTime,
        );
        if (pipelineStatusRequestDateRef.current !== nextRequestMarketDate) {
          pipelineStatusRequestDateRef.current = nextRequestMarketDate;
          pipelineStatusRef.current = null;
          setPipelineStatus(null);
        }
        setMarket(marketData);
        seedTradingApiJsonSnapshot(MOBILE_TOOLBAR_MARKET_STATUS_PATH, marketData);
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
        const nextRequestMarketDate = getDashboardProcessRequestMarketDate(
          nextTradeDate,
          marketServerTimeRef.current,
        );
        if (pipelineStatusRequestDateRef.current !== nextRequestMarketDate) {
          pipelineStatusRequestDateRef.current = nextRequestMarketDate;
          pipelineStatusRef.current = null;
          setPipelineStatus(null);
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

  const piotroskiMarketDate = dashboardProcessMarketDate;

  useEffect(() => {
    if (!piotroskiMarketDate) {
      setPiotroskiBoard(null);
      setPiotroskiBoardError(null);
      setPiotroskiBoardLoadState("idle");
      return;
    }

    let active = true;
    setPiotroskiBoard(null);
    setPiotroskiBoardError(null);
    setPiotroskiBoardLoadState("loading");

    const loadPiotroskiBoard = async () => {
      try {
        const data = await loadPiotroskiPassList({
          marketDate: piotroskiMarketDate,
          limit: 0,
        });
        if (!active) return;
        setPiotroskiBoard(data);
        setPiotroskiBoardLoadState("ready");
      } catch (piotroskiBoardLoadError) {
        console.error("Dashboard Piotroski board load failed", piotroskiBoardLoadError);
        if (!active) return;
        setPiotroskiBoard(null);
        setPiotroskiBoardError(getDashboardLoadErrorMessage(piotroskiBoardLoadError));
        setPiotroskiBoardLoadState("error");
      }
    };

    void loadPiotroskiBoard();

    return () => {
      active = false;
    };
  }, [piotroskiMarketDate]);

  useEffect(() => {
    let active = true;
    let timer: number | null = null;

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
        pipelineStatusRequestDateRef.current = pipelineRequestMarketDate;
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
  }, [pipelineRequestMarketDate, pipelineStatusPath]);

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

  const latestFundamentalsDate = getFundamentalsFreshnessDate(freshness, fundamentalsStatus);
  const todayTradeDate = getFirstTextValue(freshness?.today?.trade_date);
  const priceLatestDate = getFirstTextValue(freshness?.latest?.price_trade_date);
  const technicalLatestDate = getFirstTextValue(
    freshness?.technical?.latest_date,
    freshness?.latest?.technical_market_date,
  );
  const actionLatestDate = getFirstTextValue(freshness?.action?.latest_date, freshness?.latest?.action_market_date);
  const pricePipelineStage = getPipelineStage(pipelineStatus, "price_collection");
  const technicalPipelineStage = getPipelineStage(pipelineStatus, "technical_snapshots");
  const fundamentalsPipelineStage = getPipelineStage(pipelineStatus, "fundamentals_daily_refresh");
  const actionPipelineStage = getPipelineStage(pipelineStatus, "action_summaries");
  const useTodayPriceStage = shouldUseTodayStageData(todayTradeDate, priceLatestDate, pricePipelineStage);
  const useTodayTechnicalStage = shouldUseTodayStageData(todayTradeDate, technicalLatestDate, technicalPipelineStage);
  const useTodayActionStage = shouldUseTodayStageData(todayTradeDate, actionLatestDate, actionPipelineStage);
  const useTodayFundamentalsStage = shouldUseTodayStageData(
    todayTradeDate,
    latestFundamentalsDate,
    fundamentalsPipelineStage,
  );
  const fundamentalsStatusLabel = getFundamentalsStatusLabel(
    freshness,
    fundamentalsStatus,
    latestFundamentalsDate,
    fundamentalsPipelineStage,
  );
  const fundamentalsFreshnessStage = getFundamentalsFreshnessStage(
    freshness,
    fundamentalsStatus,
    fundamentalsStatusLabel,
    latestFundamentalsDate,
    useTodayFundamentalsStage,
  );
  const fundamentalsFailureDetails = getFundamentalsFailureDetails(
    freshness,
    fundamentalsStatus,
    latestFundamentalsDate,
    fundamentalsStatusLabel,
  );

  const eodMarketDate = todayTradeDate ?? UNKNOWN_LABEL;
  const eodStatusMarketDate = dashboardProcessMarketDate;
  const isBreakDay = isBreakDayMarket(market);
  const priceFreshnessStage = mergeRunningPipelineStage(
    getPriceFreshnessStage(freshness, useTodayPriceStage),
    pricePipelineStage,
  );
  const technicalFreshnessStage = mergeRunningPipelineStage(
    getTechnicalFreshnessStage(freshness, useTodayTechnicalStage),
    technicalPipelineStage,
  );
  const actionFreshnessStage = mergeRunningPipelineStage(
    getActionFreshnessStage(freshness, useTodayActionStage),
    actionPipelineStage,
  );
  const fundamentalsFreshnessWithPipelineStage = mergeRunningPipelineStage(
    fundamentalsFreshnessStage,
    fundamentalsPipelineStage,
  );
  const fundamentalsUpdatedSymbolsDetail = getFundamentalsUpdatedSymbolsDetail(
    fundamentalsStatus,
    todayTradeDate,
  );
  const fundamentalsStageCard = buildEodStageCard(
    "fundamentals",
    "Fundamentals",
    fundamentalsFreshnessWithPipelineStage,
    eodStatusMarketDate,
    latestFundamentalsDate,
    isBreakDay,
    fundamentalsPipelineStage,
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
      eodStatusMarketDate,
      priceLatestDate,
      isBreakDay,
      pricePipelineStage,
    ),
    buildEodStageCard(
      "technical",
      "Technical Analysis",
      technicalFreshnessStage,
      eodStatusMarketDate,
      technicalLatestDate,
      isBreakDay,
      technicalPipelineStage,
    ),
    buildEodStageCard(
      "action",
      "Action Summary",
      actionFreshnessStage,
      eodStatusMarketDate,
      actionLatestDate,
      isBreakDay,
      actionPipelineStage,
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
  const agentProgressDate =
    displayedAgentFeedbackProgress?.request?.market_date ?? agentProgressMarketDate ?? UNKNOWN_LABEL;
  const isAgentFeedbackRunning = isAgentFeedbackProgressRunning(displayedAgentFeedbackProgress);
  const agentRoleCards = buildAgentRoleCards(displayedAgentFeedbackProgress);
  const agentProgressRunStatus = getResolvedAgentProgressRunStatus(displayedAgentFeedbackProgress);
  const showCompletedAgentFeedbackIcon =
    agentProgressRunStatus === "pending" && hasCompletedDefaultAgentRoles(agentRoleCards);
  const agentFeedbackStatusTone =
    agentProgressRunStatus === "completed"
      ? "positive"
      : agentProgressRunStatus === "running"
        ? "neutral"
        : agentProgressRunStatus === "stalled"
          ? "warning"
          : "neutral";
  const filteringStatusLabel =
    piotroskiBoardLoadState === "ready"
      ? "Completed"
      : piotroskiBoardLoadState === "loading"
        ? "Loading"
        : piotroskiBoardLoadState === "error"
          ? "Needs review"
          : piotroskiMarketDate
            ? "Pending"
            : "Waiting";
  const filteringStatusTone =
    piotroskiBoardLoadState === "ready"
      ? "positive"
      : piotroskiBoardLoadState === "loading"
        ? "neutral"
        : piotroskiBoardLoadState === "error"
          ? "warning"
          : "neutral";
  const filteringCheckedCount = piotroskiBoard?.summary.entries ?? null;
  const filteringPassCount = piotroskiBoard?.summary.passed_count ?? piotroskiBoard?.totalPassedCount ?? null;
  const filteringNote =
    piotroskiBoardLoadState === "error"
      ? piotroskiBoardError ?? "Piotroski filter results are unavailable."
      : piotroskiBoardLoadState === "ready"
        ? null
        : piotroskiMarketDate
          ? "Piotroski filter status is pending for the selected market date."
          : "Piotroski market date is pending.";
  const marketBadgeLabel = market.is_open ? "Market Open" : "Market Closed";
  const coreUnavailable =
    market.state === "OFFLINE PLACEHOLDER" ||
    isOfflineTrackedPlaceholder(tracked) ||
    Boolean(marketError || trackedError);
  const error = trackedError ?? marketError;
  const fundamentalsDialogOpen =
    Boolean(fundamentalsFailureDetails) && openFundamentalsFailureKey === fundamentalsFailureDetails?.key;
  const dialogOpen = fundamentalsDialogOpen || agentFeedbackStopDialogOpen;

  function openAgentFeedbackStopDialog() {
    if (!isAgentFeedbackRunning) return;
    setAgentFeedbackStopError(null);
    setAgentFeedbackStopDialogOpen(true);
  }

  function closeAgentFeedbackStopDialog() {
    if (agentFeedbackStopPending) return;
    setAgentFeedbackStopError(null);
    setAgentFeedbackStopDialogOpen(false);
  }

  async function handleAgentFeedbackStopConfirm() {
    if (agentFeedbackStopPending) return;

    setAgentFeedbackStopPending(true);
    setAgentFeedbackStopError(null);

    try {
      await postJson<AgentContextCoreControlResponseDto>(
        AGENT_FEEDBACK_STOP_CONTROL_CLIENT_PATH,
        AGENT_FEEDBACK_STOP_REQUEST,
      );
      setAgentFeedbackStopDialogOpen(false);
    } catch (stopError) {
      if (shouldTreatAgentFeedbackStopDisconnectAsAccepted(stopError)) {
        const stoppedProgress = markAgentFeedbackProgressStopped(agentFeedbackProgressRef.current);
        agentFeedbackProgressRef.current = stoppedProgress;
        setAgentFeedbackProgress(stoppedProgress);
        setAgentFeedbackProgressError(null);
        setAgentFeedbackStopDialogOpen(false);
        return;
      }

      console.error("Dashboard agent feedback stop request failed", stopError);
      setAgentFeedbackStopError(getDashboardLoadErrorMessage(stopError));
    } finally {
      setAgentFeedbackStopPending(false);
    }
  }

  useEffect(() => {
    if (isAgentFeedbackRunning) return;
    setAgentFeedbackStopError(null);
    setAgentFeedbackStopDialogOpen(false);
  }, [isAgentFeedbackRunning]);

  useEffect(() => {
    if (!dialogOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (agentFeedbackStopPending) return;
        if (agentFeedbackStopDialogOpen) {
          setAgentFeedbackStopError(null);
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
  }, [agentFeedbackStopDialogOpen, agentFeedbackStopPending, dialogOpen, fundamentalsDialogOpen]);

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
            api="/api/trading/eod/freshness + /api/trading/eod/pipeline/status + /api/trading/market/status + /api/trading/agent-context/feedback/progress + /api/trading/agent-context/internal/core/control + /api/trading/disclosures/dart/fundamentals/daily/inspect + /api/trading/eod/piotroski-filter-results"
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
              <div className={styles.sectionHeaderRow}>
                <div>
                  <p className={styles.sectionEyebrow}>EOD Status</p>
                  <h2 className={styles.sectionTitle}>Daily Data Fetch</h2>
                  <p className={styles.cardContext}>Market date {eodMarketDate}</p>
                </div>
              </div>

              <div className={styles.eodStageGrid}>
                {eodStageCards.map((stage) => {
                  const isIconOnlyStatus = isIconOnlyEodStageStatus(stage.statusLabel);
                  const isStandaloneStatusIcon =
                    stage.statusLabel === "synced" || stage.statusLabel === "not synced";
                  const statusClass =
                    stage.statusLabel === "running"
                      ? styles.runningStatusPill
                      : "";
                  const statusAriaLabel = getEodStageStatusAriaLabel(stage);
                  const statusTitle = stage.statusBadgeTitle ?? (isIconOnlyStatus ? statusAriaLabel : undefined);
                  const standaloneStatusClass =
                    stage.statusLabel === "not synced" ? styles.notSyncedStatusIcon : styles.syncedStatusIcon;

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
                        {isStandaloneStatusIcon ? (
                          <span
                            className={`${styles.statusIconBadge} ${standaloneStatusClass}`}
                            title={statusTitle}
                            data-status-badge={stage.statusLabel}
                            role="img"
                            aria-label={statusAriaLabel}
                          />
                        ) : (
                          <span
                            className={`pill ${stage.tone} ${statusClass} ${isIconOnlyStatus ? styles.iconStatusPill : ""}`}
                            title={statusTitle}
                            data-status-badge={stage.statusLabel}
                            role={isIconOnlyStatus ? "img" : undefined}
                            aria-label={isIconOnlyStatus ? statusAriaLabel : undefined}
                          >
                            {isIconOnlyStatus ? (
                              <span className={styles.statusPillIcon} aria-hidden="true" />
                            ) : (
                              <span className={styles.statusPillLabel}>{stage.statusBadgeLabel}</span>
                            )}
                          </span>
                        )}
                      </div>
                      <div className={styles.eodStageDetails}>
                        {stage.details.map((detail) => (
                          <span
                            key={detail.key}
                            className={styles.eodStageDetailLine}
                            data-detail-tone={detail.tone ?? "text"}
                            data-detail-layout={detail.layout ?? "inline"}
                          >
                            {detail.label ? <span>{detail.label}</span> : null}
                            <span className={styles.eodStageDetailValue}>{detail.value}</span>
                          </span>
                        ))}
                        {stage.id === "fundamentals" && fundamentalsFailureDetails ? (
                          <button
                            type="button"
                            className={styles.detailButton}
                            aria-label="View fundamentals run details"
                            aria-haspopup="dialog"
                            aria-expanded={fundamentalsDialogOpen}
                            aria-controls="fundamentals-failure-dialog"
                            onClick={() => setOpenFundamentalsFailureKey(fundamentalsFailureDetails.key)}
                          >
                            view detail
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className={`${styles.integrityStat} ${styles.filteringCard}`}>
              <div className={styles.sectionHeaderRow}>
                <div>
                  <p className={styles.sectionEyebrow}>Piotroski Filter</p>
                  <h2 className={styles.sectionTitle}>Filtering</h2>
                  <p className={styles.cardContext}>Market date {piotroskiMarketDate ?? UNKNOWN_LABEL}</p>
                </div>
                <Link
                  href={buildPiotroskiListHref(piotroskiMarketDate)}
                  className={styles.sectionLink}
                  aria-label="Open the full Piotroski filter pass list"
                >
                  More
                </Link>
              </div>

              <div className={styles.statusMetricGrid}>
                <div className={styles.statusMetric}>
                  <span>Status</span>
                  <strong>
                    <span className={`pill ${filteringStatusTone}`}>{filteringStatusLabel}</span>
                  </strong>
                </div>
                <div className={styles.statusMetric}>
                  <span>Checked</span>
                  <strong>{formatEodSymbolCount(filteringCheckedCount)}</strong>
                </div>
                <div className={styles.statusMetric}>
                  <span>Pass</span>
                  <strong>{formatEodSymbolCount(filteringPassCount)}</strong>
                </div>
              </div>

              {filteringNote ? <p className={styles.cardContext}>{filteringNote}</p> : null}
            </article>

            <article className={`${styles.integrityStat} ${styles.agentFeedbackCard}`}>
              <div className={styles.sectionHeaderRow}>
                <div>
                  <h2 className={styles.sectionTitle}>Agent Feedback</h2>
                  <p className={styles.cardContext}>기준일 {agentProgressDate}</p>
                </div>
                {showCompletedAgentFeedbackIcon ? (
                  <span
                    className={`${styles.statusIconBadge} ${styles.syncedStatusIcon}`}
                    title={AGENT_PROGRESS_STATUS_LABELS.completed}
                    role="img"
                    aria-label={AGENT_PROGRESS_STATUS_LABELS.completed}
                  />
                ) : (
                  <span className={`pill ${agentFeedbackStatusTone}`}>{agentProgressStatusLabel}</span>
                )}
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
                      <div className={styles.agentRoleContent}>
                        <span className={styles.agentRoleTitleRow}>
                          <span className={styles.agentRoleName}>{role.label}</span>
                          {isSummarizerRole(role.role) ? (
                            <span
                              className={styles.agentRoleProgressIcon}
                              data-role-progress-icon={role.status}
                              aria-hidden="true"
                            />
                          ) : null}
                        </span>
                        {isSummarizerRole(role.role) ? (
                          <div
                            className={styles.agentRoleProgressTrack}
                            data-role-progress-track={role.status}
                            data-role-progress-value={role.progressPercent}
                            role="progressbar"
                            aria-label={`${role.label} progress`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={role.progressPercent}
                            aria-valuetext={role.progressLabel}
                          >
                            <i style={{ width: `${role.progressPercent}%` }} />
                          </div>
                        ) : null}
                        <span className={styles.agentRoleStatusText}>{AGENT_ROLE_STATUS_LABELS[role.status]}</span>
                        {role.metrics.length > 0 ? (
                          <dl className={styles.agentRoleMetrics}>
                            {role.metrics.map((metric) => (
                              <div key={metric.key} className={styles.agentRoleMetric}>
                                <dt>{metric.label}</dt>
                                <dd>{metric.value}</dd>
                              </div>
                            ))}
                          </dl>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={styles.emptyState}>Agent feedback role progress is unavailable for the selected market date.</div>
              )}
              {isAgentFeedbackRunning ? (
                <div className={styles.agentFeedbackActions}>
                  <button
                    type="button"
                    className={styles.agentFeedbackStopButton}
                    aria-label="중단"
                    aria-haspopup="dialog"
                    aria-expanded={agentFeedbackStopDialogOpen}
                    aria-controls={AGENT_FEEDBACK_STOP_DIALOG_ID}
                    onClick={openAgentFeedbackStopDialog}
                  >
                    중단
                  </button>
                </div>
              ) : null}
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
            <div className={styles.dialogBackdrop} onMouseDown={closeAgentFeedbackStopDialog}>
              <section
                id={AGENT_FEEDBACK_STOP_DIALOG_ID}
                className={`${styles.failureDialog} ${styles.confirmationDialog}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="agent-feedback-stop-title"
                aria-describedby={agentFeedbackStopError ? AGENT_FEEDBACK_STOP_ERROR_ID : undefined}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className={styles.dialogHeader}>
                  <div>
                    <p className={styles.sectionEyebrow}>Agent Feedback</p>
                    <h2 id="agent-feedback-stop-title" className={styles.dialogTitle}>
                      중단하시겠습니까?
                    </h2>
                  </div>
                </div>

                {agentFeedbackStopError ? (
                  <p
                    id={AGENT_FEEDBACK_STOP_ERROR_ID}
                    className={`${styles.confirmationMessage} ${styles.confirmationError}`}
                    role="alert"
                  >
                    {agentFeedbackStopError}
                  </p>
                ) : null}

                <div className={styles.dialogActions}>
                  <button
                    type="button"
                    className={`${styles.dialogActionButton} ${styles.dialogActionSecondary}`}
                    onClick={closeAgentFeedbackStopDialog}
                    autoFocus
                    disabled={agentFeedbackStopPending}
                  >
                    아니요
                  </button>
                  <button
                    type="button"
                    className={`${styles.dialogActionButton} ${styles.dialogActionDanger}`}
                    onClick={() => void handleAgentFeedbackStopConfirm()}
                    disabled={agentFeedbackStopPending}
                  >
                    {agentFeedbackStopPending ? "중단 중..." : "예"}
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
