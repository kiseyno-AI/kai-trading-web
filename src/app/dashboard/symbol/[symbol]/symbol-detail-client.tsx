"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ComponentTag } from "@/components/dev/component-tag";
import { DevModeToggle } from "@/components/dev/dev-mode-toggle";
import { MobileAppChrome } from "@/components/mobile/mobile-app-chrome";
import { resolveTradingApiClientPath } from "@/lib/trading-api-client-path";
import { formatDisplayTimestamp, formatPrice, formatTurnover } from "@/lib/format";
import { getForwardableSymbolMetaSeedValue } from "@/lib/symbol-meta";
import { getCachedTradingApiJson } from "@/lib/trading-api-cache";
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

function hasNumber(value: number | null | undefined): value is number {
  return typeof value === "number";
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

function buildQuoteFeedLabel(quote: QuoteResponse | null) {
  if (!quote) return "Feed pending";
  if (!quote.available) return "Quote unavailable";
  if (quote.is_live) return "Live feed";
  if (quote.source === "daily_price_bar") return "DB EOD fallback";
  if (quote.fallback) return "Quote fallback";
  return "Delayed feed";
}

function buildQuoteSourceLabel(quote: QuoteResponse | null) {
  if (!quote) return "Quote source pending.";
  if (!quote.available) {
    return quote.unavailable_reason
      ? `Quote unavailable: ${quote.unavailable_reason}.`
      : "Quote source is currently unavailable.";
  }
  if (quote.is_live) return "Primary KIS live quote source.";
  if (quote.source === "daily_price_bar") {
    return quote.trade_date
      ? `Daily price-bar fallback for ${quote.trade_date}.`
      : "Daily price-bar fallback path.";
  }
  if (quote.fallback) return `${quote.source} fallback path.`;
  return `${quote.source} quote source.`;
}

function buildAggregateContextSummary(
  aggregateContext: AgentContextItemDto | null,
  quote: QuoteResponse | null,
  marketDate: string | null,
) {
  if (!aggregateContext) {
    if (!marketDate) {
      return "Waiting for the quote trade date before requesting the aggregate symbol-day packet.";
    }

    return "Waiting for trading-core to resolve the symbol-day aggregate packet for this requested market date.";
  }

  const fragments = [
    `Quote rendering uses /quotes/${aggregateContext.symbol} while insight and evidence modules are layered from the symbol-day aggregate payload.`,
  ];

  if (aggregateContext.technical_snapshot) {
    fragments.push(
      `${humanizeToken(aggregateContext.technical_snapshot.trend_state)} trend with ${humanizeToken(aggregateContext.technical_snapshot.ma_alignment)} alignment.`,
    );
  }

  if (aggregateContext.action_summary) {
    fragments.push(
      `${humanizeToken(aggregateContext.action_summary.action_label)} bias at score ${aggregateContext.action_summary.signal_score}.`,
    );
  }

  if (aggregateContext.fundamentals.latest_snapshot) {
    fragments.push(
      `Latest filing snapshot received ${aggregateContext.fundamentals.latest_snapshot.filing.receipt_date ?? "with no receipt date"}.`,
    );
  } else {
    fragments.push("No stored fundamentals snapshot is attached yet.");
  }

  if (aggregateContext.recent_disclosures.count > 0) {
    fragments.push(`${aggregateContext.recent_disclosures.count} recent disclosure item(s) are available.`);
  } else {
    fragments.push("Recent disclosure coverage is empty for this packet.");
  }

  if (quote?.available) {
    fragments.push(quote.is_live ? "Price card is on a live feed." : "Price card is on a fallback quote path.");
  }

  return fragments.join(" ");
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

function buildSymbolDetailHref(symbol: string, mode: SymbolDetailMode, queryString: string) {
  const detailMode = SYMBOL_DETAIL_MODE_BY_ID[mode];
  const path = `/dashboard/symbol/${encodeURIComponent(symbol)}${detailMode.path}`;
  return queryString ? `${path}?${queryString}` : path;
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

function buildDisclosureCoverageNote(
  latestDisclosure: AgentContextDisclosureDto | null,
  disclosureCount: number,
) {
  if (disclosureCount > 0 && latestDisclosure) {
    return `${disclosureCount} disclosure item(s) loaded. Latest filing landed on ${latestDisclosure.receipt_date ?? "an unavailable receipt date"}.`;
  }

  return "No Disclosure Found for this symbol.";
}

function buildMarketStateTone(quote: QuoteResponse | null, marketStatus: MarketStatusResponse | null) {
  if (!quote || !marketStatus) return "neutral";
  if (quote.available && marketStatus.state === "OPEN") return "positive";
  if (!quote.available) return "warning";
  return "info";
}

function normalizeMarketCode(value: string | null | undefined) {
  if (!value) return null;
  return value.trim().toUpperCase();
}

function resolveMarketStateLabel(item: MarketStatusItem) {
  const state = normalizeMarketCode(item.state);
  if (item.ready === false || item.available === false) return "Not ready";
  if (state === "OPEN") return "OPEN";
  if (state === "CLOSED") return "CLOSED";
  if (state === "PREOPEN") return "PREOPEN";
  if (state === "POSTCLOSE") return "POSTCLOSE";
  return item.state ?? "Not ready";
}

function buildMarketStateRows(marketStatus: MarketStatusResponse | null, fallbackMarket: string | null | undefined) {
  const preferredMarkets = ["KRX", "KOSDAQ", "NASDAQ"];
  const normalizedFallback = normalizeMarketCode(fallbackMarket);
  const items = Array.isArray(marketStatus?.markets) ? marketStatus.markets : [];
  const byCode = new Map<string, MarketStatusItem>();

  for (const item of items) {
    const code = normalizeMarketCode(item.market ?? item.label);
    if (!code) continue;
    byCode.set(code, item);
  }

  const orderedCodes = [...preferredMarkets];
  if (normalizedFallback && !orderedCodes.includes(normalizedFallback)) {
    orderedCodes.unshift(normalizedFallback);
  }

  return orderedCodes.map((code) => {
    const item = byCode.get(code);
    return {
      market: code,
      state: item ? resolveMarketStateLabel(item) : code === "KRX" || code === "KOSDAQ" ? (marketStatus?.state ?? "Not ready") : "Not ready",
    };
  });
}

export function SymbolDetailClient({ mode = "overview" }: SymbolDetailClientProps) {
  const isOverviewMode = mode === "overview";
  const shouldLoadAggregateContext = mode !== "system-freshness";
  const shouldLoadPriceHistory = isOverviewMode || mode === "technical-analysis";
  const shouldLoadTechnicalSnapshot = isOverviewMode || mode === "technical-analysis";
  const shouldLoadActionSummary = isOverviewMode || mode === "action-summary";
  const shouldLoadFundamentalsHistory = isOverviewMode || mode === "fundamentals-history";
  const params = useParams<{ symbol: string }>();
  const searchParams = useSearchParams();
  const symbol = useMemo(() => decodeURIComponent(params.symbol), [params.symbol]);
  const requestedMarketDate = useMemo(() => searchParams.get("marketDate"), [searchParams]);
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
  const [aggregateContextLoadState, setAggregateContextLoadState] =
    useState<AggregateContextLoadState>("loading");
  const [quotePollingStopped, setQuotePollingStopped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [fundamentalsLoading, setFundamentalsLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);
  const [fundamentalsError, setFundamentalsError] = useState<string | null>(null);

  const marketDate = useMemo(() => {
    if (requestedMarketDate) return requestedMarketDate;
    if (quote?.trade_date) return quote.trade_date;
    if (!loading) return defaultMarketDate;
    return null;
  }, [defaultMarketDate, loading, quote?.trade_date, requestedMarketDate]);
  const fundamentalsEntryLimit = mode === "fundamentals-history" ? 8 : 4;
  const disclosureItemLimit = mode === "disclosure-coverage" ? 8 : 4;

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
    setAggregateContextLoadState("loading");
    setQuotePollingStopped(false);
    setLoading(true);
    setHistoryLoading(true);
    setFundamentalsLoading(true);
    setMetaError(null);
    setQuoteError(null);
    setHistoryError(null);
    setContextError(null);
    setFundamentalsError(null);
  }, [initialMeta, metaResetToken]);

  useEffect(() => {
    let active = true;

    const loadMeta = async () => {
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
  }, [initialMeta, symbol]);

  useEffect(() => {
    let active = true;
    let timer: number | null = null;

    const loadQuote = async () => {
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
  }, [symbol]);

  useEffect(() => {
    let active = true;

    const loadPriceHistory = async () => {
      if (!shouldLoadPriceHistory) {
        setPriceHistory(null);
        setSelectedBar(null);
        setHistoryLoading(false);
        setHistoryError(null);
        return;
      }

      if (!marketDate) {
        setPriceHistory(null);
        setSelectedBar(null);
        setHistoryLoading(true);
        setHistoryError(null);
        return;
      }

      setHistoryLoading(true);

      try {
        const query = buildPriceHistoryQuery(selectedRange, marketDate);
        const data = await getJson<SymbolPriceBarsResponseDto>(
          `/api/trading/symbols/${encodeURIComponent(symbol)}/price-bars?${query}`,
        );
        if (!active) return;
        setPriceHistory(data);
        setSelectedBar(data.items[data.items.length - 1] ?? null);
        setHistoryError(null);
      } catch (priceHistoryLoadError) {
        console.error("Symbol price history load failed", priceHistoryLoadError);
        if (!active) return;
        setPriceHistory(null);
        setSelectedBar(null);
        setHistoryError("Unable to load stored historical price bars from trading-core.");
      } finally {
        if (active) {
          setHistoryLoading(false);
        }
      }
    };

    loadPriceHistory();

    return () => {
      active = false;
    };
  }, [marketDate, selectedRange, shouldLoadPriceHistory, symbol]);

  useEffect(() => {
    let active = true;

    const loadAggregateContext = async () => {
      if (!shouldLoadAggregateContext) {
        setAggregateContext(null);
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
  }, [disclosureItemLimit, fsDiv, marketDate, shouldLoadAggregateContext, symbol]);

  useEffect(() => {
    let active = true;

    const loadDerivedInsights = async () => {
      if (!shouldLoadTechnicalSnapshot && !shouldLoadActionSummary) {
        setTechnicalSnapshot(null);
        setActionSummary(null);
        return;
      }

      if (!marketDate) {
        setTechnicalSnapshot(null);
        setActionSummary(null);
        return;
      }

      const insightQuery = new URLSearchParams();
      insightQuery.set("market_date", marketDate);
      insightQuery.append("symbols", symbol);

      const [technicalResult, actionResult] = await Promise.allSettled([
        shouldLoadTechnicalSnapshot
          ? getJson<EodTechnicalSnapshotsResponseDto>(
              `/api/trading/eod/technical-snapshots?${insightQuery.toString()}`,
            )
          : Promise.resolve<EodTechnicalSnapshotsResponseDto>({ market_date: marketDate, items: [] }),
        shouldLoadActionSummary
          ? getJson<EodActionSummariesResponseDto>(
              `/api/trading/eod/action-summaries?${insightQuery.toString()}`,
            )
          : Promise.resolve<EodActionSummariesResponseDto>({ market_date: marketDate, items: [] }),
      ]);

      if (!active) return;

      if (technicalResult.status === "fulfilled") {
        setTechnicalSnapshot(
          technicalResult.value.items.find((item) => item.symbol === symbol) ??
            technicalResult.value.items[0] ??
            null,
        );
      } else {
        console.error("Technical snapshot load failed", technicalResult.reason);
        setTechnicalSnapshot(null);
      }

      if (actionResult.status === "fulfilled") {
        setActionSummary(
          actionResult.value.items.find((item) => item.symbol === symbol) ??
            actionResult.value.items[0] ??
            null,
        );
      } else {
        console.error("Action summary load failed", actionResult.reason);
        setActionSummary(null);
      }
    };

    loadDerivedInsights();

    return () => {
      active = false;
    };
  }, [marketDate, shouldLoadActionSummary, shouldLoadTechnicalSnapshot, symbol]);

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
      if (!shouldLoadFundamentalsHistory) {
        setFundamentalsHistory(null);
        setFundamentalsLoading(false);
        setFundamentalsError(null);
        return;
      }

      if (!marketDate) {
        setFundamentalsHistory(null);
        setFundamentalsLoading(true);
        setFundamentalsError(null);
        return;
      }

      setFundamentalsLoading(true);

      try {
        const query = buildFundamentalsHistoryQuery(symbol, marketDate, fsDiv);
        const data = await getJson<DartFundamentalsHistoryResponseDto>(
          `/api/trading/disclosures/dart/fundamentals/history?${query}`,
        );
        if (!active) return;
        setFundamentalsHistory(data);
        setFundamentalsError(null);
      } catch (fundamentalsLoadError) {
        console.error("Fundamentals history load failed", fundamentalsLoadError);
        if (!active) return;
        setFundamentalsHistory(null);
        setFundamentalsError("Unable to load DART fundamentals history from trading-core.");
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
  }, [fsDiv, marketDate, shouldLoadFundamentalsHistory, symbol]);

  const resolvedTechnicalSnapshot = technicalSnapshot ?? aggregateContext?.technical_snapshot ?? null;
  const resolvedActionSummary = actionSummary ?? aggregateContext?.action_summary ?? null;
  const latestFundamentals = aggregateContext?.fundamentals.latest_snapshot ?? null;
  const latestDisclosure = buildLatestDisclosure(aggregateContext?.recent_disclosures.items ?? []);
  const companyHistory = pickFundamentalsCompany(fundamentalsHistory, symbol);
  const latestHistoryEntry = companyHistory?.entries[0] ?? null;
  const technicalFreshnessDate = buildTechnicalFreshnessDate(resolvedTechnicalSnapshot, freshness);
  const actionFreshnessDate = buildActionFreshnessDate(resolvedActionSummary, freshness);
  const fundamentalsDate = buildFundamentalsDate(companyHistory, latestFundamentals, aggregateContext);
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
  const contextSummary = buildAggregateContextSummary(aggregateContext, quote, marketDate);
  const detailErrors = [quoteError, metaError, historyError, contextError, fundamentalsError].filter(
    (value): value is string => Boolean(value),
  );

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

  const heroMetrics = [
    {
      label: "Quote freshness",
      value: quote?.is_live
        ? "Live"
        : quote?.trade_date ?? formatDisplayTimestamp(quote?.cached_at, loading ? LOADING_LABEL : "Quote pending"),
      detail: buildQuoteFeedLabel(quote),
    },
    {
      label: "Focus candle",
      value: focusBar?.trade_date
        ? formatIsoDateLabel(focusBar.trade_date)
        : historyLoading
          ? LOADING_LABEL
          : "No candle selected",
      detail: focusBar ? `O ${formatPrice(focusBar.open_price)} · C ${formatPrice(focusBar.close_price)}` : "Swipe or tap chart to inspect a date.",
    },
    {
      label: "TA latest",
      value: technicalFreshnessDate ?? (marketDate ? "No snapshot" : DATE_PENDING_LABEL),
      detail: resolvedTechnicalSnapshot
        ? `${humanizeToken(resolvedTechnicalSnapshot.trend_state)} · ${humanizeToken(resolvedTechnicalSnapshot.ma_alignment)}`
        : "No technical snapshot resolved yet.",
    },
    {
      label: "Action latest",
      value: actionFreshnessDate ?? (marketDate ? "No summary" : DATE_PENDING_LABEL),
      detail: resolvedActionSummary
        ? `${humanizeToken(resolvedActionSummary.action_label)} · ${humanizeToken(resolvedActionSummary.confidence_tier)} confidence`
        : "No deterministic action summary resolved yet.",
    },
  ];

  const actionReasons = resolvedActionSummary?.reasons.slice(0, 4) ?? [];
  const actionPayloadTags = buildInsightTags(resolvedActionSummary?.summary_payload);
  const technicalPayloadTags = buildInsightTags(resolvedTechnicalSnapshot?.signal_payload);
  const actionTone = buildActionTone(resolvedActionSummary);
  const technicalTone = buildTechnicalTone(resolvedTechnicalSnapshot);
  const freshnessTone = buildFreshnessTone(freshness?.today?.eod_status);
  const marketStateTone = buildMarketStateTone(quote, marketStatus);
  const marketStateRows = useMemo(() => buildMarketStateRows(marketStatus, metaMarket), [marketStatus, metaMarket]);
  const actionScore = Math.max(0, Math.min(resolvedActionSummary?.signal_score ?? 0, 100));

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

  const routeQueryString = useMemo(
    () => buildSymbolRouteQuery(meta, marketDate, fsDiv),
    [fsDiv, marketDate, meta],
  );
  const activeDetailMode = SYMBOL_DETAIL_MODE_BY_ID[mode];
  const currentDetailHref = buildSymbolDetailHref(symbol, mode, routeQueryString);
  const showOverview = isOverviewMode;
  const showChartSection = showOverview || mode === "technical-analysis";
  const showActionSection = showOverview || mode === "action-summary";
  const showTechnicalSection = showOverview || mode === "technical-analysis";
  const showFundamentalsSection = showOverview || mode === "fundamentals-history";
  const showDisclosureSection = showOverview || mode === "disclosure-coverage";
  const showFreshnessSection = showOverview || mode === "system-freshness";

  return (
    <MobileAppChrome
      activeNav="symbols"
      mySymbolsHref={currentDetailHref}
      header={
        <>
          <div className={styles.headerBrand}>
            <Link href="/dashboard" className={styles.backButton} aria-label="Back to dashboard">
              ←
            </Link>
            <div>
              <strong className={styles.headerTitle}>{symbol}</strong>
            </div>
          </div>

          <div className={styles.headerActions}>
            <span className={`pill ${quotePollingStopped ? "info" : marketStateTone}`}>
              {quotePollingStopped ? "Stable Mode" : marketStatus?.state ?? "Market Pending"}
            </span>
            <DevModeToggle />
          </div>
        </>
      }
    >
      <div className={styles.detailPage} data-mode={mode}>
        <section className={`${styles.panel} ${styles.heroCard}`} id="summary">
          <ComponentTag
            label="symbol.hero"
            api="/api/trading/quotes/{symbol} + /api/trading/market/status + /api/trading/symbols/search"
          />

          <div className={styles.heroTopRow}>
            <div>
              <p className={styles.sectionEyebrow}>Market Insights</p>
              <div className={styles.heroTitleRow}>
                <h1>{symbol}</h1>
                <p className={`clamp-3 ${styles.heroCompany}`}>{introTitle}</p>
              </div>
            </div>

            <div className={styles.heroControls}>
              <button type="button" className={styles.tradeButton} disabled title="Execution route is disabled on this read-only screen">
                Trade
              </button>
              <span className={styles.watchBadge}>★</span>
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
            <p className={`clamp-3 ${styles.heroCopy}`}>{buildQuoteSourceLabel(quote)}</p>
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

          <p className={`clamp-3 ${styles.fusionCopy}`}>
            Layer-specific freshness stays explicit. {contextSummary}
          </p>

          <div className={styles.heroMetrics}>
            {heroMetrics.map((metric) => (
              <article key={metric.label} className={styles.heroMetricCard}>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <p className="clamp-3">{metric.detail}</p>
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
            <p className={`clamp-3 ${styles.supportingCopy}`}>
              Each detail page uses the same source packets as the overview cards and labels unavailable fields explicitly.
            </p>
          </div>
          <nav className={styles.detailTabs} aria-label="Symbol detail pages">
            {SYMBOL_DETAIL_MODES.map((item) => (
              <Link
                key={item.mode}
                href={buildSymbolDetailHref(symbol, item.mode, routeQueryString)}
                className={`${styles.detailTab} ${mode === item.mode ? styles.detailTabActive : ""}`.trim()}
              >
                {item.label}
              </Link>
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
                {mode === "technical-analysis" ? "Momentum Intelligence Score" : "Historical Performance"}
              </p>
              <h2 className={styles.cardTitle}>
                {mode === "technical-analysis" ? "Candlestick view" : "Swipe-aware candlestick chart"}
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
              {chartMetrics
                ? `${selectedRange} return ${formatSignedPercent(((chartMetrics.end - chartMetrics.start) / Math.max(chartMetrics.start, 1)) * 100)}`
                : `${selectedRange} return pending`}
            </span>
            <span>{marketDate ? `Requested market date ${formatIsoDateLabel(marketDate)}` : "Market date pending"}</span>
            <span>Swipe or drag the chart to move date focus.</span>
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
              <Link className={styles.detailLink} href={buildSymbolDetailHref(symbol, "action-summary", routeQueryString)}>
                Open action detail
              </Link>
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
              <Link className={styles.detailLink} href={buildSymbolDetailHref(symbol, "technical-analysis", routeQueryString)}>
                Open technical detail
              </Link>
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
              <Link className={styles.detailLink} href={buildSymbolDetailHref(symbol, "fundamentals-history", routeQueryString)}>
                Open fundamentals detail
              </Link>
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
              <Link className={styles.detailLink} href={buildSymbolDetailHref(symbol, "disclosure-coverage", routeQueryString)}>
                Open disclosure detail
              </Link>
            ) : null}

            {disclosureSectionState === "list" ? (
              <div className={styles.disclosureList}>
                {aggregateContext?.recent_disclosures.items.slice(0, disclosureItemLimit).map((item) => (
                  <article key={item.rcept_no} className={styles.disclosureCard}>
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
                  </article>
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
            <Link className={styles.detailLink} href={buildSymbolDetailHref(symbol, "system-freshness", routeQueryString)}>
              Open freshness detail
            </Link>
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
