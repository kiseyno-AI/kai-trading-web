"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { formatDisplayTimestamp, formatPrice, formatTurnover } from "@/lib/format";

import styles from "./live-dashboard-client.module.css";

export type CoreMarketStatus = {
  state: string;
  is_open: boolean;
  server_time: string;
};

export type CoreTrackedQuote = {
  symbol: string;
  company_name?: string;
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

export type CoreTrackedSymbolsResponse = {
  tracked_symbols: string[];
  count: number;
  last_updated_at: string | null;
};

export type SymbolSearchItem = {
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

type LiveDashboardClientProps = {
  initialError?: string | null;
  initialMarket: CoreMarketStatus;
  initialTracked: CoreTrackedQuotesResponse;
  initialSymbols: CoreTrackedSymbolsResponse;
};

const compactNumberFormatter = new Intl.NumberFormat(undefined, {
  notation: "compact",
  compactDisplay: "short",
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

function getCompanyName(item: CoreTrackedQuote | undefined): string {
  if (!item) return "N/A";
  return item.company_name || item.symbol;
}

function hasNumber(value: number | null | undefined): value is number {
  return typeof value === "number";
}

function formatSignedPercent(value: number | null | undefined, fallback = "Unavailable"): string {
  if (!hasNumber(value)) return fallback;
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatSignedNumber(value: number | null | undefined, fallback = "Unavailable"): string {
  if (!hasNumber(value)) return fallback;
  return `${value >= 0 ? "+" : ""}${value.toLocaleString()}`;
}

function getJson<T>(path: string): Promise<T> {
  return fetch(path, { cache: "no-store" }).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json() as Promise<T>;
  });
}

function formatCompactMetric(value: number | null | undefined, fallback = "N/A"): string {
  if (!hasNumber(value)) return fallback;
  return compactNumberFormatter.format(value);
}

function getQuoteToneClass(value: number | null | undefined): string {
  if (!hasNumber(value)) return "";
  return value >= 0 ? styles.positive : styles.negative;
}

function describeQuoteSource(item: CoreTrackedQuote | undefined): string {
  if (!item) return "N/A";
  if (!item.available) {
    return item.unavailable_reason ? `Unavailable · ${item.unavailable_reason}` : "Unavailable";
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

export function LiveDashboardClient({
  initialError = null,
  initialMarket,
  initialTracked,
  initialSymbols,
}: LiveDashboardClientProps) {
  const router = useRouter();
  const [isMobileHeroExpanded, setIsMobileHeroExpanded] = useState(false);
  const [market, setMarket] = useState<CoreMarketStatus>(initialMarket);
  const [tracked, setTracked] = useState<CoreTrackedQuotesResponse>(initialTracked);
  const [symbols, setSymbols] = useState<CoreTrackedSymbolsResponse>(initialSymbols);
  const [error, setError] = useState<string | null>(initialError);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchItems, setSearchItems] = useState<SymbolSearchItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [coreUnavailable, setCoreUnavailable] = useState(() => initialMarket.state === "OFFLINE PLACEHOLDER");

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [marketData, trackedData, symbolsData] = await Promise.all([
          getJson<CoreMarketStatus>("/api/trading/market/status"),
          getJson<CoreTrackedQuotesResponse>("/api/trading/quotes/tracked"),
          getJson<CoreTrackedSymbolsResponse>("/api/trading/scanner/tracked-symbols"),
        ]);

        if (!active) return;
        setMarket(marketData);
        setTracked(trackedData);
        setSymbols(symbolsData);
        setError(null);
        setCoreUnavailable(false);
      } catch (loadError) {
        console.error("Dashboard polling failed", loadError);
        if (!active) return;
        setCoreUnavailable(true);
        setError(loadError instanceof Error ? loadError.message : "Failed to refresh dashboard data.");
      }
    };

    const timer = window.setInterval(load, 1000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const trimmedQuery = searchQuery.trim();

    if (trimmedQuery.length < 2) {
      setSearchItems([]);
      setSearchLoading(false);
      setSearchError(null);
      return;
    }

    let active = true;
    setSearchLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const data = await getJson<SymbolSearchResponse>(
          `/api/trading/symbols/search?q=${encodeURIComponent(trimmedQuery)}&limit=8`,
        );
        if (!active) return;
        setSearchItems(data.items);
        setSearchError(null);
      } catch (searchLoadError) {
        console.error("Symbol search failed", searchLoadError);
        if (!active) return;
        setSearchItems([]);
        setSearchError("Symbol search is unavailable. Check the upstream symbol master.");
      } finally {
        if (active) {
          setSearchLoading(false);
        }
      }
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  const lead = tracked.items[0];
  const fallbackSummary = error
    ? "Core feed unreachable. Showing local placeholder values until market status and tracked quote endpoints recover."
    : "Live data is unavailable, so the dashboard is showing local placeholder values.";

  const computed = useMemo(() => {
    const availableItems = tracked.items.filter((item) => item.available);
    const positiveCount = availableItems.filter((item) => (item.change_pct ?? 0) >= 0).length;
    const liveCount = tracked.items.filter((item) => item.is_live).length;
    const fallbackCount = tracked.items.filter((item) => item.fallback).length;
    const unavailableCount = tracked.items.filter((item) => !item.available).length;
    const totalTurnover = availableItems.reduce((sum, item) => sum + (item.turnover ?? 0), 0);
    const totalVolume = availableItems.reduce((sum, item) => sum + (item.volume ?? 0), 0);
    const averageMove = availableItems.length
      ? availableItems.reduce((sum, item) => sum + (item.change_pct ?? 0), 0) / availableItems.length
      : 0;

    return {
      availableCount: availableItems.length,
      positiveCount,
      liveCount,
      fallbackCount,
      unavailableCount,
      totalTurnover,
      totalVolume,
      averageMove,
      breadthRatio: availableItems.length ? positiveCount / availableItems.length : 0,
    };
  }, [tracked.items]);

  const movers = useMemo(
    () =>
      [...tracked.items]
        .filter((item) => item.available && hasNumber(item.change_pct))
        .sort((left, right) => Math.abs((right.change_pct ?? 0)) - Math.abs((left.change_pct ?? 0)))
        .slice(0, 5),
    [tracked.items],
  );

  const insightCards = [
    {
      label: "Lead tracked quote",
      value: lead?.symbol ?? "N/A",
      detail: lead ? (lead.available ? formatSignedPercent(lead.change_pct) : "Explicitly unavailable") : "Waiting for feed",
      tone: lead ? getQuoteToneClass(lead.change_pct) : "",
    },
    {
      label: "Positive in available set",
      value: `${Math.round(computed.breadthRatio * 100)}%`,
      detail: `${computed.positiveCount}/${computed.availableCount || 0} quote-ready names`,
      tone: styles.positive,
    },
    {
      label: "Tracked turnover",
      value: formatTurnover(computed.totalTurnover),
      detail: `Volume ${compactNumberFormatter.format(computed.totalVolume)}`,
      tone: "",
    },
    {
      label: "Tracked refresh",
      value: formatDisplayTimestamp(tracked.as_of),
      detail: market.state,
      tone: "",
    },
  ];

  const openSymbolDetail = (item: SymbolSearchItem) => {
    const detailUrl = `/dashboard/symbol/${encodeURIComponent(item.symbol)}?name=${encodeURIComponent(item.name_ko)}&market=${encodeURIComponent(item.market)}&standardCode=${encodeURIComponent(item.standard_code)}`;
    router.push(detailUrl);
  };

  return (
    <AppShell currentPath="/dashboard" title="Main Dashboard" eyebrow="Tracked Core Feed" compactMobileChrome>
      <div className={`page-stack ${styles.workspace}`}>
        {coreUnavailable ? (
          <section className={`glass ${styles.noticeBanner}`}>
            <div>
              <p className="eyebrow">Core unavailable</p>
              <strong>Offline placeholder active</strong>
            </div>
            <p>{fallbackSummary}</p>
          </section>
        ) : null}

        <section
          className={`${styles.heroShell} ${isMobileHeroExpanded ? styles.heroShellExpanded : ""}`}
          aria-label="Dashboard overview"
        >
          <section id="dashboard-hero-details" className={`glass ${styles.hero}`}>
            <div className={styles.heroCopy}>
              <div className={styles.heroHeaderRow}>
                <div className={styles.heroBadgeRow}>
                  <span className={styles.heroBadgeStrong}>{market.state}</span>
                  <span className={styles.heroBadge}>Tracked symbols {symbols.count}</span>
                  <span className={styles.heroBadge}>Client polling 1s</span>
                </div>
                <button
                  type="button"
                  className={styles.heroMobileToggle}
                  aria-expanded={isMobileHeroExpanded}
                  aria-controls="dashboard-hero-details"
                  onClick={() => setIsMobileHeroExpanded((current) => !current)}
                >
                  {isMobileHeroExpanded ? "Less" : "More"}
                </button>
              </div>
              <p className={styles.kicker}>Current core coverage only</p>
              <h1>Tracked Market Dashboard</h1>
              <p className={styles.heroSummary}>
                Built from `market/status`, `quotes/tracked`, `scanner/tracked-symbols`, and `symbols/search`. This
                pass keeps the Stitch-like density, but avoids claiming market-wide movers, automation state, or
                readiness signals that the backend does not expose yet.
              </p>
              <div className={styles.heroMobileSummary}>
                <div>
                  <span className={styles.heroMobileSummaryLabel}>Lead tracked quote</span>
                  <strong>{lead?.symbol ?? "N/A"}</strong>
                </div>
                <div>
                  <span className={styles.heroMobileSummaryLabel}>Last refresh</span>
                  <strong>{formatDisplayTimestamp(tracked.as_of)}</strong>
                </div>
                <div>
                  <span className={styles.heroMobileSummaryLabel}>Market</span>
                  <strong>{market.is_open ? "Open" : "Closed"}</strong>
                </div>
              </div>
              <div className={styles.heroDetails}>
                <div>
                  <span>Tracked symbols</span>
                  <strong>{symbols.tracked_symbols.join(", ") || "-"}</strong>
                </div>
                <div>
                  <span>Server time</span>
                  <strong>{formatDisplayTimestamp(market.server_time)}</strong>
                </div>
              </div>
            </div>

            <div className={styles.heroSpotlight}>
              <div className={styles.heroSpotlightHeader}>
                <div>
                  <p className="eyebrow">Lead tracked quote</p>
                  <h2>{getCompanyName(lead)}</h2>
                </div>
                <span className={`pill ${lead?.available ? (market.is_open ? "positive" : "neutral") : "warning"}`}>
                  {lead?.available ? (market.is_open ? "Open" : "Closed") : "Quote unavailable"}
                </span>
              </div>
              <strong className={styles.heroPrice}>{lead?.available ? `₩${formatPrice(lead.price)}` : "Unavailable"}</strong>
              <div className={`${styles.heroDelta} ${lead ? getQuoteToneClass(lead.change_pct) : ""}`}>
                {lead
                  ? lead.available
                    ? `${formatSignedPercent(lead.change_pct)} · ${formatSignedNumber(lead.change)}`
                    : (lead.unavailable_reason ?? "No fresh quote source available")
                  : "Waiting for quote"}
              </div>
              <div className={styles.heroMiniGrid}>
                <article>
                  <span>Turnover</span>
                  <strong>{lead?.available ? formatTurnover(lead.turnover) : "Unavailable"}</strong>
                </article>
                <article>
                  <span>Volume</span>
                  <strong>{lead?.available ? formatCompactMetric(lead.volume) : "Unavailable"}</strong>
                </article>
                <article>
                  <span>Quote time</span>
                  <strong>{formatDisplayTimestamp(lead?.as_of ?? lead?.trade_date ?? lead?.cached_at)}</strong>
                </article>
                <article>
                  <span>Quote source</span>
                  <strong>{describeQuoteSource(lead)}</strong>
                </article>
              </div>
            </div>
          </section>
        </section>

        <section className={styles.insightRail}>
          {insightCards.map((card) => (
            <article key={card.label} className={`glass ${styles.insightCard}`}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <p className={card.tone}>{card.detail}</p>
            </article>
          ))}
        </section>

        <section className={styles.dashboardGrid}>
          <div className={styles.primaryColumn}>
            <section className={`glass ${styles.panel}`}>
              <div className={styles.panelHeader}>
                <div>
                  <p className="eyebrow">Symbol command</p>
                  <h2>Search the master list and open symbol detail</h2>
                </div>
                <div className={styles.headerBadges}>
                  <span className="pill neutral">Min 2 chars</span>
                  <span className="pill neutral">In-app detail</span>
                </div>
              </div>

              <div className={styles.searchLayout}>
                <div className={styles.searchColumn}>
                  <label className={styles.searchField}>
                    <span className={styles.searchLabel}>Company or ticker</span>
                    <div className={styles.searchInputShell}>
                      <span className={styles.searchInputIcon}>SR</span>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Samsung / 005930"
                      />
                    </div>
                  </label>

                  <div className={styles.searchStatusRow}>
                    <span>
                      {searchLoading
                        ? "Searching symbol master"
                        : searchQuery.trim().length < 2
                          ? "Enter at least 2 characters"
                          : `${searchItems.length} matching results`}
                    </span>
                    <span>{searchError ?? "Results open the symbol detail screen inline"}</span>
                  </div>
                </div>

                <div className={styles.searchResultList}>
                  {searchQuery.trim().length < 2 ? (
                    <div className={styles.emptyState}>Start with a company name or ticker to search the symbol master.</div>
                  ) : null}

                  {searchItems.map((item) => (
                    <button
                      key={`${item.symbol}-${item.standard_code}`}
                      type="button"
                      className={styles.searchResultCard}
                      onClick={() => openSymbolDetail(item)}
                    >
                      <div>
                        <div className={styles.searchResultTitle}>{item.name_ko}</div>
                        <div className={styles.searchResultMeta}>
                          {item.symbol} · {item.standard_code}
                        </div>
                      </div>
                      <div className={styles.searchResultSide}>
                        <span className="pill neutral">{item.market}</span>
                        <span className={styles.searchResultHint}>Open detail</span>
                      </div>
                    </button>
                  ))}

                  {!searchLoading && searchQuery.trim().length >= 2 && searchItems.length === 0 && !searchError ? (
                    <div className={styles.emptyState}>No matching symbol or company was found in the master list.</div>
                  ) : null}
                </div>
              </div>
            </section>

            <section className={`glass ${styles.panel}`}>
              <div className={styles.panelHeader}>
                <div>
                  <p className="eyebrow">Quote board</p>
                  <h2>Tracked quotes from the current core feed</h2>
                </div>
                <div className={styles.headerBadges}>
                  <span className="pill positive">{computed.liveCount} flagged live</span>
                  <span className="pill neutral">{computed.fallbackCount} fallback</span>
                  <span className="pill warning">{computed.unavailableCount} unavailable</span>
                </div>
              </div>

              <div className={styles.quoteTable}>
                {tracked.items.map((item) => {
                  const barWidth = hasNumber(item.change_pct) ? Math.min(Math.abs(item.change_pct) * 12, 100) : 0;

                  return (
                    <article key={item.symbol} className={styles.quoteRow}>
                      <div className={styles.quoteIdentity}>
                        <strong>{item.symbol}</strong>
                        <span>{getCompanyName(item)}</span>
                      </div>
                      <div className={styles.quoteValue}>
                        <strong>{item.available ? `₩${formatPrice(item.price)}` : "Unavailable"}</strong>
                        <span>{item.available ? formatSignedNumber(item.change) : (item.unavailable_reason ?? "No fresh fallback")}</span>
                      </div>
                      <div className={styles.quoteMove}>
                        <strong className={getQuoteToneClass(item.change_pct)}>
                          {item.available ? formatSignedPercent(item.change_pct) : "Unavailable"}
                        </strong>
                        <div className={styles.quoteBarTrack}>
                          <div
                            className={`${styles.quoteBarFill} ${(item.change_pct ?? 0) >= 0 ? styles.quoteBarPositive : styles.quoteBarNegative}`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </div>
                      <div className={styles.quoteMeta}>
                        <span>Turnover {formatTurnover(item.turnover)}</span>
                        <span>Vol {formatCompactMetric(item.volume)}</span>
                        <span>{formatDisplayTimestamp(item.as_of ?? item.trade_date ?? item.cached_at)}</span>
                        <span>{describeQuoteSource(item)}</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>

          <aside className={styles.secondaryColumn}>
            <section className={`glass ${styles.panel} ${styles.sideFeature}`}>
              <div className={styles.panelHeader}>
                <div>
                  <p className="eyebrow">Tracked set facts</p>
                  <h2>Composition of the symbols we actually receive</h2>
                </div>
                <span className="pill neutral">{tracked.market_state}</span>
              </div>

              <div className={styles.progressGroup}>
                <div className={styles.progressHeader}>
                  <span>Positive available quotes</span>
                  <strong>{computed.positiveCount} names</strong>
                </div>
                <div className={styles.progressTrack}>
                  <div className={styles.progressFill} style={{ width: `${computed.breadthRatio * 100}%` }} />
                </div>
              </div>

              <div className={styles.progressGroup}>
                <div className={styles.progressHeader}>
                  <span>Quotes flagged live</span>
                  <strong>{computed.liveCount} active</strong>
                </div>
                <div className={styles.progressTrack}>
                  <div
                    className={`${styles.progressFill} ${styles.progressFillBlue}`}
                    style={{ width: `${tracked.items.length ? (computed.liveCount / tracked.items.length) * 100 : 0}%` }}
                  />
                </div>
              </div>

              <div className={styles.progressGroup}>
                <div className={styles.progressHeader}>
                  <span>Fallback quotes</span>
                  <strong>{computed.fallbackCount} symbols</strong>
                </div>
                <div className={styles.progressTrack}>
                  <div
                    className={`${styles.progressFill} ${styles.progressFillAmber}`}
                    style={{
                      width: `${tracked.items.length ? (computed.fallbackCount / tracked.items.length) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div className={styles.snapshotGrid}>
                <article className={styles.snapshotCard}>
                  <span>Average tracked move</span>
                  <strong className={getQuoteToneClass(computed.averageMove)}>{formatSignedPercent(computed.averageMove)}</strong>
                </article>
                <article className={styles.snapshotCard}>
                  <span>Tracked symbols</span>
                  <strong>{symbols.count}</strong>
                </article>
                <article className={styles.snapshotCard}>
                  <span>Unavailable quotes</span>
                  <strong>{computed.unavailableCount}</strong>
                </article>
              </div>
            </section>

            <section className={`glass ${styles.panel}`}>
              <div className={styles.panelHeader}>
                <div>
                  <p className="eyebrow">Tracked movers</p>
                  <h2>Largest absolute shifts inside the tracked list</h2>
                </div>
              </div>

              <div className={styles.moverList}>
                {movers.map((item) => (
                  <article key={item.symbol} className={styles.moverCard}>
                    <div>
                      <strong>{item.symbol}</strong>
                      <span>{getCompanyName(item)}</span>
                    </div>
                    <div className={styles.moverStats}>
                      <strong className={getQuoteToneClass(item.change_pct)}>{formatSignedPercent(item.change_pct)}</strong>
                      <span>₩{formatPrice(item.price)}</span>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className={`glass ${styles.panel}`}>
              <div className={styles.panelHeader}>
                <div>
                  <p className="eyebrow">Feed timestamps</p>
                  <h2>What the current endpoints tell us</h2>
                </div>
                <span className="pill neutral">No synthetic readiness score</span>
              </div>

              <div className={styles.healthList}>
                <div className={styles.healthRow}>
                  <span>Polling cadence</span>
                  <strong>1 second</strong>
                </div>
                <div className={styles.healthRow}>
                  <span>Market state</span>
                  <strong>{market.state}</strong>
                </div>
                <div className={styles.healthRow}>
                  <span>Server time</span>
                  <strong>{formatDisplayTimestamp(market.server_time)}</strong>
                </div>
                <div className={styles.healthRow}>
                  <span>Tracked list updated</span>
                  <strong>{formatDisplayTimestamp(symbols.last_updated_at, "N/A")}</strong>
                </div>
                <div className={styles.healthRow}>
                  <span>Last board refresh</span>
                  <strong>{formatDisplayTimestamp(tracked.as_of)}</strong>
                </div>
                <div className={styles.healthRow}>
                  <span>Lead source</span>
                  <strong>{describeQuoteSource(lead)}</strong>
                </div>
                <div className={styles.healthRow}>
                  <span>Lead quote availability</span>
                  <strong>{lead ? (lead.available ? (lead.is_live ? "Live" : "Fallback") : "Unavailable") : "N/A"}</strong>
                </div>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </AppShell>
  );
}
