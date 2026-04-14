"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

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

type FavoriteSymbolItem = {
  symbol: string;
  standard_code: string | null;
  name_ko: string | null;
  market: string | null;
};

type FavoriteSymbolsResponse = {
  count: number;
  items: FavoriteSymbolItem[];
};

type TrackedSymbolsResponse = {
  tracked_symbols: string[];
  count: number;
  last_updated_at: string | null;
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

const UNKNOWN = UNKNOWN_SYMBOL_META;

function hasNumber(value: number | null | undefined): value is number {
  return typeof value === "number";
}

async function getJson<T>(path: string, init?: RequestInit): Promise<JsonResult<T>> {
  const response = await fetch(path, { cache: "no-store", ...init });
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

function normalizeSymbolCode(value: string) {
  return value.trim().toUpperCase();
}

function normalizeSearchItem(item: {
  symbol: string;
  standard_code?: string | null;
  name_ko?: string | null;
  market?: string | null;
}): SymbolSearchItem {
  return {
    symbol: normalizeSymbolCode(item.symbol),
    standard_code: normalizeSymbolMetaSeedValue(item.standard_code ?? ""),
    name_ko: normalizeSymbolMetaSeedValue(item.name_ko ?? item.symbol),
    market: normalizeSymbolMetaSeedValue(item.market ?? ""),
  };
}

function buildFallbackFavoriteItem(symbol: string): SymbolSearchItem {
  return normalizeSearchItem({
    symbol,
    standard_code: "",
    name_ko: symbol,
    market: "KRX",
  });
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SymbolSearchItem[]>([]);
  const [selected, setSelected] = useState<SymbolSearchItem | null>(null);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [favoriteItems, setFavoriteItems] = useState<SymbolSearchItem[]>([]);
  const [trackedSymbols, setTrackedSymbols] = useState<string[]>([]);
  const [trackedSymbolsLoaded, setTrackedSymbolsLoaded] = useState(false);
  const [favoriteDialogOpen, setFavoriteDialogOpen] = useState(false);
  const [favoriteSymbolInput, setFavoriteSymbolInput] = useState("");
  const [favoriteSearchItems, setFavoriteSearchItems] = useState<SymbolSearchItem[]>([]);
  const [favoriteSearchLoading, setFavoriteSearchLoading] = useState(false);
  const [favoriteSearchError, setFavoriteSearchError] = useState<string | null>(null);
  const [favoriteSavingSymbol, setFavoriteSavingSymbol] = useState<string | null>(null);
  const [favoriteStatus, setFavoriteStatus] = useState<string | null>(null);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const favoriteSearchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;

    const loadFavorites = async () => {
      try {
        const result = await getJson<FavoriteSymbolsResponse>("/api/trading/symbols/favorites");
        if (!active) return;
        if (!result.ok) {
          setFavoriteItems([]);
          setFavoriteError(`Favorite list unavailable. HTTP ${result.status}`);
          return;
        }
        setFavoriteItems(result.data.items.map(normalizeSearchItem).slice(0, 4));
        setFavoriteError(null);
      } catch {
        if (!active) return;
        setFavoriteItems([]);
        setFavoriteError("Favorite list unavailable.");
      }
    };

    void loadFavorites();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadTrackedSymbols = async () => {
      try {
        const result = await getJson<TrackedSymbolsResponse>("/api/trading/scanner/tracked-symbols");
        if (!active) return;
        if (!result.ok) {
          setTrackedSymbols([]);
          setTrackedSymbolsLoaded(false);
          return;
        }
        setTrackedSymbols(result.data.tracked_symbols.map(normalizeSymbolCode));
        setTrackedSymbolsLoaded(true);
      } catch {
        if (!active) return;
        setTrackedSymbols([]);
        setTrackedSymbolsLoaded(false);
      }
    };

    void loadTrackedSymbols();
    return () => {
      active = false;
    };
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
    if (!favoriteDialogOpen) return;
    favoriteSearchInputRef.current?.focus();
  }, [favoriteDialogOpen]);

  useEffect(() => {
    if (!favoriteDialogOpen) {
      setFavoriteSearchItems([]);
      setFavoriteSearchLoading(false);
      setFavoriteSearchError(null);
      return;
    }

    const favoriteQuery = favoriteSymbolInput.trim();
    if (!favoriteQuery) {
      setFavoriteSearchItems([]);
      setFavoriteSearchLoading(false);
      setFavoriteSearchError(null);
      return;
    }

    let active = true;
    setFavoriteSearchLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const result = await getJson<SymbolSearchResponse>(
          `/api/trading/symbols/search?q=${encodeURIComponent(favoriteQuery)}&limit=8`,
        );
        if (!active) return;
        if (!result.ok) {
          setFavoriteSearchItems([]);
          setFavoriteSearchError(`Favorite search unavailable. HTTP ${result.status}`);
          return;
        }
        setFavoriteSearchItems(result.data.items.map(normalizeSearchItem));
        setFavoriteSearchError(null);
      } catch {
        if (!active) return;
        setFavoriteSearchItems([]);
        setFavoriteSearchError("Favorite search unavailable. Check trading-core connectivity.");
      } finally {
        if (active) setFavoriteSearchLoading(false);
      }
    }, 150);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [favoriteDialogOpen, favoriteSymbolInput]);

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
  const favoriteSymbolCandidate = normalizeSymbolCode(favoriteSymbolInput);
  const canAddFavorite = favoriteSymbolCandidate.length > 0 && favoriteSavingSymbol === null;
  const quickAccessItems = favoriteItems;

  const handleQueryChange = (nextQuery: string) => {
    setQuery(nextQuery);
    setFavoriteStatus(null);
    setFavoriteError(null);
  };

  const handleSelect = (item: SymbolSearchItem) => {
    setQuote(null);
    setQuoteError(null);
    setSelected(item);
  };

  const handleOpenFavoriteDialog = () => {
    setFavoriteStatus(null);
    setFavoriteError(null);
    setFavoriteSearchError(null);
    setFavoriteSymbolInput(selected?.symbol ?? query.trim());
    setFavoriteDialogOpen(true);
  };

  const handleCloseFavoriteDialog = () => {
    if (favoriteSavingSymbol) return;
    setFavoriteDialogOpen(false);
    setFavoriteSearchError(null);
  };

  const handleAddFavorite = async (item?: SymbolSearchItem) => {
    const symbol = normalizeSymbolCode(item?.symbol || favoriteSymbolInput);

    if (!symbol) {
      setFavoriteStatus(null);
      setFavoriteError("Enter a symbol code before adding a favorite.");
      return;
    }

    setFavoriteSavingSymbol(symbol);
    setFavoriteStatus(null);
    setFavoriteError(null);

    try {
      let currentTrackedSymbols = trackedSymbols;
      if (!trackedSymbolsLoaded) {
        const currentResult = await getJson<TrackedSymbolsResponse>("/api/trading/scanner/tracked-symbols");
        if (!currentResult.ok) {
          setTrackedSymbols([]);
          setTrackedSymbolsLoaded(false);
          setFavoriteError(`Favorite save blocked until tracked symbols load successfully. HTTP ${currentResult.status}`);
          return;
        }
        currentTrackedSymbols = currentResult.data.tracked_symbols.map(normalizeSymbolCode);
        setTrackedSymbols(currentTrackedSymbols);
        setTrackedSymbolsLoaded(true);
      }

      const nextSymbols = [symbol, ...currentTrackedSymbols.filter((currentSymbol) => currentSymbol !== symbol)];
      const result = await getJson<TrackedSymbolsResponse>("/api/trading/scanner/tracked-symbols", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ symbols: nextSymbols }),
      });

      if (!result.ok) {
        setFavoriteError(`Favorite save failed. HTTP ${result.status}`);
        return;
      }

      const normalizedTrackedSymbols = result.data.tracked_symbols.map(normalizeSymbolCode);
      const favoriteSourceItem =
        item?.symbol === symbol
          ? item
          : favoriteSearchItems.find((currentItem) => currentItem.symbol === symbol) ??
            (selected?.symbol === symbol ? selected : null) ??
            items.find((currentItem) => currentItem.symbol === symbol) ??
            buildFallbackFavoriteItem(symbol);
      const favoriteItem = normalizeSearchItem(favoriteSourceItem);

      setTrackedSymbols(normalizedTrackedSymbols);
      setFavoriteItems((current) => {
        const next = [favoriteItem, ...current.filter((currentItem) => currentItem.symbol !== symbol)];
        return next.slice(0, 4);
      });
      setFavoriteDialogOpen(false);
      setFavoriteSearchItems([]);
      setFavoriteSearchError(null);
      setFavoriteSymbolInput("");
      setFavoriteStatus(`${symbol} saved to core favorites.`);
    } catch {
      setFavoriteError("Favorite save failed. Check trading-core connectivity.");
    } finally {
      setFavoriteSavingSymbol(null);
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
              onChange={(event) => handleQueryChange(event.target.value)}
              placeholder="Search markets, symbols, or analysis..."
              aria-label="Search markets, symbols, or analysis"
            />
            {query ? (
              <button type="button" onClick={() => handleQueryChange("")} aria-label="Clear search query">
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
              return (
                <Link
                  key={item.symbol}
                  href={buildSymbolHref(item)}
                  className={`${styles.mobileResultCard} ${isSelected ? styles.mobileResultCardActive : ""}`.trim()}
                  onClick={() => handleSelect(item)}
                >
                  <span className={styles.symbolAvatar}>{getInitials(item)}</span>
                  <span className={styles.resultIdentity}>
                    <strong className="clamp-3">{item.symbol}</strong>
                    <span className="clamp-3">{item.name_ko}</span>
                  </span>
                </Link>
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
          <ComponentTag
            label="search.quick-access"
            api="/api/trading/symbols/favorites + /api/trading/scanner/tracked-symbols + dialog /api/trading/symbols/search"
          />
          <div className={styles.sectionHeader}>
            <h2>Quick Access</h2>
            <div className={styles.sectionActions}>
              <button
                type="button"
                onClick={handleOpenFavoriteDialog}
                disabled={favoriteSavingSymbol !== null}
                aria-label="Open favorite search"
              >
                +
              </button>
              <span>{favoriteItems.length > 0 ? "Core favorites" : "No favorites"}</span>
            </div>
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
                <strong>No favorites saved.</strong>
                <p className="clamp-3">Use + to search the symbol master and save a core favorite.</p>
              </div>
            )}
          </div>
          {favoriteDialogOpen ? (
            <div className={styles.favoriteDialogOverlay} onClick={handleCloseFavoriteDialog}>
              <div
                className={styles.favoriteDialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby="favorite-dialog-title"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => {
                  if (event.key === "Escape") handleCloseFavoriteDialog();
                }}
              >
                <div className={styles.favoriteDialogHeader}>
                  <div>
                    <strong id="favorite-dialog-title">Save Symbol</strong>
                    <span>Search the symbol master</span>
                  </div>
                  <button type="button" onClick={handleCloseFavoriteDialog} aria-label="Close favorite search">
                    x
                  </button>
                </div>
                <form
                  className={styles.favoriteSearchForm}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleAddFavorite();
                  }}
                >
                  <label className={styles.srOnly} htmlFor="favorite-symbol-search">
                    Favorite symbol search
                  </label>
                  <input
                    ref={favoriteSearchInputRef}
                    id="favorite-symbol-search"
                    value={favoriteSymbolInput}
                    onChange={(event) => setFavoriteSymbolInput(event.target.value)}
                    placeholder="Search symbol or company..."
                    aria-label="Favorite symbol search"
                    autoComplete="off"
                  />
                  <button type="submit" disabled={!canAddFavorite}>
                    {favoriteSavingSymbol ? "Saving" : "Add"}
                  </button>
                </form>
                {favoriteSearchError ? <div className={styles.feedback}>{favoriteSearchError}</div> : null}
                {favoriteError ? <div className={styles.feedback}>{favoriteError}</div> : null}
                <div className={styles.favoriteSuggestions} aria-label="Favorite search suggestions">
                  {favoriteSearchItems.map((item) => (
                    <button
                      key={item.symbol}
                      type="button"
                      onClick={() => void handleAddFavorite(item)}
                      disabled={favoriteSavingSymbol !== null}
                    >
                      <span>
                        <strong className="clamp-3">{item.symbol}</strong>
                        <small className="clamp-3">{item.name_ko}</small>
                      </span>
                      <small className="clamp-3">{item.market}</small>
                    </button>
                  ))}
                  {favoriteSymbolInput.trim() && favoriteSearchItems.length === 0 && !favoriteSearchLoading && !favoriteSearchError ? (
                    <div className={styles.emptyState}>
                      <strong>No matching symbols.</strong>
                      <p className="clamp-3">Submit the symbol code directly or refine the search.</p>
                    </div>
                  ) : null}
                  {!favoriteSymbolInput.trim() ? (
                    <div className={styles.emptyState}>
                      <strong>Start typing to search.</strong>
                      <p className="clamp-3">Suggestions use the same symbol master as Universal Search.</p>
                    </div>
                  ) : null}
                  {favoriteSearchLoading ? <p className={styles.favoriteSearchStatus}>Searching...</p> : null}
                </div>
              </div>
            </div>
          ) : null}
          {favoriteStatus ? <p className={styles.favoriteStatus}>{favoriteStatus}</p> : null}
          {favoriteError && !favoriteDialogOpen ? <p className={styles.favoriteError}>{favoriteError}</p> : null}
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
