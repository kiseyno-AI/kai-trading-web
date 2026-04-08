"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { PageIntro } from "@/components/ui/page-intro";
import { formatDisplayTimestamp, formatPrice, formatTurnover } from "@/lib/format";
import type {
  AgentContextActionSummaryDto,
  AgentContextDisclosureDto,
  AgentContextItemDto,
  AgentContextResponseDto,
  AgentContextTechnicalSnapshotDto,
} from "@/types/trading-api";

import {
  buildInitialSymbolMeta,
  createSymbolMetaResetToken,
  shouldFetchSymbolMeta,
  type SymbolMetaSeed,
} from "./symbol-detail-state";
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
  price: number;
  change: number;
  change_pct: number;
  volume: number;
  turnover: number;
  market_state: string;
  source: string;
  fallback: boolean;
  is_live: boolean;
  cached_at?: string | null;
};

type TrackedSymbolsResponse = {
  tracked_symbols: string[];
  count: number;
  last_updated_at: string | null;
};

type RecentPricePoint = {
  price: number;
  timestamp: string;
};

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

function buildAggregateContextSummary(
  aggregateContext: AgentContextItemDto,
  isTracked: boolean,
  quote: QuoteResponse | null,
) {
  const parts = [
    isTracked
      ? "This symbol is still inside the tracked dashboard universe."
      : "This symbol is being opened on demand outside the tracked dashboard universe.",
  ];

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
    parts.push(buildQuoteContext(quote));
  }

  return parts.join(" ");
}

function appendRecentPrice(history: RecentPricePoint[], quote: QuoteResponse): RecentPricePoint[] {
  const timestamp = quote.cached_at ?? new Date().toISOString();
  const nextPoint = {
    price: quote.price,
    timestamp,
  };
  const previous = history[history.length - 1];

  if (previous && previous.price === nextPoint.price && previous.timestamp === nextPoint.timestamp) {
    return history;
  }

  return [...history, nextPoint].slice(-30);
}

function buildLinePath(points: Array<{ x: number; y: number }>) {
  return points.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
}

function buildAreaPath(points: Array<{ x: number; y: number }>, height: number, padding: number) {
  if (points.length === 0) return "";

  const first = points[0];
  const last = points[points.length - 1];
  return `M ${first.x} ${height - padding} L ${buildLinePath(points).slice(2)} L ${last.x} ${height - padding} Z`;
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

export default function SymbolDetailPage() {
  const params = useParams<{ symbol: string }>();
  const searchParams = useSearchParams();
  const symbol = useMemo(() => decodeURIComponent(params.symbol), [params.symbol]);
  const marketDate = useMemo(() => searchParams.get("marketDate") ?? getCurrentSeoulMarketDate(), [searchParams]);
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
  const [aggregateContext, setAggregateContext] = useState<AgentContextItemDto | null>(null);
  const [trackedSymbols, setTrackedSymbols] = useState<TrackedSymbolsResponse | null>(null);
  const [recentPrices, setRecentPrices] = useState<RecentPricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);

  useEffect(() => {
    setMeta(initialMeta);
    setQuote(null);
    setAggregateContext(null);
    setTrackedSymbols(null);
    setRecentPrices([]);
    setLoading(true);
    setMetaError(null);
    setQuoteError(null);
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

    const loadQuote = async () => {
      try {
        const data = await getJson<QuoteResponse>(`/api/trading/quotes/${encodeURIComponent(symbol)}`);
        if (!active) return;
        setQuote(data);
        setRecentPrices((current) => appendRecentPrice(current, data));
        setQuoteError(null);
      } catch (quoteLoadError) {
        console.error("Symbol quote load failed", quoteLoadError);
        if (!active) return;
        setQuoteError("Unable to load symbol quote details from trading-core.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadQuote();
    const timer = window.setInterval(loadQuote, 1500);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [symbol]);

  useEffect(() => {
    let active = true;

    const loadContext = async () => {
      const aggregateParams = new URLSearchParams();
      aggregateParams.set("market_date", marketDate);
      aggregateParams.append("symbols", symbol);
      aggregateParams.set("disclosures_limit", "5");
      if (fsDiv) {
        aggregateParams.set("fs_div", fsDiv);
      }

      const [aggregateResult, trackedSymbolsResult] = await Promise.allSettled([
        getJson<AgentContextResponseDto>(`/api/trading/agent-context/symbol-day?${aggregateParams.toString()}`),
        getJson<TrackedSymbolsResponse>("/api/trading/scanner/tracked-symbols"),
      ]);

      if (!active) return;

      const errors: string[] = [];

      if (aggregateResult.status === "fulfilled") {
        const exactMatch = aggregateResult.value.items.find((item) => item.symbol === symbol) ?? null;
        setAggregateContext(exactMatch);
        if (!exactMatch) {
          errors.push("Aggregate symbol context did not include this symbol.");
        }
      } else {
        console.error("Aggregate symbol context load failed", aggregateResult.reason);
        setAggregateContext(null);
        errors.push("Aggregate symbol context is unavailable right now.");
      }

      if (trackedSymbolsResult.status === "fulfilled") {
        setTrackedSymbols(trackedSymbolsResult.value);
      } else {
        console.error("Tracked-universe load failed", trackedSymbolsResult.reason);
        setTrackedSymbols(null);
        errors.push("Tracked-universe coverage is unavailable right now.");
      }

      setContextError(errors.length > 0 ? errors.join(" ") : null);
    };

    loadContext();

    return () => {
      active = false;
    };
  }, [fsDiv, marketDate, symbol]);

  const isTracked = useMemo(() => {
    return trackedSymbols?.tracked_symbols.includes(symbol) ?? false;
  }, [symbol, trackedSymbols]);

  const chartMetrics = useMemo(() => {
    if (recentPrices.length === 0) return null;

    const prices = recentPrices.map((point) => point.price);
    const low = Math.min(...prices);
    const high = Math.max(...prices);
    const start = recentPrices[0]?.price ?? low;
    const end = recentPrices[recentPrices.length - 1]?.price ?? high;

    return {
      low,
      high,
      start,
      end,
      points: recentPrices.length,
    };
  }, [recentPrices]);

  const chartGeometry = useMemo(() => {
    if (!chartMetrics) return null;

    const width = 640;
    const height = 280;
    const padding = 22;
    const spread = chartMetrics.high - chartMetrics.low || Math.max(chartMetrics.high * 0.002, 1);
    const baseline = recentPrices.length === 1 ? [recentPrices[0], recentPrices[0]] : recentPrices;
    const step = baseline.length > 1 ? (width - padding * 2) / (baseline.length - 1) : 0;
    const points = baseline.map((point, index) => {
      const normalized = (point.price - chartMetrics.low) / spread;
      const x = padding + index * step;
      const y = height - padding - normalized * (height - padding * 2);
      return { x, y };
    });

    return {
      width,
      height,
      padding,
      points,
      linePath: buildLinePath(points),
      areaPath: buildAreaPath(points, height, padding),
    };
  }, [chartMetrics, recentPrices]);

  const lineColor = (quote?.change_pct ?? 0) >= 0 ? "#35d07f" : "#ff6b7a";
  const latestFundamentals = aggregateContext?.fundamentals.latest_snapshot ?? null;
  const latestDisclosure = buildLatestDisclosure(aggregateContext?.recent_disclosures.items ?? []);
  const introTitle =
    aggregateContext?.company.name_ko ?? meta?.name_ko ?? quote?.company_name ?? aggregateContext?.company.dart.corp_name ?? symbol;
  const contextSummary = aggregateContext
    ? buildAggregateContextSummary(aggregateContext, isTracked, quote)
    : "Waiting for the aggregate symbol-day context from trading-core.";

  const summaryCards = [
    {
      label: "Last price",
      value: quote ? `KRW ${formatPrice(quote.price)}` : loading ? "Loading..." : "-",
      detail: quote ? `${formatSignedPercent(quote.change_pct)} · ${formatSignedNumber(quote.change)}` : "Awaiting quote snapshot",
      tone: quote ? (quote.change_pct >= 0 ? styles.positive : styles.negative) : "",
    },
    {
      label: "Technical snapshot",
      value: aggregateContext?.technical_snapshot
        ? `${humanizeToken(aggregateContext.technical_snapshot.trend_state)} · ${humanizeToken(aggregateContext.technical_snapshot.ma_alignment)}`
        : "Unavailable",
      detail: aggregateContext?.technical_snapshot
        ? `5D ${formatOptionalPercent(aggregateContext.technical_snapshot.return_5d)} · 20D ${formatOptionalPercent(aggregateContext.technical_snapshot.return_20d)} · Vol ${formatOptionalMultiple(aggregateContext.technical_snapshot.volume_ratio_20d)}`
        : `Stored market-date snapshot missing for ${marketDate}`,
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
      detail: latestFundamentals
        ? `${latestFundamentals.filing.receipt_date ?? "Date unknown"} · ${latestFundamentals.statement.fs_label ?? latestFundamentals.statement.fs_div} · ${aggregateContext?.recent_disclosures.count ?? 0} recent disclosure(s)`
        : latestDisclosure
          ? `Recent disclosure only: ${latestDisclosure.report_nm} (${latestDisclosure.receipt_date ?? "date unknown"})`
          : "No fundamentals or disclosures returned for this symbol-day packet",
      tone: "",
    },
  ];

  return (
    <AppShell currentPath="/dashboard" title={introTitle} eyebrow="Symbol Detail" compactMobileChrome>
      <div className={`page-stack ${styles.detailPage}`}>
        <PageIntro
          eyebrow="Symbol Detail"
          title={introTitle}
          description="The recent price chart and live quote metrics still poll the quote endpoint, while explanatory cards now read the backend aggregate symbol-day context for company metadata, technicals, action summary, fundamentals summary, and recent disclosures."
          aside={
            <div className={styles.introAside}>
              <span className="pill neutral">{symbol}</span>
              <span className="pill neutral">{aggregateContext?.company.market ?? meta?.market ?? quote?.market_state ?? "Market pending"}</span>
              <span className={`pill ${quote?.change_pct && quote.change_pct < 0 ? "warning" : "positive"}`}>
                {quote ? (quote.is_live ? "Live feed" : "Cached feed") : "Feed pending"}
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
                <p className="eyebrow">Recent Price Trace</p>
                <h2>Recent price chart</h2>
                <p>
                  Lightweight SVG rendering keeps the view smooth while the backend still exposes live quote snapshots
                  rather than a dedicated historical bar feed for this screen.
                </p>
              </div>
              <div className={styles.chartMeta}>
                <span className={styles.metaPill}>{recentPrices.length || 0} points</span>
                <span className={styles.metaPill}>Updated {formatDisplayTimestamp(quote?.cached_at)}</span>
              </div>
            </div>

            <div className={styles.chartFrame}>
              {chartGeometry ? (
                <svg
                  key={symbol}
                  viewBox={`0 0 ${chartGeometry.width} ${chartGeometry.height}`}
                  className={styles.chartSvg}
                  role="img"
                  aria-label={`Recent price trace for ${symbol}`}
                >
                  {[0.2, 0.5, 0.8].map((ratio) => {
                    const y = chartGeometry.height - chartGeometry.padding - ratio * (chartGeometry.height - chartGeometry.padding * 2);
                    return (
                      <line
                        key={ratio}
                        x1={chartGeometry.padding}
                        y1={y}
                        x2={chartGeometry.width - chartGeometry.padding}
                        y2={y}
                        className={styles.chartGridLine}
                      />
                    );
                  })}
                  <path d={chartGeometry.areaPath} className={styles.chartArea} fill={`${lineColor}22`} />
                  <path d={chartGeometry.linePath} className={styles.chartLine} stroke={lineColor} />
                  {chartGeometry.points.map((point, index) => (
                    <circle
                      key={`${point.x}-${point.y}-${index}`}
                      cx={point.x}
                      cy={point.y}
                      r={index === chartGeometry.points.length - 1 ? 4.5 : 2.2}
                      className={styles.chartDot}
                      fill={lineColor}
                    />
                  ))}
                  {chartMetrics ? (
                    <>
                      <text x={chartGeometry.padding} y={18} className={styles.axisLabel}>
                        High KRW {formatPrice(chartMetrics.high)}
                      </text>
                      <text
                        x={chartGeometry.padding}
                        y={chartGeometry.height - 8}
                        className={styles.axisLabel}
                      >
                        Low KRW {formatPrice(chartMetrics.low)}
                      </text>
                    </>
                  ) : null}
                </svg>
              ) : (
                <div className={styles.noteCard}>
                  <strong>Waiting for the first quote snapshot</strong>
                  <p className={styles.supportingNote}>
                    The chart will initialize as soon as trading-core returns the first symbol quote.
                  </p>
                </div>
              )}
            </div>

            <div className={styles.chartFooter}>
              <span>
                {chartMetrics
                  ? `Since entry: ${formatSignedPercent(((chartMetrics.end - chartMetrics.start) / Math.max(chartMetrics.start, 1)) * 100)}`
                  : "Since entry: waiting for enough points"}
              </span>
              <span>{quote ? `${quote.market_state} · ${quote.source}` : "Feed metadata pending"}</span>
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
                  {isTracked
                    ? "This symbol is part of the tracked dashboard universe, so aggregate context and live quote polling can be compared with the desk set."
                    : "This symbol is not in the tracked dashboard universe right now, so the page mixes on-demand quote polling with the aggregate symbol-day context packet."}
                </p>
              </div>
              <div className={styles.noteCard}>
                <strong>Recent-trace assumption</strong>
                <p className={styles.supportingNote}>
                  The chart, feed mode, last price, volume, and turnover still use <code>/api/trading/quotes/[symbol]</code>.
                  Company metadata, technical snapshot, action summary, fundamentals summary, and disclosures now come
                  from <code>/api/trading/agent-context/symbol-day</code>. Tracked coverage still comes from
                  <code> /api/trading/scanner/tracked-symbols </code>.
                </p>
              </div>
            </section>
          </aside>
        </section>

        {(quoteError || metaError || contextError) ? (
          <section className={styles.detailGrid}>
            {quoteError ? <div className={styles.feedback}>{quoteError}</div> : null}
            {metaError ? <div className={styles.feedback}>{metaError}</div> : null}
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
                <span className={styles.infoLabel}>Volume</span>
                <strong className={styles.infoValue}>{quote ? quote.volume.toLocaleString() : "-"}</strong>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Turnover</span>
                <strong className={styles.infoValue}>{quote ? formatTurnover(quote.turnover) : "-"}</strong>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Feed provenance</span>
                <strong className={styles.infoValue}>{quote ? `${quote.source} (${quote.fallback ? "fallback" : "primary"})` : "-"}</strong>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Updated</span>
                <strong className={styles.infoValue}>{formatDisplayTimestamp(quote?.cached_at)}</strong>
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
            {aggregateContext?.recent_disclosures.items.length ? (
              <div className={styles.itemList}>
                {aggregateContext.recent_disclosures.items.map((item) => (
                  <div key={item.rcept_no} className={styles.itemRow}>
                    <strong className={styles.itemTitle}>{item.report_nm}</strong>
                    <span className={styles.itemMeta}>
                      {item.receipt_date ?? "Date unknown"} · {humanizeToken(item.filing_category)} · {item.fundamentals_capture_status ?? "status unknown"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.noteCard}>
                <strong>No recent disclosures</strong>
                <p className={styles.supportingNote}>
                  Trading-core did not return any disclosure events for this symbol inside the requested market-date window.
                </p>
              </div>
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
