"use client";

import Link from "next/link";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { type MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from "react";

import { ComponentTag } from "@/components/dev/component-tag";
import { DevModeToggle } from "@/components/dev/dev-mode-toggle";
import { MobileAppChrome } from "@/components/mobile/mobile-app-chrome";
import { useAppState } from "@/components/providers/app-state-provider";
import { FullPageLoadingScreen } from "@/components/ui/full-page-loading";
import { getSymbolDetailCopy, type SymbolDetailCopy } from "@/i18n/symbol-detail-copy";
import { getNumberLocale } from "@/lib/locale";
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
  Locale,
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

async function loadTrackedSymbolsSnapshot(copy: SymbolDetailCopy) {
  const result = await getJsonResult<TrackedSymbolsResponse>("/api/trading/scanner/tracked-symbols");
  if (!result.ok) {
    return {
      ok: false as const,
      message: `${copy.errors.trackingStatusUnavailable} HTTP ${result.status}`,
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

function formatSignedNumber(value: number | null | undefined, fallback = "Unavailable", numberLocale = "en-US") {
  if (!hasNumber(value)) return fallback;
  return `${value >= 0 ? "+" : ""}${value.toLocaleString(numberLocale)}`;
}

function formatCompactNumber(
  value: number | string | null | undefined,
  fallback = "Unavailable",
  numberLocale = "en-US",
) {
  if (typeof value === "number") {
    return new Intl.NumberFormat(numberLocale, {
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

function formatQuantity(value: number | null | undefined, fallback = "Unavailable", numberLocale = "en-US") {
  return hasNumber(value) ? value.toLocaleString(numberLocale) : fallback;
}

function formatNumberOrDash(value: number | null | undefined, fallback = "Unavailable") {
  return hasNumber(value) ? value.toFixed(2) : fallback;
}

function humanizeToken(value: string | null | undefined, fallback = "Unavailable") {
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

function formatIsoDateLabel(value: string | null | undefined, fallback = "Date pending") {
  if (!value) return fallback;
  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${year}.${month}.${day}`;
}

function buildQuoteSourceLabel(quote: QuoteResponse | null, copy: SymbolDetailCopy) {
  if (!quote) return copy.hero.quotePending;
  if (!quote.available) {
    const unavailableLabel = copy.freshness.quoteCoverageUnavailable.replace(/\.$/, "");
    return quote.unavailable_reason
      ? `${unavailableLabel} ${quote.unavailable_reason}.`
      : copy.freshness.quoteCoverageUnavailable;
  }
  if (quote.is_live) return copy.freshness.live;
  if (quote.source === "daily_price_bar") {
    return quote.trade_date
      ? `최신 업데이트 : ${quote.trade_date}`
      : copy.freshness.dailyPriceBarFallbackPath;
  }
  if (quote.fallback) return `${quote.source} ${copy.freshness.fallbackPathSuffix}`;
  return `${quote.source} ${copy.freshness.quoteSourceSuffix}`;
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

function formatHighlightValue(metric: DartFundamentalsHistoryMetricDto, copy: SymbolDetailCopy) {
  return formatCompactNumber(metric.value, copy.fundamentals.notReported);
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
  copy: SymbolDetailCopy,
) {
  return (
    latestHistoryEntry?.filing.report_nm ??
    latestFundamentals?.filing.report_name ??
    latestHistoryEntry?.period.report_label ??
    latestFundamentals?.period.report_label ??
    (latestFundamentals?.period.business_year ? `FY ${latestFundamentals.period.business_year}` : null) ??
    copy.fundamentals.noFilingLoaded
  );
}

function buildFundamentalsMetricFallbacks(
  latestFundamentals: AgentContextFundamentalsSummaryDto["latest_snapshot"] | null,
  latestHistoryEntry: DartFundamentalsHistoryEntryDto | null,
  copy: SymbolDetailCopy,
) {
  const metrics: DartFundamentalsHistoryMetricDto[] = [];
  const filingLabel = buildFundamentalsLatestLabel(latestHistoryEntry, latestFundamentals, copy);
  metrics.push({ metric_key: "latest_filing", label: copy.fundamentals.latestFiling, value: filingLabel });

  const periodLabel =
    latestHistoryEntry?.period.report_label ??
    latestFundamentals?.period.report_label ??
    latestHistoryEntry?.period.period_end_date ??
    latestFundamentals?.period.period_end_date ??
    null;
  if (periodLabel) {
    metrics.push({ metric_key: "period", label: copy.fundamentals.period, value: periodLabel });
  }

  if (hasNumber(latestFundamentals?.statement.row_count)) {
    metrics.push({
      metric_key: "statement_rows",
      label: copy.fundamentals.statementRows,
      value: latestFundamentals.statement.row_count,
    });
  }

  return metrics.slice(0, 3);
}

function buildHistoryEntryMetrics(entry: DartFundamentalsHistoryEntryDto, copy: SymbolDetailCopy) {
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
      label: copy.fundamentals.periodEnd,
      value: entry.period.period_end_date ?? entry.period.report_label ?? copy.fundamentals.noPeriodDate,
    },
    {
      metric_key: "filing_receipt",
      label: copy.fundamentals.receipt,
      value: entry.filing.receipt_date ?? copy.fundamentals.noReceiptDate,
    },
  ];
}

function buildFundamentalsCoverageNote(
  companyHistory: DartFundamentalsHistoryCompanyDto | null,
  latestFundamentals: AgentContextFundamentalsSummaryDto["latest_snapshot"] | null,
  copy: SymbolDetailCopy,
) {
  if (companyHistory?.entries.length) {
    const count = companyHistory.entries.length.toLocaleString();
    const separator = /^[A-Za-z]/.test(copy.fundamentals.storedPeriodsLoadedSuffix) ? " " : "";
    return `${count}${separator}${copy.fundamentals.storedPeriodsLoadedSuffix}`;
  }

  if (latestFundamentals) {
    return `${copy.fundamentals.aggregateContextHas} ${latestFundamentals.filing.report_name ?? copy.fundamentals.latestFiling} ${copy.fundamentals.from} ${latestFundamentals.filing.receipt_date ?? latestFundamentals.period.period_end_date ?? copy.fundamentals.noPeriodDate}.`;
  }

  return copy.fundamentals.coverageMissing;
}

function buildFocusCandleRows(focusBar: SymbolPriceBarDto | null, copy: SymbolDetailCopy, numberLocale: string): HeroMetricRow[] {
  if (!focusBar) return [];

  return [
    { label: copy.chart.open, value: formatPrice(focusBar.open_price) },
    { label: copy.chart.close, value: formatPrice(focusBar.close_price) },
    { label: copy.chart.volume, value: formatQuantity(focusBar.volume, copy.common.unavailable, numberLocale) },
    { label: copy.chart.highest, value: formatPrice(focusBar.high_price) },
    { label: copy.chart.lowest, value: formatPrice(focusBar.low_price) },
  ];
}

function buildDisclosureCoverageNote(
  latestDisclosure: AgentContextDisclosureDto | null,
  disclosureCount: number,
  copy: SymbolDetailCopy,
) {
  if (disclosureCount > 0 && latestDisclosure) {
    const count = disclosureCount.toLocaleString();
    const separator = /^[A-Za-z]/.test(copy.disclosures.loadedSuffix) ? " " : "";
    return `${count}${separator}${copy.disclosures.loadedSuffix} ${copy.disclosures.latestFilingLandedOn} ${latestDisclosure.receipt_date ?? copy.disclosures.unavailableReceiptDate}.`;
  }

  return copy.disclosures.emptyTitle;
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

function resolveMarketStateValue(value: string | null | undefined, copy: SymbolDetailCopy) {
  const state = normalizeMarketCode(value);
  if (state === "OPEN") return copy.header.marketStates.open;
  if (state === "CLOSED") return copy.header.marketStates.closed;
  if (state === "PREOPEN") return copy.header.marketStates.preopen;
  if (state === "POSTCLOSE") return copy.header.marketStates.postclose;
  return value ?? copy.header.marketStates.notReady;
}

function resolveMarketStateLabel(item: MarketStatusItem, copy: SymbolDetailCopy) {
  if (item.ready === false || item.available === false) return copy.header.marketStates.notReady;
  return resolveMarketStateValue(item.state, copy);
}

function getRelevantMarketStatusCodes(market: string) {
  if (market === "KOSPI") return ["KOSPI", "KRX"];
  if (market === "KONEX") return ["KONEX", "KRX"];
  return [market];
}

function buildMarketStateRows(
  marketStatus: MarketStatusResponse | null,
  fallbackMarket: string | null | undefined,
  copy: SymbolDetailCopy,
) {
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
      return item
        ? [{
            market: relevantCode,
            state: resolveMarketStateLabel(item, copy),
            stateCode: normalizeMarketCode(item.state),
            isReady: item.ready !== false && item.available !== false,
          }]
        : [];
    }

    const fallbackState = resolveMarketStateValue(marketStatus?.state, copy);
    return fallbackState === copy.header.marketStates.notReady
      ? []
      : [{
          market: normalizedFallback,
          state: fallbackState,
          stateCode: normalizeMarketCode(marketStatus?.state),
          isReady: true,
        }];
  }

  return items
    .map((item) => {
      const market = normalizeMarketCode(item.market ?? item.label);
      if (!market) return null;
      return {
        market,
        state: resolveMarketStateLabel(item, copy),
        stateCode: normalizeMarketCode(item.state),
        isReady: item.ready !== false && item.available !== false,
      };
    })
    .filter((row): row is { market: string; state: string; stateCode: string | null; isReady: boolean } => row !== null);
}

function getTrackingButtonLabel(
  locale: Locale,
  symbol: string,
  trackedSymbolsLoaded: boolean,
  isTrackedSymbol: boolean,
  trackingSaving: boolean,
) {
  if (trackingSaving) {
    return locale === "ko" ? `${symbol} 추적 종목 상태 업데이트 중` : "Updating tracked-symbol membership";
  }

  if (!trackedSymbolsLoaded) {
    return locale === "ko" ? `${symbol} 추적 종목 상태 확인 중` : `${symbol} tracked-symbol status pending`;
  }

  if (isTrackedSymbol) {
    return locale === "ko" ? `${symbol}를 추적 종목에서 제거` : `Remove ${symbol} from tracked symbols`;
  }

  return locale === "ko" ? `${symbol}를 추적 종목에 추가` : `Add ${symbol} to tracked symbols`;
}

function getPiotroskiLabel(
  piotroskiResult: EodPiotroskiFilterResultItemDto | null,
  piotroskiLoadState: AggregateContextLoadState,
  copy: SymbolDetailCopy,
) {
  if (piotroskiResult) {
    return piotroskiResult.passed_filter ? copy.common.pass : copy.common.fail;
  }

  if (piotroskiLoadState === "loading") return copy.common.loading;
  if (piotroskiLoadState === "error") return copy.common.unavailable;
  return copy.common.pending;
}

function buildActionHeadline(
  actionSummary: AgentContextActionSummaryDto | null,
  copy: SymbolDetailCopy,
) {
  if (!actionSummary) return copy.action.emptyHeadline;
  return `${humanizeToken(actionSummary.action_label)} · ${copy.action.confidence} ${humanizeToken(actionSummary.confidence_tier)}`;
}

function buildTechnicalHeadline(
  technicalSnapshot: AgentContextTechnicalSnapshotDto | null,
  copy: SymbolDetailCopy,
) {
  if (!technicalSnapshot) return copy.technical.emptyHeadline;
  return `${copy.technical.maAlignment} ${humanizeToken(technicalSnapshot.ma_alignment)}`;
}

export function SymbolDetailClient({ mode = "overview", symbol: serverSymbol }: SymbolDetailClientProps) {
  const { locale } = useAppState();
  const copy = getSymbolDetailCopy(locale);
  const numberLocale = getNumberLocale(locale);
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
  const localizedModes = useMemo(
    () => ({
      overview: {
        label: copy.modes.overview.label,
        eyebrow: copy.modes.overview.eyebrow,
        title: copy.modes.overview.title,
      },
      "action-summary": {
        label: copy.modes.actionSummary.label,
        eyebrow: copy.modes.actionSummary.eyebrow,
        title: copy.modes.actionSummary.title,
      },
      "technical-analysis": {
        label: copy.modes.technicalAnalysis.label,
        eyebrow: copy.modes.technicalAnalysis.eyebrow,
        title: copy.modes.technicalAnalysis.title,
      },
      "fundamentals-history": {
        label: copy.modes.fundamentalsHistory.label,
        eyebrow: copy.modes.fundamentalsHistory.eyebrow,
        title: copy.modes.fundamentalsHistory.title,
      },
      "disclosure-coverage": {
        label: copy.modes.disclosureCoverage.label,
        eyebrow: copy.modes.disclosureCoverage.eyebrow,
        title: copy.modes.disclosureCoverage.title,
      },
      "system-freshness": {
        label: copy.modes.systemFreshness.label,
        eyebrow: copy.modes.systemFreshness.eyebrow,
        title: copy.modes.systemFreshness.title,
      },
    }),
    [copy],
  );

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
        const result = await loadTrackedSymbolsSnapshot(copy);
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
        setTrackingError(copy.errors.trackingStatusUnavailable);
      }
    };

    void loadTrackedSymbols();
    return () => {
      active = false;
    };
  }, [copy, symbol, symbolReady]);

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
        setMetaError(exactMatch ? null : copy.errors.masterSymbolNotFound);
      } catch (metaLoadError) {
        console.error("Symbol metadata load failed", metaLoadError);
        if (!active) return;
        setMetaError(copy.errors.masterSymbolUnavailable);
      }
    };

    loadMeta();

    return () => {
      active = false;
    };
  }, [copy, initialMeta, symbol, symbolReady]);

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
        setQuoteError(copy.errors.quoteUnavailable);
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
  }, [copy, symbol, symbolReady]);

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
        setHistoryError(copy.errors.historyUnavailable);
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
  }, [copy, hasFinishedInitialLoad, marketDate, shouldLoadPriceHistory, symbol, symbolReady]);

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
          setHistoryError(copy.errors.historyUnavailable);
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
  }, [copy, hasFinishedInitialLoad, marketDate, priceHistory, selectedRange, shouldLoadPriceHistory, symbol, symbolReady]);

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
        setContextError(exactMatch ? null : copy.errors.aggregateMissing);
      } catch (aggregateLoadError) {
        console.error("Aggregate symbol context load failed", aggregateLoadError);
        if (!active) return;
        setAggregateContext(null);
        setAggregateContextLoadState("error");
        setContextError(copy.errors.aggregateUnavailable);
      }
    };

    loadAggregateContext();

    return () => {
      active = false;
    };
  }, [copy, disclosureItemLimit, fsDiv, marketDate, shouldLoadAggregateContext, symbol, symbolReady]);

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
        setFundamentalsError(copy.errors.fundamentalsUnavailable);
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
  }, [copy, fsDiv, fundamentalsHistory, marketDate, shouldLoadFundamentalsHistory, symbol, symbolReady]);

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
      ? buildFundamentalsLatestLabel(latestHistoryEntry, latestFundamentals, copy)
      : null);
  const latestFundamentalEventDate = latestDisclosure?.receipt_date ?? fundamentalsDate;
  const piotroskiLabel = getPiotroskiLabel(piotroskiResult, piotroskiLoadState, copy);
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
        : buildFundamentalsMetricFallbacks(latestFundamentals, latestHistoryEntry, copy);
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
  const marketLabel =
    aggregateMarket ?? metaMarket ?? (quote?.market_state ? resolveMarketStateValue(quote.market_state, copy) : copy.header.marketPending);
  const quoteSourceCopy = quote?.is_live ? null : buildQuoteSourceLabel(quote, copy);
  const detailErrors = [quoteError, metaError, historyError, contextError, fundamentalsError].filter(
    (value): value is string => Boolean(value),
  );
  const isTrackedSymbol = trackedSymbols.includes(normalizedSymbol);
  const trackingButtonLabel = getTrackingButtonLabel(
    locale,
    normalizedSymbol,
    trackedSymbolsLoaded,
    isTrackedSymbol,
    trackingSaving,
  );

  const handleToggleTrackedSymbol = async () => {
    if (trackingSaving) return;

    if (!normalizedSymbol) {
      setTrackingError(copy.errors.trackingUpdateUnavailable);
      return;
    }

    setTrackingSaving(true);
    setTrackingError(null);

    try {
      invalidateTradingApiCacheByPathPrefix([
        "/api/trading/scanner/tracked-symbols",
        "/api/trading/quotes/tracked",
      ]);
      const currentResult = await loadTrackedSymbolsSnapshot(copy);
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
        setTrackingError(`${copy.errors.trackingUpdateFailed} HTTP ${result.status}`);
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
      setTrackingError(copy.errors.trackingUpdateFailed);
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
  const focusCandleRows = buildFocusCandleRows(focusBar, copy, numberLocale);
  const focusCandleValue =
    focusCandleRows.length > 0
      ? null
      : shouldLoadPriceHistory
        ? historyLoading
          ? copy.hero.priceLoading
          : copy.chart.noCandleSelected
        : copy.chart.technicalTitle;
  const focusCandleDetail =
    focusCandleRows.length > 0
      ? null
      : shouldLoadPriceHistory
        ? copy.chart.selectCandle
        : copy.chart.selectCandle;

  const heroMetrics: HeroMetric[] = [
    {
      label: copy.hero.focusCandle,
      value: focusCandleValue,
      detail: focusCandleDetail,
      rows: focusCandleRows,
    },
    {
      label: copy.hero.fundamentalLatest,
      value:
        latestFundamentalEventLabel ??
        (aggregateContextLoadState === "loading" || fundamentalsLoading ? copy.hero.priceLoading : copy.disclosures.emptyTitle),
      detail: latestFundamentalEventDate ? formatIsoDateLabel(latestFundamentalEventDate) : null,
    },
    {
      label: copy.hero.piotroskiFilter,
      value: piotroskiLabel,
      valueClassName: piotroskiValueClassName,
      detail: null,
    },
    {
      label: copy.hero.recommendation,
      value: copy.hero.comingSoon,
      detail: null,
    },
  ];

  const actionReasons = resolvedActionSummary?.reasons.slice(0, 4) ?? [];
  const actionPayloadTags = buildInsightTags(resolvedActionSummary?.summary_payload);
  const technicalPayloadTags = buildInsightTags(resolvedTechnicalSnapshot?.signal_payload);
  const actionTone = buildActionTone(resolvedActionSummary);
  const technicalTone = buildTechnicalTone(resolvedTechnicalSnapshot);
  const freshnessTone = buildFreshnessTone(freshness?.today?.eod_status);
  const marketStateRows = useMemo(() => buildMarketStateRows(marketStatus, metaMarket, copy), [copy, marketStatus, metaMarket]);
  const toolbarMarketOpenState = getMarketOpenState(marketStatus);
  const toolbarMarketBadgeLabel =
    toolbarMarketOpenState === null
      ? copy.header.marketPending
      : toolbarMarketOpenState
        ? copy.header.marketOpen
        : copy.header.marketClosed;
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
    return <FullPageLoadingScreen label={copy.loadingWorkspace} />;
  }

  const moduleRows = [
    {
      id: "price",
      label: copy.freshness.priceModule,
      date: freshness?.latest?.price_trade_date ?? quote?.trade_date ?? formatDisplayTimestamp(quote?.cached_at, copy.hero.quotePending),
      detail: quote?.available ? buildQuoteSourceLabel(quote, copy) : quote?.unavailable_reason ?? copy.freshness.quoteCoverageUnavailable,
      tone: buildModuleStatusTone(Boolean(quote?.available)),
      status: quote?.available ? (quote?.is_live ? copy.freshness.live : copy.freshness.fallback) : copy.freshness.unavailable,
      api: "/api/trading/quotes/{symbol}",
    },
    {
      id: "technical",
      label: copy.freshness.technicalModule,
      date: technicalFreshnessDate ?? copy.freshness.noTechnicalDate,
      detail: resolvedTechnicalSnapshot
        ? `${humanizeToken(resolvedTechnicalSnapshot.trend_state)} · ${copy.technical.maAlignment} ${humanizeToken(resolvedTechnicalSnapshot.ma_alignment)}`
        : copy.freshness.technicalUnavailable,
      tone: resolvedTechnicalSnapshot || freshness?.technical?.success ? technicalTone : "warning",
      status: resolvedTechnicalSnapshot ? copy.freshness.synced : freshness?.technical?.success ? copy.freshness.synced : copy.freshness.pending,
      api: "/api/trading/eod/technical-snapshots",
    },
    {
      id: "action",
      label: copy.freshness.actionModule,
      date: actionFreshnessDate ?? copy.freshness.noActionDate,
      detail: resolvedActionSummary
        ? `${humanizeToken(resolvedActionSummary.action_label)} · ${copy.action.risk} ${humanizeToken(resolvedActionSummary.risk_tier)}`
        : copy.freshness.actionUnavailable,
      tone: resolvedActionSummary ? actionTone : "warning",
      status: resolvedActionSummary ? copy.freshness.resolved : copy.freshness.pending,
      api: "/api/trading/eod/action-summaries",
    },
    {
      id: "fundamentals",
      label: copy.freshness.fundamentalsModule,
      date: fundamentalsDate ?? copy.fundamentals.noReceiptDate,
      detail: buildFundamentalsCoverageNote(companyHistory, latestFundamentals, copy),
      tone: companyHistory?.entries.length || latestFundamentals ? "info" : "warning",
      status: companyHistory?.entries.length ? copy.freshness.historyLoaded : latestFundamentals ? copy.freshness.aggregateOnly : copy.freshness.noHistory,
      api: "/api/trading/disclosures/dart/fundamentals/history",
    },
    {
      id: "disclosures",
      label: copy.freshness.disclosuresModule,
      date:
        latestDisclosure?.receipt_date ??
        (disclosureSectionState === "loading"
          ? copy.common.loading
          : disclosureSectionState === "empty"
            ? copy.freshness.noDisclosures
            : copy.freshness.unavailable),
      detail: buildDisclosureCoverageNote(
        latestDisclosure,
        aggregateContext?.recent_disclosures.count ?? 0,
        copy,
      ),
      tone:
        disclosureSectionState === "list"
          ? "info"
          : disclosureSectionState === "empty"
            ? "neutral"
            : "warning",
      status:
        disclosureSectionState === "list"
          ? copy.freshness.coverage
          : disclosureSectionState === "empty"
            ? copy.freshness.empty
            : disclosureSectionState === "loading"
              ? copy.freshness.loading
              : copy.freshness.unavailable,
      api: "/api/trading/agent-context/symbol-day",
    },
  ] as const;
  const activeDetailMode = localizedModes[activeMode];
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
            <Link href="/dashboard" className={styles.backButton} aria-label={copy.header.backToDashboard}>
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
              <p className={styles.sectionEyebrow}>{copy.hero.eyebrow}</p>
              <div className={styles.heroTitleRow}>
                <h1 className="clamp-3">{introTitle}</h1>
                <p className={styles.heroCompany}>{symbol}</p>
              </div>
            </div>

            <div className={styles.heroControls}>
              <button type="button" className={styles.tradeButton} disabled title={copy.hero.tradeDisabledTitle}>
                {copy.hero.trade}
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
                  : copy.common.notAvailable
                : loading
                  ? copy.hero.priceLoading
                  : copy.hero.quotePending}
            </strong>
            <span className={hasNumber(quote?.change_pct) ? (quote.change_pct >= 0 ? styles.positive : styles.negative) : ""}>
              {quote?.available
                ? `${formatSignedPercent(quote.change_pct, copy.common.unavailable)} · ${formatSignedNumber(quote.change, copy.common.unavailable, numberLocale)}`
                : quote?.unavailable_reason ?? copy.hero.awaitingQuoteSource}
            </span>
            {quoteSourceCopy ? <p className={`clamp-3 ${styles.heroCopy}`}>{quoteSourceCopy}</p> : null}
          </div>

          <div className={styles.heroPills}>
            <span className="pill neutral">{marketLabel}</span>
            {marketStateRows.map((item) => (
              <span
                key={item.market}
                className={`pill ${item.stateCode === "OPEN" ? "positive" : !item.isReady || item.stateCode === null ? "warning" : "info"}`}
              >
                {item.market}: {item.state}
              </span>
            ))}
            <span className={`pill ${quotePollingStopped ? "info" : "warning"}`}>
              {quotePollingStopped ? copy.hero.pollingStopped : copy.hero.pollingActive}
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
            <p className={styles.sectionEyebrow}>{copy.errors.dataIssues}</p>
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
          <nav className={styles.detailTabs} aria-label={copy.modes.tabsAriaLabel}>
            {SYMBOL_DETAIL_MODES.map((item) => (
              <button
                key={item.mode}
                type="button"
                aria-pressed={activeMode === item.mode}
                className={`${styles.detailTab} ${activeMode === item.mode ? styles.detailTabActive : ""}`.trim()}
                onClick={(event) => handleDetailModeNavigation(event, item.mode)}
              >
                {localizedModes[item.mode].label}
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
                {activeMode === "technical-analysis" ? copy.chart.technicalEyebrow : copy.chart.overviewEyebrow}
              </p>
              <h2 className={styles.cardTitle}>
                {activeMode === "technical-analysis" ? copy.chart.technicalTitle : copy.chart.overviewTitle}
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
              <span>{copy.chart.focusDate}</span>
              <strong>
                {focusBar?.trade_date
                  ? formatIsoDateLabel(focusBar.trade_date, copy.common.datePending)
                  : historyLoading
                    ? copy.common.loading
                    : copy.chart.noCandleSelected}
              </strong>
              <p className="clamp-3">
                {focusBar
                  ? `${copy.chart.open} ${formatPrice(focusBar.open_price)} · ${copy.chart.highest} ${formatPrice(focusBar.high_price)} · ${copy.chart.lowest} ${formatPrice(focusBar.low_price)}`
                  : copy.chart.selectCandle}
              </p>
            </article>
            <article className={styles.focusCard}>
              <span>{copy.chart.closeMove}</span>
              <strong className={hasNumber(focusMovePct) ? (focusMovePct >= 0 ? styles.positive : styles.negative) : ""}>
                {hasNumber(focusMovePct) ? formatSignedPercent(focusMovePct, copy.common.unavailable) : copy.chart.noPriorCandle}
              </strong>
              <p className="clamp-3">
                {previousFocusBar
                  ? `${copy.chart.priorClose} ${formatPrice(previousFocusBar.close_price)} · ${copy.chart.currentClose} ${formatPrice(focusBar?.close_price)}`
                  : copy.chart.priorCloseComparison}
              </p>
            </article>
            <article className={styles.focusCard}>
              <span>{copy.chart.volume}</span>
              <strong>{formatCompactNumber(focusBar?.volume, copy.common.unavailable, numberLocale)}</strong>
              <p className="clamp-3">
                {focusBar ? `${copy.chart.turnover} ${formatTurnover(focusBar.turnover)}` : copy.chart.turnover}
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
                <strong>{copy.chart.loadingTitle}</strong>
                <p className="clamp-3">{copy.chart.loadingBody}</p>
              </div>
            ) : (
              <div className={styles.emptyPanel}>
                <strong>{copy.chart.emptyTitle}</strong>
                <p className="clamp-3">{copy.chart.emptyBody}</p>
              </div>
            )}
          </div>

          <div className={styles.chartFooter}>
            <span>
              {hasSelectedRangeHistoryLoaded && chartMetrics
                ? `${selectedRange} ${copy.chart.returnLabel} ${formatSignedPercent(((chartMetrics.end - chartMetrics.start) / Math.max(chartMetrics.start, 1)) * 100)}`
                : historyHydrating
                  ? `${copy.chart.hydratingPrefix} ${selectedRange} ${copy.chart.historySuffix}`.trim()
                  : `${selectedRange} ${copy.chart.returnPendingSuffix}`}
            </span>
            <span>{marketDate ? `${copy.chart.requestedMarketDate} ${formatIsoDateLabel(marketDate, copy.common.datePending)}` : copy.chart.marketDatePending}</span>
            <span>{historyHydrating ? copy.chart.loadingTitle : copy.chart.swipeHint}</span>
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
	                <p className={styles.sectionEyebrow}>{copy.action.eyebrow}</p>
	                <h2 className={styles.cardTitle}>{copy.action.title}</h2>
	              </div>
              <span className={`pill ${actionTone}`}>{resolvedActionSummary ? humanizeToken(resolvedActionSummary.action_label) : copy.action.unavailable}</span>
            </div>
            {showOverview ? (
              <button
                type="button"
                className={styles.detailLink}
                onClick={(event) => handleDetailModeNavigation(event, "action-summary")}
              >
                {copy.action.openDetail}
              </button>
            ) : null}

            <div className={styles.signalMeter}>
              <div className={styles.signalTrack}>
                <span className={styles.signalSell}>{copy.action.sell}</span>
                <span className={styles.signalStrong}>{copy.action.strongBuy}</span>
                <div className={styles.signalFill} style={{ width: `${actionScore}%` }} />
              </div>
            </div>

            <strong className={`clamp-3 ${styles.insightHeadline}`}>
              {buildActionHeadline(resolvedActionSummary, copy)}
            </strong>
            <p className={`clamp-3 ${styles.supportingCopy}`}>
              {actionReasons.length > 0
                ? actionReasons.join(" ")
                : copy.action.emptyBody}
            </p>

            <div className={styles.metricGrid}>
              <article className={styles.metricCard}>
                <span>{copy.action.confidence}</span>
                <strong>{humanizeToken(resolvedActionSummary?.confidence_tier)}</strong>
              </article>
              <article className={styles.metricCard}>
                <span>{copy.action.risk}</span>
                <strong>{humanizeToken(resolvedActionSummary?.risk_tier)}</strong>
              </article>
              <article className={styles.metricCard}>
                <span>{copy.action.trigger}</span>
                <strong>
                  {hasNumber(resolvedActionSummary?.trigger_price)
                    ? `₩${formatPrice(resolvedActionSummary?.trigger_price)}`
                    : copy.action.noTriggerPrice}
                </strong>
              </article>
            </div>

            <div className={styles.tagGroup}>
              {(actionReasons.length > 0 ? actionReasons : [copy.action.noRationaleRows]).map((reason) => (
                <span key={reason} className={styles.tagChip}>
                  {reason}
                </span>
              ))}
            </div>

            <p className={styles.metaCaption}>{copy.action.payloadKeys}: {actionPayloadTags.join(" · ")}</p>
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
                <p className={styles.sectionEyebrow}>{copy.technical.eyebrow}</p>
                <h2 className={styles.cardTitle}>{copy.technical.title}</h2>
              </div>
              <span className={`pill ${technicalTone}`}>
                {resolvedTechnicalSnapshot ? humanizeToken(resolvedTechnicalSnapshot.trend_state) : copy.technical.unavailable}
              </span>
            </div>
            {showOverview ? (
              <button
                type="button"
                className={styles.detailLink}
                onClick={(event) => handleDetailModeNavigation(event, "technical-analysis")}
              >
                {copy.technical.openDetail}
              </button>
            ) : null}

            <strong className={`clamp-3 ${styles.insightHeadline}`}>
              {buildTechnicalHeadline(resolvedTechnicalSnapshot, copy)}
            </strong>
            <p className={`clamp-3 ${styles.supportingCopy}`}>
              {resolvedTechnicalSnapshot
                ? `${copy.technical.breakout20d} ${resolvedTechnicalSnapshot.breakout_20d ? copy.technical.yes : copy.technical.no} · ${copy.technical.breakdown20d} ${resolvedTechnicalSnapshot.breakdown_20d ? copy.technical.yes : copy.technical.no} · ${copy.technical.source} ${resolvedTechnicalSnapshot.source}`
                : copy.technical.emptyBody}
            </p>

            <div className={styles.metricGrid}>
              <article className={styles.metricCard}>
                <span>{copy.technical.return5d}</span>
                <strong>{formatSignedPercent(resolvedTechnicalSnapshot?.return_5d, copy.technical.noReturn5d)}</strong>
              </article>
              <article className={styles.metricCard}>
                <span>{copy.technical.return20d}</span>
                <strong>{formatSignedPercent(resolvedTechnicalSnapshot?.return_20d, copy.technical.noReturn20d)}</strong>
              </article>
              <article className={styles.metricCard}>
                <span>{copy.technical.volumeRatio20d}</span>
                <strong>{formatNumberOrDash(resolvedTechnicalSnapshot?.volume_ratio_20d)}</strong>
              </article>
              <article className={styles.metricCard}>
                <span>{copy.technical.atr14}</span>
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
              {copy.technical.sourceDate} {resolvedTechnicalSnapshot?.market_date ?? technicalFreshnessDate ?? copy.technical.noSourceDate} · {copy.technical.freshnessNote}
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
                <p className={styles.sectionEyebrow}>{copy.fundamentals.eyebrow}</p>
                <h2 className={styles.cardTitle}>{copy.fundamentals.title}</h2>
              </div>
              <span className={`pill ${buildConfidenceTone(fsDiv)}`}>{fsDiv ?? copy.fundamentals.defaultFs}</span>
            </div>
            {showOverview ? (
              <button
                type="button"
                className={styles.detailLink}
                onClick={(event) => handleDetailModeNavigation(event, "fundamentals-history")}
              >
                {copy.fundamentals.openDetail}
              </button>
            ) : null}

            <div className={styles.companyStrip}>
              <div className={styles.companyAvatar}>{symbol.slice(0, 1)}</div>
              <div>
                <strong>{introTitle}</strong>
                <p className="clamp-3">
                  {copy.fundamentals.latestFilingPrefix} {buildFundamentalsLatestLabel(latestHistoryEntry, latestFundamentals, copy)}.
                </p>
              </div>
            </div>

            <div className={styles.metricGrid}>
              {latestHighlights.length > 0 ? (
                latestHighlights.map((metric, index) => (
                  <article key={`${formatHighlightLabel(metric, index)}-${index}`} className={styles.metricCard}>
                    <span>{formatHighlightLabel(metric, index)}</span>
                    <strong>{formatHighlightValue(metric, copy)}</strong>
                  </article>
                ))
              ) : (
                <article className={styles.metricCard}>
                  <span>{copy.fundamentals.latestFiling}</span>
                  <strong>{buildFundamentalsLatestLabel(latestHistoryEntry, latestFundamentals, copy)}</strong>
                </article>
              )}
            </div>

            <div className={styles.historyList}>
              {companyHistory?.entries.length ? (
                companyHistory.entries.slice(0, fundamentalsEntryLimit).map((entry) => {
                  const visibleHighlights = buildHistoryEntryMetrics(entry, copy);

                  return (
                    <article key={entry.filing.rcept_no} className={styles.historyCard}>
                      <div className={styles.historyHeader}>
                        <div>
                          <strong className="clamp-3">
                            {entry.period.report_label ??
                              `${entry.period.business_year ?? copy.fundamentals.unknownYear} ${entry.period.report_code ?? ""}`}
                          </strong>
                          <p className="clamp-3">
                            {entry.filing.report_nm ?? copy.fundamentals.unnamedFiling} · {copy.fundamentals.receipt} {entry.filing.receipt_date ?? copy.fundamentals.noReceiptDate}
                          </p>
                        </div>
                        <span className="pill neutral">{entry.statement.fs_div ?? copy.fundamentals.fsPending}</span>
                      </div>
                      <div className={styles.historyMetrics}>
                        {visibleHighlights.map((metric, index) => (
                          <div key={`${entry.filing.rcept_no}-${formatHighlightLabel(metric, index)}-${index}`} className={styles.historyMetricRow}>
                            <span>{formatHighlightLabel(metric, index)}</span>
                            <strong>{formatHighlightValue(metric, copy)}</strong>
                          </div>
                        ))}
                      </div>
                    </article>
                  );
                })
              ) : fundamentalsLoading ? (
                <div className={styles.emptyPanel}>
                  <strong>{copy.fundamentals.loadingTitle}</strong>
                  <p className="clamp-3">{copy.fundamentals.loadingBody}</p>
                </div>
              ) : (
                <div className={styles.emptyPanel}>
                  <strong>{copy.fundamentals.emptyTitle}</strong>
                  <p className="clamp-3">{buildFundamentalsCoverageNote(companyHistory, latestFundamentals, copy)}</p>
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
                <p className={styles.sectionEyebrow}>{copy.disclosures.eyebrow}</p>
                <h2 className={styles.cardTitle}>{copy.disclosures.title}</h2>
              </div>
              <span className={`pill ${disclosureSectionState === "list" ? "info" : disclosureSectionState === "empty" ? "neutral" : "warning"}`}>
                {aggregateContext?.recent_disclosures.count ?? 0} {copy.disclosures.items}
              </span>
            </div>
            {showOverview ? (
              <button
                type="button"
                className={styles.detailLink}
                onClick={(event) => handleDetailModeNavigation(event, "disclosure-coverage")}
              >
                {copy.disclosures.openDetail}
              </button>
            ) : null}

            {disclosureSectionState === "list" ? (
              <div className={styles.disclosureList}>
                {aggregateContext?.recent_disclosures.items.slice(0, disclosureItemLimit).map((item) => (
                  <Link
                    key={item.rcept_no}
                    className={styles.disclosureCard}
                    href={buildDisclosureReportHref(symbol, item, routeQueryString)}
                    aria-label={`${copy.disclosures.openReportPrefix} ${item.report_nm}`}
                  >
                    <div className={styles.disclosureHeader}>
                      <strong className="clamp-3">{item.report_nm}</strong>
                      <span className="pill neutral">{item.receipt_date ?? copy.disclosures.noReceiptDate}</span>
                    </div>
                    <p className="clamp-3">
                      {humanizeToken(item.filing_category, copy.disclosures.noCategory)} · {copy.disclosures.capture}{" "}
                      {humanizeToken(item.fundamentals_capture_status, copy.disclosures.notCaptured)}
                    </p>
                    <div className={styles.disclosureMeta}>
                      <span>{copy.disclosures.receipt} {item.receipt_date ?? copy.disclosures.noReceiptDate}</span>
                      <span>{copy.disclosures.receiptNo} {item.rcept_no}</span>
                    </div>
                    <span className={styles.disclosureAction}>{copy.disclosures.viewReportDetail}</span>
                  </Link>
                ))}
              </div>
            ) : disclosureSectionState === "loading" ? (
              <div className={styles.emptyPanel}>
                <strong>{copy.disclosures.loadingTitle}</strong>
                <p className="clamp-3">{copy.disclosures.loadingBody}</p>
              </div>
            ) : disclosureSectionState === "empty" ? (
              <div className={styles.emptyPanel}>
                <strong>{copy.disclosures.emptyTitle}</strong>
                <p className="clamp-3">{copy.disclosures.emptyBody}</p>
              </div>
            ) : (
              <div className={styles.emptyPanel}>
                <strong>{copy.disclosures.unavailableTitle}</strong>
                <p className="clamp-3">{copy.disclosures.unavailableBody}</p>
              </div>
            )}

            <div className={styles.coverageNote}>
              <strong>{latestDisclosure ? copy.disclosures.latestDisclosureAvailable : copy.disclosures.partialAnalystCoverage}</strong>
              <p className="clamp-3">
                {buildDisclosureCoverageNote(latestDisclosure, aggregateContext?.recent_disclosures.count ?? 0, copy)}
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
              <p className={styles.sectionEyebrow}>{copy.freshness.eyebrow}</p>
              <h2 className={styles.cardTitle}>{copy.freshness.title}</h2>
            </div>
            <span className={`pill ${freshnessTone}`}>{humanizeToken(freshness?.today?.eod_status, copy.freshness.statusPending)}</span>
          </div>
          {showOverview ? (
            <button
              type="button"
              className={styles.detailLink}
              onClick={(event) => handleDetailModeNavigation(event, "system-freshness")}
            >
              {copy.freshness.openDetail}
            </button>
          ) : null}

          <div className={styles.metricGrid}>
            <article className={styles.metricCard}>
              <span>{copy.freshness.eodTradeDate}</span>
              <strong>{freshness?.today?.trade_date ?? marketDate ?? copy.common.datePending}</strong>
            </article>
            <article className={styles.metricCard}>
              <span>{copy.freshness.priceLatest}</span>
              <strong>{freshness?.latest?.price_trade_date ?? quote?.trade_date ?? formatDisplayTimestamp(quote?.cached_at, copy.hero.quotePending)}</strong>
            </article>
            <article className={styles.metricCard}>
              <span>{copy.freshness.technicalLatest}</span>
              <strong>{technicalFreshnessDate ?? copy.freshness.noTechnicalDate}</strong>
            </article>
            <article className={styles.metricCard}>
              <span>{copy.freshness.actionLatest}</span>
              <strong>{actionFreshnessDate ?? copy.freshness.noActionDate}</strong>
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
