"use client";

import { useEffect, useMemo, useState } from "react";

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
  price: number;
  change: number;
  change_pct: number;
  volume: number;
  turnover: number;
  as_of: string | null;
  market_state: string;
  source: string;
  fallback: boolean;
  is_live: boolean;
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

function formatSignedPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatSignedNumber(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toLocaleString()}`;
}

function getJson<T>(path: string): Promise<T> {
  return fetch(path, { cache: "no-store" }).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json() as Promise<T>;
  });
}

function getQuoteToneClass(value: number): string {
  return value >= 0 ? styles.positive : styles.negative;
}

export function LiveDashboardClient({
  initialError = null,
  initialMarket,
  initialTracked,
  initialSymbols,
}: LiveDashboardClientProps) {
  const [isMobileHeroExpanded, setIsMobileHeroExpanded] = useState(false);
  const [market, setMarket] = useState<CoreMarketStatus>(initialMarket);
  const [tracked, setTracked] = useState<CoreTrackedQuotesResponse>(initialTracked);
  const [symbols, setSymbols] = useState<CoreTrackedSymbolsResponse>(initialSymbols);
  const [error, setError] = useState<string | null>(initialError);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchItems, setSearchItems] = useState<SymbolSearchItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [coreUnavailable, setCoreUnavailable] = useState(() => initialMarket.state === "MOCK MODE");

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

  const computed = useMemo(() => {
    const positiveCount = tracked.items.filter((item) => item.change_pct >= 0).length;
    const liveCount = tracked.items.filter((item) => item.is_live).length;
    const fallbackCount = tracked.items.filter((item) => item.fallback).length;
    const totalTurnover = tracked.items.reduce((sum, item) => sum + item.turnover, 0);
    const totalVolume = tracked.items.reduce((sum, item) => sum + item.volume, 0);
    const averageMove = tracked.items.length
      ? tracked.items.reduce((sum, item) => sum + item.change_pct, 0) / tracked.items.length
      : 0;

    return {
      positiveCount,
      liveCount,
      fallbackCount,
      totalTurnover,
      totalVolume,
      averageMove,
      breadthRatio: tracked.items.length ? positiveCount / tracked.items.length : 0,
    };
  }, [tracked.items]);

  const movers = useMemo(
    () => [...tracked.items].sort((left, right) => Math.abs(right.change_pct) - Math.abs(left.change_pct)).slice(0, 5),
    [tracked.items],
  );

  const insightCards = [
    {
      label: "Lead quote",
      value: lead?.symbol ?? "N/A",
      detail: lead ? formatSignedPercent(lead.change_pct) : "Waiting for feed",
      tone: lead ? getQuoteToneClass(lead.change_pct) : "",
    },
    {
      label: "Positive breadth",
      value: `${Math.round(computed.breadthRatio * 100)}%`,
      detail: `${computed.positiveCount}/${tracked.items.length || 0} names`,
      tone: styles.positive,
    },
    {
      label: "Tracked turnover",
      value: formatTurnover(computed.totalTurnover),
      detail: `Volume ${compactNumberFormatter.format(computed.totalVolume)}`,
      tone: "",
    },
    {
      label: "Last refresh",
      value: formatDisplayTimestamp(tracked.as_of),
      detail: market.state,
      tone: "",
    },
  ];

  const openSymbolDetail = (item: SymbolSearchItem) => {
    const detailUrl = `/dashboard/symbol/${encodeURIComponent(item.symbol)}?name=${encodeURIComponent(item.name_ko)}&market=${encodeURIComponent(item.market)}&standardCode=${encodeURIComponent(item.standard_code)}`;
    window.open(detailUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <AppShell currentPath="/dashboard" title="Main Dashboard" eyebrow="Live KIS Core Feed">
      <div className={`page-stack ${styles.workspace}`}>
        {coreUnavailable ? (
          <section className={`glass ${styles.noticeBanner}`}>
            <div>
              <p className="eyebrow">Core unavailable</p>
              <strong>Mock snapshot is active</strong>
            </div>
            <p>{error ?? "Live trading API data is unavailable, so the dashboard is rendering a mock snapshot."}</p>
          </section>
        ) : null}

        <section
          className={`${styles.heroShell} ${isMobileHeroExpanded ? styles.heroShellExpanded : ""}`}
          aria-label="Dashboard overview"
        >
          <section id="dashboard-hero-details" className={`glass ${styles.hero}`}>
            <div className={styles.heroCopy}>
              <div className={styles.heroBadgeRow}>
                <span className={styles.heroBadgeStrong}>{market.state}</span>
                <span className={styles.heroBadge}>1 second polling</span>
                <span className={styles.heroBadge}>Tracked universe {symbols.count}</span>
              </div>
              <p className={styles.kicker}>Stitch-inspired command deck</p>
              <h1>Trading Dashboard Home</h1>
              <p className={styles.heroSummary}>
                A denser trading board with clearer hierarchy: lead quote context up top, actionable symbol search in
                the main lane, and side-rail health signals that stay readable while live data keeps updating.
              </p>
              <div className={styles.heroMobileSummary}>
                <div>
                  <span className={styles.heroMobileSummaryLabel}>Lead quote</span>
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
                  <span>Universe</span>
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
                  <p className="eyebrow">Lead spotlight</p>
                  <h2>{getCompanyName(lead)}</h2>
                </div>
                <span className={`pill ${market.is_open ? "positive" : "neutral"}`}>
                  {market.is_open ? "Open" : "Closed"}
                </span>
              </div>
              <strong className={styles.heroPrice}>₩{lead ? formatPrice(lead.price) : "N/A"}</strong>
              <div className={`${styles.heroDelta} ${lead ? getQuoteToneClass(lead.change_pct) : ""}`}>
                {lead ? `${formatSignedPercent(lead.change_pct)} · ${formatSignedNumber(lead.change)}` : "Waiting for quote"}
              </div>
              <div className={styles.heroMiniGrid}>
                <article>
                  <span>Turnover</span>
                  <strong>{lead ? formatTurnover(lead.turnover) : "N/A"}</strong>
                </article>
                <article>
                  <span>Volume</span>
                  <strong>{lead ? compactNumberFormatter.format(lead.volume) : "N/A"}</strong>
                </article>
                <article>
                  <span>Quote time</span>
                  <strong>{formatDisplayTimestamp(lead?.as_of)}</strong>
                </article>
                <article>
                  <span>Feed mode</span>
                  <strong>{lead?.is_live ? "Live" : "Cached"}</strong>
                </article>
              </div>
            </div>
          </section>
          <button
            type="button"
            className={styles.heroMobileToggle}
            aria-expanded={isMobileHeroExpanded}
            aria-controls="dashboard-hero-details"
            onClick={() => setIsMobileHeroExpanded((current) => !current)}
          >
            {isMobileHeroExpanded ? "Hide market snapshot" : "Show market snapshot"}
          </button>
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
                  <span className="pill neutral">New window</span>
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
                    <span>{searchError ?? "Results open detail in a new window"}</span>
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
                  <h2>Tracked tape with faster scanability</h2>
                </div>
                <div className={styles.headerBadges}>
                  <span className="pill positive">{computed.liveCount} live</span>
                  <span className="pill neutral">{computed.fallbackCount} fallback</span>
                </div>
              </div>

              <div className={styles.quoteTable}>
                {tracked.items.map((item) => {
                  const barWidth = Math.min(Math.abs(item.change_pct) * 12, 100);

                  return (
                    <article key={item.symbol} className={styles.quoteRow}>
                      <div className={styles.quoteIdentity}>
                        <strong>{item.symbol}</strong>
                        <span>{getCompanyName(item)}</span>
                      </div>
                      <div className={styles.quoteValue}>
                        <strong>₩{formatPrice(item.price)}</strong>
                        <span>{formatSignedNumber(item.change)}</span>
                      </div>
                      <div className={styles.quoteMove}>
                        <strong className={getQuoteToneClass(item.change_pct)}>{formatSignedPercent(item.change_pct)}</strong>
                        <div className={styles.quoteBarTrack}>
                          <div
                            className={`${styles.quoteBarFill} ${item.change_pct >= 0 ? styles.quoteBarPositive : styles.quoteBarNegative}`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </div>
                      <div className={styles.quoteMeta}>
                        <span>Turnover {formatTurnover(item.turnover)}</span>
                        <span>Vol {compactNumberFormatter.format(item.volume)}</span>
                        <span>{formatDisplayTimestamp(item.as_of)}</span>
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
                  <p className="eyebrow">Universe pulse</p>
                  <h2>Readiness and breadth</h2>
                </div>
                <span className="pill neutral">{tracked.market_state}</span>
              </div>

              <div className={styles.progressGroup}>
                <div className={styles.progressHeader}>
                  <span>Positive breadth</span>
                  <strong>{computed.positiveCount} names</strong>
                </div>
                <div className={styles.progressTrack}>
                  <div className={styles.progressFill} style={{ width: `${computed.breadthRatio * 100}%` }} />
                </div>
              </div>

              <div className={styles.progressGroup}>
                <div className={styles.progressHeader}>
                  <span>Live quotes</span>
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
                  <span>Fallback exposure</span>
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
                  <span>Average move</span>
                  <strong className={getQuoteToneClass(computed.averageMove)}>{formatSignedPercent(computed.averageMove)}</strong>
                </article>
                <article className={styles.snapshotCard}>
                  <span>Universe size</span>
                  <strong>{symbols.count}</strong>
                </article>
              </div>
            </section>

            <section className={`glass ${styles.panel}`}>
              <div className={styles.panelHeader}>
                <div>
                  <p className="eyebrow">Top movers</p>
                  <h2>Largest absolute shifts</h2>
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
                  <p className="eyebrow">Core health</p>
                  <h2>Connection and timing</h2>
                </div>
                <span className={`pill ${coreUnavailable ? "negative" : "positive"}`}>
                  {coreUnavailable ? "Degraded" : "Connected"}
                </span>
              </div>

              <div className={styles.healthList}>
                <div className={styles.healthRow}>
                  <span>Polling cadence</span>
                  <strong>1 second</strong>
                </div>
                <div className={styles.healthRow}>
                  <span>Tracked updated</span>
                  <strong>{formatDisplayTimestamp(symbols.last_updated_at, "N/A")}</strong>
                </div>
                <div className={styles.healthRow}>
                  <span>Last board refresh</span>
                  <strong>{formatDisplayTimestamp(tracked.as_of)}</strong>
                </div>
                <div className={styles.healthRow}>
                  <span>Lead source</span>
                  <strong>{lead?.source ?? "N/A"}</strong>
                </div>
                <div className={styles.healthRow}>
                  <span>Market open</span>
                  <strong>{market.is_open ? "Yes" : "No"}</strong>
                </div>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </AppShell>
  );
}
