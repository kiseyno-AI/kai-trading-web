"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { ComponentTag } from "@/components/dev/component-tag";
import { AppShell } from "@/components/layout/app-shell";
import { formatDisplayTimestamp, formatPrice, formatTurnover } from "@/lib/format";
import type { EodFreshnessResponseDto } from "@/types/trading-api";

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
  initialFreshness: EodFreshnessResponseDto | null;
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
  return `${value >= 0 ? "+" : ""}${value.toLocaleString()}`;
}

function getCompanyName(item: CoreTrackedQuote | undefined): string {
  if (!item) return "N/A";
  return item.company_name || item.symbol;
}

function getJson<T>(path: string): Promise<T> {
  return fetch(path, { cache: "no-store" }).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json() as Promise<T>;
  });
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

function getPriceFreshnessLabel(item: CoreTrackedQuote) {
  if (!item.available) return "Unavailable";
  if (item.is_live) return "Live";
  if (item.trade_date) return item.trade_date;
  return formatDisplayTimestamp(item.as_of ?? item.cached_at, "Pending");
}

function getTechnicalFreshnessLabel(freshness: EodFreshnessResponseDto | null) {
  return freshness?.latest?.technical_market_date ?? "[확인 필요]";
}

function getFreshnessTone(status: string | null | undefined) {
  if (!status) return "warning";
  if (status === "completed") return "positive";
  if (status === "completed_with_errors") return "warning";
  if (status === "running") return "info";
  return "neutral";
}

function humanizeStatus(status: string | null | undefined) {
  if (!status) return "[확인 필요]";
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function LiveDashboardClient({
  initialError = null,
  initialMarket,
  initialTracked,
  initialSymbols,
  initialFreshness,
}: LiveDashboardClientProps) {
  const router = useRouter();
  const [market, setMarket] = useState<CoreMarketStatus>(initialMarket);
  const [tracked, setTracked] = useState<CoreTrackedQuotesResponse>(initialTracked);
  const [symbols, setSymbols] = useState<CoreTrackedSymbolsResponse>(initialSymbols);
  const [freshness, setFreshness] = useState<EodFreshnessResponseDto | null>(initialFreshness);
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

    load();
    const timer = window.setInterval(load, 4_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

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
  const availableItems = tracked.items.filter((item) => item.available);
  const positiveCount = availableItems.filter((item) => (item.change_pct ?? 0) >= 0).length;
  const liveCount = tracked.items.filter((item) => item.is_live).length;
  const fallbackCount = tracked.items.filter((item) => item.fallback).length;
  const unavailableCount = tracked.items.filter((item) => !item.available).length;
  const totalTurnover = availableItems.reduce((sum, item) => sum + (item.turnover ?? 0), 0);
  const breadthRatio = availableItems.length ? positiveCount / availableItems.length : 0;

  const movers = useMemo(
    () =>
      [...tracked.items]
        .filter((item) => item.available && hasNumber(item.change_pct))
        .sort((left, right) => Math.abs((right.change_pct ?? 0)) - Math.abs((left.change_pct ?? 0)))
        .slice(0, 3),
    [tracked.items],
  );

  const summaryCards = [
    {
      id: "tracked-count",
      label: "Tracked symbols",
      value: String(symbols.count),
      detail: `${positiveCount} positive · ${unavailableCount} unavailable`,
      tone: "",
    },
    {
      id: "turnover",
      label: "Tracked turnover",
      value: formatTurnover(totalTurnover),
      detail: `As of ${formatDisplayTimestamp(tracked.as_of)}`,
      tone: "",
    },
    {
      id: "breadth",
      label: "Positive breadth",
      value: `${Math.round(breadthRatio * 100)}%`,
      detail: `${positiveCount}/${availableItems.length || 0} quote-ready names`,
      tone: styles.positive,
    },
    {
      id: "lead-source",
      label: "Lead feed mode",
      value: lead ? (lead.available ? (lead.is_live ? "Live" : "Fallback") : "Unavailable") : "Pending",
      detail: describeQuoteSource(lead),
      tone: lead?.available === false ? styles.negative : "",
    },
  ];

  const moduleRows = [
    {
      id: "price",
      label: "Price Module",
      status: lead?.available ? "Optimal" : "Unavailable",
      meta: freshness?.latest?.price_trade_date ?? lead?.trade_date ?? "[확인 필요]",
      coverage: `${availableItems.length}/${tracked.items.length} symbols ready`,
      tone: lead?.available ? "positive" : "warning",
    },
    {
      id: "technical",
      label: "Technical Analysis",
      status: freshness?.latest?.technical_market_date ? "Synced" : "[확인 필요]",
      meta: freshness?.latest?.technical_market_date ?? "[확인 필요]",
      coverage: "EOD-derived snapshot date",
      tone: freshness?.latest?.technical_market_date ? "info" : "warning",
    },
    {
      id: "action",
      label: "Action Summary",
      status: freshness?.latest?.action_market_date ? "Synced" : "[확인 필요]",
      meta: freshness?.latest?.action_market_date ?? "[확인 필요]",
      coverage: "Deterministic action layer",
      tone: freshness?.latest?.action_market_date ? "info" : "warning",
    },
    {
      id: "fundamentals",
      label: "Fundamentals",
      status: "[확인 필요]",
      meta: "[확인 필요]",
      coverage: "Freshness API not exposed in current web layer",
      tone: "neutral",
    },
  ] as const;

  const derivedNotes = [
    {
      id: "momentum",
      title: movers[0] ? `${movers[0].symbol} leads tracked momentum` : "Tracked momentum is waiting for live coverage",
      detail: movers[0]
        ? `${getCompanyName(movers[0])} is the largest absolute mover at ${formatSignedPercent(movers[0].change_pct)}.`
        : "No tracked quote has enough available data to rank momentum yet.",
      api: "/api/trading/quotes/tracked",
    },
    {
      id: "risk",
      title: unavailableCount > 0 ? `${unavailableCount} tracked quote(s) need attention` : "Fallback pressure is currently contained",
      detail:
        unavailableCount > 0
          ? "Unavailable symbols stay explicit instead of dropping to zero. Review the quote cards before acting on relative strength."
          : `${fallbackCount} symbols are on fallback paths, but the board still has live coverage for ${liveCount} tracked names.`,
      api: "/api/trading/quotes/tracked",
    },
    {
      id: "freshness",
      title: `EOD registry ${humanizeStatus(freshness?.today?.eod_status)}`,
      detail:
        freshness?.today?.trade_date
          ? `Price latest ${freshness.latest?.price_trade_date ?? "[확인 필요]"} · technical latest ${freshness.latest?.technical_market_date ?? "[확인 필요]"}.`
          : "Current web layer can read the freshness registry, but some module-level dates remain unavailable.",
      api: "/api/trading/eod/freshness",
    },
  ];

  const openSymbolDetail = (item: SymbolSearchItem) => {
    const detailUrl = `/dashboard/symbol/${encodeURIComponent(item.symbol)}?name=${encodeURIComponent(item.name_ko)}&market=${encodeURIComponent(item.market)}&standardCode=${encodeURIComponent(item.standard_code)}`;
    router.push(detailUrl);
  };

  const openTrackedDetail = (item: CoreTrackedQuote) => {
    const params = new URLSearchParams();
    params.set("name", item.company_name ?? item.symbol);
    params.set("market", "KRX");
    router.push(`/dashboard/symbol/${encodeURIComponent(item.symbol)}?${params.toString()}`);
  };

  const statusTone = getFreshnessTone(freshness?.today?.eod_status);
  const statusLabel = humanizeStatus(freshness?.today?.eod_status);

  return (
    <AppShell currentPath="/dashboard" title="Tracked Market Dashboard" eyebrow="Obsidian Ledger" compactMobileChrome>
      <div className={`page-stack ${styles.workspace}`}>
        {coreUnavailable ? (
          <section className={`glass ${styles.noticeBanner}`}>
            <ComponentTag label="dashboard.core-unavailable" api="/api/trading/market/status + /api/trading/quotes/tracked" />
            <div>
              <p className="eyebrow">Core unavailable</p>
              <strong>Offline placeholder active</strong>
            </div>
            <p className="clamp-3">
              {error ?? "Core feed unreachable. Showing placeholder values until the upstream endpoints recover."}
            </p>
          </section>
        ) : null}

        <section className={`glass ${styles.operationalCard}`} id="dashboard-freshness">
          <ComponentTag label="dashboard.operational-integrity" api="/api/trading/eod/freshness + /api/trading/market/status" />
          <div className={styles.sectionHeader}>
            <div>
              <p className="eyebrow">Market Freshness Registry</p>
              <h1>Operational Integrity</h1>
              <p className={`clamp-3 ${styles.sectionCopy}`}>
                Mobile dashboard cards now anchor to real market-state and freshness signals first, then layer tracked
                symbol summaries without inventing portfolio data that the current core APIs do not expose.
              </p>
            </div>
            <span className={`pill ${statusTone}`}>{statusLabel}</span>
          </div>

          <div className={styles.heroStats}>
            <article className={styles.heroStatCard}>
              <span>Market state</span>
              <strong>{market.state}</strong>
              <p className="clamp-3">Server time {formatDisplayTimestamp(market.server_time)}</p>
            </article>
            <article className={styles.heroStatCard}>
              <span>EOD trade date</span>
              <strong>{freshness?.today?.trade_date ?? "[확인 필요]"}</strong>
              <p className="clamp-3">
                {freshness?.today?.symbols_succeeded ?? "[확인 필요]"} / {freshness?.today?.symbols_total ?? "[확인 필요]"} symbols succeeded
              </p>
            </article>
            <article className={styles.heroStatCard}>
              <span>Price latest</span>
              <strong>{freshness?.latest?.price_trade_date ?? lead?.trade_date ?? "[확인 필요]"}</strong>
              <p className="clamp-3">Tracked board refreshed {formatDisplayTimestamp(tracked.as_of)}</p>
            </article>
          </div>

          <div className={styles.moduleList}>
            {moduleRows.map((row) => (
              <article key={row.id} className={styles.moduleRow}>
                <div>
                  <strong>{row.label}</strong>
                  <p className="clamp-3">{row.coverage}</p>
                </div>
                <div className={styles.moduleMeta}>
                  <span>{row.meta}</span>
                  <span className={`pill ${row.tone}`}>{row.status}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.summaryGrid}>
          {summaryCards.map((card) => (
            <article key={card.id} className={`glass ${styles.summaryCard}`}>
              <ComponentTag label={`dashboard.summary.${card.id}`} api="/api/trading/quotes/tracked" />
              <span>{card.label}</span>
              <strong className={card.tone}>{card.value}</strong>
              <p className="clamp-3">{card.detail}</p>
            </article>
          ))}
        </section>

        <section className={`glass ${styles.trackedSection}`}>
          <ComponentTag label="dashboard.tracked-symbols" api="/api/trading/quotes/tracked + /api/trading/scanner/tracked-symbols" />
          <div className={styles.sectionHeader}>
            <div>
              <p className="eyebrow">Tracked Symbols</p>
              <h2>Priority symbol cards</h2>
              <p className={`clamp-3 ${styles.sectionCopy}`}>
                Each card keeps price freshness and technical freshness separate so we do not imply all modules share one
                timestamp.
              </p>
            </div>
          </div>

          <div className={styles.trackedScroller}>
            {tracked.items.map((item) => (
              <button
                key={item.symbol}
                type="button"
                className={styles.trackedCard}
                onClick={() => openTrackedDetail(item)}
              >
                <ComponentTag label={`dashboard.symbol-card.${item.symbol}`} api="/api/trading/quotes/tracked" />
                <div className={styles.cardTopRow}>
                  <div>
                    <strong className={styles.symbolCode}>{item.symbol}</strong>
                    <p className="clamp-3">{getCompanyName(item)}</p>
                  </div>
                  <span className={`pill ${item.available ? (item.change_pct ?? 0) >= 0 ? "positive" : "negative" : "warning"}`}>
                    {item.available ? (item.is_live ? "Live" : "Fallback") : "Unavailable"}
                  </span>
                </div>

                <div className={styles.priceBlock}>
                  <strong>{item.available ? `₩${formatPrice(item.price)}` : "Unavailable"}</strong>
                  <span className={getQuoteToneClass(item.change_pct)}>
                    {item.available ? `${formatSignedPercent(item.change_pct)} · ${formatSignedNumber(item.change)}` : (item.unavailable_reason ?? "No fresh quote source")}
                  </span>
                </div>

                <div className={styles.cardMetaGrid}>
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
                  <span className="clamp-3">Turnover {formatTurnover(item.turnover)}</span>
                  <span className="clamp-3">{describeQuoteSource(item)}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className={styles.commandGrid}>
          <section className={`glass ${styles.commandSection}`}>
            <ComponentTag label="dashboard.search-command" api="/api/trading/symbols/search" />
            <div className={styles.sectionHeader}>
              <div>
                <p className="eyebrow">Search Command</p>
                <h2>Open any symbol detail quickly</h2>
                <p className={`clamp-3 ${styles.sectionCopy}`}>
                  Search stays in the dashboard flow on mobile, then pushes directly into the symbol detail stack.
                </p>
              </div>
            </div>

            <label className={styles.searchField}>
              <span>Company or ticker</span>
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
              <span className="clamp-3">{searchError ?? "Results open the symbol detail screen."}</span>
            </div>

            <div className={styles.searchResultList}>
              {searchQuery.trim().length < 2 ? (
                <div className={styles.emptyState}>Search opens KRX symbols without inventing unsupported market summaries.</div>
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
                    <div className={`${styles.searchResultMeta} clamp-3`}>
                      {item.symbol} · {item.standard_code}
                    </div>
                  </div>
                  <div className={styles.searchResultSide}>
                    <span className="pill neutral">{item.market}</span>
                    <span>Open</span>
                  </div>
                </button>
              ))}

              {!searchLoading && searchQuery.trim().length >= 2 && searchItems.length === 0 && !searchError ? (
                <div className={styles.emptyState}>No matching symbol or company was found in the master list.</div>
              ) : null}
            </div>
          </section>

          <section className={`glass ${styles.notesSection}`}>
            <ComponentTag label="dashboard.derived-notes" api="/api/trading/quotes/tracked + /api/trading/eod/freshness" />
            <div className={styles.sectionHeader}>
              <div>
                <p className="eyebrow">Context Notes</p>
                <h2>What the current APIs support today</h2>
              </div>
            </div>

            <div className={styles.noteList}>
              {derivedNotes.map((note) => (
                <article key={note.id} className={styles.noteCard}>
                  <strong className="clamp-3">{note.title}</strong>
                  <p className="clamp-3">{note.detail}</p>
                  <span>{note.api}</span>
                </article>
              ))}
            </div>
          </section>
        </section>
      </div>
    </AppShell>
  );
}
