"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ComponentTag } from "@/components/dev/component-tag";
import { DevModeToggle } from "@/components/dev/dev-mode-toggle";
import { MobileAppChrome } from "@/components/mobile/mobile-app-chrome";
import { formatDisplayTimestamp, formatPrice } from "@/lib/format";
import { resolveTradingApiClientPath } from "@/lib/trading-api-client-path";
import {
  UNKNOWN_SYMBOL_META,
  getForwardableSymbolMetaSeedValue,
  normalizeSymbolMetaSeedValue,
} from "@/lib/symbol-meta";
import { getTradingApiJsonResult, invalidateTradingApiCacheByPathPrefix } from "@/lib/trading-api-cache";

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

type CoreMarketStatus = {
  state: string;
  is_open: boolean;
  server_time: string;
};

type TrendingMode = "kis" | "1d" | "5d" | "20d";

type TrendingTab = {
  mode: TrendingMode;
  label: string;
  description: string;
};

type TrendingMetric = {
  period?: string | null;
  name: string;
  value: number | null;
  unit?: string | null;
};

type RealtimeTrendingSource = {
  source: string;
  source_label: string;
  rank: number | null;
  metric: TrendingMetric;
  market?: string | null;
  market_code?: string | null;
};

type RealtimeTrendingItem = {
  symbol: string;
  name?: string | null;
  market?: string | null;
  market_code?: string | null;
  price?: number | null;
  change?: number | null;
  change_pct?: number | null;
  volume?: number | null;
  turnover?: number | null;
  best_rank?: number | null;
  source_count?: number | null;
  sources?: RealtimeTrendingSource[];
};

type RealtimeTrendingResponse = {
  status: string;
  source: string;
  as_of?: string | null;
  market?: string | null;
  items: RealtimeTrendingItem[];
  summary?: {
    item_count?: number | null;
  };
};

type StoredTrendingItem = {
  rank: number;
  symbol: string;
  name_ko?: string | null;
  market?: string | null;
  market_date?: string | null;
  trend_direction?: string | null;
  metric?: TrendingMetric | null;
  price?: {
    close_price?: number | null;
    change?: number | null;
    change_pct?: number | null;
    volume?: number | null;
    turnover?: number | null;
  } | null;
  technical?: {
    close_price?: number | null;
    volume?: number | null;
    trend_state?: string | null;
    return_5d?: number | null;
    return_20d?: number | null;
    volume_ratio_20d?: number | null;
  } | null;
  action_summary?: {
    action_label?: string | null;
    signal_score?: number | null;
  } | null;
};

type StoredTrendingResponse = {
  request?: {
    resolved_market_date?: string | null;
    period?: string | null;
    direction?: string | null;
    limit?: number | null;
    markets?: string[] | null;
  };
  summary?: {
    count?: number | null;
    data_available?: boolean | null;
  };
  items: StoredTrendingItem[];
};

type TrendingDisplayItem = {
  symbol: string;
  name: string;
  market: string;
  rank: number | null;
  sourceLabel: string;
  metricName: string;
  metricUnit: string | null;
  metricValue: number | null;
  changePct: number | null;
  price: number | null;
  searchItem: SymbolSearchItem;
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
const FAVORITE_DIALOG_ID = "favorite-symbol-dialog";
const FAVORITE_SUGGESTIONS_ID = "favorite-symbol-suggestions";
const TRENDING_INITIAL_LIMIT = 5;
const TRENDING_LIMIT_STEP = 5;
const TRENDING_REALTIME_SOURCES = "volume-rank,fluctuation,hts-top-view";
const DEFAULT_MARKET_STATUS: CoreMarketStatus = {
  state: "MARKET STATUS PENDING",
  is_open: false,
  server_time: "",
};
const TRENDING_TABS: TrendingTab[] = [
  { mode: "kis", label: "KIS", description: "Live KIS ranks" },
  { mode: "1d", label: "1D", description: "One-day movers" },
  { mode: "5d", label: "5D", description: "Five-day movers" },
  { mode: "20d", label: "20D", description: "Twenty-day movers" },
];

function hasNumber(value: number | null | undefined): value is number {
  return typeof value === "number";
}

async function getJson<T>(path: string, init?: RequestInit): Promise<JsonResult<T>> {
  return getTradingApiJsonResult<T>(resolveTradingApiClientPath(path), init);
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

function PanelUnavailable({ message }: { message: string }) {
  return (
    <div className={styles.feedback} role="status">
      <strong>Unavailable</strong>
      <p className="clamp-3">{message}</p>
    </div>
  );
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

function getTrendingEndpoint(mode: TrendingMode, limit: number) {
  if (mode === "kis") {
    const params = new URLSearchParams({
      limit: String(limit),
      market_code: "J",
      sources: TRENDING_REALTIME_SOURCES,
    });
    return `/api/trading/scanner/realtime-trending?${params.toString()}`;
  }

  const params = new URLSearchParams({
    period: mode,
    direction: "both",
    limit: String(limit),
  });
  return `/api/trading/scanner/trending-stocks?${params.toString()}`;
}

function formatTrendingStatusDate(value?: string | null, fallback = UNKNOWN) {
  const timestamp = formatDisplayTimestamp(value, fallback);
  return timestamp.split(" : ")[0] || fallback;
}

function isPercentTrendingMetric(item: TrendingDisplayItem) {
  const metricName = item.metricName.toLowerCase();
  const metricUnit = item.metricUnit?.toLowerCase();
  return metricUnit === "percent" || metricName.includes("pct") || metricName.includes("return");
}

function getTrendingMetricValue(item: TrendingDisplayItem) {
  if (isPercentTrendingMetric(item)) {
    return hasNumber(item.changePct) ? item.changePct : item.metricValue;
  }
  return item.metricValue;
}

function formatTrendingMetric(item: TrendingDisplayItem) {
  const metricUnit = item.metricUnit?.toLowerCase();
  const value = getTrendingMetricValue(item);

  if (!hasNumber(value)) return UNKNOWN;
  if (isPercentTrendingMetric(item)) {
    return formatChangePct(value);
  }
  if (metricUnit === "shares") {
    return value.toLocaleString("ko-KR");
  }
  if (metricUnit === "rank") {
    return `#${Math.round(value)}`;
  }
  return value.toLocaleString("ko-KR");
}

function getTrendingMetricClass(item: TrendingDisplayItem) {
  const value = getTrendingMetricValue(item);
  if (!hasNumber(value)) return styles.neutralText;
  return value >= 0 ? styles.positiveText : styles.negativeText;
}

function getTrendingPrice(item: StoredTrendingItem) {
  return item.price?.close_price ?? item.technical?.close_price ?? null;
}

function mapRealtimeTrendingItems(response: RealtimeTrendingResponse): TrendingDisplayItem[] {
  return response.items.map((item, index) => {
    const primarySource = item.sources?.[0];
    const sourceCount = item.source_count ?? item.sources?.length ?? 0;
    const sourceLabel =
      sourceCount > 1 ? `${sourceCount} KIS lists` : primarySource?.source_label ?? response.source.toUpperCase();
    const market = normalizeSymbolMetaSeedValue(item.market ?? item.market_code ?? response.market ?? "KRX");
    const name = normalizeSymbolMetaSeedValue(item.name ?? item.symbol);
    const searchItem = normalizeSearchItem({
      symbol: item.symbol,
      standard_code: "",
      name_ko: name,
      market,
    });

    return {
      symbol: searchItem.symbol,
      name,
      market,
      rank: item.best_rank ?? primarySource?.rank ?? index + 1,
      sourceLabel,
      metricName: primarySource?.metric.name ?? "change_pct",
      metricUnit: primarySource?.metric.unit ?? "percent",
      metricValue: primarySource?.metric.value ?? null,
      changePct: item.change_pct ?? null,
      price: item.price ?? null,
      searchItem,
    };
  });
}

function mapStoredTrendingItems(response: StoredTrendingResponse, mode: Exclude<TrendingMode, "kis">): TrendingDisplayItem[] {
  return response.items.map((item, index) => {
    const market = normalizeSymbolMetaSeedValue(item.market ?? "KRX");
    const name = normalizeSymbolMetaSeedValue(item.name_ko ?? item.symbol);
    const searchItem = normalizeSearchItem({
      symbol: item.symbol,
      standard_code: "",
      name_ko: name,
      market,
    });

    return {
      symbol: searchItem.symbol,
      name,
      market,
      rank: item.rank ?? index + 1,
      sourceLabel: `${mode.toUpperCase()} stored rank`,
      metricName: item.metric?.name ?? `${mode}_return_pct`,
      metricUnit: "percent",
      metricValue: item.metric?.value ?? null,
      changePct: item.price?.change_pct ?? item.metric?.value ?? null,
      price: getTrendingPrice(item),
      searchItem,
    };
  });
}

export default function SearchPageClient() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SymbolSearchItem[]>([]);
  const [selected, setSelected] = useState<SymbolSearchItem | null>(null);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [favoriteItems, setFavoriteItems] = useState<SymbolSearchItem[]>([]);
  const [favoriteListError, setFavoriteListError] = useState<string | null>(null);
  const [trackedSymbols, setTrackedSymbols] = useState<string[]>([]);
  const [trackedSymbolsLoaded, setTrackedSymbolsLoaded] = useState(false);
  const [trackedSymbolsError, setTrackedSymbolsError] = useState<string | null>(null);
  const [favoriteDialogOpen, setFavoriteDialogOpen] = useState(false);
  const [favoriteSymbolInput, setFavoriteSymbolInput] = useState("");
  const [favoriteSearchItems, setFavoriteSearchItems] = useState<SymbolSearchItem[]>([]);
  const [favoriteSearchLoading, setFavoriteSearchLoading] = useState(false);
  const [favoriteSearchError, setFavoriteSearchError] = useState<string | null>(null);
  const [favoriteSavingSymbol, setFavoriteSavingSymbol] = useState<string | null>(null);
  const [favoriteStatus, setFavoriteStatus] = useState<string | null>(null);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const favoriteOpenButtonRef = useRef<HTMLButtonElement>(null);
  const favoriteSearchInputRef = useRef<HTMLInputElement>(null);
  const [trendingMode, setTrendingMode] = useState<TrendingMode>("kis");
  const [trendingItems, setTrendingItems] = useState<TrendingDisplayItem[]>([]);
  const [trendingVisibleLimit, setTrendingVisibleLimit] = useState(TRENDING_INITIAL_LIMIT);
  const [trendingResultCount, setTrendingResultCount] = useState(0);
  const [trendingMeta, setTrendingMeta] = useState<string | null>(null);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [trendingError, setTrendingError] = useState<string | null>(null);
  const [marketStatus, setMarketStatus] = useState<CoreMarketStatus>(DEFAULT_MARKET_STATUS);

  useEffect(() => {
    let active = true;

    const loadMarketStatus = async () => {
      try {
        const result = await getJson<CoreMarketStatus>("/api/trading/market/status");
        if (!active) return;
        if (!result.ok) {
          setMarketStatus(DEFAULT_MARKET_STATUS);
          return;
        }
        setMarketStatus(result.data);
      } catch {
        if (!active) return;
        setMarketStatus(DEFAULT_MARKET_STATUS);
      }
    };

    void loadMarketStatus();
    const timer = window.setInterval(loadMarketStatus, 60_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadFavorites = async () => {
      try {
        const result = await getJson<FavoriteSymbolsResponse>("/api/trading/symbols/favorites");
        if (!active) return;
        if (!result.ok) {
          setFavoriteItems([]);
          setFavoriteListError(`Favorite list unavailable. HTTP ${result.status}`);
          return;
        }
        setFavoriteItems(result.data.items.map(normalizeSearchItem).slice(0, 4));
        setFavoriteListError(null);
      } catch {
        if (!active) return;
        setFavoriteItems([]);
        setFavoriteListError("Favorite list unavailable.");
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
          setTrackedSymbolsError(`Favorite updates unavailable. HTTP ${result.status}`);
          return;
        }
        setTrackedSymbols(result.data.tracked_symbols.map(normalizeSymbolCode));
        setTrackedSymbolsLoaded(true);
        setTrackedSymbolsError(null);
      } catch {
        if (!active) return;
        setTrackedSymbols([]);
        setTrackedSymbolsLoaded(false);
        setTrackedSymbolsError("Favorite updates unavailable.");
      }
    };

    void loadTrackedSymbols();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const searchQuery = query.trim();
    if (!searchQuery) {
      setItems([]);
      setSearchError(null);
      return;
    }

    let active = true;
    const load = async () => {
      try {
        const result = await getJson<SymbolSearchResponse>(
          `/api/trading/symbols/search?q=${encodeURIComponent(searchQuery)}&limit=20`,
        );
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
    let active = true;

    const loadTrending = async () => {
      setTrendingLoading(true);
      setTrendingError(null);

      try {
        if (trendingMode === "kis") {
          const result = await getJson<RealtimeTrendingResponse>(getTrendingEndpoint(trendingMode, trendingVisibleLimit));
          if (!active) return;
          if (!result.ok) {
            setTrendingItems([]);
            setTrendingResultCount(0);
            setTrendingMeta(null);
            setTrendingError(`KIS trending unavailable. HTTP ${result.status}`);
            return;
          }

          const mappedItems = mapRealtimeTrendingItems(result.data);
          setTrendingItems(mappedItems.slice(0, trendingVisibleLimit));
          setTrendingResultCount(result.data.summary?.item_count ?? mappedItems.length);
          setTrendingMeta(`${result.data.status.toUpperCase()} · ${formatTrendingStatusDate(result.data.as_of)}`);
          return;
        }

        const result = await getJson<StoredTrendingResponse>(getTrendingEndpoint(trendingMode, trendingVisibleLimit));
        if (!active) return;
        if (!result.ok) {
          setTrendingItems([]);
          setTrendingResultCount(0);
          setTrendingMeta(null);
          setTrendingError(`${trendingMode.toUpperCase()} trending unavailable. HTTP ${result.status}`);
          return;
        }

        const mappedItems = mapStoredTrendingItems(result.data, trendingMode);
        setTrendingItems(mappedItems.slice(0, trendingVisibleLimit));
        setTrendingResultCount(result.data.summary?.count ?? mappedItems.length);
        setTrendingMeta(`Stored ${trendingMode.toUpperCase()} · ${result.data.request?.resolved_market_date ?? UNKNOWN}`);
      } catch {
        if (!active) return;
        setTrendingItems([]);
        setTrendingResultCount(0);
        setTrendingMeta(null);
        setTrendingError("Trending symbols unavailable. Check trading-core connectivity.");
      } finally {
        if (active) setTrendingLoading(false);
      }
    };

    void loadTrending();
    return () => {
      active = false;
    };
  }, [trendingMode, trendingVisibleLimit]);

  useEffect(() => {
    if (!selected) return;
    let active = true;

    const loadQuote = async () => {
      try {
        const result = await getJson<QuoteResponse>(`/api/trading/quotes/${selected.symbol}`);
        if (!active) return;
        if (!result.ok) {
          setQuote(null);
          return;
        }
        const data = result.data;
        setQuote(data);
      } catch {
        if (!active) return;
        setQuote(null);
      }
    };

    void loadQuote();
    const timer = window.setInterval(loadQuote, 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selected]);

  const getValidatedFavoriteItem = (symbol: string) =>
    (selected?.symbol === symbol ? selected : null) ??
    favoriteSearchItems.find((currentItem) => currentItem.symbol === symbol) ??
    items.find((currentItem) => currentItem.symbol === symbol) ??
    null;

  const resultTitle = query.trim() ? `Results for "${query.trim()}"` : "Search Results";
  const selectedQuoteDate = quote ? formatDisplayTimestamp(quote.cached_at ?? quote.trade_date, UNKNOWN) : UNKNOWN;
  const favoriteSymbolCandidate = normalizeSymbolCode(favoriteSymbolInput);
  const favoriteInputItem = favoriteSymbolCandidate ? getValidatedFavoriteItem(favoriteSymbolCandidate) : null;
  const canAddFavorite = favoriteInputItem !== null && favoriteSavingSymbol === null;
  const quickAccessItems = favoriteItems;
  const selectedTrendingTab = TRENDING_TABS.find((tab) => tab.mode === trendingMode) ?? TRENDING_TABS[0];
  const canShowMoreTrending = trendingItems.length > 0 && trendingResultCount >= trendingVisibleLimit && !trendingLoading;
  const marketBadgeLabel = marketStatus.is_open ? "Market Open" : "Market Closed";

  const handleTrendingModeChange = (nextMode: TrendingMode) => {
    if (nextMode === trendingMode && trendingVisibleLimit === TRENDING_INITIAL_LIMIT) return;

    setTrendingMode(nextMode);
    setTrendingVisibleLimit(TRENDING_INITIAL_LIMIT);
    setTrendingItems([]);
    setTrendingResultCount(0);
    setTrendingError(null);
    setTrendingMeta(null);
  };

  const handleShowMoreTrending = () => {
    setTrendingVisibleLimit((current) => current + TRENDING_LIMIT_STEP);
  };

  const handleQueryChange = (nextQuery: string) => {
    setQuery(nextQuery);
    setFavoriteStatus(null);
    setFavoriteError(null);
  };

  const handleSelect = (item: SymbolSearchItem, options?: { navigate?: boolean }) => {
    setQuote(null);
    setSelected(item);
    if (options?.navigate) {
      router.push(buildSymbolHref(item));
    }
  };

  const handleOpenFavoriteDialog = () => {
    setFavoriteStatus(null);
    setFavoriteError(null);
    setFavoriteSearchError(null);
    setFavoriteSymbolInput(selected?.symbol ?? "");
    setFavoriteDialogOpen(true);
  };

  const handleCloseFavoriteDialog = () => {
    if (favoriteSavingSymbol) return;
    setFavoriteDialogOpen(false);
    setFavoriteSearchError(null);
    window.setTimeout(() => favoriteOpenButtonRef.current?.focus(), 0);
  };

  const handleAddFavorite = async (item?: SymbolSearchItem) => {
    const symbolCandidate = normalizeSymbolCode(item?.symbol || favoriteSymbolInput);
    const favoriteSourceItem = item ? normalizeSearchItem(item) : getValidatedFavoriteItem(symbolCandidate);

    if (!symbolCandidate) {
      setFavoriteStatus(null);
      setFavoriteError("Enter a symbol code before adding a favorite.");
      return;
    }

    if (!favoriteSourceItem) {
      setFavoriteStatus(null);
      setFavoriteError("Select a symbol from the search suggestions before adding a favorite.");
      return;
    }

    const symbol = favoriteSourceItem.symbol;
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
          setTrackedSymbolsError(`Favorite updates unavailable. HTTP ${currentResult.status}`);
          setFavoriteError(`Favorite save blocked until tracked symbols load successfully. HTTP ${currentResult.status}`);
          return;
        }
        currentTrackedSymbols = currentResult.data.tracked_symbols.map(normalizeSymbolCode);
        setTrackedSymbols(currentTrackedSymbols);
        setTrackedSymbolsLoaded(true);
        setTrackedSymbolsError(null);
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
      const favoriteItem = normalizeSearchItem(favoriteSourceItem);

      invalidateTradingApiCacheByPathPrefix([
        "/api/trading/scanner/tracked-symbols",
        "/api/trading/symbols/favorites",
      ]);
      setTrackedSymbols(normalizedTrackedSymbols);
      setTrackedSymbolsError(null);
      setFavoriteListError(null);
      setFavoriteItems((current) => {
        const next = [favoriteItem, ...current.filter((currentItem) => currentItem.symbol !== symbol)];
        return next.slice(0, 4);
      });
      setFavoriteDialogOpen(false);
      setFavoriteSearchItems([]);
      setFavoriteSearchError(null);
      setFavoriteSymbolInput("");
      setFavoriteStatus(`${symbol} saved to core favorites.`);
      window.setTimeout(() => favoriteOpenButtonRef.current?.focus(), 0);
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
            <span className={`pill ${styles.marketStatusPill} ${marketStatus.is_open ? "positive" : styles.marketStatusClosedPill}`}>
              {marketBadgeLabel}
            </span>
            <DevModeToggle />
          </div>
        </>
      }
    >
      <div className={styles.searchTerminal}>
        <section className={styles.heroPanel}>
          <ComponentTag label="search.terminal-shell" api="/api/trading/symbols/search" />
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
          {searchError ? <PanelUnavailable message={searchError} /> : null}
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
                ref={favoriteOpenButtonRef}
                type="button"
                onClick={handleOpenFavoriteDialog}
                disabled={favoriteSavingSymbol !== null}
                aria-label="Open favorite search"
                aria-haspopup="dialog"
                aria-expanded={favoriteDialogOpen}
                aria-controls={favoriteDialogOpen ? FAVORITE_DIALOG_ID : undefined}
              >
                +
              </button>
              <span>{favoriteListError ? "Unavailable" : favoriteItems.length > 0 ? "Core favorites" : "No favorites"}</span>
            </div>
          </div>
          <div className={styles.quickGrid}>
            {favoriteListError ? (
              <PanelUnavailable message={favoriteListError} />
            ) : quickAccessItems.length > 0 ? (
              quickAccessItems.map((item) => (
                <button
                  key={item.symbol}
                  type="button"
                  className={styles.quickCard}
                  onClick={() => handleSelect(item, { navigate: true })}
                >
                  <span>
                    <strong className="clamp-3">{item.symbol}</strong>
                    <small className="clamp-3">{item.name_ko}</small>
                  </span>
                </button>
              ))
            ) : (
              <div className={styles.emptyState}>
                <strong>No favorites saved.</strong>
                <p className="clamp-3">Use + to search the symbol master and save a core favorite.</p>
              </div>
            )}
          </div>
          {favoriteDialogOpen && typeof document !== "undefined"
            ? createPortal(
                <div className={styles.favoriteDialogOverlay} onClick={handleCloseFavoriteDialog}>
                  <div
                    id={FAVORITE_DIALOG_ID}
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
                        role="combobox"
                        aria-autocomplete="list"
                        aria-expanded={favoriteSearchItems.length > 0}
                        aria-controls={FAVORITE_SUGGESTIONS_ID}
                        autoComplete="off"
                      />
                      <button type="submit" disabled={!canAddFavorite}>
                        {favoriteSavingSymbol ? "Saving" : "Add"}
                      </button>
                    </form>
                    {favoriteSearchError ? <div className={styles.feedback}>{favoriteSearchError}</div> : null}
                    {favoriteError ? <div className={styles.feedback}>{favoriteError}</div> : null}
                    <div
                      id={FAVORITE_SUGGESTIONS_ID}
                      className={styles.favoriteSuggestions}
                      aria-label="Favorite search suggestions"
                      aria-busy={favoriteSearchLoading}
                      aria-live="polite"
                    >
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
                      {favoriteSymbolInput.trim() &&
                      favoriteSearchItems.length === 0 &&
                      !favoriteSearchLoading &&
                      !favoriteSearchError ? (
                        <div className={styles.emptyState}>
                          <strong>No matching symbols.</strong>
                          <p className="clamp-3">Enter an exact symbol code from the symbol master or refine the search.</p>
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
                </div>,
                document.body,
              )
            : null}
          {favoriteStatus ? <p className={styles.favoriteStatus}>{favoriteStatus}</p> : null}
          {trackedSymbolsError ? <p className={styles.favoriteError}>{trackedSymbolsError}</p> : null}
          {favoriteError && !favoriteDialogOpen ? <p className={styles.favoriteError}>{favoriteError}</p> : null}
        </section>

        <section className={styles.trendingPanel}>
          <ComponentTag
            label="search.trending-symbols"
            api="/api/trading/scanner/realtime-trending + /api/trading/scanner/trending-stocks"
          />
          <div className={styles.sectionHeader}>
            <h2>Trending Symbols</h2>
            <span>{trendingMeta ?? selectedTrendingTab.description}</span>
          </div>
          <div className={styles.trendingTabs} role="tablist" aria-label="Trending source">
            {TRENDING_TABS.map((tab) => (
              <button
                key={tab.mode}
                type="button"
                role="tab"
                aria-selected={tab.mode === trendingMode}
                className={tab.mode === trendingMode ? styles.trendingTabActive : undefined}
                onClick={() => handleTrendingModeChange(tab.mode)}
              >
                <span>{tab.label}</span>
                <small>{tab.description}</small>
              </button>
            ))}
          </div>
          {trendingError ? <PanelUnavailable message={trendingError} /> : null}
          <div className={styles.trendingList}>
            {trendingItems.map((item) => {
              const isSelected = selected?.symbol === item.symbol;
              return (
                <button
                  key={`${trendingMode}-${item.symbol}`}
                  type="button"
                  className={`${styles.trendingRow} ${isSelected ? styles.trendingRowActive : ""}`.trim()}
                  onClick={() => handleSelect(item.searchItem, { navigate: true })}
                >
                  <span className={styles.trendingRank}>#{item.rank ?? UNKNOWN}</span>
                  <span className={styles.trendingIdentity}>
                    <strong className="clamp-3">{item.name}</strong>
                    <small className="clamp-3">{item.symbol}</small>
                  </span>
                  <span className={styles.trendingMetric}>
                    <strong className={getTrendingMetricClass(item)}>{formatTrendingMetric(item)}</strong>
                    <small className="clamp-3">
                      {item.sourceLabel} · {item.market}
                    </small>
                  </span>
                </button>
              );
            })}
            {trendingItems.length === 0 && !trendingLoading && !trendingError ? (
              <div className={styles.emptyState}>
                <strong>{UNKNOWN}</strong>
                <p className="clamp-3">No symbols returned for {selectedTrendingTab.label} trending.</p>
              </div>
            ) : null}
          </div>
          {trendingLoading ? <p className={styles.trendingStatus}>Loading {selectedTrendingTab.label} symbols...</p> : null}
          {canShowMoreTrending ? (
            <button type="button" className={styles.trendingMoreButton} onClick={handleShowMoreTrending}>
              More
            </button>
          ) : null}
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
          {searchError ? <PanelUnavailable message={searchError} /> : null}
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
      </div>
    </MobileAppChrome>
  );
}
