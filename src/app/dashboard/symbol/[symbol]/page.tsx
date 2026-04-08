"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { PageIntro } from "@/components/ui/page-intro";
import { formatDisplayTimestamp, formatPrice, formatTurnover } from "@/lib/format";

import styles from "./symbol-detail.module.css";

type SymbolSearchItem = {
  symbol: string;
  standard_code: string;
  name_ko: string;
  market: string;
};

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

type TrackedQuoteResponse = {
  market_state: string;
  as_of: string;
  items: Array<
    QuoteResponse & {
      as_of: string | null;
    }
  >;
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

function buildTrackedContext(quote: Pick<QuoteResponse, "fallback" | "is_live" | "market_state">) {
  if (quote.fallback) return "Fallback snapshot is active for this symbol.";
  if (quote.is_live) return "Live tracked quote is flowing through the core feed.";
  return `Market state is ${quote.market_state.toLowerCase()} on the current feed.`;
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

export default function SymbolDetailPage() {
  const params = useParams<{ symbol: string }>();
  const searchParams = useSearchParams();
  const symbol = useMemo(() => decodeURIComponent(params.symbol), [params.symbol]);
  const initialMeta = useMemo(() => {
    const name = searchParams.get("name");
    const market = searchParams.get("market");
    const standardCode = searchParams.get("standardCode");

    if (!name && !market && !standardCode) {
      return null;
    }

    return {
      symbol,
      name_ko: name ?? symbol,
      market: market ?? "-",
      standard_code: standardCode ?? "-",
    };
  }, [searchParams, symbol]);
  const [meta, setMeta] = useState<SymbolSearchItem | null>(initialMeta);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [trackedQuotes, setTrackedQuotes] = useState<TrackedQuoteResponse | null>(null);
  const [trackedSymbols, setTrackedSymbols] = useState<TrackedSymbolsResponse | null>(null);
  const [recentPrices, setRecentPrices] = useState<RecentPricePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [contextError, setContextError] = useState<string | null>(null);

  useEffect(() => {
    setMeta(initialMeta);
    setQuote(null);
    setRecentPrices([]);
    setLoading(true);
    setMetaError(null);
    setQuoteError(null);
  }, [initialMeta]);

  useEffect(() => {
    let active = true;

    const loadMeta = async () => {
      if (meta) return;

      try {
        const data = await getJson<SymbolSearchResponse>(`/api/trading/symbols/search?q=${encodeURIComponent(symbol)}&limit=20`);
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
  }, [meta, symbol]);

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
      try {
        const [trackedData, trackedSymbolsData] = await Promise.all([
          getJson<TrackedQuoteResponse>("/api/trading/quotes/tracked"),
          getJson<TrackedSymbolsResponse>("/api/trading/scanner/tracked-symbols"),
        ]);

        if (!active) return;
        setTrackedQuotes(trackedData);
        setTrackedSymbols(trackedSymbolsData);
        setContextError(null);
      } catch (contextLoadError) {
        console.error("Supplemental symbol context load failed", contextLoadError);
        if (!active) return;
        setContextError("Tracked-universe context is unavailable right now.");
      }
    };

    loadContext();

    return () => {
      active = false;
    };
  }, []);

  const trackedMatch = useMemo(
    () => trackedQuotes?.items.find((item) => item.symbol === symbol) ?? null,
    [symbol, trackedQuotes],
  );

  const isTracked = useMemo(() => {
    if (trackedMatch) return true;
    return trackedSymbols?.tracked_symbols.includes(symbol) ?? false;
  }, [symbol, trackedMatch, trackedSymbols]);

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
  const introTitle = quote?.company_name || meta?.name_ko || symbol;
  const contextSummary = quote
    ? `${isTracked ? "Included in the tracked dashboard universe." : "Loaded on demand outside the tracked dashboard set."} ${buildTrackedContext(quote)}`
    : "Waiting for the latest symbol snapshot from trading-core.";

  const summaryCards = [
    {
      label: "Last price",
      value: quote ? `₩${formatPrice(quote.price)}` : loading ? "Loading..." : "-",
      detail: quote ? `${formatSignedPercent(quote.change_pct)} · ${formatSignedNumber(quote.change)}` : "Awaiting quote snapshot",
      tone: quote ? (quote.change_pct >= 0 ? styles.positive : styles.negative) : "",
    },
    {
      label: "Recent range",
      value:
        chartMetrics
          ? `₩${formatPrice(chartMetrics.low)} - ₩${formatPrice(chartMetrics.high)}`
          : "Building trace",
      detail:
        chartMetrics
          ? `${chartMetrics.points} recent snapshots collected on this page`
          : "The current backend exposes snapshots, so the trace starts when you open this screen.",
      tone: "",
    },
    {
      label: "Desk coverage",
      value: isTracked ? "Tracked" : "On demand",
      detail: trackedSymbols ? `${trackedSymbols.count} symbols in the current tracked universe` : "Tracked-universe context pending",
      tone: "",
    },
    {
      label: "Feed mode",
      value: quote ? (quote.is_live ? "Live" : "Cached") : "-",
      detail: quote ? `${quote.source} · ${quote.fallback ? "fallback path" : "primary path"}` : "Waiting for feed context",
      tone: "",
    },
  ];

  return (
    <AppShell currentPath="/dashboard" title={introTitle} eyebrow="Symbol Detail" compactMobileChrome>
      <div className={`page-stack ${styles.detailPage}`}>
        <PageIntro
          eyebrow="Symbol Detail"
          title={introTitle}
          description="Normal in-app detail route for a selected symbol. Recent price trace is built from the live quote snapshot endpoint, while reference and desk context come from the current trading-core payloads."
          aside={
            <div className={styles.introAside}>
              <span className="pill neutral">{symbol}</span>
              <span className="pill neutral">{meta?.market ?? quote?.market_state ?? "Market pending"}</span>
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
                  Lightweight SVG rendering keeps the view smooth while the current backend supplies snapshot quotes
                  rather than a dedicated historical bar feed.
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
                        High ₩{formatPrice(chartMetrics.high)}
                      </text>
                      <text
                        x={chartGeometry.padding}
                        y={chartGeometry.height - 8}
                        className={styles.axisLabel}
                      >
                        Low ₩{formatPrice(chartMetrics.low)}
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
                <strong>Tracked universe</strong>
                <p className={styles.supportingNote}>
                  {isTracked
                    ? "This symbol is part of the tracked dashboard universe, so it can be compared directly with the live desk feed."
                    : "This symbol is not in the tracked dashboard universe right now, so this view focuses on on-demand quote detail."}
                </p>
              </div>
              <div className={styles.noteCard}>
                <strong>Recent-trace assumption</strong>
                <p className={styles.supportingNote}>
                  No recent price-history endpoint is wired in this repo today. The chart uses rolling snapshots from
                  <code> /api/trading/quotes/[symbol] </code> and starts when the page opens.
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
                <strong className={styles.infoValue}>{meta?.name_ko ?? quote?.company_name ?? "-"}</strong>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Symbol</span>
                <strong className={styles.infoValue}>{symbol}</strong>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Market</span>
                <strong className={styles.infoValue}>{meta?.market ?? "-"}</strong>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Standard code</span>
                <strong className={styles.infoValue}>{meta?.standard_code ?? "-"}</strong>
              </div>
            </div>
          </section>

          <section className={`glass ${styles.infoCard}`}>
            <div className={styles.cardHeader}>
              <div>
                <p className="eyebrow">Market Activity</p>
                <h2>Quote payload detail</h2>
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
                <span className={styles.infoLabel}>Updated</span>
                <strong className={styles.infoValue}>{formatDisplayTimestamp(quote?.cached_at)}</strong>
              </div>
            </div>
          </section>

          <section className={`glass ${styles.infoCard}`}>
            <div className={styles.cardHeader}>
              <div>
                <p className="eyebrow">Desk Context</p>
                <h2>Why the current payload matters</h2>
              </div>
            </div>
            <p className={styles.contextBody}>
              {trackedMatch
                ? buildTrackedContext(trackedMatch)
                : "This symbol is not currently surfaced inside the tracked quotes response, so the desk context is limited to the on-demand quote snapshot and symbol-master record."}
            </p>
            <div className={styles.infoList}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Tracked match</span>
                <strong className={styles.infoValue}>{trackedMatch ? "Present" : "Not present"}</strong>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Tracked universe</span>
                <strong className={styles.infoValue}>{isTracked ? "Included" : "Excluded"}</strong>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Feed provenance</span>
                <strong className={styles.infoValue}>{quote ? `${quote.source} (${quote.fallback ? "fallback" : "primary"})` : "-"}</strong>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Universe updated</span>
                <strong className={styles.infoValue}>{formatDisplayTimestamp(trackedSymbols?.last_updated_at)}</strong>
              </div>
            </div>
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
