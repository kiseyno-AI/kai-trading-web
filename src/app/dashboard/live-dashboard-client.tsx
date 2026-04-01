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
  initialMarket,
  initialTracked,
  initialSymbols,
}: LiveDashboardClientProps) {
  const [market, setMarket] = useState<CoreMarketStatus>(initialMarket);
  const [tracked, setTracked] = useState<CoreTrackedQuotesResponse>(initialTracked);
  const [symbols, setSymbols] = useState<CoreTrackedSymbolsResponse>(initialSymbols);
  const [error, setError] = useState<string | null>(null);
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
        setError("코어 서버에 연결하지 못해 현재는 mock snapshot을 유지하고 있습니다.");
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
        setSearchError("심볼 검색을 불러오지 못했습니다. 코어 심볼 마스터 연결을 확인하세요.");
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
              <strong>Local mock snapshot is active</strong>
            </div>
            <p>{error ?? "trading-core (127.0.0.1:8000)에 연결할 수 없어 mock 데이터로 렌더링 중입니다."}</p>
          </section>
        ) : null}

        <section className={`glass ${styles.hero}`}>
          <div className={styles.heroIntro}>
            <div className={styles.heroEyebrowRow}>
              <span className={styles.heroEyebrow}>Realtime workspace</span>
              <span className={styles.heroDivider} />
              <span className={styles.heroEyebrow}>Stitch-inspired desk layout</span>
            </div>
            <h1>Trading Dashboard Home</h1>
            <p className={styles.heroSummary}>
              High-density monitoring surface for tracked KRX symbols, symbol search, lead quote context, and core
              health. Existing data flows stay intact while the desk shifts to a cleaner control-room layout.
            </p>
            <div className={styles.heroMeta}>
              <span className={styles.heroPillStrong}>{market.state}</span>
              <span className={styles.heroPill}>1s refresh loop</span>
              <span className={styles.heroPill}>Tracked universe {symbols.count}</span>
            </div>
          </div>

          <div className={styles.heroStats}>
            <article className={styles.heroStatCard}>
              <span className={styles.statLabel}>Lead quote</span>
              <strong>{lead?.symbol ?? "N/A"}</strong>
              <span className={styles.statSubtle}>{getCompanyName(lead)}</span>
              <span className={`${styles.statDelta} ${lead ? getQuoteToneClass(lead.change_pct) : ""}`}>
                {lead ? formatSignedPercent(lead.change_pct) : "N/A"}
              </span>
            </article>
            <article className={styles.heroStatCard}>
              <span className={styles.statLabel}>Tracked turnover</span>
              <strong>{formatTurnover(computed.totalTurnover)}</strong>
              <span className={styles.statSubtle}>
                Volume {compactNumberFormatter.format(computed.totalVolume)}
              </span>
            </article>
            <article className={styles.heroStatCard}>
              <span className={styles.statLabel}>Breadth</span>
              <strong>{Math.round(computed.breadthRatio * 100)}%</strong>
              <span className={styles.statSubtle}>
                {computed.positiveCount}/{tracked.items.length || 0} symbols positive
              </span>
            </article>
          </div>
        </section>

        <section className={styles.commandGrid}>
          <div className={styles.primaryColumn}>
            <section className={`glass ${styles.panel} ${styles.searchPanel}`}>
              <div className={styles.panelHeader}>
                <div>
                  <p className="eyebrow">Symbol command</p>
                  <h2>Search master list and open detail windows</h2>
                </div>
                <div className={styles.headerBadges}>
                  <span className="pill neutral">Min 2 chars</span>
                  <span className="pill neutral">Window launch</span>
                </div>
              </div>

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
                <span>{searchError ?? "Opens detail in a new window"}</span>
              </div>

              <div className={styles.searchResultList}>
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
            </section>

            <section className={`glass ${styles.panel}`}>
              <div className={styles.panelHeader}>
                <div>
                  <p className="eyebrow">Market board</p>
                  <h2>Tracked quotes at a glance</h2>
                </div>
                <div className={styles.headerBadges}>
                  <span className="pill positive">{computed.liveCount} live</span>
                  <span className="pill neutral">{computed.fallbackCount} fallback</span>
                </div>
              </div>

              <div className={styles.quoteBoard}>
                {tracked.items.map((item) => (
                  <article key={item.symbol} className={styles.quoteCard}>
                    <div className={styles.quoteCardTop}>
                      <div>
                        <div className={styles.quoteCardTitle}>{getCompanyName(item)}</div>
                        <div className={styles.quoteCardMeta}>
                          {item.symbol} · {item.market_state} · {item.source}
                        </div>
                      </div>
                      <div className={`${styles.quoteDelta} ${getQuoteToneClass(item.change_pct)}`}>
                        {formatSignedPercent(item.change_pct)}
                      </div>
                    </div>

                    <div className={styles.quotePriceRow}>
                      <strong>₩{formatPrice(item.price)}</strong>
                      <span>{formatSignedNumber(item.change)}</span>
                    </div>

                    <div className={styles.metricStrip}>
                      <div className={styles.metricBlock}>
                        <span>Turnover</span>
                        <strong>{formatTurnover(item.turnover)}</strong>
                      </div>
                      <div className={styles.metricBlock}>
                        <span>Volume</span>
                        <strong>{compactNumberFormatter.format(item.volume)}</strong>
                      </div>
                      <div className={styles.metricBlock}>
                        <span>As of</span>
                        <strong>{formatDisplayTimestamp(item.as_of)}</strong>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </div>

          <aside className={styles.secondaryColumn}>
            <section className={`glass ${styles.panel} ${styles.spotlightPanel}`}>
              <div className={styles.panelHeader}>
                <div>
                  <p className="eyebrow">Lead spotlight</p>
                  <h2>{getCompanyName(lead)}</h2>
                </div>
                <span className={`pill ${market.is_open ? "positive" : "neutral"}`}>
                  {market.is_open ? "Open" : "Closed"}
                </span>
              </div>

              <div className={styles.spotlightPrice}>₩{lead ? formatPrice(lead.price) : "N/A"}</div>
              <div className={`${styles.spotlightChange} ${lead ? getQuoteToneClass(lead.change_pct) : ""}`}>
                {lead ? `${formatSignedPercent(lead.change_pct)} · ${formatSignedNumber(lead.change)}` : "N/A"}
              </div>

              <div className={styles.spotlightMetaGrid}>
                <div className={styles.metaPanel}>
                  <span>Tracked state</span>
                  <strong>{tracked.market_state}</strong>
                </div>
                <div className={styles.metaPanel}>
                  <span>Feed mode</span>
                  <strong>{lead?.is_live ? "Live" : "Cached"}</strong>
                </div>
                <div className={styles.metaPanel}>
                  <span>Quote time</span>
                  <strong>{formatDisplayTimestamp(lead?.as_of)}</strong>
                </div>
                <div className={styles.metaPanel}>
                  <span>Server time</span>
                  <strong>{formatDisplayTimestamp(market.server_time)}</strong>
                </div>
              </div>
            </section>

            <section className={`glass ${styles.panel}`}>
              <div className={styles.panelHeader}>
                <div>
                  <p className="eyebrow">Universe pulse</p>
                  <h2>Tracked breadth and readiness</h2>
                </div>
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
                  <span>Avg move</span>
                  <strong className={getQuoteToneClass(computed.averageMove)}>
                    {formatSignedPercent(computed.averageMove)}
                  </strong>
                </article>
                <article className={styles.snapshotCard}>
                  <span>Universe size</span>
                  <strong>{symbols.count}</strong>
                </article>
                <article className={styles.snapshotCard}>
                  <span>Scanner list</span>
                  <strong>{symbols.tracked_symbols.join(", ") || "-"}</strong>
                </article>
              </div>
            </section>

            <section className={`glass ${styles.panel}`}>
              <div className={styles.panelHeader}>
                <div>
                  <p className="eyebrow">Core health</p>
                  <h2>Connection and timing</h2>
                </div>
                <span className="pill positive">Connected</span>
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
