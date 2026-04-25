import { type DashboardLiveCopy } from "@/i18n/dashboard-live-copy";
import {
  getLatestActionMarketDate,
  getLatestEodStatus,
  getLatestPriceTradeDate,
  getLatestTechnicalMarketDate,
} from "@/lib/eod-freshness-latest";
import { formatDisplayTimestamp } from "@/lib/format";
import {
  getEodSymbolsFailed,
  getEodSymbolsSucceeded,
  getEodSymbolsTotal,
  getFundamentalsRunDate,
  getFundamentalsStageDisplayCounts,
  getLatestAvailableFundamentalsCoverage,
  getLatestEodSymbolsFailed,
  getLatestEodSymbolsSucceeded,
  getLatestEodSymbolsTotal,
  getLatestFundamentalsRun,
  isRunningPipelineStage,
} from "@/lib/dashboard-eod-stage-data";
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

import type {
  AgentRoleCard,
  AgentRoleMetric,
  AgentRoleProgressSnapshot,
  AgentRoleResultSnapshot,
  AgentRoleStatus,
  CoreMarketStatus,
  CoreTrackedQuote,
  CoreTrackedQuotesResponse,
  DetailItem,
  EodStageCard,
  EodStageDetail,
  EodStageId,
  FundamentalsFailureDetails,
  SymbolMetadataItem,
  SymbolSearchResponse,
} from "./live-dashboard-types";

export const UNKNOWN_LABEL = "[확인 필요]";
const EOD_PIPELINE_STATUS_RUNNING_POLL_MS = 1_000;
const EOD_PIPELINE_STATUS_IDLE_POLL_MS = 30_000;
const AGENT_FEEDBACK_PROGRESS_RUNNING_POLL_MS = 1_000;
const AGENT_FEEDBACK_PROGRESS_IDLE_POLL_MS = 30_000;
const FUNDAMENTALS_UPDATED_SYMBOL_SAMPLE_LIMIT = 4;
const DEFAULT_AGENT_ROLE_ORDER = [
  "eod-summarizer",
  "technical-summarizer",
  "fundamental-summarizer",
] as const;

function hasNumber(value: number | null | undefined): value is number {
  return typeof value === "number";
}

export function getAgentProgressStatusLabels(copy: DashboardLiveCopy) {
  return {
    pending: copy.agentFeedback.statuses.pending,
    running: copy.agentFeedback.statuses.running,
    stalled: copy.agentFeedback.statuses.stalled,
    completed: copy.agentFeedback.statuses.completed,
  } satisfies Record<AgentFeedbackRunStatus, string>;
}

export function getAgentRoleStatusLabels(copy: DashboardLiveCopy) {
  return {
    completed: copy.agentFeedback.roleStatuses.completed,
    running: copy.agentFeedback.roleStatuses.running,
    pending: copy.agentFeedback.roleStatuses.pending,
    attention: copy.agentFeedback.roleStatuses.attention,
  } satisfies Record<AgentRoleStatus, string>;
}

export function getStageStatusLabel(status: EodStageCard["statusLabel"], copy: DashboardLiveCopy) {
  switch (status) {
    case "synced":
      return copy.stage.synced;
    case "running":
      return copy.stage.running;
    case "break day":
      return copy.stage.breakDay;
    case "not synced":
      return copy.stage.notSynced;
    default:
      return status;
  }
}

export function formatSignedPercent(value: number | null | undefined, fallback = "Unavailable"): string {
  if (!hasNumber(value)) return fallback;
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function formatSignedNumber(value: number | null | undefined, fallback = "Unavailable", numberLocale = "en-US"): string {
  if (!hasNumber(value)) return fallback;
  return `${value >= 0 ? "+" : ""}${value.toLocaleString(numberLocale)}`;
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

export function getQuoteCompanyName(item: CoreTrackedQuote | undefined): string | null {
  if (!item) return null;
  return getUsableCompanyName(item.symbol, item.company_name, item.name_ko, item.name);
}

function getMetadataCompanyName(
  item: CoreTrackedQuote,
  metadata: SymbolMetadataItem | null | undefined,
): string | null {
  return getUsableCompanyName(item.symbol, metadata?.name_ko, metadata?.name, metadata?.company_name);
}

export function getCompanyName(item: CoreTrackedQuote | undefined, metadata?: SymbolMetadataItem | null): string {
  if (!item) return "N/A";
  return getQuoteCompanyName(item) ?? getMetadataCompanyName(item, metadata) ?? UNKNOWN_LABEL;
}

export function pickSymbolMetadata(symbol: string, response: SymbolSearchResponse): SymbolMetadataItem | null {
  const normalizedSymbol = symbol.trim().toUpperCase();
  return response.items.find((item) => item.symbol.trim().toUpperCase() === normalizedSymbol) ?? null;
}

export function getDashboardLoadErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to refresh dashboard data.";
}

export function shouldTreatAgentFeedbackStopDisconnectAsAccepted(error: unknown) {
  const normalizedMessage = getDashboardLoadErrorMessage(error).trim().toLowerCase();
  return normalizedMessage === "fetch failed" || normalizedMessage === "failed to fetch";
}

export function markAgentFeedbackProgressStopped(
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

export function isOfflineTrackedPlaceholder(tracked: CoreTrackedQuotesResponse) {
  return (
    tracked.market_state === "offline-placeholder" ||
    tracked.items.some((item) => item.source === "mock" || item.fallback_reason === "offline_placeholder")
  );
}

export function describeQuoteSource(item: CoreTrackedQuote | undefined, copy: DashboardLiveCopy): string {
  if (!item) return "N/A";
  if (!item.available) {
    return item.unavailable_reason
      ? `${copy.tracked.quoteUnavailable} · ${item.unavailable_reason}`
      : copy.tracked.quoteUnavailable;
  }
  if (!item.fallback) {
    return item.is_live ? copy.tracked.liveKisQuote : item.source;
  }
  if (item.source === "daily_price_bar") {
    return item.trade_date ? `${copy.tracked.dbEodFallback} · ${item.trade_date}` : copy.tracked.dbEodFallback;
  }
  if (item.source === "db_cache") {
    return copy.tracked.sameDayDbQuoteCache;
  }
  if (item.source === "cache") {
    return copy.tracked.sameDayMemoryCache;
  }
  return `${item.source} ${copy.tracked.fallbackSuffix}`;
}

export function getPriceFreshnessLabel(item: CoreTrackedQuote, copy: DashboardLiveCopy) {
  if (!item.available) return item.trade_date ?? copy.tracked.unavailable;
  if (item.is_live) return copy.tracked.live;
  if (item.trade_date) return item.trade_date;
  return formatDisplayTimestamp(item.as_of ?? item.cached_at, copy.tracked.pending);
}

export function getTechnicalFreshnessLabel(freshness: EodFreshnessResponseDto | null) {
  return getFirstTextValue(freshness?.technical?.latest_date, getLatestTechnicalMarketDate(freshness)) ?? UNKNOWN_LABEL;
}

export function getFundamentalsFreshnessLayer(
  freshness: EodFreshnessResponseDto | null,
): EodFreshnessLayerStatusDto | null {
  return freshness?.fundamentals ?? freshness?.fundamental ?? null;
}

export function getFirstTextValue(...values: Array<string | null | undefined>) {
  for (const value of values) {
    if (hasTextValue(value)) return value.trim();
  }

  return null;
}

function humanizeToken(value: string | null | undefined, fallback = UNKNOWN_LABEL) {
  if (!hasTextValue(value)) return fallback;
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function normalizeFundamentalsStatusToken(value: string | null | undefined) {
  if (!hasTextValue(value)) return null;
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function isFundamentalsFailureStatus(value: string | null | undefined) {
  const normalizedStatus = normalizeFundamentalsStatusToken(value);
  return (
    normalizedStatus !== null &&
    ["failed", "partial", "needs review", "completed with errors", "error"].includes(normalizedStatus)
  );
}

export function getFundamentalsStatusLabel(
  freshness: EodFreshnessResponseDto | null,
  fundamentalsStatus: DartFundamentalsDailyInspectResponseDto | null,
  latestAvailableCoverage: ReturnType<typeof getLatestAvailableFundamentalsCoverage>,
  pipelineStage: EodPipelineStageDto | null,
): string {
  if (normalizePipelineStageStatus(pipelineStage) === "running") return "running";

  const runStatus = normalizeFundamentalsStatusToken(getLatestFundamentalsRun(fundamentalsStatus)?.status);
  if (runStatus === "running" || isFundamentalsFailureStatus(runStatus)) return runStatus ?? UNKNOWN_LABEL;

  const latestCoverageStatus = normalizeFundamentalsStatusToken(latestAvailableCoverage?.status);
  if (hasTextValue(latestCoverageStatus)) return latestCoverageStatus;
  if (hasTextValue(runStatus)) return runStatus;

  const freshnessLayer = getFundamentalsFreshnessLayer(freshness);
  if (freshnessLayer?.success === true) return "completed";
  if (freshnessLayer?.success === false) return "needs review";
  if (hasTextValue(latestAvailableCoverage?.tradeDate)) return "completed";

  return UNKNOWN_LABEL;
}

function getFundamentalsStatusDisplayLabel(statusLabel: string, copy: DashboardLiveCopy) {
  if (!hasTextValue(statusLabel) || statusLabel === UNKNOWN_LABEL) return UNKNOWN_LABEL;

  const normalizedStatus = normalizeFundamentalsStatusToken(statusLabel);
  if (normalizedStatus === "running") return copy.stage.running;
  if (normalizedStatus === "completed") return copy.agentFeedback.roleStatuses.completed;
  if (normalizedStatus === "needs review") return copy.piotroski.needsReview;

  return humanizeToken(statusLabel);
}

function getHumanCount(value: number | null | undefined, numberLocale: string) {
  if (!hasNumber(value)) return UNKNOWN_LABEL;
  return value.toLocaleString(numberLocale);
}

function getFailureCountPhrase(count: number, singularLabel: string, pluralLabel: string, numberLocale: string) {
  const label = count === 1 ? singularLabel : pluralLabel;
  return `${count.toLocaleString(numberLocale)} ${label}`;
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
  const symbolsFailed = run?.symbols_failed;
  const eventsFailed = run?.events_failed;
  return (
    isFundamentalsFailureStatus(statusLabel) ||
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
  copy: DashboardLiveCopy,
  numberLocale: string,
) {
  if (hasTextValue(run?.error_message)) return run.error_message.trim();

  const failedCounts: string[] = [];
  const symbolsFailed = run?.symbols_failed;
  const eventsFailed = run?.events_failed;
  if (hasNumber(symbolsFailed) && symbolsFailed > 0) {
    failedCounts.push(
      getFailureCountPhrase(
        symbolsFailed,
        copy.fundamentalsFailure.failedSymbol.one,
        copy.fundamentalsFailure.failedSymbol.many,
        numberLocale,
      ),
    );
  }
  if (hasNumber(eventsFailed) && eventsFailed > 0) {
    failedCounts.push(
      getFailureCountPhrase(
        eventsFailed,
        copy.fundamentalsFailure.failedEvent.one,
        copy.fundamentalsFailure.failedEvent.many,
        numberLocale,
      ),
    );
  }

  if (failedCounts.length > 0) {
    return `${copy.fundamentalsFailure.coreReported} ${failedCounts.join(" and ")}.`;
  }

  if (getFundamentalsFreshnessLayer(freshness)?.success === false) {
    return copy.fundamentalsFailure.freshnessFailed;
  }

  return `${copy.fundamentalsFailure.markedAs} ${getFundamentalsStatusDisplayLabel(statusLabel, copy)}.`;
}

export function getFundamentalsFailureDetails(
  freshness: EodFreshnessResponseDto | null,
  fundamentalsStatus: DartFundamentalsDailyInspectResponseDto | null,
  latestFundamentalsDate: string | null,
  statusLabel: string,
  copy: DashboardLiveCopy,
  numberLocale: string,
): FundamentalsFailureDetails | null {
  const run = getLatestFundamentalsRun(fundamentalsStatus);

  if (!hasFundamentalsFailureSignal(freshness, run, statusLabel)) return null;

  const runDate = getFundamentalsRunDate(run) ?? latestFundamentalsDate ?? UNKNOWN_LABEL;
  const displayedStatusLabel = getFundamentalsStatusDisplayLabel(statusLabel, copy);

  return {
    key: `${run?.id ?? "freshness"}:${runDate}:${statusLabel}`,
    title: `${copy.fundamentalsFailure.titlePrefix} ${displayedStatusLabel.toLowerCase()}`,
    reason: getFundamentalsFailureReason(freshness, run, statusLabel, copy, numberLocale),
    details: [
      { label: copy.fundamentalsFailure.fields.runDate, value: runDate },
      { label: copy.fundamentalsFailure.fields.status, value: displayedStatusLabel },
      { label: copy.fundamentalsFailure.fields.fsDivision, value: run?.fs_div ?? UNKNOWN_LABEL },
      { label: copy.fundamentalsFailure.fields.trigger, value: humanizeToken(run?.trigger) },
      { label: copy.fundamentalsFailure.fields.symbolsTotal, value: getHumanCount(run?.symbols_total, numberLocale) },
      { label: copy.fundamentalsFailure.fields.symbolsChecked, value: getHumanCount(run?.symbols_checked, numberLocale) },
      { label: copy.fundamentalsFailure.fields.symbolsMissing, value: getHumanCount(run?.symbols_missing, numberLocale) },
      { label: copy.fundamentalsFailure.fields.symbolsStale, value: getHumanCount(run?.symbols_stale, numberLocale) },
      { label: copy.fundamentalsFailure.fields.symbolsFresh, value: getHumanCount(run?.symbols_fresh, numberLocale) },
      { label: copy.fundamentalsFailure.fields.symbolsRefreshed, value: getHumanCount(run?.symbols_refreshed, numberLocale) },
      { label: copy.fundamentalsFailure.fields.symbolsFailed, value: getHumanCount(run?.symbols_failed, numberLocale) },
      { label: copy.fundamentalsFailure.fields.eventsDetected, value: getHumanCount(run?.events_detected, numberLocale) },
      { label: copy.fundamentalsFailure.fields.eventsCaptured, value: getHumanCount(run?.events_captured, numberLocale) },
      { label: copy.fundamentalsFailure.fields.eventsFailed, value: getHumanCount(run?.events_failed, numberLocale) },
      { label: copy.fundamentalsFailure.fields.started, value: formatDisplayTimestamp(run?.started_at, UNKNOWN_LABEL) },
      { label: copy.fundamentalsFailure.fields.completed, value: formatDisplayTimestamp(run?.completed_at, UNKNOWN_LABEL) },
    ],
    metadata: getFailureMetadata(run),
  };
}

function hasTextValue(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function formatPipelineDetailText(value: string | null | undefined) {
  if (!hasTextValue(value)) return null;

  const trimmed = value.trim();
  return /[_-]/.test(trimmed) && !trimmed.includes(" ") ? humanizeToken(trimmed, trimmed) : trimmed;
}

function hasEodReadinessSignal(freshness: EodFreshnessResponseDto | null) {
  return (
    hasTextValue(getLatestPriceTradeDate(freshness)) ||
    hasNumber(getEodSymbolsSucceeded(freshness)) ||
    hasNumber(getEodSymbolsTotal(freshness))
  );
}

export function formatEodSymbolCount(value: number | null | undefined, numberLocale: string) {
  if (!hasNumber(value)) return UNKNOWN_LABEL;
  return value.toLocaleString(numberLocale);
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

export function getPipelineStage(
  pipelineStatus: EodPipelineStatusResponseDto | null,
  key: EodPipelineStageKey,
) {
  return pipelineStatus?.stages?.[key] ?? null;
}

export function mergeRunningPipelineStage(
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

export function getEodPipelineStatusPollDelayMs(pipelineStatus: EodPipelineStatusResponseDto | null) {
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

export function isBreakDayMarket(market: CoreMarketStatus) {
  if (market.is_trading_day === false) return true;
  if (market.is_trading_day === true) return false;
  if (hasBreakDayText(market.state) || hasBreakDayText(market.reason)) return true;

  const state = normalizeMarketState(market.state);
  const canUseWeekendFallback = state === "CLOSED" || state === "WEEKEND";
  return canUseWeekendFallback && isWeekendIsoDate(market.server_time ?? market.as_of);
}

function getTodayPriceFreshnessStage(freshness: EodFreshnessResponseDto | null): EodFreshnessStageDto | null {
  if (freshness?.today?.price) return freshness.today.price;

  const status = freshness?.today?.eod_status ?? getLatestEodStatus(freshness);
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
  const status = getLatestEodStatus(freshness);
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

export function getPriceFreshnessStage(
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
    getFirstTextValue(freshness?.technical?.latest_date, getLatestTechnicalMarketDate(freshness)) !== null;
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

export function getTechnicalFreshnessStage(
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

  const latestActionDate = getFirstTextValue(freshness?.action?.latest_date, getLatestActionMarketDate(freshness));
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

export function getActionFreshnessStage(
  freshness: EodFreshnessResponseDto | null,
  useTodayStage: boolean,
): EodFreshnessStageDto | null {
  if (useTodayStage && freshness?.today?.action_summary) return freshness.today.action_summary;

  return getLatestActionFreshnessStage(freshness) ?? freshness?.today?.action_summary ?? null;
}

export function getFundamentalsFreshnessStage(
  freshness: EodFreshnessResponseDto | null,
  fundamentalsStatus: DartFundamentalsDailyInspectResponseDto | null,
  fundamentalsStatusLabel: string,
  latestFundamentalsDate: string | null,
  useTodayStage: boolean,
): EodFreshnessStageDto | null {
  const { symbolsTotal, symbolsChecked, symbolsFailed } = getFundamentalsStageDisplayCounts(
    freshness,
    fundamentalsStatus,
    freshness?.today?.fundamentals,
    useTodayStage,
  );
  const normalizedStatus = normalizeFundamentalsStatusToken(fundamentalsStatusLabel);
  if (normalizedStatus === "running") return buildStage("running", symbolsTotal, symbolsChecked, symbolsFailed);
  if (
    (normalizedStatus !== null && ["completed", "available", "ready", "success"].includes(normalizedStatus)) ||
    hasTextValue(latestFundamentalsDate)
  ) {
    return buildStage("ready", symbolsTotal, symbolsChecked, symbolsFailed);
  }
  if (isFundamentalsFailureStatus(normalizedStatus)) {
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

export function getFundamentalsStageStatusLabel(
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

  if (status === "ready" && hasStaleDate) {
    return canShowBreakDay ? "break day" : "not synced";
  }

  return getEodStageStatusLabel(stage, todayTradeDate, latestDate, canShowBreakDay);
}

function getEodStageTone(statusLabel: EodStageCard["statusLabel"]): EodStageCard["tone"] {
  if (statusLabel === "synced") return "positive";
  if (statusLabel === "running") return "info";
  if (statusLabel === "break day") return "neutral";
  return "warning";
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

export function isIconOnlyEodStageStatus(statusLabel: EodStageCard["statusLabel"]) {
  return statusLabel === "synced" || statusLabel === "not synced";
}

export function buildEodStageCard(
  id: EodStageId,
  label: string,
  stage: EodFreshnessStageDto | null,
  todayTradeDate: string | null,
  latestDate: string | null,
  canShowBreakDay: boolean,
  pipelineStage: EodPipelineStageDto | null | undefined,
  copy: DashboardLiveCopy,
  numberLocale: string,
  countDetail: Pick<EodStageDetail, "label" | "value"> = {
    label: "",
    value: `${formatEodSymbolCount(stage?.symbols_succeeded, numberLocale)} / ${formatEodSymbolCount(stage?.symbols_total, numberLocale)}`,
  },
  statusLabelResolver: (
    stage: EodFreshnessStageDto | null,
    todayTradeDate: string | null,
    latestDate: string | null,
    canShowBreakDay: boolean,
  ) => EodStageCard["statusLabel"] = getEodStageStatusLabel,
): EodStageCard {
  const statusLabel = statusLabelResolver(stage, todayTradeDate, latestDate, canShowBreakDay);
  const { label: statusBadgeLabel, title: statusBadgeTitle } = getEodStageStatusBadge(statusLabel, pipelineStage);
  const details: EodStageDetail[] = [
    {
      key: "count",
      tone: "count",
      ...countDetail,
    },
  ];

  if (hasTextValue(todayTradeDate) && hasTextValue(latestDate) && todayTradeDate !== latestDate) {
    details.push({ key: "latest-date", label: copy.operational.latestDate, value: latestDate, tone: "text" });
  }
  if (hasNumber(stage?.symbols_failed) && stage.symbols_failed > 0) {
    details.push({
      key: "failed",
      label: copy.operational.failed,
      value: formatEodSymbolCount(stage.symbols_failed, numberLocale),
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

export function getFundamentalsCheckedCount(
  freshness: EodFreshnessResponseDto | null,
  fundamentalsStatus: DartFundamentalsDailyInspectResponseDto | null,
  stage: EodFreshnessStageDto | null,
) {
  const latestCoverage = getLatestAvailableFundamentalsCoverage(freshness, fundamentalsStatus);
  const latestRun = getLatestFundamentalsRun(fundamentalsStatus);
  if (normalizeStageStatus(stage) === "running") {
    return stage?.symbols_succeeded ?? latestRun?.symbols_checked ?? stage?.symbols_total ?? null;
  }

  return latestCoverage?.symbolsChecked ?? latestRun?.symbols_checked ?? stage?.symbols_succeeded ?? stage?.symbols_total ?? null;
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

export function getFundamentalsUpdatedSymbolsDetail(
  fundamentalsStatus: DartFundamentalsDailyInspectResponseDto | null,
  todayTradeDate: string | null,
  copy: DashboardLiveCopy,
  numberLocale: string,
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
  const countLabel = formatEodSymbolCount(refreshedCount ?? symbolSample.length, numberLocale);
  const symbolLabel =
    visibleSymbols.length > 0
      ? ` (${visibleSymbols.join(", ")}${remainingSymbols > 0 ? ` +${formatEodSymbolCount(remainingSymbols, numberLocale)}` : ""})`
      : "";

  return {
    key: "updated-symbols",
    label: copy.operational.updatedToday,
    value: `${countLabel}${symbolLabel}`,
    tone: "text",
    layout: "stacked",
  };
}

function formatAgentProgressCountLabel(value: number | null | undefined, numberLocale: string) {
  if (!hasNumber(value)) return UNKNOWN_LABEL;
  return value.toLocaleString(numberLocale);
}

function clampAgentProgressPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function formatAgentProgressPercentValueLabel(value: number | null | undefined, numberLocale: string) {
  const percent = value;
  if (!hasNumber(percent)) return UNKNOWN_LABEL;
  return `${clampAgentProgressPercent(percent).toLocaleString(numberLocale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })}%`;
}

function formatAgentProgressPercentLabel(progress: AgentFeedbackProgressResponseDto | null, numberLocale: string) {
  return formatAgentProgressPercentValueLabel(progress?.summary?.progress_percent, numberLocale);
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
  return normalized === "pending" || normalized === "running" || normalized === "stalled" || normalized === "completed"
    ? (normalized as AgentFeedbackRunStatus)
    : null;
}

export function getResolvedAgentProgressRunStatus(progress: AgentFeedbackProgressResponseDto | null) {
  if (!progress) return null;

  const summary = progress.summary;
  const runStatus = normalizeAgentProgressRunStatus(summary.run_status);
  if (runStatus) return runStatus;

  if (summary.is_live) return "running";
  if (summary.failed_items > 0) return "stalled";
  if (summary.progress_percent >= 100) return "completed";
  return "pending";
}

export function isAgentFeedbackProgressRunning(progress: AgentFeedbackProgressResponseDto | null) {
  return getResolvedAgentProgressRunStatus(progress) === "running";
}

export function getAgentFeedbackProgressPollDelayMs(progress: AgentFeedbackProgressResponseDto | null) {
  return isAgentFeedbackProgressRunning(progress)
    ? AGENT_FEEDBACK_PROGRESS_RUNNING_POLL_MS
    : AGENT_FEEDBACK_PROGRESS_IDLE_POLL_MS;
}

export function getAgentProgressStatusLabel(
  progress: AgentFeedbackProgressResponseDto | null,
  error: string | null,
  copy: DashboardLiveCopy,
) {
  const labels = getAgentProgressStatusLabels(copy);
  if (!progress) return error ? labels.stalled : UNKNOWN_LABEL;
  const runStatus = getResolvedAgentProgressRunStatus(progress);
  return runStatus ? labels[runStatus] : labels.pending;
}

function normalizeAgentRole(role: string | null | undefined) {
  return role?.trim().toLowerCase() ?? null;
}

function getAgentRoleLabel(role: string, copy: DashboardLiveCopy) {
  const normalizedRole = normalizeAgentRole(role);
  if (normalizedRole === "eod-summarizer") {
    return copy.agentFeedback.roles.eod;
  }
  if (normalizedRole === "technical-summarizer") {
    return copy.agentFeedback.roles.technical;
  }
  if (normalizedRole === "fundamental-summarizer") {
    return copy.agentFeedback.roles.fundamental;
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

function buildAgentRoleMetrics(
  progress: AgentFeedbackProgressResponseDto | null,
  copy: DashboardLiveCopy,
  numberLocale: string,
): AgentRoleMetric[] {
  if (!isAgentFeedbackProgressRunning(progress)) return [];

  return [
    {
      key: "progress",
      label: copy.agentFeedback.metrics.progress,
      value: formatAgentProgressPercentLabel(progress, numberLocale),
    },
    {
      key: "total",
      label: copy.agentFeedback.metrics.total,
      value: formatAgentProgressCountLabel(progress?.summary?.total_symbols, numberLocale),
    },
    {
      key: "failed",
      label: copy.agentFeedback.metrics.failed,
      value: formatAgentProgressCountLabel(progress?.summary?.failed_items, numberLocale),
    },
    {
      key: "completed",
      label: copy.agentFeedback.metrics.completed,
      value: formatAgentProgressCountLabel(
        getResolvedAgentProgressRunStatus(progress) === "running"
          ? progress?.summary?.processed_symbols
          : progress?.summary?.completed_symbols,
        numberLocale,
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

function buildAgentRoleResultMetrics(
  snapshot: AgentRoleResultSnapshot,
  copy: DashboardLiveCopy,
  numberLocale: string,
): AgentRoleMetric[] {
  return [
    {
      key: "completed",
      label: copy.agentFeedback.metrics.completed,
      value: formatAgentProgressCountLabel(snapshot.completedCount, numberLocale),
    },
    {
      key: "errors",
      label: copy.agentFeedback.metrics.errors,
      value: formatAgentProgressCountLabel(snapshot.errorCount, numberLocale),
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

export function isSummarizerRole(role: string) {
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
  copy: DashboardLiveCopy,
  numberLocale: string,
  progressPercentOverride: number | null = null,
): AgentRoleCard {
  const progressPercent =
    progressPercentOverride ?? getAgentRoleProgressPercent(progress, status, completedCount, snapshot);

  return {
    role,
    label: getAgentRoleLabel(role, copy),
    status,
    progressPercent,
    progressLabel: formatAgentProgressPercentValueLabel(progressPercent, numberLocale),
    metrics,
  };
}

export function buildAgentRoleCards(
  progress: AgentFeedbackProgressResponseDto | null,
  copy: DashboardLiveCopy,
  numberLocale: string,
): AgentRoleCard[] {
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
        ? buildAgentRoleResultMetrics(resultSnapshot, copy, numberLocale)
        : [
            {
              key: "completed",
              label: copy.agentFeedback.metrics.complete,
              value: formatAgentProgressCountLabel(completedCount, numberLocale),
            },
          ];

      return buildAgentRoleCard(
        progress,
        role,
        status,
        completedCount,
        snapshot,
        metrics,
        copy,
        numberLocale,
        resultSnapshot ? getAgentRoleResultProgressPercent(resultSnapshot) : null,
      );
    });
  }

  const metrics = buildAgentRoleMetrics(progress, copy, numberLocale);
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
      copy,
      numberLocale,
    );
  });
}

export function hasCompletedDefaultAgentRoles(roleCards: AgentRoleCard[]) {
  const completedRoles = new Set(
    roleCards
      .filter((role) => role.status === "completed")
      .map((role) => normalizeAgentRole(role.role) ?? role.role),
  );

  return DEFAULT_AGENT_ROLE_ORDER.every((role) => completedRoles.has(role));
}

export function buildTrackedDetailHref(item: CoreTrackedQuote, metadata?: SymbolMetadataItem | null) {
  const params = new URLSearchParams();
  const companyName = getQuoteCompanyName(item) ?? getMetadataCompanyName(item, metadata);
  if (companyName) {
    params.set("name", companyName);
  }

  const query = params.toString();
  return `/dashboard/symbol/${encodeURIComponent(item.symbol)}${query ? `?${query}` : ""}`;
}
