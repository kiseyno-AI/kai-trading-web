"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { ComponentTag } from "@/components/dev/component-tag";
import { DevModeToggle } from "@/components/dev/dev-mode-toggle";
import { MobileAppChrome } from "@/components/mobile/mobile-app-chrome";
import { getAgentFeedbackProgressMarketDate } from "@/lib/agent-feedback-progress";
import { formatDisplayTimestamp, formatPrice, formatTurnover } from "@/lib/format";
import { resolveTradingApiClientPath } from "@/lib/trading-api-client-path";
import { getCachedTradingApiJson, seedTradingApiJsonCache } from "@/lib/trading-api-cache";
import type {
  AgentFeedbackProgressResponseDto,
  DartFundamentalsDailyInspectResponseDto,
  DartFundamentalsDailyRunDto,
  EodFreshnessLayerStatusDto,
  EodFreshnessResponseDto,
  EodFreshnessStageDto,
} from "@/types/trading-api";

import styles from "./live-dashboard-client.module.css";

const UNKNOWN_LABEL = "[확인 필요]";
const TRACKED_QUOTES_RETRY_DELAYS_MS = [5_000, 15_000, 30_000] as const;

export type CoreMarketStatus = {
  state: string;
  is_open: boolean;
  server_time: string;
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
  statusLabel: "synced" | "running" | "not synced";
  tone: "positive" | "info" | "warning";
  details: string[];
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
) {
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
): EodStageCard["statusLabel"] {
  const status = normalizeStageStatus(stage);
  if (status === "running") return "running";
  if (hasTextValue(todayTradeDate) && hasTextValue(latestDate) && todayTradeDate !== latestDate) {
    return "not synced";
  }
  if (status === "ready") return "synced";
  return "not synced";
}

function getEodStageTone(statusLabel: EodStageCard["statusLabel"]): EodStageCard["tone"] {
  if (statusLabel === "synced") return "positive";
  if (statusLabel === "running") return "info";
  return "warning";
}

function buildEodStageCard(
  id: EodStageId,
  label: string,
  stage: EodFreshnessStageDto | null,
  todayTradeDate: string | null,
  latestDate: string | null,
): EodStageCard {
  const statusLabel = getEodStageStatusLabel(stage, todayTradeDate, latestDate);
  const details = [
    `Succeeded ${formatEodSymbolCount(stage?.symbols_succeeded)} / ${formatEodSymbolCount(stage?.symbols_total)}`,
    `Failed ${formatEodSymbolCount(stage?.symbols_failed)}`,
  ];

  if (hasTextValue(todayTradeDate) && hasTextValue(latestDate) && todayTradeDate !== latestDate) {
    details.push(`Latest date ${latestDate}`);
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

function formatAgentProgressCountLabel(value: number | null | undefined) {
  if (!hasNumber(value)) return UNKNOWN_LABEL;
  return `${value.toLocaleString("ko-KR")}개`;
}

function formatAgentProgressPercentLabel(progress: AgentFeedbackProgressResponseDto | null) {
  const percent = progress?.summary?.progress_percent;
  if (!hasNumber(percent)) return UNKNOWN_LABEL;
  return `${Math.max(0, Math.min(100, Math.round(percent))).toLocaleString("ko-KR")}%`;
}

function getAgentProgressPercentValue(progress: AgentFeedbackProgressResponseDto | null) {
  const percent = progress?.summary?.progress_percent;
  if (!hasNumber(percent)) return 0;
  return Math.max(0, Math.min(100, percent));
}

function getAgentProgressStatusLabel(progress: AgentFeedbackProgressResponseDto | null, error: string | null) {
  if (!progress) return error ? "에이전트 확인 필요" : UNKNOWN_LABEL;

  const summary = progress.summary;
  if (summary.total_symbols <= 0) return "에이전트 분석 대기";
  if (summary.in_progress_symbols > 0 || summary.pending_symbols > 0 || summary.progress_percent < 100) {
    return "에이전트 분석 중...";
  }
  if (summary.failed_items > 0) return "에이전트 확인 필요";
  return "에이전트 분석 완료";
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
  initialAgentFeedbackProgress,
}: LiveDashboardClientProps) {
  const [market, setMarket] = useState<CoreMarketStatus>(initialMarket);
  const [tracked, setTracked] = useState<CoreTrackedQuotesResponse>(initialTracked);
  const [freshness, setFreshness] = useState<EodFreshnessResponseDto | null>(initialFreshness);
  const [fundamentalsStatus, setFundamentalsStatus] = useState<DartFundamentalsDailyInspectResponseDto | null>(
    initialFundamentalsStatus,
  );
  const [agentFeedbackProgress, setAgentFeedbackProgress] = useState<AgentFeedbackProgressResponseDto | null>(
    initialAgentFeedbackProgress,
  );
  const [agentFeedbackProgressError, setAgentFeedbackProgressError] = useState<string | null>(null);
  const [symbolMetaBySymbol, setSymbolMetaBySymbol] = useState<Record<string, SymbolMetadataItem | null>>({});
  const [openFundamentalsFailureKey, setOpenFundamentalsFailureKey] = useState<string | null>(null);
  const [marketError, setMarketError] = useState<string | null>(initialError);
  const [trackedError, setTrackedError] = useState<string | null>(initialError);

  useEffect(() => {
    seedTradingApiJsonCache("/api/trading/eod/freshness", initialFreshness);
    seedTradingApiJsonCache(
      "/api/trading/disclosures/dart/fundamentals/daily/inspect?runs_limit=1",
      initialFundamentalsStatus,
    );
  }, [initialFreshness, initialFundamentalsStatus]);

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

    const loadFundamentalsStatus = async () => {
      try {
        const data = await getJson<DartFundamentalsDailyInspectResponseDto>(
          "/api/trading/disclosures/dart/fundamentals/daily/inspect?runs_limit=1",
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
  }, []);

  const agentProgressMarketDate = getAgentFeedbackProgressMarketDate(freshness);

  useEffect(() => {
    if (!agentProgressMarketDate) return;

    let active = true;
    const progressPath = `/api/trading/agent-context/feedback/progress?market_date=${encodeURIComponent(
      agentProgressMarketDate,
    )}`;

    const loadAgentFeedbackProgress = async () => {
      try {
        const data = await getJson<AgentFeedbackProgressResponseDto>(progressPath);
        if (!active) return;
        setAgentFeedbackProgress(data);
        setAgentFeedbackProgressError(null);
      } catch (progressError) {
        console.error("Dashboard agent feedback progress load failed", progressError);
        if (!active) return;
        setAgentFeedbackProgressError(getDashboardLoadErrorMessage(progressError));
      }
    };

    loadAgentFeedbackProgress();
    const timer = window.setInterval(loadAgentFeedbackProgress, 30_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [agentProgressMarketDate]);

  const lead = tracked.items[0];
  const liveCount = tracked.items.filter((item) => item.is_live).length;
  const fallbackCount = tracked.items.filter((item) => item.fallback).length;
  const unavailableCount = tracked.items.filter((item) => !item.available).length;
  const latestFundamentalsDate = getFundamentalsFreshnessDate(freshness, fundamentalsStatus);
  const fundamentalsStatusLabel = getFundamentalsStatusLabel(freshness, fundamentalsStatus, latestFundamentalsDate);
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
  const eodStageCards = [
    buildEodStageCard(
      "price",
      "Price Fetch",
      getPriceFreshnessStage(freshness),
      todayTradeDate,
      freshness?.latest?.price_trade_date ?? lead?.trade_date ?? null,
    ),
    buildEodStageCard(
      "technical",
      "Technical Analysis",
      getTechnicalFreshnessStage(freshness),
      todayTradeDate,
      freshness?.technical?.latest_date ?? freshness?.latest?.technical_market_date ?? null,
    ),
    buildEodStageCard(
      "action",
      "Action Summary",
      getActionFreshnessStage(freshness),
      todayTradeDate,
      freshness?.latest?.action_market_date ?? null,
    ),
    buildEodStageCard(
      "fundamentals",
      "Fundamentals",
      getFundamentalsFreshnessStage(freshness, fundamentalsStatusLabel, latestFundamentalsDate),
      todayTradeDate,
      latestFundamentalsDate,
    ),
  ] as const;
  const moduleRows = eodStageCards.map((row) => ({
    id: row.id,
    label: row.label,
    status: row.statusLabel,
    meta: row.latestDate ?? UNKNOWN_LABEL,
    coverage: row.details.slice(0, 2).join(" · "),
    tone: row.tone,
  }));
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
  const agentProgressDate =
    displayedAgentFeedbackProgress?.request?.market_date ?? agentProgressMarketDate ?? UNKNOWN_LABEL;
  const marketBadgeLabel = market.is_open ? "Market Open" : "Market Closed";
  const coreUnavailable =
    market.state === "OFFLINE PLACEHOLDER" ||
    isOfflineTrackedPlaceholder(tracked) ||
    Boolean(marketError || trackedError);
  const error = trackedError ?? marketError;
  const fundamentalsDialogOpen =
    Boolean(fundamentalsFailureDetails) && openFundamentalsFailureKey === fundamentalsFailureDetails?.key;

  useEffect(() => {
    if (!fundamentalsDialogOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
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
  }, [fundamentalsDialogOpen]);

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
            api="/api/trading/eod/freshness + /api/trading/market/status + /api/trading/agent-context/feedback/progress"
          />

          <div className={styles.panelHeader}>
            <div>
              <p className={styles.sectionEyebrow}>Market Freshness Registry</p>
              <h1 className={styles.heroTitle}>Operational Integrity</h1>
              <p className={styles.marketContext}>
                Market state {market.state}
                <br />
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
                      data-status={stage.statusLabel}
                    >
                      <div className={styles.eodStageTop}>
                        <span>{stage.label}</span>
                        <span className={`pill ${stage.tone} ${statusClass}`}>{stage.statusLabel}</span>
                      </div>
                      <div className={styles.eodStageDetails}>
                        {stage.details.map((detail) => (
                          <span key={detail}>{detail}</span>
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
            </article>

            <article className={`${styles.integrityStat} ${styles.agentFeedbackCard}`}>
              <span>Agent Feedback</span>
              <strong>{agentProgressStatusLabel}</strong>
              <div className={styles.agentProgressTrack} aria-hidden="true">
                <i style={{ width: `${agentProgressPercentValue}%` }} />
              </div>
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
              </p>
            </article>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.supportPanel} ${styles.desktopAuditPanel}`}>
          <ComponentTag label="dashboard.audit-feed" api="/api/trading/eod/freshness + /api/trading/quotes/tracked" />
          <p className={styles.sectionEyebrow}>Real-Time Audit Feed</p>
          <h2 className={styles.sectionTitle}>Layer sync events</h2>
          <div className={styles.auditList}>
            {moduleRows.slice(0, 3).map((row) => (
              <article key={row.id} className={styles.auditItem}>
                <span>{row.meta}</span>
                <p className="clamp-3">
                  {row.label} status is {row.status}. {row.coverage}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.sectionHeaderRow} id="tracked-symbols">
          <div>
            <p className={styles.sectionEyebrow}>Tracked Symbols</p>
            <h2 className={styles.sectionTitle}>Today&apos;s ledger recommendations</h2>
          </div>
          <Link href="/search" className={styles.sectionLink}>
            Manage Feed
          </Link>
        </section>

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

        <section className={styles.supportGrid}>
          <section className={`${styles.panel} ${styles.supportPanel}`}>
            <ComponentTag label="dashboard.momentum-board" api="/api/trading/quotes/tracked" />
            <p className={styles.sectionEyebrow}>Global Sentiment Distribution</p>
            <h2 className={styles.sectionTitle}>Highest absolute movers</h2>
            <div className={styles.supportList}>
              {movers.length > 0 ? (
                movers.map((item) => (
                  <article key={item.symbol} className={styles.supportRow}>
                    <div>
                      <strong>{item.symbol}</strong>
                      <p className="clamp-3">{getCompanyName(item, symbolMetaBySymbol[item.symbol])}</p>
                    </div>
                    <span className={getQuoteToneClass(item.change_pct)}>{formatSignedPercent(item.change_pct)}</span>
                  </article>
                ))
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
    </MobileAppChrome>
  );
}
