"use client";

import Link from "next/link";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { type MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from "react";

import { ComponentTag } from "@/components/dev/component-tag";
import { DevModeToggle } from "@/components/dev/dev-mode-toggle";
import { MobileAppChrome } from "@/components/mobile/mobile-app-chrome";
import { FullPageLoadingScreen } from "@/components/ui/full-page-loading";
import { resolveTradingApiClientPath } from "@/lib/trading-api-client-path";
import { formatDisplayTimestamp, formatPrice, formatTurnover } from "@/lib/format";
import { getForwardableSymbolMetaSeedValue } from "@/lib/symbol-meta";
import {
  getCachedTradingApiJson,
  getTradingApiJsonResult,
  invalidateTradingApiCacheByPathPrefix,
} from "@/lib/trading-api-cache";
import type {
  AgentContextActionSummaryDto,
  AgentContextDisclosureDto,
  AgentContextFundamentalsSummaryDto,
  AgentContextItemDto,
  AgentContextResponseDto,
  AgentContextTechnicalSnapshotDto,
  DartFundamentalsHistoryCompanyDto,
  DartFundamentalsHistoryEntryDto,
  DartFundamentalsHistoryMetricDto,
  DartFundamentalsHistoryResponseDto,
  EodActionSummariesResponseDto,
  EodFreshnessResponseDto,
  EodPiotroskiFilterResultItemDto,
  EodPiotroskiFilterResultsResponseDto,
  EodTechnicalSnapshotsResponseDto,
  SymbolPriceBarDto,
  SymbolPriceBarsResponseDto,
} from "@/types/trading-api";

import {
  buildInitialSymbolMeta,
  createSymbolMetaResetToken,
  getDisclosureSectionState,
  shouldFetchSymbolMeta,
  type AggregateContextLoadState,
  type SymbolMetaSeed,
} from "./symbol-detail-state";
import { SymbolHistoryChart } from "./symbol-history-chart";
import styles from "./symbol-detail.module.css";

type SymbolSearchItem = SymbolMetaSeed;

type SymbolSearchResponse = {
  query: string;
  count: number;
  items: SymbolSearchItem[];
};

type QuoteResponse = {
  symbol: string;
  company_name?: string;
  price: number | null;
  change: number | null;
  change_pct: number | null;
  volume: number | null;
  turnover: number | null;
  market_state: string;
  source: string;
  fallback: boolean;
  is_live: boolean;
  available: boolean;
  cached_at?: string | null;
  trade_date?: string | null;
  fallback_reason?: string | null;
  unavailable_reason?: string | null;
};

type MarketStatusItem = {
  market?: string | null;
  state?: string | null;
  is_open?: boolean | null;
  available?: boolean | null;
  ready?: boolean | null;
  label?: string | null;
};

type MarketStatusResponse = {
  state?: string;
  is_open?: boolean;
  server_time?: string;
  markets?: MarketStatusItem[];
};

type TrackedSymbolsResponse = {
  tracked_symbols: string[];
  count: number;
  last_updated_at: string | null;
};

type PriceHistoryRange = "3M" | "1Y" | "5Y" | "MAX";

const DATA_UNAVAILABLE_LABEL = "Unavailable";
const DATE_PENDING_LABEL = "Date pending";
const LOADING_LABEL = "Loading...";

export type SymbolDetailMode =
  | "overview"
  | "action-summary"
  | "technical-analysis"
  | "fundamentals-history"
  | "disclosure-coverage"
  | "system-freshness";

type SymbolDetailClientProps = {
  mode?: SymbolDetailMode;
  symbol?: string;
};

type HeroMetricRow = {
  label: string;
  value: string;
  valueClassName?: string;
};

type HeroMetric = {
  label: string;
  value?: string | null;
  valueClassName?: string;
  detail?: string | null;
  rows?: HeroMetricRow[];
};

const PRICE_HISTORY_RANGES: PriceHistoryRange[] = ["3M", "1Y", "5Y", "MAX"];

const SYMBOL_DETAIL_MODES: Array<{
  mode: SymbolDetailMode;
  label: string;
  eyebrow: string;
  title: string;
  path: string;
  api: string;
}> = [
  {
    mode: "overview",
    label: "Insights",
    eyebrow: "Symbol Detail",
    title: "Insights & Data",
    path: "",
    api: "/api/trading/quotes/{symbol} + layered symbol APIs",
  },
  {
    mode: "action-summary",
    label: "Action",
    eyebrow: "Action Summary Detail",
    title: "Deterministic action layer",
    path: "/action-summary",
    api: "/api/trading/eod/action-summaries",
  },
  {
    mode: "technical-analysis",
    label: "Technical",
    eyebrow: "Technical Analysis Detail",
    title: "Stored technical snapshot",
    path: "/technical-analysis",
    api: "/api/trading/eod/technical-snapshots",
  },
  {
    mode: "fundamentals-history",
    label: "Fundamentals",
    eyebrow: "Fundamentals History Detail",
    title: "DART fundamentals history",
    path: "/fundamentals-history",
    api: "/api/trading/disclosures/dart/fundamentals/history",
  },
  {
    mode: "disclosure-coverage",
    label: "Disclosures",
    eyebrow: "Disclosure & Coverage Detail",
    title: "Recent DART disclosure coverage",
    path: "/disclosure-coverage",
    api: "/api/trading/agent-context/symbol-day",
  },
  {
    mode: "system-freshness",
    label: "Freshness",
    eyebrow: "System Freshness Detail",
    title: "Layer-specific freshness registry",
    path: "/system-freshness",
    api: "/api/trading/eod/freshness",
  },
];

const SYMBOL_DETAIL_MODE_BY_ID = SYMBOL_DETAIL_MODES.reduce(
  (acc, item) => {
    acc[item.mode] = item;
    return acc;
  },
  {} as Record<SymbolDetailMode, (typeof SYMBOL_DETAIL_MODES)[number]>,
);

async function getJson<T>(path: string): Promise<T> {
  return getCachedTradingApiJson<T>(resolveTradingApiClientPath(path));
}

async function getJsonResult<T>(path: string, init?: RequestInit) {
  return getTradingApiJsonResult<T>(resolveTradingApiClientPath(path), init);
}

function hasNumber(value: number | null | undefined): value is number {
  return typeof value === "number";
}

function normalizeSymbolCode(value: string) {
  return value.trim().toUpperCase();
}

function normalizeTrackedSymbols(symbols: string[]) {
  return Array.from(new Set(symbols.map(normalizeSymbolCode).filter(Boolean)));
}

function readRouteParam(value: string | string[] | undefined) {
  if (typeof value === "string") {
    return value;
  }

  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return "";
}

async function loadTrackedSymbolsSnapshot() {
  const result = await getJsonResult<TrackedSymbolsResponse>("/api/trading/scanner/tracked-symbols");
  if (!result.ok) {
    return {
      ok: false as const,
      message: `Tracking status unavailable. HTTP ${result.status}`,
    };
  }

  return {
    ok: true as const,
    symbols: normalizeTrackedSymbols(result.data.tracked_symbols),
  };
}

function formatSignedPercent(value: number | null | undefined, fallback = "Unavailable") {
  if (!hasNumber(value)) return fallback;
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatSignedNumber(value: number | null | undefined, fallback = "Unavailable") {
  if (!hasNumber(value)) return fallback;
  return `${value >= 0 ? "+" : ""}${value.toLocaleString("ko-KR")}`;
}

function formatCompactNumber(value: number | string | null | undefined, fallback = DATA_UNAVAILABLE_LABEL) {
  if (typeof value === "number") {
    return new Intl.NumberFormat("ko-KR", {
      notation: "compact",
      compactDisplay: "short",
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    }).format(value);
  }

  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  return fallback;
}

function formatQuantity(value: number | null | undefined, fallback = DATA_UNAVAILABLE_LABEL) {
  return hasNumber(value) ? value.toLocaleString("ko-KR") : fallback;
}

function formatNumberOrDash(value: number | null | undefined, fallback = DATA_UNAVAILABLE_LABEL) {
  return hasNumber(value) ? value.toFixed(2) : fallback;
}

function humanizeToken(value: string | null | undefined, fallback = DATA_UNAVAILABLE_LABEL) {
  if (!value) return fallback;
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isDisplayableHighlightValue(value: unknown): value is DartFundamentalsHistoryMetricDto["value"] {
  return typeof value === "number" || typeof value === "string" || value === null;
}

function normalizeHighlightMetric(
  value: unknown,
  fallbackKey: string | null,
  index: number,
): DartFundamentalsHistoryMetricDto | null {
  if (typeof value === "number" || typeof value === "string" || value === null) {
    return {
      metric_key: fallbackKey,
      label: fallbackKey ? humanizeToken(fallbackKey, `Metric ${index + 1}`) : null,
      value,
    };
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const metric = value as Record<string, unknown>;
  const metricKey = typeof metric.metric_key === "string" ? metric.metric_key : fallbackKey;
  const label = typeof metric.label === "string"
    ? metric.label
    : metricKey
      ? humanizeToken(metricKey, `Metric ${index + 1}`)
      : null;

  return {
    metric_key: metricKey,
    label,
    value: isDisplayableHighlightValue(metric.value) ? metric.value : null,
  };
}

function normalizeHighlightMetrics(highlights: unknown) {
  if (Array.isArray(highlights)) {
    return highlights
      .map((metric, index) => normalizeHighlightMetric(metric, null, index))
      .filter((metric): metric is DartFundamentalsHistoryMetricDto => metric !== null);
  }

  if (!highlights || typeof highlights !== "object") {
    return [];
  }

  const highlightRecord = highlights as Record<string, unknown>;
  if ("value" in highlightRecord || "label" in highlightRecord || "metric_key" in highlightRecord) {
    const metric = normalizeHighlightMetric(highlightRecord, null, 0);
    return metric ? [metric] : [];
  }

  return Object.entries(highlightRecord)
    .map(([key, value], index) => normalizeHighlightMetric(value, key, index))
    .filter((metric): metric is DartFundamentalsHistoryMetricDto => metric !== null);
}

function getCurrentSeoulMarketDate(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function formatIsoDateLabel(value: string | null | undefined, fallback = DATE_PENDING_LABEL) {
  if (!value) return fallback;
  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${year}.${month}.${day}`;
}

function buildQuoteSourceLabel(quote: QuoteResponse | null) {
  if (!quote) return "Quote source pending.";
  if (!quote.available) {
    return quote.unavailable_reason
      ? `Quote unavailable: ${quote.unavailable_reason}.`
      : "Quote source is currently unavailable.";
  }
  if (quote.is_live) return "Live feed.";
  if (quote.source === "daily_price_bar") {
    return quote.trade_date
      ? `최신 업데이트 : ${quote.trade_date}`
      : "Daily price-bar fallback path.";
  }
  if (quote.fallback) return `${quote.source} fallback path.`;
  return `${quote.source} quote source.`;
}

function shiftIsoDate(isoDate: string, { months = 0, years = 0 }: { months?: number; years?: number }) {
  const parts = isoDate.split("-").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    return isoDate;
  }

  const [year, month, day] = parts;
  const totalMonths = year * 12 + (month - 1) + years * 12 + months;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonthIndex = totalMonths - targetYear * 12;
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonthIndex + 1, 0)).getUTCDate();
  const clampedDay = Math.min(day, lastDayOfTargetMonth);

  return new Date(Date.UTC(targetYear, targetMonthIndex, clampedDay)).toISOString().slice(0, 10);
}

function buildPriceHistoryQuery(range: PriceHistoryRange, marketDate: string) {
  const params = new URLSearchParams();
  params.set("end_date", marketDate);

  if (range === "3M") {
    params.set("start_date", shiftIsoDate(marketDate, { months: -3 }));
  } else if (range === "1Y") {
    params.set("start_date", shiftIsoDate(marketDate, { years: -1 }));
  } else if (range === "5Y") {
    params.set("start_date", shiftIsoDate(marketDate, { years: -5 }));
  } else {
    params.set("limit", "10000");
  }

  return params.toString();
}

function buildBootstrapPriceHistoryQuery(marketDate: string) {
  const params = new URLSearchParams();
  params.set("start_date", marketDate);
  params.set("end_date", marketDate);
  return params.toString();
}

function pickSelectedBar(items: SymbolPriceBarDto[], previousSelectedBar: SymbolPriceBarDto | null) {
  if (items.length === 0) return null;
  if (!previousSelectedBar) return items[items.length - 1] ?? null;
  return items.find((item) => item.trade_date === previousSelectedBar.trade_date) ?? items[items.length - 1] ?? null;
}

function buildFundamentalsHistoryQuery(symbol: string, marketDate: string, fsDiv: string | null) {
  const params = new URLSearchParams();
  params.append("symbols", symbol);
  params.set("start_date", shiftIsoDate(marketDate, { years: -5 }));
  params.set("end_date", marketDate);
  if (fsDiv) {
    params.set("fs_div", fsDiv);
  }
  return params.toString();
}

function buildSymbolRouteQuery(
  meta: SymbolSearchItem | null,
  marketDate: string | null,
  fsDiv: string | null,
) {
  const params = new URLSearchParams();
  const name = meta?.name_ko;
  const market = meta?.market;
  const standardCode = meta?.standard_code;
  const forwardableName = getForwardableSymbolMetaSeedValue(name);
  const forwardableMarket = getForwardableSymbolMetaSeedValue(market);
  const forwardableStandardCode = getForwardableSymbolMetaSeedValue(standardCode);

  if (forwardableName) {
    params.set("name", forwardableName);
  }

  if (forwardableMarket) {
    params.set("market", forwardableMarket);
  }

  if (forwardableStandardCode) {
    params.set("standardCode", forwardableStandardCode);
  }

  if (marketDate) {
    params.set("marketDate", marketDate);
  }

  if (fsDiv) {
    params.set("fsDiv", fsDiv);
  }

  return params.toString();
}

function resolveSymbolDetailMode(value: string | null | undefined) {
  if (!value) return null;
  return Object.prototype.hasOwnProperty.call(SYMBOL_DETAIL_MODE_BY_ID, value) ? (value as SymbolDetailMode) : null;
}

function resolveSymbolDetailModeFromPathname(pathname: string | null, symbol: string) {
  if (!pathname || !symbol) return null;

  const segments = pathname.split("/").filter(Boolean);
  const symbolSegmentIndex = segments.findIndex(
    (segment, index) => segment === "symbol" && segments[index - 1] === "dashboard",
  );
  if (symbolSegmentIndex === -1) return null;

  const encodedSymbol = segments[symbolSegmentIndex + 1];
  if (!encodedSymbol) return null;

  try {
    if (decodeURIComponent(encodedSymbol) !== symbol) return null;
  } catch {
    if (encodedSymbol !== symbol) return null;
  }

  const detailPath = segments[symbolSegmentIndex + 2] ? `/${segments[symbolSegmentIndex + 2]}` : "";
  return SYMBOL_DETAIL_MODES.find((item) => item.path === detailPath)?.mode ?? null;
}

function buildDisclosureReportHref(symbol: string, disclosure: AgentContextDisclosureDto, queryString: string) {
  const params = new URLSearchParams(queryString);
  params.set("reportName", disclosure.report_nm);
  params.set("corpName", disclosure.corp_name);

  if (disclosure.receipt_date) {
    params.set("receiptDate", disclosure.receipt_date);
  }

  if (disclosure.filing_category) {
    params.set("filingCategory", humanizeToken(disclosure.filing_category));
  }

  if (disclosure.fundamentals_capture_status) {
    params.set("captureStatus", humanizeToken(disclosure.fundamentals_capture_status));
  }

  const path = `/dashboard/symbol/${encodeURIComponent(symbol)}/disclosure-coverage/${encodeURIComponent(disclosure.rcept_no)}`;
  const nextQueryString = params.toString();
  return nextQueryString ? `${path}?${nextQueryString}` : path;
}

function buildLatestDisclosure(disclosures: AgentContextDisclosureDto[]) {
  return disclosures[0] ?? null;
}

function buildActionTone(actionSummary: AgentContextActionSummaryDto | null) {
  if (!actionSummary) return "neutral";
  if (actionSummary.bias_direction === "long") return "positive";
  if (actionSummary.bias_direction === "short") return "negative";
  return "info";
}

function buildTechnicalTone(technicalSnapshot: AgentContextTechnicalSnapshotDto | null) {
  if (!technicalSnapshot) return "warning";
  if (technicalSnapshot.trend_state === "uptrend") return "positive";
  if (technicalSnapshot.trend_state === "downtrend") return "negative";
  return "info";
}

function buildFreshnessTone(status: string | null | undefined) {
  if (!status) return "warning";
  if (status === "completed") return "positive";
  if (status === "completed_with_errors") return "warning";
  if (status === "running") return "info";
  return "neutral";
}

function buildModuleStatusTone(available: boolean, fallbackTone = "warning") {
  return available ? "positive" : fallbackTone;
}

function buildConfidenceTone(value: string | null | undefined) {
  if (!value) return "warning";
  if (value === "high" || value === "premium") return "positive";
  if (value === "low") return "negative";
  return "info";
}

function buildInsightTags(payload: Record<string, unknown> | null | undefined) {
  const keys = payload ? Object.keys(payload) : [];
  if (keys.length === 0) {
    return ["No payload keys"];
  }

  return keys.slice(0, 4).map((key) => humanizeToken(key, key));
}

function formatHighlightLabel(metric: DartFundamentalsHistoryMetricDto, index: number) {
  return metric.label ?? metric.metric_key ?? `Metric ${index + 1}`;
}

function formatHighlightValue(metric: DartFundamentalsHistoryMetricDto) {
  return formatCompactNumber(metric.value, "Not reported");
}

function pickFundamentalsCompany(
  fundamentalsHistory: DartFundamentalsHistoryResponseDto | null,
  symbol: string,
) {
  if (!fundamentalsHistory) return null;
  return (
    fundamentalsHistory.companies.find((company) => company.symbol === symbol) ??
    fundamentalsHistory.companies[0] ??
    null
  );
}

function buildTechnicalFreshnessDate(
  technicalSnapshot: AgentContextTechnicalSnapshotDto | null,
  freshness: EodFreshnessResponseDto | null,
) {
  return technicalSnapshot?.market_date ?? freshness?.technical?.latest_date ?? freshness?.latest?.technical_market_date ?? null;
}

function buildActionFreshnessDate(
  actionSummary: AgentContextActionSummaryDto | null,
  freshness: EodFreshnessResponseDto | null,
) {
  return actionSummary?.market_date ?? freshness?.latest?.action_market_date ?? null;
}

function buildFundamentalsDate(
  companyHistory: DartFundamentalsHistoryCompanyDto | null,
  latestFundamentals: AgentContextFundamentalsSummaryDto["latest_snapshot"] | null,
  aggregateContext: AgentContextItemDto | null,
) {
  return (
    companyHistory?.entries[0]?.filing.receipt_date ??
    latestFundamentals?.filing.receipt_date ??
    aggregateContext?.fundamentals.history_summary.latest_receipt_date ??
    latestFundamentals?.period.period_end_date ??
    aggregateContext?.fundamentals.history_summary.latest_period_end_date ??
    null
  );
}

function buildFundamentalsLatestLabel(
  latestHistoryEntry: DartFundamentalsHistoryEntryDto | null,
  latestFundamentals: AgentContextFundamentalsSummaryDto["latest_snapshot"] | null,
) {
  return (
    latestHistoryEntry?.filing.report_nm ??
    latestFundamentals?.filing.report_name ??
    latestHistoryEntry?.period.report_label ??
    latestFundamentals?.period.report_label ??
    (latestFundamentals?.period.business_year ? `FY ${latestFundamentals.period.business_year}` : null) ??
    "No filing loaded"
  );
}

function buildFundamentalsMetricFallbacks(
  latestFundamentals: AgentContextFundamentalsSummaryDto["latest_snapshot"] | null,
  latestHistoryEntry: DartFundamentalsHistoryEntryDto | null,
) {
  const metrics: DartFundamentalsHistoryMetricDto[] = [];
  const filingLabel = buildFundamentalsLatestLabel(latestHistoryEntry, latestFundamentals);
  metrics.push({ metric_key: "latest_filing", label: "Latest filing", value: filingLabel });

  const periodLabel =
    latestHistoryEntry?.period.report_label ??
    latestFundamentals?.period.report_label ??
    latestHistoryEntry?.period.period_end_date ??
    latestFundamentals?.period.period_end_date ??
    null;
  if (periodLabel) {
    metrics.push({ metric_key: "period", label: "Period", value: periodLabel });
  }

  if (hasNumber(latestFundamentals?.statement.row_count)) {
    metrics.push({ metric_key: "statement_rows", label: "Statement rows", value: latestFundamentals.statement.row_count });
  }

  return metrics.slice(0, 3);
}

function buildHistoryEntryMetrics(entry: DartFundamentalsHistoryEntryDto) {
  const highlightMetrics = normalizeHighlightMetrics(entry.highlights);
  if (highlightMetrics.length > 0) {
    return highlightMetrics.slice(0, 2);
  }

  const statementMetrics =
    entry.statements
      ?.filter((statement) => statement.account_name && statement.current_amount !== null)
      .slice(0, 2)
      .map((statement) => ({
        metric_key: statement.account_name,
        label: statement.account_name,
        value: statement.current_amount,
      })) ?? [];

  if (statementMetrics.length > 0) {
    return statementMetrics;
  }

  return [
    {
      metric_key: "period_end",
      label: "Period end",
      value: entry.period.period_end_date ?? entry.period.report_label ?? "No period date",
    },
    {
      metric_key: "filing_receipt",
      label: "Receipt",
      value: entry.filing.receipt_date ?? "No receipt date",
    },
  ];
}

function buildFundamentalsCoverageNote(
  companyHistory: DartFundamentalsHistoryCompanyDto | null,
  latestFundamentals: AgentContextFundamentalsSummaryDto["latest_snapshot"] | null,
) {
  if (companyHistory?.entries.length) {
    return `${companyHistory.entries.length} stored filing period(s) loaded from the DART fundamentals history endpoint.`;
  }

  if (latestFundamentals) {
    return `Aggregate context has ${latestFundamentals.filing.report_name ?? "the latest filing snapshot"} from ${latestFundamentals.filing.receipt_date ?? latestFundamentals.period.period_end_date ?? "an undated filing period"}.`;
  }

  return "Current web layer cannot confirm a stored fundamentals history row for this symbol yet.";
}

function buildFocusCandleRows(focusBar: SymbolPriceBarDto | null): HeroMetricRow[] {
  if (!focusBar) return [];

  return [
    { label: "Open", value: formatPrice(focusBar.open_price) },
    { label: "Close", value: formatPrice(focusBar.close_price) },
    { label: "Volume", value: formatQuantity(focusBar.volume) },
    { label: "Highest", value: formatPrice(focusBar.high_price) },
    { label: "Lowest", value: formatPrice(focusBar.low_price) },
  ];
}

function buildDisclosureCoverageNote(
  latestDisclosure: AgentContextDisclosureDto | null,
  disclosureCount: number,
) {
  if (disclosureCount > 0 && latestDisclosure) {
    return `${disclosureCount} disclosure item(s) loaded. Latest filing landed on ${latestDisclosure.receipt_date ?? "an unavailable receipt date"}.`;
  }

  return "No Disclosure Found for this symbol.";
}

function normalizeMarketCode(value: string | null | undefined) {
  if (!value) return null;
  return value.trim().toUpperCase();
}

function getMarketOpenState(marketStatus: MarketStatusResponse | null) {
  if (!marketStatus) return null;
  if (typeof marketStatus.is_open === "boolean") return marketStatus.is_open;

  const state = normalizeMarketCode(marketStatus.state);
  if (state === "OPEN") return true;
  if (state === "CLOSED") return false;
  return null;
}

function resolveMarketStateValue(value: string | null | undefined) {
  const state = normalizeMarketCode(value);
  if (state === "OPEN") return "OPEN";
  if (state === "CLOSED") return "CLOSED";
  if (state === "PREOPEN") return "PREOPEN";
  if (state === "POSTCLOSE") return "POSTCLOSE";
  return value ?? "Not ready";
}

function resolveMarketStateLabel(item: MarketStatusItem) {
  if (item.ready === false || item.available === false) return "Not ready";
  return resolveMarketStateValue(item.state);
}

function getRelevantMarketStatusCodes(market: string) {
  if (market === "KOSPI") return ["KOSPI", "KRX"];
  if (market === "KONEX") return ["KONEX", "KRX"];
  return [market];
}

function buildMarketStateRows(marketStatus: MarketStatusResponse | null, fallbackMarket: string | null | undefined) {
  const normalizedFallback = normalizeMarketCode(fallbackMarket);
  const items = Array.isArray(marketStatus?.markets) ? marketStatus.markets : [];
  const byCode = new Map<string, MarketStatusItem>();

  for (const item of items) {
    const code = normalizeMarketCode(item.market ?? item.label);
    if (!code) continue;
    byCode.set(code, item);
  }

  if (normalizedFallback) {
    const relevantCode = getRelevantMarketStatusCodes(normalizedFallback).find((code) => byCode.has(code));

    if (relevantCode) {
      const item = byCode.get(relevantCode);
      return item ? [{ market: relevantCode, state: resolveMarketStateLabel(item) }] : [];
    }

    const fallbackState = resolveMarketStateValue(marketStatus?.state);
    return fallbackState === "Not ready" ? [] : [{ market: normalizedFallback, state: fallbackState }];
  }

  return items
    .map((item) => {
      const market = normalizeMarketCode(item.market ?? item.label);
      if (!market) return null;
      return { market, state: resolveMarketStateLabel(item) };
    })
    .filter((row): row is { market: string; state: string } => row !== null);
}

export function SymbolDetailClient({ mode = "overview", symbol: serverSymbol }: SymbolDetailClientProps) {
  const [activeMode, setActiveMode] = useState(mode);
  const params = useParams<{ symbol?: string | string[] }>();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const symbol = useMemo(() => {
    if (typeof serverSymbol === "string" && serverSymbol.trim().length > 0) {
      return serverSymbol;
    }

    return readRouteParam(params.symbol);
  }, [params.symbol, serverSymbol]);
  const normalizedSymbol = useMemo(() => normalizeSymbolCode(symbol), [symbol]);
  const symbolReady = normalizedSymbol.length > 0;
  const requestedMarketDate = useMemo(() => searchParams.get("marketDate"), [searchParams]);
  const requestedViewMode = useMemo(() => resolveSymbolDetailMode(searchParams.get("view")), [searchParams]);
  const defaultMarketDate = useMemo(() => getCurrentSeoulMarketDate(), []);
  const fsDiv = useMemo(() => searchParams.get("fsDiv"), [searchParams]);
  const initialMeta = useMemo(() => {
    return buildInitialSymbolMeta(symbol, {
      name: searchParams.get("name"),
      market: searchParams.get("market"),
      standardCode: searchParams.get("standardCode"),
    });
  }, [searchParams, symbol]);
  const metaResetToken = useMemo(() => createSymbolMetaResetToken(symbol, initialMeta), [initialMeta, symbol]);
  const [meta, setMeta] = useState<SymbolSearchItem | null>(initialMeta);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [marketStatus, setMarketStatus] = useState<MarketStatusResponse | null>(null);
  const [selectedRange, setSelectedRange] = useState<PriceHistoryRange>("1Y");
  const [priceHistory, setPriceHistory] = useState<SymbolPriceBarsResponseDto | null>(null);
  const [selectedBar, setSelectedBar] = useState<SymbolPriceBarDto | null>(null);
  const [aggregateContext, setAggregateContext] = useState<AgentContextItemDto | null>(null);
  const [technicalSnapshot, setTechnicalSnapshot] = useState<AgentContextTechnicalSnapshotDto | null>(null);
  const [actionSummary, setActionSummary] = useState<AgentContextActionSummaryDto | null>(null);
  const [freshness, setFreshness] = useState<EodFreshnessResponseDto | null>(null);
  const [fundamentalsHistory, setFundamentalsHistory] = useState<DartFundamentalsHistoryResponseDto | null>(null);
  const [piotroskiResult, setPiotroskiResult] = useState<EodPiotroskiFilterResultItemDto | null>(null);
  const [piotroskiLoadState, setPiotroskiLoadState] = useState<AggregateContextLoadState>("loading");
  const [trackedSymbols, setTrackedSymbols] = useState<string[]>([]);
  const [trackedSymbolsLoaded, setTrackedSymbolsLoaded] = useState(false);
  const [aggregateContextLoadState, setAggregateContextLoadState] =
    useState<AggregateContextLoadState>("loading");
  const [quotePollingStopped, setQuotePollingStopped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [insightLoading, setInsightLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyHydrating, setHistoryHydrating] = useState(false);
  const [fundamentalsLoading, setFundamentalsLoading] = useState(true);
  const [hasFinishedInitialLoad, setHasFinishedInitialLoad] = useState(false);
  const [trackingSaving, setTrackingSaving] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [fundamentalsError, setFundamentalsError] = useState<string | null>(null);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const bootstrapPriceHistoryRequestKeyRef = useRef<string | null>(null);
  const fullPriceHistoryRequestKeyRef = useRef<string | null>(null);
  const technicalSnapshotRequestKeyRef = useRef<string | null>(null);
  const actionSummaryRequestKeyRef = useRef<string | null>(null);
  const fundamentalsHistoryRequestKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setActiveMode(requestedViewMode ?? resolveSymbolDetailModeFromPathname(pathname, symbol) ?? mode);
  }, [mode, pathname, requestedViewMode, symbol]);

  const isOverviewMode = activeMode === "overview";
  const shouldLoadAggregateContext = activeMode !== "system-freshness";
  const shouldLoadPriceHistory = isOverviewMode || activeMode === "technical-analysis";
  const shouldLoadTechnicalSnapshot = isOverviewMode || activeMode === "technical-analysis";
  const shouldLoadActionSummary = isOverviewMode || activeMode === "action-summary";
  const shouldLoadFundamentalsHistory = isOverviewMode || activeMode === "fundamentals-history";

  const marketDate = useMemo(() => {
    if (requestedMarketDate) return requestedMarketDate;
    if (quote?.trade_date) return quote.trade_date;
    if (!loading) return defaultMarketDate;
    return null;
  }, [defaultMarketDate, loading, quote?.trade_date, requestedMarketDate]);
  const fundamentalsEntryLimit = activeMode === "fundamentals-history" ? 8 : 4;
  const disclosureItemLimit = activeMode === "disclosure-coverage" ? 8 : 4;

  useEffect(() => {
    setMeta(initialMeta);
    setQuote(null);
    setMarketStatus(null);
    setSelectedRange("1Y");
    setPriceHistory(null);
    setSelectedBar(null);
    setAggregateContext(null);
    setTechnicalSnapshot(null);
    setActionSummary(null);
    setFreshness(null);
    setFundamentalsHistory(null);
    setPiotroskiResult(null);
    setPiotroskiLoadState("loading");
    setTrackedSymbols([]);
    setTrackedSymbolsLoaded(false);
    setAggregateContextLoadState("loading");
    setQuotePollingStopped(false);
    setLoading(true);
    setInsightLoading(true);
    setHistoryLoading(true);
    setHistoryHydrating(false);
    setFundamentalsLoading(true);
    setHasFinishedInitialLoad(false);
    setTrackingSaving(false);
    setMetaError(null);
    setQuoteError(null);
    setHistoryError(null);
    setContextError(null);
    setFundamentalsError(null);
    setTrackingError(null);
    bootstrapPriceHistoryRequestKeyRef.current = null;
    fullPriceHistoryRequestKeyRef.current = null;
    technicalSnapshotRequestKeyRef.current = null;
    actionSummaryRequestKeyRef.current = null;
    fundamentalsHistoryRequestKeyRef.current = null;
  }, [initialMeta, metaResetToken]);

  useEffect(() => {
    let active = true;

    const loadTrackedSymbols = async () => {
      if (!symbolReady) {
        setTrackedSymbols([]);
        setTrackedSymbolsLoaded(false);
        setTrackingError(null);
        return;
      }

      try {
        const result = await loadTrackedSymbolsSnapshot();
        if (!active) return;

        if (!result.ok) {
          setTrackedSymbols([]);
          setTrackedSymbolsLoaded(false);
          setTrackingError(result.message);
          return;
        }

        setTrackedSymbols(result.symbols);
        setTrackedSymbolsLoaded(true);
        setTrackingError(null);
      } catch {
        if (!active) return;
        setTrackedSymbols([]);
        setTrackedSymbolsLoaded(false);
        setTrackingError("Tracking status unavailable.");
      }
    };

    void loadTrackedSymbols();
    return () => {
      active = false;
    };
  }, [symbol, symbolReady]);

  useEffect(() => {
    let active = true;

    const loadMeta = async () => {
      if (!symbolReady) {
        setMeta(null);
        setMetaError(null);
        return;
      }

      if (!shouldFetchSymbolMeta(initialMeta)) {
        if (!active) return;
        setMeta(initialMeta);
        return;
      }

      try {
        const data = await getJson<SymbolSearchResponse>(
          `/api/trading/symbols/search?q=${encodeURIComponent(symbol)}&limit=20`,
        );
        if (!active) return;
        const exactMatch = data.items.find((item) => item.symbol === symbol) ?? data.items[0] ?? null;
        setMeta(exactMatch);
        setMetaError(exactMatch ? null : "Master symbol information was not found for this code.");
      } catch (metaLoadError) {
        console.error("Symbol metadata load failed", metaLoadError);
        if (!active) return;
        setMetaError("Unable to load master symbol information.");
      }
    };

    loadMeta();

    return () => {
      active = false;
    };
  }, [initialMeta, symbol, symbolReady]);

  useEffect(() => {
    let active = true;
    let timer: number | null = null;

    const loadQuote = async () => {
      if (!symbolReady) {
        setQuote(null);
        setMarketStatus(null);
        setQuotePollingStopped(false);
        setQuoteError(null);
        setLoading(true);
        return;
      }

      try {
        const [quoteData, marketData] = await Promise.all([
          getJson<QuoteResponse>(`/api/trading/quotes/${encodeURIComponent(symbol)}`),
          getJson<MarketStatusResponse>("/api/trading/market/status"),
        ]);
        if (!active) return;

        const shouldStopPolling =
          marketData.state === "CLOSED" && quoteData.market_state === "CLOSED";

        setQuote(quoteData);
        setMarketStatus(marketData);
        setQuotePollingStopped(shouldStopPolling);
        setQuoteError(null);

        if (!shouldStopPolling) {
          timer = window.setTimeout(loadQuote, 1_500);
        }
      } catch (quoteLoadError) {
        console.error("Symbol quote load failed", quoteLoadError);
        if (!active) return;
        setQuoteError("Unable to load symbol quote details from trading-core.");
        timer = window.setTimeout(loadQuote, 1_500);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadQuote();

    return () => {
      active = false;
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [symbol, symbolReady]);

  useEffect(() => {
    let active = true;

    const loadBootstrapPriceHistory = async () => {
      if (!symbolReady) {
        setPriceHistory(null);
        setSelectedBar(null);
        setHistoryLoading(true);
        setHistoryHydrating(false);
        setHistoryError(null);
        return;
      }

      if (!shouldLoadPriceHistory) {
        setHistoryLoading(false);
        setHistoryHydrating(false);
        return;
      }

      if (hasFinishedInitialLoad) {
        setHistoryLoading(false);
        return;
      }

      if (!marketDate) {
        setPriceHistory(null);
        setSelectedBar(null);
        setHistoryLoading(true);
        setHistoryHydrating(false);
        setHistoryError(null);
        return;
      }

      const query = buildBootstrapPriceHistoryQuery(marketDate);
      const priceHistoryRequestKey = `${symbol}|bootstrap|${query}`;
      if (bootstrapPriceHistoryRequestKeyRef.current === priceHistoryRequestKey) {
        setHistoryLoading(false);
        return;
      }

      setHistoryLoading(true);

      try {
        const data = await getJson<SymbolPriceBarsResponseDto>(
          `/api/trading/symbols/${encodeURIComponent(symbol)}/price-bars?${query}`,
        );
        if (!active) return;
        setPriceHistory(data);
        setSelectedBar((current) => pickSelectedBar(data.items, current));
        setHistoryError(null);
        bootstrapPriceHistoryRequestKeyRef.current = priceHistoryRequestKey;
      } catch (priceHistoryLoadError) {
        console.error("Symbol price history load failed", priceHistoryLoadError);
        if (!active) return;
        setPriceHistory(null);
        setSelectedBar(null);
        setHistoryError("Unable to load stored historical price bars from trading-core.");
        bootstrapPriceHistoryRequestKeyRef.current = null;
        fullPriceHistoryRequestKeyRef.current = null;
      } finally {
        if (active) {
          setHistoryLoading(false);
        }
      }
    };

    loadBootstrapPriceHistory();

    return () => {
      active = false;
    };
  }, [hasFinishedInitialLoad, marketDate, shouldLoadPriceHistory, symbol, symbolReady]);

  useEffect(() => {
    let active = true;

    const loadSelectedRangePriceHistory = async () => {
      if (!symbolReady) {
        setHistoryHydrating(false);
        return;
      }

      if (!shouldLoadPriceHistory) {
        setHistoryHydrating(false);
        return;
      }

      if (!hasFinishedInitialLoad || !marketDate) {
        return;
      }

      const query = buildPriceHistoryQuery(selectedRange, marketDate);
      const priceHistoryRequestKey = `${symbol}|full|${query}`;
      if (fullPriceHistoryRequestKeyRef.current === priceHistoryRequestKey) {
        setHistoryHydrating(false);
        return;
      }

      if (priceHistory?.items.length) {
        setHistoryHydrating(true);
      } else {
        setHistoryLoading(true);
      }

      try {
        const data = await getJson<SymbolPriceBarsResponseDto>(
          `/api/trading/symbols/${encodeURIComponent(symbol)}/price-bars?${query}`,
        );
        if (!active) return;
        setPriceHistory(data);
        setSelectedBar((current) => pickSelectedBar(data.items, current));
        setHistoryError(null);
        fullPriceHistoryRequestKeyRef.current = priceHistoryRequestKey;
      } catch (priceHistoryLoadError) {
        console.error("Symbol price history range hydration failed", priceHistoryLoadError);
        if (!active) return;

        if (!priceHistory?.items.length) {
          setPriceHistory(null);
          setSelectedBar(null);
          setHistoryError("Unable to load stored historical price bars from trading-core.");
        }

        fullPriceHistoryRequestKeyRef.current = null;
      } finally {
        if (active) {
          setHistoryLoading(false);
          setHistoryHydrating(false);
        }
      }
    };

    loadSelectedRangePriceHistory();

    return () => {
      active = false;
    };
  }, [hasFinishedInitialLoad, marketDate, priceHistory, selectedRange, shouldLoadPriceHistory, symbol, symbolReady]);

  useEffect(() => {
    let active = true;

    const loadAggregateContext = async () => {
      if (!symbolReady) {
        setAggregateContext(null);
        setAggregateContextLoadState("loading");
        setContextError(null);
        return;
      }

      if (!shouldLoadAggregateContext) {
        setAggregateContextLoadState("success");
        setContextError(null);
        return;
      }

      if (!marketDate) {
        setAggregateContext(null);
        setAggregateContextLoadState("loading");
        setContextError(null);
        return;
      }

      setAggregateContextLoadState("loading");
      const aggregateParams = new URLSearchParams();
      aggregateParams.set("market_date", marketDate);
      aggregateParams.append("symbols", symbol);
      aggregateParams.set("disclosures_limit", String(disclosureItemLimit));
      if (fsDiv) {
        aggregateParams.set("fs_div", fsDiv);
      }

      try {
        const data = await getJson<AgentContextResponseDto>(
          `/api/trading/agent-context/symbol-day?${aggregateParams.toString()}`,
        );
        if (!active) return;

        const exactMatch = data.items.find((item) => item.symbol === symbol) ?? null;
        setAggregateContext(exactMatch);
        setAggregateContextLoadState(exactMatch ? "success" : "error");
        setContextError(exactMatch ? null : "Aggregate symbol context did not include this symbol.");
      } catch (aggregateLoadError) {
        console.error("Aggregate symbol context load failed", aggregateLoadError);
        if (!active) return;
        setAggregateContext(null);
        setAggregateContextLoadState("error");
        setContextError("Aggregate symbol context is unavailable right now.");
      }
    };

    loadAggregateContext();

    return () => {
      active = false;
    };
  }, [disclosureItemLimit, fsDiv, marketDate, shouldLoadAggregateContext, symbol, symbolReady]);

  useEffect(() => {
    let active = true;

    const loadPiotroskiResult = async () => {
      if (!symbolReady) {
        setPiotroskiResult(null);
        setPiotroskiLoadState("loading");
        return;
      }

      if (!marketDate) {
        setPiotroskiResult(null);
        setPiotroskiLoadState("loading");
        return;
      }

      setPiotroskiLoadState("loading");
      const query = new URLSearchParams();
      query.set("market_date", marketDate);
      query.set("symbol", normalizedSymbol);

      try {
        const data = await getJson<EodPiotroskiFilterResultsResponseDto>(
          `/api/trading/eod/piotroski-filter-results?${query.toString()}`,
        );
        if (!active) return;
        setPiotroskiResult(data.item ?? null);
        setPiotroskiLoadState("success");
      } catch (piotroskiLoadError) {
        console.error("Piotroski filter load failed", piotroskiLoadError);
        if (!active) return;
        setPiotroskiResult(null);
        setPiotroskiLoadState("error");
      }
    };

    loadPiotroskiResult();

    return () => {
      active = false;
    };
  }, [marketDate, normalizedSymbol, symbolReady]);

  useEffect(() => {
    let active = true;

    const loadDerivedInsights = async () => {
      if (!symbolReady) {
        setTechnicalSnapshot(null);
        setActionSummary(null);
        setInsightLoading(true);
        return;
      }

      if (!shouldLoadTechnicalSnapshot && !shouldLoadActionSummary) {
        setInsightLoading(false);
        return;
      }

      if (!marketDate) {
        setTechnicalSnapshot(null);
        setActionSummary(null);
        setInsightLoading(true);
        return;
      }

      const insightQuery = new URLSearchParams();
      insightQuery.set("market_date", marketDate);
      insightQuery.append("symbols", symbol);
      const insightRequestKey = `${symbol}|${marketDate}`;
      const needsTechnicalSnapshot =
        shouldLoadTechnicalSnapshot && technicalSnapshotRequestKeyRef.current !== insightRequestKey;
      const needsActionSummary =
        shouldLoadActionSummary && actionSummaryRequestKeyRef.current !== insightRequestKey;

      if (!needsTechnicalSnapshot && !needsActionSummary) {
        setInsightLoading(false);
        return;
      }

      setInsightLoading(true);

      const [technicalResult, actionResult] = await Promise.allSettled([
        needsTechnicalSnapshot
          ? getJson<EodTechnicalSnapshotsResponseDto>(
              `/api/trading/eod/technical-snapshots?${insightQuery.toString()}`,
            )
          : Promise.resolve<EodTechnicalSnapshotsResponseDto | null>(null),
        needsActionSummary
          ? getJson<EodActionSummariesResponseDto>(
              `/api/trading/eod/action-summaries?${insightQuery.toString()}`,
            )
          : Promise.resolve<EodActionSummariesResponseDto | null>(null),
      ]);

      if (!active) return;

      if (needsTechnicalSnapshot && technicalResult.status === "fulfilled" && technicalResult.value) {
        setTechnicalSnapshot(
          technicalResult.value.items.find((item) => item.symbol === symbol) ??
            technicalResult.value.items[0] ??
            null,
        );
        technicalSnapshotRequestKeyRef.current = insightRequestKey;
      } else if (needsTechnicalSnapshot && technicalResult.status === "rejected") {
        console.error("Technical snapshot load failed", technicalResult.reason);
        setTechnicalSnapshot(null);
        technicalSnapshotRequestKeyRef.current = null;
      }

      if (needsActionSummary && actionResult.status === "fulfilled" && actionResult.value) {
        setActionSummary(
          actionResult.value.items.find((item) => item.symbol === symbol) ??
            actionResult.value.items[0] ??
            null,
        );
        actionSummaryRequestKeyRef.current = insightRequestKey;
      } else if (needsActionSummary && actionResult.status === "rejected") {
        console.error("Action summary load failed", actionResult.reason);
        setActionSummary(null);
        actionSummaryRequestKeyRef.current = null;
      }

      setInsightLoading(false);
    };

    loadDerivedInsights();

    return () => {
      active = false;
    };
  }, [marketDate, shouldLoadActionSummary, shouldLoadTechnicalSnapshot, symbol, symbolReady]);

  useEffect(() => {
    let active = true;

    const loadFreshness = async () => {
      try {
        const data = await getJson<EodFreshnessResponseDto>("/api/trading/eod/freshness");
        if (!active) return;
        setFreshness(data);
      } catch (freshnessLoadError) {
        console.error("Symbol freshness load failed", freshnessLoadError);
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

    const loadFundamentalsHistory = async () => {
      if (!symbolReady) {
        setFundamentalsHistory(null);
        setFundamentalsLoading(true);
        setFundamentalsError(null);
        return;
      }

      if (!shouldLoadFundamentalsHistory) {
        setFundamentalsLoading(false);
        return;
      }

      if (!marketDate) {
        setFundamentalsHistory(null);
        setFundamentalsLoading(true);
        setFundamentalsError(null);
        return;
      }

      const query = buildFundamentalsHistoryQuery(symbol, marketDate, fsDiv);
      const fundamentalsHistoryRequestKey = query;
      if (fundamentalsHistoryRequestKeyRef.current === fundamentalsHistoryRequestKey && fundamentalsHistory) {
        setFundamentalsLoading(false);
        return;
      }

      setFundamentalsLoading(true);

      try {
        const data = await getJson<DartFundamentalsHistoryResponseDto>(
          `/api/trading/disclosures/dart/fundamentals/history?${query}`,
        );
        if (!active) return;
        setFundamentalsHistory(data);
        setFundamentalsError(null);
        fundamentalsHistoryRequestKeyRef.current = fundamentalsHistoryRequestKey;
      } catch (fundamentalsLoadError) {
        console.error("Fundamentals history load failed", fundamentalsLoadError);
        if (!active) return;
        setFundamentalsHistory(null);
        setFundamentalsError("Unable to load DART fundamentals history from trading-core.");
        fundamentalsHistoryRequestKeyRef.current = null;
      } finally {
        if (active) {
          setFundamentalsLoading(false);
        }
      }
    };

    loadFundamentalsHistory();

    return () => {
      active = false;
    };
  }, [fsDiv, fundamentalsHistory, marketDate, shouldLoadFundamentalsHistory, symbol, symbolReady]);

  const resolvedTechnicalSnapshot = technicalSnapshot ?? aggregateContext?.technical_snapshot ?? null;
  const resolvedActionSummary = actionSummary ?? aggregateContext?.action_summary ?? null;
  const latestFundamentals = aggregateContext?.fundamentals.latest_snapshot ?? null;
  const latestDisclosure = buildLatestDisclosure(aggregateContext?.recent_disclosures.items ?? []);
  const companyHistory = pickFundamentalsCompany(fundamentalsHistory, symbol);
  const latestHistoryEntry = companyHistory?.entries[0] ?? null;
  const technicalFreshnessDate = buildTechnicalFreshnessDate(resolvedTechnicalSnapshot, freshness);
  const actionFreshnessDate = buildActionFreshnessDate(resolvedActionSummary, freshness);
  const fundamentalsDate = buildFundamentalsDate(companyHistory, latestFundamentals, aggregateContext);
  const latestFundamentalEventLabel =
    latestDisclosure?.report_nm ??
    (latestHistoryEntry || latestFundamentals
      ? buildFundamentalsLatestLabel(latestHistoryEntry, latestFundamentals)
      : null);
  const latestFundamentalEventDate = latestDisclosure?.receipt_date ?? fundamentalsDate;
  const piotroskiLabel = piotroskiResult
    ? piotroskiResult.passed_filter
      ? "Pass"
      : "Fail"
    : piotroskiLoadState === "loading"
      ? LOADING_LABEL
      : piotroskiLoadState === "error"
        ? DATA_UNAVAILABLE_LABEL
        : "Pending";
  const piotroskiValueClassName = piotroskiResult
    ? piotroskiResult.passed_filter
      ? styles.positive
      : styles.negative
    : undefined;
  const latestHistoryHighlights = normalizeHighlightMetrics(latestHistoryEntry?.highlights).slice(0, 3);
  const latestAggregateHighlights = normalizeHighlightMetrics(latestFundamentals?.highlights).slice(0, 3);
  const latestHighlights =
    latestHistoryHighlights.length > 0
      ? latestHistoryHighlights
      : latestAggregateHighlights.length > 0
        ? latestAggregateHighlights
        : buildFundamentalsMetricFallbacks(latestFundamentals, latestHistoryEntry);
  const disclosureSectionState = getDisclosureSectionState(
    aggregateContextLoadState,
    aggregateContext !== null,
    aggregateContext?.recent_disclosures.count ?? 0,
  );

  const aggregateCompanyName = getForwardableSymbolMetaSeedValue(aggregateContext?.company.name_ko);
  const metaCompanyName = getForwardableSymbolMetaSeedValue(meta?.name_ko);
  const quoteCompanyName = getForwardableSymbolMetaSeedValue(quote?.company_name);
  const dartCompanyName = getForwardableSymbolMetaSeedValue(aggregateContext?.company.dart.corp_name);
  const aggregateMarket = getForwardableSymbolMetaSeedValue(aggregateContext?.company.market);
  const metaMarket = getForwardableSymbolMetaSeedValue(meta?.market);
  const introTitle = aggregateCompanyName ?? metaCompanyName ?? quoteCompanyName ?? dartCompanyName ?? symbol;
  const marketLabel = aggregateMarket ?? metaMarket ?? quote?.market_state ?? "Market pending";
  const quoteSourceCopy = quote?.is_live ? null : buildQuoteSourceLabel(quote);
  const detailErrors = [quoteError, metaError, historyError, contextError, fundamentalsError].filter(
    (value): value is string => Boolean(value),
  );
  const isTrackedSymbol = trackedSymbols.includes(normalizedSymbol);
  const trackingButtonLabel = trackingSaving
    ? "Updating tracked symbol"
    : !trackedSymbolsLoaded
      ? `Set tracked status for ${normalizedSymbol}`
      : isTrackedSymbol
        ? `Remove ${normalizedSymbol} from tracked symbols`
        : `Add ${normalizedSymbol} to tracked symbols`;

  const handleToggleTrackedSymbol = async () => {
    if (trackingSaving) return;

    if (!normalizedSymbol) {
      setTrackingError("Tracking update unavailable for this symbol.");
      return;
    }

    setTrackingSaving(true);
    setTrackingError(null);

    try {
      invalidateTradingApiCacheByPathPrefix([
        "/api/trading/scanner/tracked-symbols",
        "/api/trading/quotes/tracked",
      ]);
      const currentResult = await loadTrackedSymbolsSnapshot();
      if (!currentResult.ok) {
        setTrackedSymbols([]);
        setTrackedSymbolsLoaded(false);
        setTrackingError(currentResult.message);
        return;
      }

      const currentTrackedSymbols = currentResult.symbols;
      const currentlyTracked = currentTrackedSymbols.includes(normalizedSymbol);
      const nextSymbols = currentlyTracked
        ? currentTrackedSymbols.filter((currentSymbol) => currentSymbol !== normalizedSymbol)
        : [normalizedSymbol, ...currentTrackedSymbols.filter((currentSymbol) => currentSymbol !== normalizedSymbol)];

      setTrackedSymbols(currentTrackedSymbols);
      setTrackedSymbolsLoaded(true);

      const result = await getJsonResult<TrackedSymbolsResponse>("/api/trading/scanner/tracked-symbols", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ symbols: nextSymbols }),
      });

      if (!result.ok) {
        setTrackingError(`Tracking update failed. HTTP ${result.status}`);
        return;
      }

      const normalizedTrackedSymbols = normalizeTrackedSymbols(result.data.tracked_symbols);
      invalidateTradingApiCacheByPathPrefix([
        "/api/trading/scanner/tracked-symbols",
        "/api/trading/symbols/favorites",
        "/api/trading/quotes/tracked",
      ]);
      setTrackedSymbols(normalizedTrackedSymbols);
      setTrackedSymbolsLoaded(true);
      setTrackingError(null);
    } catch {
      setTrackingError("Tracking update failed.");
    } finally {
      setTrackingSaving(false);
    }
  };

  const chartMetrics = useMemo(() => {
    if (!priceHistory || priceHistory.items.length === 0) return null;

    const first = priceHistory.items[0];
    const last = priceHistory.items[priceHistory.items.length - 1];
    let low = first.low_price;
    let high = first.high_price;

    for (const bar of priceHistory.items) {
      if (bar.low_price < low) low = bar.low_price;
      if (bar.high_price > high) high = bar.high_price;
    }

    return {
      low,
      high,
      start: first.open_price,
      end: last.close_price,
      points: priceHistory.items.length,
      startDate: first.trade_date,
      endDate: last.trade_date,
    };
  }, [priceHistory]);

  const focusBar = selectedBar ?? priceHistory?.items[priceHistory.items.length - 1] ?? null;
  const focusBarIndex =
    focusBar && priceHistory
      ? priceHistory.items.findIndex((item) => item.trade_date === focusBar.trade_date)
      : -1;
  const previousFocusBar =
    focusBarIndex > 0 && priceHistory ? priceHistory.items[focusBarIndex - 1] ?? null : null;
  const focusMovePct =
    focusBar && previousFocusBar && previousFocusBar.close_price > 0
      ? ((focusBar.close_price - previousFocusBar.close_price) / previousFocusBar.close_price) * 100
      : null;
  const focusCandleRows = buildFocusCandleRows(focusBar);
  const focusCandleValue =
    focusCandleRows.length > 0
      ? null
      : shouldLoadPriceHistory
        ? historyLoading
          ? LOADING_LABEL
          : "No candle selected"
        : "Open chart detail";
  const focusCandleDetail =
    focusCandleRows.length > 0
      ? null
      : shouldLoadPriceHistory
        ? "Select a candle to inspect OHLCV details."
        : "Open the overview or technical view to inspect stored OHLCV data.";

  const heroMetrics: HeroMetric[] = [
    {
      label: "Focus candle",
      value: focusCandleValue,
      detail: focusCandleDetail,
      rows: focusCandleRows,
    },
    {
      label: "Fundamental latest",
      value:
        latestFundamentalEventLabel ??
        (aggregateContextLoadState === "loading" || fundamentalsLoading ? LOADING_LABEL : "No DART event"),
      detail: latestFundamentalEventDate ? formatIsoDateLabel(latestFundamentalEventDate) : null,
    },
    {
      label: "Piotroski filter",
      value: piotroskiLabel,
      valueClassName: piotroskiValueClassName,
      detail: null,
    },
    {
      label: "Recommendation",
      value: "Coming soon",
      detail: null,
    },
  ];

  const actionReasons = resolvedActionSummary?.reasons.slice(0, 4) ?? [];
  const actionPayloadTags = buildInsightTags(resolvedActionSummary?.summary_payload);
  const technicalPayloadTags = buildInsightTags(resolvedTechnicalSnapshot?.signal_payload);
  const actionTone = buildActionTone(resolvedActionSummary);
  const technicalTone = buildTechnicalTone(resolvedTechnicalSnapshot);
  const freshnessTone = buildFreshnessTone(freshness?.today?.eod_status);
  const marketStateRows = useMemo(() => buildMarketStateRows(marketStatus, metaMarket), [marketStatus, metaMarket]);
  const toolbarMarketOpenState = getMarketOpenState(marketStatus);
  const toolbarMarketBadgeLabel =
    toolbarMarketOpenState === null ? "Market Pending" : toolbarMarketOpenState ? "Market Open" : "Market Closed";
  const toolbarMarketBadgeTone =
    toolbarMarketOpenState === null ? "neutral" : toolbarMarketOpenState ? "positive" : styles.marketStatusClosedPill;
  const actionScore = Math.max(0, Math.min(resolvedActionSummary?.signal_score ?? 0, 100));
  const routeQueryString = useMemo(
    () => buildSymbolRouteQuery(meta, marketDate, fsDiv),
    [fsDiv, marketDate, meta],
  );
  const selectedRangeHistoryRequestKey = useMemo(
    () => (marketDate ? `${symbol}|full|${buildPriceHistoryQuery(selectedRange, marketDate)}` : null),
    [marketDate, selectedRange, symbol],
  );
  const hasSelectedRangeHistoryLoaded =
    selectedRangeHistoryRequestKey !== null && fullPriceHistoryRequestKeyRef.current === selectedRangeHistoryRequestKey;

  const handleDetailModeNavigation = (
    event: ReactMouseEvent<HTMLButtonElement>,
    nextMode: SymbolDetailMode,
  ) => {
    if (event.defaultPrevented) return;
    if (typeof event.button === "number" && event.button !== 0) return;

    event.preventDefault();
    if (activeMode !== nextMode) {
      setActiveMode(nextMode);
    }
  };

  const initialRouteReady = useMemo(() => {
    if (loading) return false;

    if (activeMode === "system-freshness") {
      return true;
    }

    if (activeMode === "disclosure-coverage") {
      return aggregateContextLoadState !== "loading";
    }

    if (activeMode === "fundamentals-history") {
      return aggregateContextLoadState !== "loading" && !fundamentalsLoading;
    }

    if (activeMode === "action-summary") {
      return aggregateContextLoadState !== "loading" && !insightLoading;
    }

    if (activeMode === "technical-analysis") {
      return aggregateContextLoadState !== "loading" && !historyLoading && !insightLoading;
    }

    return aggregateContextLoadState !== "loading" && !historyLoading && !fundamentalsLoading && !insightLoading;
  }, [activeMode, aggregateContextLoadState, fundamentalsLoading, historyLoading, insightLoading, loading]);

  useEffect(() => {
    if (hasFinishedInitialLoad || !initialRouteReady) return;
    setHasFinishedInitialLoad(true);
  }, [hasFinishedInitialLoad, initialRouteReady]);

  if (!hasFinishedInitialLoad) {
    return <FullPageLoadingScreen label="Loading symbol workspace" />;
  }

  const moduleRows = [
    {
      id: "price",
      label: "Price Module",
      date: freshness?.latest?.price_trade_date ?? quote?.trade_date ?? formatDisplayTimestamp(quote?.cached_at, "Quote pending"),
      detail: quote?.available ? buildQuoteSourceLabel(quote) : quote?.unavailable_reason ?? "Quote coverage unavailable.",
      tone: buildModuleStatusTone(Boolean(quote?.available)),
      status: quote?.available ? (quote?.is_live ? "Live" : "Fallback") : "Unavailable",
      api: "/api/trading/quotes/{symbol}",
    },
    {
      id: "technical",
      label: "Technical Analysis",
      date: technicalFreshnessDate ?? "No technical date",
      detail: resolvedTechnicalSnapshot
        ? `${humanizeToken(resolvedTechnicalSnapshot.trend_state)} · ${humanizeToken(resolvedTechnicalSnapshot.ma_alignment)}`
        : "Technical snapshot unavailable or still lagging the latest close.",
      tone: resolvedTechnicalSnapshot || freshness?.technical?.success ? technicalTone : "warning",
      status: resolvedTechnicalSnapshot ? "Synced" : freshness?.technical?.success ? "Synced" : "Pending",
      api: "/api/trading/eod/technical-snapshots",
    },
    {
      id: "action",
      label: "Action Summary",
      date: actionFreshnessDate ?? "No action date",
      detail: resolvedActionSummary
        ? `${humanizeToken(resolvedActionSummary.action_label)} · ${humanizeToken(resolvedActionSummary.risk_tier)} risk`
        : "Action summary unavailable or not yet derived for this date.",
      tone: resolvedActionSummary ? actionTone : "warning",
      status: resolvedActionSummary ? "Resolved" : "Pending",
      api: "/api/trading/eod/action-summaries",
    },
    {
      id: "fundamentals",
      label: "Fundamentals",
      date: fundamentalsDate ?? "No filing date",
      detail: buildFundamentalsCoverageNote(companyHistory, latestFundamentals),
      tone: companyHistory?.entries.length || latestFundamentals ? "info" : "warning",
      status: companyHistory?.entries.length ? "History loaded" : latestFundamentals ? "Aggregate only" : "No history",
      api: "/api/trading/disclosures/dart/fundamentals/history",
    },
    {
      id: "disclosures",
      label: "DART Disclosures",
      date:
        latestDisclosure?.receipt_date ??
        (disclosureSectionState === "loading"
          ? LOADING_LABEL
          : disclosureSectionState === "empty"
            ? "No disclosures"
            : "Unavailable"),
      detail: buildDisclosureCoverageNote(
        latestDisclosure,
        aggregateContext?.recent_disclosures.count ?? 0,
      ),
      tone:
        disclosureSectionState === "list"
          ? "info"
          : disclosureSectionState === "empty"
            ? "neutral"
            : "warning",
      status:
        disclosureSectionState === "list"
          ? "Coverage"
          : disclosureSectionState === "empty"
            ? "Empty"
            : disclosureSectionState === "loading"
              ? "Loading"
              : "Unavailable",
      api: "/api/trading/agent-context/symbol-day",
    },
  ] as const;
  const activeDetailMode = SYMBOL_DETAIL_MODE_BY_ID[activeMode];
  const toolbarTitle = introTitle;
  const showOverview = isOverviewMode;
  const showChartSection = showOverview || activeMode === "technical-analysis";
  const showActionSection = activeMode === "action-summary";
  const showTechnicalSection = activeMode === "technical-analysis";
  const showFundamentalsSection = activeMode === "fundamentals-history";
  const showDisclosureSection = activeMode === "disclosure-coverage";
  const showFreshnessSection = showOverview || activeMode === "system-freshness";

  return (
    <MobileAppChrome
      activeNav="symbols"
      mySymbolsHref="/my-symbols"
      header={
        <>
          <div className={styles.headerBrand}>
            <Link href="/dashboard" className={styles.backButton} aria-label="Back to dashboard">
              ←
            </Link>
            <div>
              <strong className={styles.headerTitle} title={toolbarTitle}>
                {toolbarTitle}
              </strong>
            </div>
          </div>

          <div className={styles.headerActions}>
            <span className={`pill ${styles.marketStatusPill} ${toolbarMarketBadgeTone}`}>
              {toolbarMarketBadgeLabel}
            </span>
            <DevModeToggle />
          </div>
        </>
      }
    >
      <div className={styles.detailPage} data-mode={activeMode}>
        <section className={`${styles.panel} ${styles.heroCard}`} id="summary">
          <ComponentTag
            label="symbol.hero"
            api="/api/trading/quotes/{symbol} + /api/trading/market/status + /api/trading/symbols/search + /api/trading/symbols/{symbol}/price-bars + /api/trading/agent-context/symbol-day + /api/trading/eod/piotroski-filter-results"
          />

          <div className={styles.heroTopRow}>
            <div>
              <p className={styles.sectionEyebrow}>Market Insights</p>
              <div className={styles.heroTitleRow}>
                <h1 className="clamp-3">{introTitle}</h1>
                <p className={styles.heroCompany}>{symbol}</p>
              </div>
            </div>

            <div className={styles.heroControls}>
              <button type="button" className={styles.tradeButton} disabled title="Execution route is disabled on this read-only screen">
                Trade
              </button>
              <button
                type="button"
                className={`${styles.watchBadge} ${isTrackedSymbol ? styles.watchBadgeActive : ""}`.trim()}
                aria-label={trackingButtonLabel}
                aria-pressed={isTrackedSymbol}
                aria-busy={trackingSaving}
                disabled={trackingSaving}
                title={trackingButtonLabel}
                onClick={handleToggleTrackedSymbol}
              >
                <span aria-hidden="true">{isTrackedSymbol ? "★" : "☆"}</span>
              </button>
              {trackingError ? (
                <p className={styles.trackingFeedback} role="status">
                  {trackingError}
                </p>
              ) : null}
            </div>
          </div>

          <div className={styles.heroQuoteBlock}>
            <strong>
              {quote
                ? quote.available
                  ? `₩${formatPrice(quote.price)}`
                  : "N/A"
                : loading
                  ? "Loading..."
                  : "Quote pending"}
            </strong>
            <span className={hasNumber(quote?.change_pct) ? (quote.change_pct >= 0 ? styles.positive : styles.negative) : ""}>
              {quote?.available
                ? `${formatSignedPercent(quote.change_pct)} · ${formatSignedNumber(quote.change)}`
                : quote?.unavailable_reason ?? "Awaiting a fresh quote source"}
            </span>
            {quoteSourceCopy ? <p className={`clamp-3 ${styles.heroCopy}`}>{quoteSourceCopy}</p> : null}
          </div>

          <div className={styles.heroPills}>
            <span className="pill neutral">{marketLabel}</span>
            {marketStateRows.map((item) => (
              <span
                key={item.market}
                className={`pill ${item.state === "OPEN" ? "positive" : item.state === "Not ready" ? "warning" : "info"}`}
              >
                {item.market}: {item.state}
              </span>
            ))}
            <span className={`pill ${quotePollingStopped ? "info" : "warning"}`}>
              {quotePollingStopped ? "Polling stopped" : "Polling active"}
            </span>
          </div>

          <div className={styles.heroMetrics}>
            {heroMetrics.map((metric) => (
              <article key={metric.label} className={styles.heroMetricCard}>
                <span>{metric.label}</span>
                {metric.value ? <strong className={metric.valueClassName}>{metric.value}</strong> : null}
                {metric.rows?.length ? (
                  <dl className={styles.heroMetricList}>
                    {metric.rows.map((row) => (
                      <div key={`${metric.label}-${row.label}`} className={styles.heroMetricRow}>
                        <dt>{row.label}</dt>
                        <dd className={row.valueClassName}>{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
                {metric.detail ? <p className="clamp-3">{metric.detail}</p> : null}
              </article>
            ))}
          </div>
        </section>

        {detailErrors.length > 0 ? (
          <section className={`${styles.panel} ${styles.alertCard}`}>
            <ComponentTag label="symbol.errors" api="client fetch states" />
            <p className={styles.sectionEyebrow}>Data Issues</p>
            <div className={styles.errorList}>
              {detailErrors.map((error) => (
                <div key={error} className={styles.feedback}>
                  {error}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className={`${styles.panel} ${styles.detailNavigator}`}>
          <div>
            <p className={styles.sectionEyebrow}>{activeDetailMode.eyebrow}</p>
            <h2 className={styles.cardTitle}>{activeDetailMode.title}</h2>
          </div>
          <nav className={styles.detailTabs} aria-label="Symbol detail pages">
            {SYMBOL_DETAIL_MODES.map((item) => (
              <button
                key={item.mode}
                type="button"
                aria-pressed={activeMode === item.mode}
                className={`${styles.detailTab} ${activeMode === item.mode ? styles.detailTabActive : ""}`.trim()}
                onClick={(event) => handleDetailModeNavigation(event, item.mode)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </section>

        {showChartSection ? (
        <section className={`${styles.panel} ${styles.chartCard}`} id="chart">
          <ComponentTag
            label="symbol.chart"
            api="/api/trading/symbols/{symbol}/price-bars + /api/trading/quotes/{symbol}"
          />

          <div className={styles.cardHeader}>
            <div>
              <p className={styles.sectionEyebrow}>
                {activeMode === "technical-analysis" ? "Momentum Intelligence Score" : "Historical Performance"}
              </p>
              <h2 className={styles.cardTitle}>
                {activeMode === "technical-analysis" ? "Candlestick view" : "Swipe-aware candlestick chart"}
              </h2>
            </div>

            <div className={styles.rangeRow}>
              {PRICE_HISTORY_RANGES.map((range) => (
                <button
                  key={range}
                  type="button"
                  className={`${styles.rangeButton} ${selectedRange === range ? styles.rangeButtonActive : ""}`.trim()}
                  onClick={() => setSelectedRange(range)}
                >
                  {range}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.focusGrid}>
            <article className={styles.focusCard}>
              <span>Focus date</span>
              <strong>{focusBar?.trade_date ? formatIsoDateLabel(focusBar.trade_date) : historyLoading ? LOADING_LABEL : "No candle selected"}</strong>
              <p className="clamp-3">
                {focusBar
                  ? `Open ${formatPrice(focusBar.open_price)} · High ${formatPrice(focusBar.high_price)} · Low ${formatPrice(focusBar.low_price)}`
                  : "Select a candle to inspect OHLC details."}
              </p>
            </article>
            <article className={styles.focusCard}>
              <span>Close move</span>
              <strong className={hasNumber(focusMovePct) ? (focusMovePct >= 0 ? styles.positive : styles.negative) : ""}>
                {hasNumber(focusMovePct) ? formatSignedPercent(focusMovePct) : "No prior candle"}
              </strong>
              <p className="clamp-3">
                {previousFocusBar
                  ? `Prior close ${formatPrice(previousFocusBar.close_price)} · Current close ${formatPrice(focusBar?.close_price)}`
                  : "Prior close comparison appears once a neighboring candle exists."}
              </p>
            </article>
            <article className={styles.focusCard}>
              <span>Volume</span>
              <strong>{formatCompactNumber(focusBar?.volume)}</strong>
              <p className="clamp-3">
                {focusBar ? `Turnover ${formatTurnover(focusBar.turnover)}` : "Focus any candle for turnover metadata."}
              </p>
            </article>
          </div>

          <div className={styles.chartFrame}>
            {priceHistory && priceHistory.items.length > 0 ? (
              <SymbolHistoryChart
                key={`${symbol}-${selectedRange}`}
                symbol={symbol}
                bars={priceHistory.items}
                onSelectedBarChange={setSelectedBar}
              />
            ) : historyLoading ? (
              <div className={styles.emptyPanel}>
                <strong>Loading stored price history</strong>
                <p className="clamp-3">Requesting the selected historical OHLCV window from trading-core through the BFF.</p>
              </div>
            ) : (
              <div className={styles.emptyPanel}>
                <strong>No stored bars returned</strong>
                <p className="clamp-3">Trading-core did not return any daily price bars for the selected range.</p>
              </div>
            )}
          </div>

          <div className={styles.chartFooter}>
            <span>
              {hasSelectedRangeHistoryLoaded && chartMetrics
                ? `${selectedRange} return ${formatSignedPercent(((chartMetrics.end - chartMetrics.start) / Math.max(chartMetrics.start, 1)) * 100)}`
                : historyHydrating
                  ? `Hydrating ${selectedRange} history`
                  : `${selectedRange} return pending`}
            </span>
            <span>{marketDate ? `Requested market date ${formatIsoDateLabel(marketDate)}` : "Market date pending"}</span>
            <span>{historyHydrating ? "Latest bar loaded. Expanding the selected chart window." : "Swipe or drag the chart to move date focus."}</span>
          </div>
        </section>
        ) : null}

        {showActionSection || showTechnicalSection ? (
        <section className={styles.insightGrid}>
          {showActionSection ? (
          <section className={`${styles.panel} ${styles.insightCard}`} id="action">
            <ComponentTag
              label="symbol.action-summary"
              api="/api/trading/eod/action-summaries + /api/trading/agent-context/symbol-day"
            />

            <div className={styles.cardHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Action Summary</p>
                <h2 className={styles.cardTitle}>Deterministic action layer</h2>
              </div>
              <span className={`pill ${actionTone}`}>{resolvedActionSummary ? humanizeToken(resolvedActionSummary.action_label) : "Unavailable"}</span>
            </div>
            {showOverview ? (
              <button
                type="button"
                className={styles.detailLink}
                onClick={(event) => handleDetailModeNavigation(event, "action-summary")}
              >
                Open action detail
              </button>
            ) : null}

            <div className={styles.signalMeter}>
              <div className={styles.signalTrack}>
                <span className={styles.signalSell}>Sell</span>
                <span className={styles.signalStrong}>Strong Buy</span>
                <div className={styles.signalFill} style={{ width: `${actionScore}%` }} />
              </div>
            </div>

            <strong className={`clamp-3 ${styles.insightHeadline}`}>
              {resolvedActionSummary
                ? `${humanizeToken(resolvedActionSummary.action_label)} bias with ${humanizeToken(resolvedActionSummary.confidence_tier)} confidence`
                : "Action summary is not resolved for this symbol-date packet."}
            </strong>
            <p className={`clamp-3 ${styles.supportingCopy}`}>
              {actionReasons.length > 0
                ? actionReasons.join(" ")
                : "No historical action rationale returned for this symbol-date packet yet."}
            </p>

            <div className={styles.metricGrid}>
              <article className={styles.metricCard}>
                <span>Confidence</span>
                <strong>{humanizeToken(resolvedActionSummary?.confidence_tier)}</strong>
              </article>
              <article className={styles.metricCard}>
                <span>Risk</span>
                <strong>{humanizeToken(resolvedActionSummary?.risk_tier)}</strong>
              </article>
              <article className={styles.metricCard}>
                <span>Trigger</span>
                <strong>
                  {hasNumber(resolvedActionSummary?.trigger_price)
                    ? `₩${formatPrice(resolvedActionSummary?.trigger_price)}`
                    : "No trigger price"}
                </strong>
              </article>
            </div>

            <div className={styles.tagGroup}>
              {(actionReasons.length > 0 ? actionReasons : ["No rationale rows returned"]).map((reason) => (
                <span key={reason} className={styles.tagChip}>
                  {reason}
                </span>
              ))}
            </div>

            <p className={styles.metaCaption}>Payload keys: {actionPayloadTags.join(" · ")}</p>
          </section>
          ) : null}

          {showTechnicalSection ? (
          <section className={`${styles.panel} ${styles.insightCard}`} id="technical">
            <ComponentTag
              label="symbol.technical-analysis"
              api="/api/trading/eod/technical-snapshots + /api/trading/agent-context/symbol-day"
            />

            <div className={styles.cardHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Technical Snapshot</p>
                <h2 className={styles.cardTitle}>Stored snapshot metrics</h2>
              </div>
              <span className={`pill ${technicalTone}`}>
                {resolvedTechnicalSnapshot ? humanizeToken(resolvedTechnicalSnapshot.trend_state) : "Unavailable"}
              </span>
            </div>
            {showOverview ? (
              <button
                type="button"
                className={styles.detailLink}
                onClick={(event) => handleDetailModeNavigation(event, "technical-analysis")}
              >
                Open technical detail
              </button>
            ) : null}

            <strong className={`clamp-3 ${styles.insightHeadline}`}>
              {resolvedTechnicalSnapshot
                ? `${humanizeToken(resolvedTechnicalSnapshot.ma_alignment)} structure`
                : "Technical snapshot is not available for the requested market date."}
            </strong>
            <p className={`clamp-3 ${styles.supportingCopy}`}>
              {resolvedTechnicalSnapshot
                ? `Breakout 20D ${resolvedTechnicalSnapshot.breakout_20d ? "yes" : "no"} · Breakdown 20D ${resolvedTechnicalSnapshot.breakdown_20d ? "yes" : "no"} · Source ${resolvedTechnicalSnapshot.source}`
                : "Only confirmed technical fields from trading-core are rendered here."}
            </p>

            <div className={styles.metricGrid}>
              <article className={styles.metricCard}>
                <span>5D return</span>
                <strong>{formatSignedPercent(resolvedTechnicalSnapshot?.return_5d, "No 5D return")}</strong>
              </article>
              <article className={styles.metricCard}>
                <span>20D return</span>
                <strong>{formatSignedPercent(resolvedTechnicalSnapshot?.return_20d, "No 20D return")}</strong>
              </article>
              <article className={styles.metricCard}>
                <span>Volume ratio 20D</span>
                <strong>{formatNumberOrDash(resolvedTechnicalSnapshot?.volume_ratio_20d)}</strong>
              </article>
              <article className={styles.metricCard}>
                <span>ATR 14</span>
                <strong>{formatNumberOrDash(resolvedTechnicalSnapshot?.atr_14)}</strong>
              </article>
            </div>

            <div className={styles.tagGroup}>
              {technicalPayloadTags.map((tag) => (
                <span key={tag} className={styles.tagChip}>
                  {tag}
                </span>
              ))}
            </div>

            <p className={styles.metaCaption}>
              Source date {resolvedTechnicalSnapshot?.market_date ?? technicalFreshnessDate ?? "No source date"} · Layer freshness is independent from price freshness.
            </p>
          </section>
          ) : null}
        </section>
        ) : null}

        {showFundamentalsSection || showDisclosureSection ? (
        <section className={styles.evidenceGrid}>
          {showFundamentalsSection ? (
          <section className={`${styles.panel} ${styles.evidenceCard}`} id="fundamentals">
            <ComponentTag
              label="symbol.fundamentals-history"
              api="/api/trading/disclosures/dart/fundamentals/history + /api/trading/agent-context/symbol-day"
            />

            <div className={styles.cardHeader}>
              <div>
                <p className={styles.sectionEyebrow}>Fundamentals</p>
                <h2 className={styles.cardTitle}>Stored DART filing history</h2>
              </div>
              <span className={`pill ${buildConfidenceTone(fsDiv)}`}>{fsDiv ?? "Default FS"}</span>
            </div>
            {showOverview ? (
              <button
                type="button"
                className={styles.detailLink}
                onClick={(event) => handleDetailModeNavigation(event, "fundamentals-history")}
              >
                Open fundamentals detail
              </button>
            ) : null}

            <div className={styles.companyStrip}>
              <div className={styles.companyAvatar}>{symbol.slice(0, 1)}</div>
              <div>
                <strong>{introTitle}</strong>
                <p className="clamp-3">
                  Latest filing {buildFundamentalsLatestLabel(latestHistoryEntry, latestFundamentals)}.
                </p>
              </div>
            </div>

            <div className={styles.metricGrid}>
              {latestHighlights.length > 0 ? (
                latestHighlights.map((metric, index) => (
                  <article key={`${formatHighlightLabel(metric, index)}-${index}`} className={styles.metricCard}>
                    <span>{formatHighlightLabel(metric, index)}</span>
                    <strong>{formatHighlightValue(metric)}</strong>
                  </article>
                ))
              ) : (
                <article className={styles.metricCard}>
                  <span>Latest filing</span>
                  <strong>{buildFundamentalsLatestLabel(latestHistoryEntry, latestFundamentals)}</strong>
                </article>
              )}
            </div>

            <div className={styles.historyList}>
              {companyHistory?.entries.length ? (
                companyHistory.entries.slice(0, fundamentalsEntryLimit).map((entry) => {
                  const visibleHighlights = buildHistoryEntryMetrics(entry);

                  return (
                    <article key={entry.filing.rcept_no} className={styles.historyCard}>
                      <div className={styles.historyHeader}>
                        <div>
                          <strong className="clamp-3">
                            {entry.period.report_label ??
                              `${entry.period.business_year ?? "Unknown year"} ${entry.period.report_code ?? ""}`}
                          </strong>
                          <p className="clamp-3">
                            {entry.filing.report_nm ?? "Unnamed filing"} · Receipt {entry.filing.receipt_date ?? "No receipt date"}
                          </p>
                        </div>
                        <span className="pill neutral">{entry.statement.fs_div ?? "FS pending"}</span>
                      </div>
                      <div className={styles.historyMetrics}>
                        {visibleHighlights.map((metric, index) => (
                          <div key={`${entry.filing.rcept_no}-${formatHighlightLabel(metric, index)}-${index}`} className={styles.historyMetricRow}>
                            <span>{formatHighlightLabel(metric, index)}</span>
                            <strong>{formatHighlightValue(metric)}</strong>
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })
              ) : fundamentalsLoading ? (
                <div className={styles.emptyPanel}>
                  <strong>Loading fundamentals history</strong>
                  <p className="clamp-3">Requesting DART filing history through the trading-web BFF.</p>
                </div>
              ) : (
                <div className={styles.emptyPanel}>
                  <strong>No stored fundamentals history</strong>
                  <p className="clamp-3">{buildFundamentalsCoverageNote(companyHistory, latestFundamentals)}</p>
                </div>
              )}
            </div>
          </section>
          ) : null}

          {showDisclosureSection ? (
          <section className={`${styles.panel} ${styles.evidenceCard}`} id="disclosures">
            <ComponentTag label="symbol.disclosures" api="/api/trading/agent-context/symbol-day" />

            <div className={styles.cardHeader}>
              <div>
                <p className={styles.sectionEyebrow}>DART Disclosures</p>
                <h2 className={styles.cardTitle}>Recent filing coverage</h2>
              </div>
              <span className={`pill ${disclosureSectionState === "list" ? "info" : disclosureSectionState === "empty" ? "neutral" : "warning"}`}>
                {aggregateContext?.recent_disclosures.count ?? 0} items
              </span>
            </div>
            {showOverview ? (
              <button
                type="button"
                className={styles.detailLink}
                onClick={(event) => handleDetailModeNavigation(event, "disclosure-coverage")}
              >
                Open disclosure detail
              </button>
            ) : null}

            {disclosureSectionState === "list" ? (
              <div className={styles.disclosureList}>
                {aggregateContext?.recent_disclosures.items.slice(0, disclosureItemLimit).map((item) => (
                  <Link
                    key={item.rcept_no}
                    className={styles.disclosureCard}
                    href={buildDisclosureReportHref(symbol, item, routeQueryString)}
                    aria-label={`Open report detail for ${item.report_nm}`}
                  >
                    <div className={styles.disclosureHeader}>
                      <strong className="clamp-3">{item.report_nm}</strong>
                      <span className="pill neutral">{item.receipt_date ?? "No receipt date"}</span>
                    </div>
                    <p className="clamp-3">
                      {humanizeToken(item.filing_category, "No category")} · Capture{" "}
                      {humanizeToken(item.fundamentals_capture_status, "Not captured")}
                    </p>
                    <div className={styles.disclosureMeta}>
                      <span>Receipt {item.receipt_date ?? "No receipt date"}</span>
                      <span>Rcept {item.rcept_no}</span>
                    </div>
                    <span className={styles.disclosureAction}>View report detail</span>
                  </Link>
                ))}
              </div>
            ) : disclosureSectionState === "loading" ? (
              <div className={styles.emptyPanel}>
                <strong>Loading disclosure coverage</strong>
                <p className="clamp-3">Waiting for the aggregate symbol-day payload before rendering disclosure availability.</p>
              </div>
            ) : disclosureSectionState === "empty" ? (
              <div className={styles.emptyPanel}>
                <strong>No Disclosure Found</strong>
                <p className="clamp-3">Aggregate context succeeded, but no recent disclosure rows were attached to this symbol-day packet.</p>
              </div>
            ) : (
              <div className={styles.emptyPanel}>
                <strong>Disclosure coverage unavailable</strong>
                <p className="clamp-3">Recent disclosure coverage could not be confirmed because the aggregate route is currently unavailable.</p>
              </div>
            )}

            <div className={styles.coverageNote}>
              <strong>{latestDisclosure ? "Latest disclosure available" : "Partial analyst coverage"}</strong>
              <p className="clamp-3">
                {buildDisclosureCoverageNote(latestDisclosure, aggregateContext?.recent_disclosures.count ?? 0)}
              </p>
            </div>
          </section>
          ) : null}
        </section>
        ) : null}

        {showFreshnessSection ? (
        <section className={`${styles.panel} ${styles.freshnessCard}`} id="freshness">
          <ComponentTag
            label="symbol.system-freshness"
            api="/api/trading/eod/freshness + /api/trading/quotes/{symbol}"
          />

          <div className={styles.cardHeader}>
            <div>
              <p className={styles.sectionEyebrow}>Operational Integrity</p>
              <h2 className={styles.cardTitle}>Layer-specific freshness registry</h2>
            </div>
            <span className={`pill ${freshnessTone}`}>{humanizeToken(freshness?.today?.eod_status, "Status pending")}</span>
          </div>
          {showOverview ? (
            <button
              type="button"
              className={styles.detailLink}
              onClick={(event) => handleDetailModeNavigation(event, "system-freshness")}
            >
              Open freshness detail
            </button>
          ) : null}

          <div className={styles.metricGrid}>
            <article className={styles.metricCard}>
              <span>EOD trade date</span>
              <strong>{freshness?.today?.trade_date ?? marketDate ?? DATE_PENDING_LABEL}</strong>
            </article>
            <article className={styles.metricCard}>
              <span>Price latest</span>
              <strong>{freshness?.latest?.price_trade_date ?? quote?.trade_date ?? formatDisplayTimestamp(quote?.cached_at, "Quote pending")}</strong>
            </article>
            <article className={styles.metricCard}>
              <span>Technical latest</span>
              <strong>{technicalFreshnessDate ?? "No technical date"}</strong>
            </article>
            <article className={styles.metricCard}>
              <span>Action latest</span>
              <strong>{actionFreshnessDate ?? "No action date"}</strong>
            </article>
          </div>

          <div className={styles.moduleRows}>
            {moduleRows.map((row) => (
              <article key={row.id} className={styles.moduleRow}>
                <div>
                  <strong>{row.label}</strong>
                  <p className="clamp-3">{row.detail}</p>
                  <span className={styles.moduleApi}>{row.api}</span>
                </div>
                <div className={styles.moduleAside}>
                  <span>{row.date}</span>
                  <span className={`pill ${row.tone}`}>{row.status}</span>
                </div>
            </article>
          ))}
          </div>
        </section>
        ) : null}
      </div>
    </MobileAppChrome>
  );
}
