"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ComponentTag } from "@/components/dev/component-tag";
import { DevModeToggle } from "@/components/dev/dev-mode-toggle";
import { MobileAppChrome } from "@/components/mobile/mobile-app-chrome";
import { formatDisplayTimestamp, formatPrice, formatTurnover } from "@/lib/format";
import {
  UNKNOWN_SYMBOL_META,
  getForwardableSymbolMetaSeedValue,
  normalizeSymbolMetaSeedValue,
} from "@/lib/symbol-meta";

import styles from "./search-page.module.css";

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
  unavailable_reason?: string | null;
};

type JsonResult<T> = { ok: true; data: T } | { ok: false; status: number };

const SEARCH_RECENTS_STORAGE_KEY = "kai.search.recent-symbols";
const UNKNOWN = UNKNOWN_SYMBOL_META;

function hasNumber(value: number | null | undefined): value is number {
  return typeof value === "number";
}

async function getJson<T>(path: string): Promise<JsonResult<T>> {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) return { ok: false, status: response.status };
  const data = (await response.json()) as T;
  return { ok: true, data };
}

function getInitials(item: SymbolSearchItem) {
  const letters = item.symbol.replace(/[^A-Z0-9]/gi, "").slice(0, 2).toUpperCase();
  return letters || "SR";
}

function buildSymbolHref(item: SymbolSearchItem) {
  const params = new URLSearchParams();
  const name = getForwardableSymbolMetaSeedValue(item.name_ko);
  const market = getForwardableSymbolMetaSeedValue(item.market);
  const standardCode = getForwardableSymbolMetaSeedValue(item.standard_code);
  if (name) params.set("name", name);
  if (market) params.set("market", market);
  if (standardCode) params.set("standardCode", standardCode);
  const query = params.toString();
  return `/dashboard/symbol/${encodeURIComponent(item.symbol)}${query ? `?${query}` : ""}`;
}

function getChangeClass(value: number | null | undefined) {
  if (!hasNumber(value)) return styles.neutralText;
  return value >= 0 ? styles.positiveText : styles.negativeText;
}

function formatChangePct(value: number | null | undefined) {
  if (!hasNumber(value)) return UNKNOWN;
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatChangeValue(value: number | null | undefined) {
  if (!hasNumber(value)) return UNKNOWN;
  return `${value >= 0 ? "+" : ""}${formatPrice(value)}`;
}

function getQuoteMode(quote: QuoteResponse | null) {
  if (!quote) return UNKNOWN;
  if (!quote.available) return "UNAVAILABLE";
  if (quote.is_live) return "LIVE";
  if (quote.fallback) return "FALLBACK";
  return "DELAYED";
}

function normalizeSearchItem(item: SymbolSearchItem): SymbolSearchItem {
  return {
    symbol: item.symbol,
    standard_code: normalizeSymbolMetaSeedValue(item.standard_code),
    name_ko: normalizeSymbolMetaSeedValue(item.name_ko),
    market: normalizeSymbolMetaSeedValue(item.market),
  };
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SymbolSearchItem[]>([]);
  const [selected, setSelected] = useState<SymbolSearchItem | null>(null);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [recentItems, setRecentItems] = useState<SymbolSearchItem[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = window.localStorage.getItem(SEARCH_RECENTS_STORAGE_KEY);
        if (!stored) return;
        const parsed = JSON.parse(stored) as SymbolSearchItem[];
        setRecentItems(parsed.map(normalizeSearchItem).slice(0, 4));
      } catch {
        setRecentItems([]);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const result = await getJson<SymbolSearchResponse>(`/api/trading/symbols/search?q=${encodeURIComponent(query)}&limit=20`);
        if (!active) return;
        if (!result.ok) {
          setItems([]);
          setSearchError(`Search endpoint unavailable. Check trading-core or BFF connectivity. HTTP ${result.status}`);
          return;
        }
        const data = result.data;
        const normalizedItems = data.items.map(normalizeSearchItem);
        setItems(normalizedItems);
        setSearchError(null);
      } catch {
        if (!active) return;
        setItems([]);
        setSearchError("Search endpoint unavailable. Check trading-core or BFF connectivity.");
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [query]);

  useEffect(() => {
    if (!selected) return;
    let active = true;

    const loadQuote = async () => {
      try {
        const result = await getJson<QuoteResponse>(`/api/trading/quotes/${selected.symbol}`);
        if (!active) return;
        if (!result.ok) {
          setQuote(null);
          setQuoteError(`Quote endpoint unavailable. Select stays pinned, but live fields need confirmation. HTTP ${result.status}`);
          return;
        }
        const data = result.data;
        setQuote(data);
        setQuoteError(null);
      } catch {
        if (!active) return;
        setQuote(null);
        setQuoteError("Quote endpoint unavailable. Select stays pinned, but live fields need confirmation.");
      }
    };

    void loadQuote();
    const timer = window.setInterval(loadQuote, 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selected]);

  const resultTitle = query.trim() ? `Results for "${query.trim()}"` : "Search Results";
  const selectedQuoteDate = quote ? formatDisplayTimestamp(quote.cached_at ?? quote.trade_date, UNKNOWN) : UNKNOWN;
  const selectedHref = selected ? buildSymbolHref(selected) : "/dashboard#tracked-symbols";

  const quickAccessItems = useMemo(() => {
    const merged = [...recentItems, ...items];
    const seen = new Set<string>();
    return merged.filter((item) => {
      if (seen.has(item.symbol)) return false;
      seen.add(item.symbol);
      return true;
    }).slice(0, 4);
  }, [items, recentItems]);

  const handleSelect = (item: SymbolSearchItem) => {
    setQuote(null);
    setQuoteError(null);
    setSelected(item);
    setRecentItems((current) => {
      const next = [item, ...current.filter((recent) => recent.symbol !== item.symbol)].slice(0, 4);
      try {
        window.localStorage.setItem(SEARCH_RECENTS_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Local storage is a convenience only; search still works without it.
      }
      return next;
    });
  };

  const handleClearRecent = () => {
    setRecentItems([]);
    try {
      window.localStorage.removeItem(SEARCH_RECENTS_STORAGE_KEY);
    } catch {
      // Ignore storage failures.
    }
  };

  return (
    <MobileAppChrome
      activeNav="search"
      header={
        <>
          <div className={styles.appHeaderBrand}>
            <div className={styles.brandMark}>K</div>
            <div>
              <p className={styles.brandEyebrow}>Obsidian Ledger</p>
              <strong className={styles.brandTitle}>Trading Dashboard</strong>
            </div>
          </div>

          <div className={styles.appHeaderActions}>
            <span className="pill positive">Market Open</span>
            <DevModeToggle />
          </div>
        </>
      }
    >
      <div className={styles.searchTerminal}>
        <section className={styles.heroPanel}>
          <ComponentTag label="search.terminal-shell" api="/api/trading/symbols/search + /api/trading/quotes/{symbol}" />
          <p className={styles.desktopBreadcrumb}>Terminal &gt; Symbol Search</p>
          <h1>Universal Search</h1>
          <p className={`${styles.heroCopy} clamp-3`}>
            Query markets, symbols, and institutional intelligence through the trading-core BFF. Confirmed data renders from
            live endpoints; unsupported terminal fields stay marked as {UNKNOWN}.
          </p>
          <label className={styles.searchInputFrame}>
            <span className={styles.srOnly}>Search markets, symbols, or analysis</span>
            <span className={styles.searchGlyph} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search markets, symbols, or analysis..."
              aria-label="Search markets, symbols, or analysis"
            />
            {query ? (
              <button type="button" onClick={() => setQuery("")} aria-label="Clear search query">
                /
              </button>
            ) : (
              <kbd>/</kbd>
            )}
          </label>
        </section>

        <section className={styles.mobileResultsPanel}>
          <ComponentTag label="search.mobile-results" api="/api/trading/symbols/search" />
          <div className={styles.sectionHeader}>
            <h2>{resultTitle}</h2>
            <span>{items.length} matches</span>
          </div>
          {searchError ? <div className={styles.feedback}>{searchError}</div> : null}
          <div className={styles.mobileResultList}>
            {items.slice(0, 6).map((item) => {
              const isSelected = selected?.symbol === item.symbol;
              const canShowSelectedQuote = isSelected && quote;
              return (
                <button
                  key={item.symbol}
                  type="button"
                  className={`${styles.mobileResultCard} ${isSelected ? styles.mobileResultCardActive : ""}`.trim()}
                  onClick={() => handleSelect(item)}
                >
                  <span className={styles.symbolAvatar}>{getInitials(item)}</span>
                  <span className={styles.resultIdentity}>
                    <strong className="clamp-3">{item.symbol}</strong>
                    <span className="clamp-3">{item.name_ko}</span>
                  </span>
                  <span className={styles.mobileResultQuote}>
                    <strong>{canShowSelectedQuote && hasNumber(quote.price) ? `₩${formatPrice(quote.price)}` : UNKNOWN}</strong>
                    <span className={canShowSelectedQuote ? getChangeClass(quote.change_pct) : styles.neutralText}>
                      {canShowSelectedQuote ? formatChangePct(quote.change_pct) : UNKNOWN}
                    </span>
                    <small>{canShowSelectedQuote ? selectedQuoteDate : "select for quote"}</small>
                  </span>
                </button>
              );
            })}
            {items.length === 0 && !searchError ? (
              <div className={styles.emptyState}>
                <strong>Start typing to search the symbol master.</strong>
                <p className="clamp-3">Results are fetched from `/api/trading/symbols/search`; no sample symbols are manufactured here.</p>
              </div>
            ) : null}
          </div>
        </section>

        <section className={styles.quickSection}>
          <ComponentTag label="search.quick-access" api="local recent selections + /api/trading/symbols/search" />
          <div className={styles.sectionHeader}>
            <h2>Quick Access / Recent</h2>
            {recentItems.length > 0 ? (
              <button type="button" onClick={handleClearRecent}>
                Clear All
              </button>
            ) : (
              <span>From current query</span>
            )}
          </div>
          <div className={styles.quickGrid}>
            {quickAccessItems.length > 0 ? (
              quickAccessItems.map((item) => (
                <button key={item.symbol} type="button" className={styles.quickCard} onClick={() => handleSelect(item)}>
                  <span>
                    <strong className="clamp-3">{item.symbol}</strong>
                    <small className="clamp-3">{item.name_ko}</small>
                  </span>
                  <i aria-hidden="true" />
                </button>
              ))
            ) : (
              <div className={styles.emptyState}>
                <strong>{UNKNOWN}</strong>
                <p className="clamp-3">Quick access requires confirmed search results or a local recent selection.</p>
              </div>
            )}
          </div>
        </section>

        <section className={styles.trendingPanel}>
          <ComponentTag label="search.trending-symbols" api="/api/trading/symbols/search metadata, quote only after selection" />
          <div className={styles.sectionHeader}>
            <h2>Trending Symbols</h2>
            <span>Rank source {UNKNOWN}</span>
          </div>
          <div className={styles.trendingGrid}>
            {items.slice(0, 4).map((item, index) => {
              const isSelected = selected?.symbol === item.symbol;
              const canShowSelectedQuote = isSelected && quote;
              return (
                <button key={item.symbol} type="button" className={styles.trendingCard} onClick={() => handleSelect(item)}>
                  <span className={styles.trendingTopline}>
                    <strong className="clamp-3">{item.symbol}</strong>
                    <small className={index % 2 === 0 ? styles.positiveText : styles.negativeText}>
                      {canShowSelectedQuote ? formatChangePct(quote.change_pct) : UNKNOWN}
                    </small>
                  </span>
                  <span className={styles.sparkline} aria-hidden="true">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className={styles.trendingFooter}>
                    <strong>{canShowSelectedQuote && hasNumber(quote.price) ? `₩${formatPrice(quote.price)}` : UNKNOWN}</strong>
                    <small className="clamp-3">{item.market}</small>
                  </span>
                </button>
              );
            })}
            {items.length === 0 ? (
              <div className={styles.emptyState}>
                <strong>{UNKNOWN}</strong>
                <p className="clamp-3">No confirmed trending API is exposed for this route yet.</p>
              </div>
            ) : null}
          </div>
        </section>

        <section className={styles.integrityPanel}>
          <ComponentTag label="search.network-integrity" api="client fetch states" />
          <div>
            <span>Network Integrity</span>
            <strong>{searchError || quoteError ? "Degraded" : "99.9%"}</strong>
          </div>
          <div className={styles.integrityTrack} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i className={searchError || quoteError ? styles.integritySegmentDown : ""} />
          </div>
          {quoteError ? <p className="clamp-3">{quoteError}</p> : null}
        </section>

        <section className={styles.desktopResultsPanel}>
          <ComponentTag label="search.desktop-results-table" api="/api/trading/symbols/search + selected /api/trading/quotes/{symbol}" />
          <div className={styles.desktopResultsHeader}>
            <div>
              <span aria-hidden="true">=</span>
              <h2>
                {query.trim() ? `${resultTitle} · ` : "Search Results "}({items.length} found)
              </h2>
            </div>
            <div>
              <button type="button">Filters</button>
              <button type="button">Export</button>
            </div>
          </div>
          {searchError ? <div className={styles.feedback}>{searchError}</div> : null}
          <div className={styles.resultsTableWrap}>
            <table className={styles.resultsTable}>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Name</th>
                  <th>Price</th>
                  <th>Change %</th>
                  <th>Mkt Cap</th>
                  <th>Coverage</th>
                  <th>Freshness</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isSelected = selected?.symbol === item.symbol;
                  const canShowSelectedQuote = isSelected && quote;
                  return (
                    <tr key={item.symbol} className={isSelected ? styles.selectedRow : undefined}>
                      <td>
                        <button type="button" onClick={() => handleSelect(item)}>
                          {item.symbol}
                        </button>
                      </td>
                      <td>
                        <span className="clamp-3">{item.name_ko}</span>
                      </td>
                      <td>{canShowSelectedQuote && hasNumber(quote.price) ? formatPrice(quote.price) : UNKNOWN}</td>
                      <td className={canShowSelectedQuote ? getChangeClass(quote.change_pct) : styles.neutralText}>
                        {canShowSelectedQuote ? formatChangePct(quote.change_pct) : UNKNOWN}
                      </td>
                      <td>{UNKNOWN}</td>
                      <td>
                        <span className={styles.coverageBadge}>{item.market}</span>
                      </td>
                      <td>
                        <span className={styles.freshnessCell}>
                          {canShowSelectedQuote ? selectedQuoteDate : UNKNOWN}
                          <i />
                        </span>
                      </td>
                      <td>
                        <Link href={buildSymbolHref(item)}>Open</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {items.length === 0 && !searchError ? (
              <div className={styles.emptyState}>
                <strong>No search rows yet.</strong>
                <p className="clamp-3">Type a symbol or company name to fetch rows from trading-core.</p>
              </div>
            ) : null}
          </div>
        </section>

        <aside className={styles.selectedPanel}>
          <ComponentTag label="search.selected-quote" api="/api/trading/quotes/{symbol}" />
          <div className={styles.selectedPanelHeader}>
            <div>
              <span>Selected Terminal Feed</span>
              <h2>{selected ? selected.symbol : UNKNOWN}</h2>
            </div>
            <span className={styles.modeBadge}>{getQuoteMode(quote)}</span>
          </div>
          {selected ? (
            <>
              <p className={`${styles.selectedName} clamp-3`}>{quote?.company_name || selected.name_ko}</p>
              <div className={styles.selectedPriceGrid}>
                <div>
                  <span>Last Price</span>
                  <strong>{quote && hasNumber(quote.price) ? `₩${formatPrice(quote.price)}` : UNKNOWN}</strong>
                </div>
                <div>
                  <span>Change</span>
                  <strong className={getChangeClass(quote?.change_pct)}>{quote ? formatChangePct(quote.change_pct) : UNKNOWN}</strong>
                  <small>{quote ? formatChangeValue(quote.change) : UNKNOWN}</small>
                </div>
              </div>
              <div className={styles.selectedStats}>
                <span>
                  Volume <strong>{quote && hasNumber(quote.volume) ? quote.volume.toLocaleString("ko-KR") : UNKNOWN}</strong>
                </span>
                <span>
                  Turnover <strong>{quote ? formatTurnover(quote.turnover, "₩", UNKNOWN) : UNKNOWN}</strong>
                </span>
                <span>
                  Source <strong>{quote?.source ?? UNKNOWN}</strong>
                </span>
                <span>
                  Updated <strong>{selectedQuoteDate}</strong>
                </span>
              </div>
              {quoteError ? <div className={styles.feedback}>{quoteError}</div> : null}
              <Link className={styles.detailLink} href={selectedHref}>
                Open Symbol Detail
              </Link>
            </>
          ) : (
            <div className={styles.emptyState}>
              <strong>Select a result to inspect live quote fields.</strong>
              <p className="clamp-3">The terminal avoids placeholder quote data until a real quote response arrives.</p>
            </div>
          )}
        </aside>
      </div>
    </MobileAppChrome>
  );
}
