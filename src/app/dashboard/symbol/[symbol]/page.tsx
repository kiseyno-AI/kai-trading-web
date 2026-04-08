"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { PageIntro } from "@/components/ui/page-intro";
import { formatDisplayTimestamp, formatPrice, formatTurnover } from "@/lib/format";
import type {
  AgentContextActionSummaryDto,
  AgentContextFundamentalsSummaryDto,
  AgentContextDisclosureDto,
  AgentContextItemDto,
  AgentContextResponseDto,
  AgentContextTechnicalSnapshotDto,
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

type MarketStatusResponse = {
  state: string;
  is_open: boolean;
  server_time: string;
};

type PriceHistoryRange = "3M" | "1Y" | "5Y" | "MAX";

const PRICE_HISTORY_RANGES: PriceHistoryRange[] = ["3M", "1Y", "5Y", "MAX"];

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatSignedNumber(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toLocaleString()}`;
}

function hasNumber(value: number | null | undefined): value is number {
  return typeof value === "number";
}

function formatSignedPercentOptional(value: number | null | undefined, fallback = "Unavailable") {
  return hasNumber(value) ? formatSignedPercent(value) : fallback;
}

function formatSignedNumberOptional(value: number | null | undefined, fallback = "Unavailable") {
  return hasNumber(value) ? formatSignedNumber(value) : fallback;
}

function formatOptionalPercent(value: number | null) {
  return value === null ? "-" : formatSignedPercent(value);
}

function formatOptionalMultiple(value: number | null) {
  return value === null ? "-" : `${value.toFixed(2)}x`;
}

function humanizeToken(value: string | null | undefined) {
  if (!value) return "-";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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

function buildQuoteContext(quote: Pick<QuoteResponse, "fallback" | "is_live" | "market_state">) {
  if (quote.fallback) return "Quote polling is currently on the backend fallback path.";
  if (quote.is_live) return "Quote polling is on the live trading-core feed.";
  return `Quote polling reports market state ${quote.market_state.toLowerCase()}.`;
}

function buildQuoteFeedLabel(quote: QuoteResponse | null) {
  if (!quote) return "Feed pending";
  if (!quote.available) return "Quote unavailable";
  if (quote.is_live) return "Live feed";
  if (quote.source === "daily_price_bar") return "DB EOD fallback";
  if (quote.fallback) return "Quote fallback";
  return "Delayed feed";
}

function buildAggregateContextSummary(
  aggregateContext: AgentContextItemDto,
  quote: QuoteResponse | null,
) {
  const parts = ["This symbol detail view mixes on-demand quote polling with the stored symbol-day aggregate packet."];

  if (aggregateContext.action_summary) {
    parts.push(
      `${humanizeToken(aggregateContext.action_summary.action_label)} bias with ${aggregateContext.action_summary.confidence_tier} confidence and ${aggregateContext.action_summary.risk_tier} risk.`,
    );
  } else if (aggregateContext.technical_snapshot) {
    parts.push(
      `${humanizeToken(aggregateContext.technical_snapshot.trend_state)} technical state with ${humanizeToken(aggregateContext.technical_snapshot.ma_alignment)} moving-average alignment.`,
    );
  } else {
    parts.push("No stored technical/action block is available for the requested market date yet.");
  }

  if (aggregateContext.fundamentals.latest_snapshot) {
    const latestSnapshot = aggregateContext.fundamentals.latest_snapshot;
    parts.push(
      `Latest fundamentals summary comes from ${latestSnapshot.filing.report_name ?? latestSnapshot.period.report_label ?? "the stored filing"} received ${latestSnapshot.filing.receipt_date ?? "at an unknown date"}.`,
    );
  } else {
    parts.push("No eligible fundamentals summary is stored for this symbol yet.");
  }

  if (aggregateContext.recent_disclosures.count > 0) {
    parts.push(`${aggregateContext.recent_disclosures.count} recent disclosure event(s) are attached to this context packet.`);
  } else {
    parts.push("No recent disclosures were returned for this market-date window.");
  }

  if (quote) {
    if (quote.available) {
      parts.push(buildQuoteContext(quote));
    } else {
      parts.push(`Quote polling is explicitly unavailable: ${quote.unavailable_reason ?? "no fresh upstream or fallback data"}.`);
    }
  }

  return parts.join(" ");
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

function buildActionTone(actionSummary: AgentContextActionSummaryDto | null) {
  if (!actionSummary) return "";
  if (actionSummary.bias_direction === "long") return styles.positive;
  if (actionSummary.bias_direction === "short") return styles.negative;
  return "";
}

function buildTechnicalTone(technicalSnapshot: AgentContextTechnicalSnapshotDto | null) {
  if (!technicalSnapshot) return "";
  if (technicalSnapshot.trend_state === "uptrend") return styles.positive;
  if (technicalSnapshot.trend_state === "downtrend") return styles.negative;
  return "";
}

function buildLatestDisclosure(disclosures: AgentContextDisclosureDto[]) {
  return disclosures[0] ?? null;
}

function buildTechnicalSnapshotDetail(
  technicalSnapshot: AgentContextTechnicalSnapshotDto | null,
  quote: QuoteResponse | null,
  marketDate: string | null,
) {
  if (technicalSnapshot) {
    return `As of ${technicalSnapshot.market_date} · 5D ${formatOptionalPercent(technicalSnapshot.return_5d)} · 20D ${formatOptionalPercent(technicalSnapshot.return_20d)} · Vol ${formatOptionalMultiple(technicalSnapshot.volume_ratio_20d)}`;
  }

  if (quote?.trade_date && marketDate && quote.trade_date !== marketDate) {
    return `Requested ${marketDate}, but the latest completed trading day is ${quote.trade_date}. Stored EOD technical snapshots only exist after that market close.`;
  }

  if (marketDate && quote?.market_state === "PREOPEN") {
    return `Stored EOD technical snapshots are keyed to the prior completed trading day. Before the session opens, ${marketDate} can legitimately be empty until quote trade-date resolution settles on the previous close.`;
  }

  if (marketDate && quote?.market_state === "OPEN") {
    return `Stored EOD technical snapshots are written after the market closes, so ${marketDate} remains unavailable during the live session.`;
  }

  if (marketDate) {
    return `Stored market-date snapshot missing for ${marketDate}. If this is the current calendar day, the latest completed EOD packet may still be the prior trading session.`;
  }

  return "Waiting for quote trade date before loading stored technical context";
}

function buildLatestFilingDetail(
  latestFundamentals: AgentContextFundamentalsSummaryDto["latest_snapshot"] | null,
  latestDisclosure: AgentContextDisclosureDto | null,
  aggregateContextLoaded: boolean,
  disclosureCount: number,
  symbol: string,
) {
  if (latestFundamentals) {
    return `${latestFundamentals.filing.receipt_date ?? "Date unknown"} · ${latestFundamentals.statement.fs_label ?? latestFundamentals.statement.fs_div} · ${disclosureCount} recent disclosure(s)`;
  }

  if (latestDisclosure) {
    return `Recent disclosure only: ${latestDisclosure.report_nm} (${latestDisclosure.receipt_date ?? "date unknown"})`;
  }

  if (aggregateContextLoaded) {
    return `No stored DART fundamentals summary or recent disclosure is attached to ${symbol} yet. Current-universe DART backfill is still batch-driven, so later symbols can legitimately remain empty until their batch is processed.`;
  }

  return "Waiting for the symbol-day aggregate response to confirm DART coverage";
}

export default function SymbolDetailPage() {
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
  const [aggregateContext, setAggregateContext] = useState<AgentContextItemDto | null>(null);
  const [aggregateContextLoadState, setAggregateContextLoadState] = useState<AggregateContextLoadState>("loading");
  const [quotePollingStopped, setQuotePollingStopped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);

  const marketDate = useMemo(() => {
    if (requestedMarketDate) return requestedMarketDate;
    if (quote?.trade_date) return quote.trade_date;
    if (!loading) return defaultMarketDate;
    return null;
  }, [defaultMarketDate, loading, quote?.trade_date, requestedMarketDate]);

  useEffect(() => {
    setMeta(initialMeta);
    setQuote(null);
    setSelectedRange("1Y");
    setPriceHistory(null);
    setAggregateContext(null);
    setAggregateContextLoadState("loading");
    setQuotePollingStopped(false);
    setLoading(true);
    setHistoryLoading(true);
    setMetaError(null);
    setQuoteError(null);
    setHistoryError(null);
    setContextError(null);
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
        const shouldStopPolling = marketData.state === "CLOSED" && quoteData.market_state === "CLOSED";

        setQuote(quoteData);
        setMarketStatus(marketData);
        setQuotePollingStopped(shouldStopPolling);
        setQuoteError(null);

        if (!shouldStopPolling) {
          timer = window.setTimeout(loadQuote, 1500);
        }
      } catch (quoteLoadError) {
        console.error("Symbol quote load failed", quoteLoadError);
        if (!active) return;
        setQuoteError("Unable to load symbol quote details from trading-core.");
        timer = window.setTimeout(loadQuote, 1500);
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
      if (!marketDate) {
        setPriceHistory(null);
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
        setHistoryError(null);
      } catch (priceHistoryLoadError) {
        console.error("Symbol price history load failed", priceHistoryLoadError);
        if (!active) return;
        setPriceHistory(null);
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
  }, [marketDate, selectedRange, symbol]);

  useEffect(() => {
    let active = true;

    const loadContext = async () => {
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
      aggregateParams.set("disclosures_limit", "5");
      if (fsDiv) {
        aggregateParams.set("fs_div", fsDiv);
      }

      const aggregateResult = await getJson<AgentContextResponseDto>(
        `/api/trading/agent-context/symbol-day?${aggregateParams.toString()}`,
      )
        .then((value) => ({ status: "fulfilled" as const, value }))
        .catch((reason: unknown) => ({ status: "rejected" as const, reason }));

      if (!active) return;

      const errors: string[] = [];

      if (aggregateResult.status === "fulfilled") {
        const exactMatch = aggregateResult.value.items.find((item) => item.symbol === symbol) ?? null;
        setAggregateContext(exactMatch);
        if (!exactMatch) {
          setAggregateContextLoadState("error");
          errors.push("Aggregate symbol context did not include this symbol.");
        } else {
          setAggregateContextLoadState("success");
        }
      } else {
        console.error("Aggregate symbol context load failed", aggregateResult.reason);
        setAggregateContext(null);
        setAggregateContextLoadState("error");
        errors.push("Aggregate symbol context is unavailable right now.");
      }

      setContextError(errors.length > 0 ? errors.join(" ") : null);
    };

    loadContext();

    return () => {
      active = false;
    };
  }, [fsDiv, marketDate, symbol]);

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

  const latestFundamentals = aggregateContext?.fundamentals.latest_snapshot ?? null;
  const latestDisclosure = buildLatestDisclosure(aggregateContext?.recent_disclosures.items ?? []);
  const disclosureSectionState = getDisclosureSectionState(
    aggregateContextLoadState,
    aggregateContext !== null,
    aggregateContext?.recent_disclosures.count ?? 0,
  );
  const introTitle =
    aggregateContext?.company.name_ko ?? meta?.name_ko ?? quote?.company_name ?? aggregateContext?.company.dart.corp_name ?? symbol;
  const contextSummary = aggregateContext
    ? buildAggregateContextSummary(aggregateContext, quote)
    : marketDate
      ? "Waiting for the aggregate symbol-day context from trading-core."
      : "Waiting for the quote trade date before loading stored symbol-day context.";

  const summaryCards = [
    {
      label: "Last price",
      value: quote ? (quote.available ? `KRW ${formatPrice(quote.price)}` : "Unavailable") : loading ? "Loading..." : "-",
      detail: quote
        ? quote.available
          ? `${formatSignedPercentOptional(quote.change_pct)} · ${formatSignedNumberOptional(quote.change)}`
          : (quote.unavailable_reason ?? "Awaiting a fresh quote source")
        : "Awaiting quote snapshot",
      tone: quote && hasNumber(quote.change_pct) ? (quote.change_pct >= 0 ? styles.positive : styles.negative) : "",
    },
    {
      label: "Technical snapshot",
      value: aggregateContext?.technical_snapshot
        ? `${humanizeToken(aggregateContext.technical_snapshot.trend_state)} · ${humanizeToken(aggregateContext.technical_snapshot.ma_alignment)}`
        : "Unavailable",
      detail: buildTechnicalSnapshotDetail(aggregateContext?.technical_snapshot ?? null, quote, marketDate),
      tone: buildTechnicalTone(aggregateContext?.technical_snapshot ?? null),
    },
    {
      label: "Action summary",
      value: aggregateContext?.action_summary ? humanizeToken(aggregateContext.action_summary.action_label) : "Unavailable",
      detail: aggregateContext?.action_summary
        ? `Score ${aggregateContext.action_summary.signal_score} · ${humanizeToken(aggregateContext.action_summary.confidence_tier)} confidence · ${humanizeToken(aggregateContext.action_summary.risk_tier)} risk`
        : "No deterministic action block stored for this symbol-day packet",
      tone: buildActionTone(aggregateContext?.action_summary ?? null),
    },
    {
      label: "Latest filing",
      value: latestFundamentals?.filing.report_name ?? latestFundamentals?.period.report_label ?? "No snapshot",
      detail: buildLatestFilingDetail(
        latestFundamentals,
        latestDisclosure,
        aggregateContext !== null,
        aggregateContext?.recent_disclosures.count ?? 0,
        symbol,
      ),
      tone: "",
    },
  ];

  return (
    <AppShell currentPath="/dashboard" title={introTitle} eyebrow="Symbol Detail" compactMobileChrome>
      <div className={`page-stack ${styles.detailPage}`}>
        <PageIntro
          eyebrow="Symbol Detail"
          title={introTitle}
          description="The primary chart reads stored multi-year OHLCV history through the trading-web BFF, while the summary cards combine quote polling with market-status checks until both routes confirm a closed market and the backend aggregate symbol-day context."
          aside={
            <div className={styles.introAside}>
              <span className="pill neutral">{symbol}</span>
              <span className="pill neutral">{aggregateContext?.company.market ?? meta?.market ?? quote?.market_state ?? "Market pending"}</span>
              <span className={`pill ${quote && quote.available && (quote.change_pct ?? 0) < 0 ? "warning" : quote?.available === false ? "warning" : "positive"}`}>
                {buildQuoteFeedLabel(quote)}
              </span>
            </div>
          }
        />

        <section className={styles.summaryGrid}>
          {summaryCards.map((card) => (
            <article key={card.label} className={`glass ${styles.summaryCard}`}>
              <span className={styles.cardLabel}>{card.label}</span>
              <strong className={`${styles.cardValue} ${card.tone}`.trim()}>{card.value}</strong>
              <p className={styles.cardDetail}>{card.detail}</p>
            </article>
          ))}
        </section>

        <section className={styles.chartSection}>
          <section className={`glass ${styles.chartCard}`}>
            <div className={styles.chartHeader}>
              <div>
                <p className="eyebrow">Price History</p>
                <h2>Historical candlestick chart</h2>
                <p>
                  Stored daily OHLCV bars now come from <code>daily_price_bars</code> via the symbol history API, so
                  this view can cover multiple years instead of a short live trace.
                </p>
              </div>
              <div className={styles.chartMeta}>
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

            <div className={styles.chartFrame}>
              {priceHistory && priceHistory.items.length > 0 ? (
                <SymbolHistoryChart key={`${symbol}-${selectedRange}`} symbol={symbol} bars={priceHistory.items} />
              ) : historyLoading ? (
                <div className={styles.noteCard}>
                  <strong>Loading stored price history</strong>
                  <p className={styles.supportingNote}>
                    Requesting the selected historical OHLCV window from trading-core through the BFF.
                  </p>
                </div>
              ) : (
                <div className={styles.noteCard}>
                  <strong>No stored bars returned</strong>
                  <p className={styles.supportingNote}>
                    Trading-core did not return any daily price bars for the selected range.
                  </p>
                </div>
              )}
            </div>

            <div className={styles.chartFooter}>
              <span>
                {chartMetrics
                  ? `${selectedRange} return: ${formatSignedPercent(((chartMetrics.end - chartMetrics.start) / Math.max(chartMetrics.start, 1)) * 100)}`
                  : `${selectedRange} return: waiting for stored bars`}
              </span>
              <span>
                {chartMetrics
                  ? `${chartMetrics.points} bars · ${chartMetrics.startDate} to ${chartMetrics.endDate}`
                  : "History metadata pending"}
              </span>
            </div>
          </section>

          <aside className={styles.noteGrid}>
            <section className={`glass ${styles.sideStack}`}>
              <div className={styles.cardHeader}>
                <div>
                  <p className="eyebrow">At a glance</p>
                  <h2>What this screen is telling you</h2>
                </div>
              </div>
              <div className={styles.noteCard}>
                <strong>Desk context</strong>
                <p className={styles.supportingNote}>{contextSummary}</p>
              </div>
              <div className={styles.noteCard}>
                <strong>Aggregate payload route</strong>
                <p className={styles.supportingNote}>
                  Reference and explanatory cards now read <code>/api/trading/agent-context/symbol-day</code> with
                  <code> market_date={marketDate} </code> and <code>symbols={symbol}</code>.
                </p>
              </div>
              <div className={styles.noteCard}>
                <strong>Tracked universe</strong>
                <p className={styles.supportingNote}>
                  The tracked-symbol scanner list currently powers the main dashboard universe, counts, and tracked search suggestions. This detail screen no longer requests that list because it does not change any symbol-specific rendering here.
                </p>
              </div>
              <div className={styles.noteCard}>
                <strong>History route</strong>
                <p className={styles.supportingNote}>
                  The candlestick chart now uses <code>/api/trading/symbols/[symbol]/price-bars</code>. Live feed mode,
                  last price, volume, and turnover still use <code>/api/trading/quotes/[symbol]</code>, paired with
                  <code> /api/trading/market/status </code> until both return <code>CLOSED</code>. Company metadata,
                  technical snapshot, action summary, fundamentals summary, and disclosures come from
                  <code> /api/trading/agent-context/symbol-day </code>.
                </p>
              </div>
              <div className={styles.noteCard}>
                <strong>Quote provenance</strong>
                <p className={styles.supportingNote}>
                  Current quote mode: <code>{quote?.source ?? "pending"}</code>. The backend now marks quotes as
                  explicitly unavailable when no fresh live, same-day cache, or acceptable DB EOD fallback exists.
                </p>
              </div>
              <div className={styles.noteCard}>
                <strong>EOD timing</strong>
                <p className={styles.supportingNote}>
                  Stored technical snapshots are keyed by completed trading day, not by the current Seoul calendar day.
                  Around pre-open and intraday windows, a symbol can legitimately show yesterday&apos;s last completed
                  packet as the newest available EOD context.
                </p>
              </div>
              <div className={styles.noteCard}>
                <strong>DART coverage</strong>
                <p className={styles.supportingNote}>
                  DART fundamentals and disclosure rows are batch-ingested over the active universe. A valid symbol can
                  still show empty DART coverage when its backfill batch has not been processed yet.
                </p>
              </div>
            </section>
          </aside>
        </section>

        {(quoteError || metaError || historyError || contextError) ? (
          <section className={styles.detailGrid}>
            {quoteError ? <div className={styles.feedback}>{quoteError}</div> : null}
            {metaError ? <div className={styles.feedback}>{metaError}</div> : null}
            {historyError ? <div className={styles.feedback}>{historyError}</div> : null}
            {contextError ? <div className={styles.feedback}>{contextError}</div> : null}
          </section>
        ) : null}

        <section className={styles.detailGrid}>
          <section className={`glass ${styles.infoCard}`}>
            <div className={styles.cardHeader}>
              <div>
                <p className="eyebrow">Reference</p>
                <h2>Backend-backed symbol facts</h2>
              </div>
            </div>
            <div className={styles.infoList}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Company</span>
                <strong className={styles.infoValue}>
                  {aggregateContext?.company.name_ko ?? aggregateContext?.company.dart.corp_name ?? meta?.name_ko ?? quote?.company_name ?? "-"}
                </strong>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Symbol</span>
                <strong className={styles.infoValue}>{symbol}</strong>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Market</span>
                <strong className={styles.infoValue}>{aggregateContext?.company.market ?? meta?.market ?? "-"}</strong>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Standard code</span>
                <strong className={styles.infoValue}>{aggregateContext?.company.standard_code ?? meta?.standard_code ?? "-"}</strong>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>DART corp code</span>
                <strong className={styles.infoValue}>{aggregateContext?.company.dart.corp_code ?? "-"}</strong>
              </div>
            </div>
          </section>

          <section className={`glass ${styles.infoCard}`}>
            <div className={styles.cardHeader}>
              <div>
                <p className="eyebrow">Market Activity</p>
                <h2>Live quote snapshot</h2>
              </div>
            </div>
            <div className={styles.infoList}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Market state</span>
                <strong className={styles.infoValue}>{quote?.market_state ?? "-"}</strong>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Market status route</span>
                <strong className={styles.infoValue}>
                  {marketStatus ? `${marketStatus.state} (${quotePollingStopped ? "polling stopped" : "polling active"})` : "-"}
                </strong>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Volume</span>
                <strong className={styles.infoValue}>{hasNumber(quote?.volume) ? quote.volume.toLocaleString() : "-"}</strong>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Turnover</span>
                <strong className={styles.infoValue}>{quote ? formatTurnover(quote.turnover) : "-"}</strong>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Feed provenance</span>
                <strong className={styles.infoValue}>
                  {quote
                    ? quote.available
                      ? `${quote.source} (${quote.fallback ? "fallback" : "primary"})`
                      : `unavailable (${quote.unavailable_reason ?? "no fresh fallback"})`
                    : "-"}
                </strong>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Updated</span>
                <strong className={styles.infoValue}>{formatDisplayTimestamp(quote?.cached_at ?? quote?.trade_date)}</strong>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Trade date</span>
                <strong className={styles.infoValue}>{quote?.trade_date ?? "-"}</strong>
              </div>
            </div>
          </section>

          <section className={`glass ${styles.infoCard}`}>
            <div className={styles.cardHeader}>
              <div>
                <p className="eyebrow">Agent Context</p>
                <h2>Aggregate payload coverage</h2>
              </div>
            </div>
            <p className={styles.contextBody}>{contextSummary}</p>
            <div className={styles.infoList}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Market date</span>
                <strong className={styles.infoValue}>{aggregateContext?.market_date ?? marketDate}</strong>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Company block</span>
                <strong className={styles.infoValue}>{aggregateContext?.availability.company ? "Present" : "Missing"}</strong>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Technical snapshot</span>
                <strong className={styles.infoValue}>{aggregateContext?.availability.technical_snapshot ? "Present" : "Missing"}</strong>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Action summary</span>
                <strong className={styles.infoValue}>{aggregateContext?.availability.action_summary ? "Present" : "Missing"}</strong>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Fundamentals summary</span>
                <strong className={styles.infoValue}>{aggregateContext?.availability.fundamentals ? "Present" : "Missing"}</strong>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Recent disclosures</span>
                <strong className={styles.infoValue}>{aggregateContext?.recent_disclosures.count ?? 0}</strong>
              </div>
            </div>
          </section>

          <section className={`glass ${styles.infoCard}`}>
            <div className={styles.cardHeader}>
              <div>
                <p className="eyebrow">Fundamentals</p>
                <h2>Latest stored summary</h2>
              </div>
            </div>
            <div className={styles.infoList}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Report</span>
                <strong className={styles.infoValue}>{latestFundamentals?.filing.report_name ?? latestFundamentals?.period.report_label ?? "-"}</strong>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Receipt date</span>
                <strong className={styles.infoValue}>{latestFundamentals?.filing.receipt_date ?? "-"}</strong>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Period end</span>
                <strong className={styles.infoValue}>{latestFundamentals?.period.period_end_date ?? "-"}</strong>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Statement</span>
                <strong className={styles.infoValue}>{latestFundamentals?.statement.fs_label ?? latestFundamentals?.statement.fs_div ?? "-"}</strong>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Rows captured</span>
                <strong className={styles.infoValue}>{latestFundamentals?.statement.row_count ?? 0}</strong>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Stored periods</span>
                <strong className={styles.infoValue}>{aggregateContext?.fundamentals.history_summary.entries ?? 0}</strong>
              </div>
            </div>
          </section>

          <section className={`glass ${styles.infoCard}`}>
            <div className={styles.cardHeader}>
              <div>
                <p className="eyebrow">Disclosures</p>
                <h2>Recent disclosure window</h2>
              </div>
            </div>
            {disclosureSectionState === "list" ? (
              <div className={styles.itemList}>
                {aggregateContext?.recent_disclosures.items.map((item) => (
                  <div key={item.rcept_no} className={styles.itemRow}>
                    <strong className={styles.itemTitle}>{item.report_nm}</strong>
                    <span className={styles.itemMeta}>
                      {item.receipt_date ?? "Date unknown"} · {humanizeToken(item.filing_category)} · {item.fundamentals_capture_status ?? "status unknown"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              disclosureSectionState === "loading" ? (
                <div className={styles.noteCard}>
                  <strong>Loading aggregate context</strong>
                  <p className={styles.supportingNote}>
                    Waiting for the symbol-day aggregate response before determining disclosure availability.
                  </p>
                </div>
              ) : disclosureSectionState === "unavailable" ? (
                <div className={styles.noteCard}>
                  <strong>Aggregate context unavailable</strong>
                  <p className={styles.supportingNote}>
                    Recent disclosures cannot be determined because the symbol-day aggregate request did not complete successfully.
                  </p>
                </div>
              ) : (
                <div className={styles.noteCard}>
                  <strong>No recent disclosures</strong>
                  <p className={styles.supportingNote}>
                    Trading-core did not return any disclosure events for this symbol inside the requested market-date window.
                  </p>
                </div>
              )
            )}
          </section>
        </section>

        <section className={styles.linkRow}>
          <Link href="/dashboard" className={styles.linkButton}>
            Back to dashboard
          </Link>
          <Link href="/search" className={styles.linkButton}>
            Open search workspace
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
