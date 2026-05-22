"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { ComponentTag } from "@/components/dev/component-tag";
import { MobileAppChrome } from "@/components/mobile/mobile-app-chrome";
import { useAppState } from "@/components/providers/app-state-provider";
import { useNavigationLoading } from "@/components/providers/navigation-loading-provider";
import { SurfaceState } from "@/components/ui/surface-state";
import { getSearchPageCopy, type SearchPageCopy } from "@/i18n/search-page-copy";
import { formatDisplayTimestamp, formatPrice } from "@/lib/format";
import { getNumberLocale } from "@/lib/locale";
import {
  resolveKisMetricPresentation,
  resolveKisSourceLabel,
  resolveStoredTrendingLabels,
  type RealtimeTrendingResponse,
} from "@/lib/search-trending-metadata";
import {
  buildMobileToolbarTrendingPath,
  MOBILE_TOOLBAR_FAVORITES_PATH,
  MOBILE_TOOLBAR_INITIAL_TRENDING_LIMIT,
  MOBILE_TOOLBAR_MARKET_STATUS_PATH,
  MOBILE_TOOLBAR_TRACKED_QUOTES_PATH,
  warmMobileToolbarViewData,
} from "@/lib/mobile-toolbar-data";
import { resolveTradingApiClientPath } from "@/lib/trading-api-client-path";
import {
  UNKNOWN_SYMBOL_META,
  getForwardableSymbolMetaSeedValue,
  normalizeSymbolMetaSeedValue,
} from "@/lib/symbol-meta";
import { getSearchSuggestionBadge } from "@/lib/search-suggestion-badge";
import {
  getTradingApiJsonResult,
  invalidateTradingApiCacheByPathPrefix,
  readTradingApiJsonCacheData,
  readTradingApiJsonSnapshot,
  seedTradingApiJsonSnapshot,
} from "@/lib/trading-api-cache";
import {
  SYMBOL_DETAIL_NAV_CONTEXT_PARAM,
  SYMBOL_DETAIL_SEARCH_NAV_CONTEXT,
} from "@/app/dashboard/symbol/[symbol]/symbol-detail-state";

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
  metricLabel: string;
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
const SEARCH_SUGGESTIONS_ID = "search-symbol-suggestions";
const FAVORITE_DIALOG_ID = "favorite-symbol-dialog";
const FAVORITE_SUGGESTIONS_ID = "favorite-symbol-suggestions";
const TRENDING_INITIAL_LIMIT = MOBILE_TOOLBAR_INITIAL_TRENDING_LIMIT;
const TRENDING_LIMIT_STEP = 5;
const DEFAULT_MARKET_STATUS: CoreMarketStatus = {
  state: "MARKET STATUS PENDING",
  is_open: false,
  server_time: "",
};

const CLOSED_MARKET_STATUS: CoreMarketStatus = {
  state: "CLOSED",
  is_open: false,
  server_time: "",
};

function hasNumber(value: number | null | undefined): value is number {
  return typeof value === "number";
}

async function getJson<T>(path: string, init?: RequestInit): Promise<JsonResult<T>> {
  return getTradingApiJsonResult<T>(resolveTradingApiClientPath(path), init);
}

function buildSymbolHref(item: SymbolSearchItem, query: string) {
  const params = new URLSearchParams();
  const name = getForwardableSymbolMetaSeedValue(item.name_ko);
  const market = getForwardableSymbolMetaSeedValue(item.market);
  const standardCode = getForwardableSymbolMetaSeedValue(item.standard_code);
  const normalizedQuery = query.trim();

  if (name) params.set("name", name);
  if (market) params.set("market", market);
  if (standardCode) params.set("standardCode", standardCode);
  params.set(SYMBOL_DETAIL_NAV_CONTEXT_PARAM, SYMBOL_DETAIL_SEARCH_NAV_CONTEXT);
  if (normalizedQuery) {
    params.set("q", normalizedQuery);
  }
  const queryString = params.toString();
  return `/dashboard/symbol/${encodeURIComponent(item.symbol)}${queryString ? `?${queryString}` : ""}`;
}

function getChangeClass(value: number | null | undefined) {
  if (!hasNumber(value)) return styles.neutralText;
  return value >= 0 ? styles.positiveText : styles.negativeText;
}

function formatChangePct(value: number | null | undefined) {
  if (!hasNumber(value)) return UNKNOWN;
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function PanelUnavailable({ message, label }: { message: string; label: string }) {
  return (
    <SurfaceState className={styles.feedback} title={label} tone="warning">
      <span className="clamp-3">{message}</span>
    </SurfaceState>
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
    return buildMobileToolbarTrendingPath(limit);
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

function formatTrendingMetric(item: TrendingDisplayItem, numberLocale: string) {
  const metricUnit = item.metricUnit?.toLowerCase();
  const value = getTrendingMetricValue(item);

  if (!hasNumber(value)) return UNKNOWN;
  if (isPercentTrendingMetric(item)) {
    return formatChangePct(value);
  }
  if (metricUnit === "shares") {
    return value.toLocaleString(numberLocale);
  }
  if (metricUnit === "rank") {
    return `#${Math.round(value)}`;
  }
  return value.toLocaleString(numberLocale);
}

function getInitialFavoriteItems() {
  return (
    readTradingApiJsonCacheData<FavoriteSymbolsResponse>(MOBILE_TOOLBAR_FAVORITES_PATH)
      ?.items.map(normalizeSearchItem)
      .slice(0, 4) ?? []
  );
}

function getInitialTrendingState(copy: SearchPageCopy) {
  const cachedData = readTradingApiJsonCacheData<RealtimeTrendingResponse>(
    buildMobileToolbarTrendingPath(TRENDING_INITIAL_LIMIT),
  );
  if (!cachedData) {
    return {
      items: [] as TrendingDisplayItem[],
      meta: null as string | null,
      resultCount: 0,
    };
  }

  const mappedItems = mapRealtimeTrendingItems(cachedData, copy);
  return {
    items: mappedItems.slice(0, TRENDING_INITIAL_LIMIT),
    meta: `${cachedData.status.toUpperCase()} · ${formatTrendingStatusDate(cachedData.as_of)}`,
    resultCount: cachedData.summary?.item_count ?? mappedItems.length,
  };
}

function getTrendingMetricClass(item: TrendingDisplayItem) {
  const value = getTrendingMetricValue(item);
  if (!hasNumber(value)) return styles.neutralText;
  return value >= 0 ? styles.positiveText : styles.negativeText;
}

function getTrendingPrice(item: StoredTrendingItem) {
  return item.price?.close_price ?? item.technical?.close_price ?? null;
}

function mapRealtimeTrendingItems(response: RealtimeTrendingResponse, copy: SearchPageCopy): TrendingDisplayItem[] {
  return response.items.map((item, index) => {
    const primarySource = item.sources?.[0];
    const sourceCount = item.source_count ?? item.sources?.length ?? 0;
    const metricPresentation = resolveKisMetricPresentation(primarySource, copy);
    const sourceLabel = resolveKisSourceLabel(primarySource?.source_label, response.source, sourceCount);
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
      metricLabel: metricPresentation.metricLabel,
      sourceLabel,
      metricName: metricPresentation.metricName,
      metricUnit: metricPresentation.metricUnit,
      metricValue: metricPresentation.metricValue,
      changePct: item.change_pct ?? null,
      price: item.price ?? null,
      searchItem,
    };
  });
}

function mapStoredTrendingItems(
  response: StoredTrendingResponse,
  mode: Exclude<TrendingMode, "kis">,
  copy: SearchPageCopy,
): TrendingDisplayItem[] {
  return response.items.map((item, index) => {
    const market = normalizeSymbolMetaSeedValue(item.market ?? "KRX");
    const name = normalizeSymbolMetaSeedValue(item.name_ko ?? item.symbol);
    const searchItem = normalizeSearchItem({
      symbol: item.symbol,
      standard_code: "",
      name_ko: name,
      market,
    });
    const { metricLabel, sourceLabel } = resolveStoredTrendingLabels(mode, copy);

    return {
      symbol: searchItem.symbol,
      name,
      market,
      rank: item.rank ?? index + 1,
      metricLabel,
      sourceLabel,
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
  const { beginNavigation } = useNavigationLoading();
  const searchParams = useSearchParams();
  const { locale } = useAppState();
  const copy = getSearchPageCopy(locale);
  const numberLocale = getNumberLocale(locale);
  const querySeed = useMemo(() => searchParams.get("q")?.trim() ?? "", [searchParams]);
  const [query, setQuery] = useState(querySeed);
  const [items, setItems] = useState<SymbolSearchItem[]>([]);
  const [selected, setSelected] = useState<SymbolSearchItem | null>(null);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [favoriteItems, setFavoriteItems] = useState<SymbolSearchItem[]>(() => getInitialFavoriteItems());
  const [favoriteListError, setFavoriteListError] = useState<string | null>(null);
  const [trackedSymbolsError, setTrackedSymbolsError] = useState<string | null>(null);
  const [favoriteDialogOpen, setFavoriteDialogOpen] = useState(false);
  const [favoriteSymbolInput, setFavoriteSymbolInput] = useState("");
  const [favoriteSearchItems, setFavoriteSearchItems] = useState<SymbolSearchItem[]>([]);
  const [favoriteSearchLoading, setFavoriteSearchLoading] = useState(false);
  const [favoriteSearchError, setFavoriteSearchError] = useState<string | null>(null);

  useEffect(() => {
    setQuery(querySeed);
  }, [querySeed]);
  const [favoriteSavingSymbol, setFavoriteSavingSymbol] = useState<string | null>(null);
  const [favoriteStatus, setFavoriteStatus] = useState<string | null>(null);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const favoriteOpenButtonRef = useRef<HTMLButtonElement>(null);
  const favoriteSearchInputRef = useRef<HTMLInputElement>(null);
  const trendingListRef = useRef<HTMLDivElement>(null);
  const pendingTrendingViewportCompensationRef = useRef(false);
  const [trendingMode, setTrendingMode] = useState<TrendingMode>("kis");
  const [trendingItems, setTrendingItems] = useState<TrendingDisplayItem[]>(() => getInitialTrendingState(copy).items);
  const [trendingVisibleLimit, setTrendingVisibleLimit] = useState(TRENDING_INITIAL_LIMIT);
  const [trendingResultCount, setTrendingResultCount] = useState(() => getInitialTrendingState(copy).resultCount);
  const [trendingMeta, setTrendingMeta] = useState<string | null>(() => getInitialTrendingState(copy).meta);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [trendingReservedHeight, setTrendingReservedHeight] = useState<number | null>(null);
  const [trendingViewportSpacerHeight, setTrendingViewportSpacerHeight] = useState(0);
  const [trendingError, setTrendingError] = useState<string | null>(null);
  const [marketStatus, setMarketStatus] = useState<CoreMarketStatus>(
    () => readTradingApiJsonSnapshot<CoreMarketStatus>(MOBILE_TOOLBAR_MARKET_STATUS_PATH) ?? DEFAULT_MARKET_STATUS,
  );
  const trendingTabs: TrendingTab[] = [
    { mode: "kis", label: "KIS", description: copy.trending.tabs.kis },
    { mode: "1d", label: "1D", description: copy.trending.tabs["1d"] },
    { mode: "5d", label: "5D", description: copy.trending.tabs["5d"] },
    { mode: "20d", label: "20D", description: copy.trending.tabs["20d"] },
  ];

  const resetTrendingResults = () => {
    setTrendingItems([]);
    setTrendingResultCount(0);
    setTrendingMeta(null);
  };

  useEffect(() => {
    let active = true;

    const loadMarketStatus = async () => {
      try {
        const result = await getJson<CoreMarketStatus>("/api/trading/market/status");
        if (!active) return;
        if (!result.ok) {
          setMarketStatus((current) => ({
            ...current,
            ...CLOSED_MARKET_STATUS,
            server_time: current.server_time,
          }));
          return;
        }
        setMarketStatus(result.data);
        seedTradingApiJsonSnapshot(MOBILE_TOOLBAR_MARKET_STATUS_PATH, result.data);
      } catch {
        if (!active) return;
        setMarketStatus((current) => ({
          ...current,
          ...CLOSED_MARKET_STATUS,
          server_time: current.server_time,
        }));
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
          setFavoriteListError(`${copy.errors.favoriteListUnavailable} HTTP ${result.status}`);
          return;
        }
        setFavoriteItems(result.data.items.map(normalizeSearchItem).slice(0, 4));
        setFavoriteListError(null);
      } catch {
        if (!active) return;
        setFavoriteListError(copy.errors.favoriteListUnavailable);
      }
    };

    void loadFavorites();
    return () => {
      active = false;
    };
  }, [copy.errors.favoriteListUnavailable]);

  useEffect(() => {
    let active = true;

    const loadTrackedSymbols = async () => {
      try {
        const result = await getJson<TrackedSymbolsResponse>("/api/trading/scanner/tracked-symbols");
        if (!active) return;
        if (!result.ok) {
          setTrackedSymbolsError(`${copy.errors.favoriteUpdatesUnavailable} HTTP ${result.status}`);
          return;
        }
        setTrackedSymbolsError(null);
      } catch {
        if (!active) return;
        setTrackedSymbolsError(copy.errors.favoriteUpdatesUnavailable);
      }
    };

    void loadTrackedSymbols();
    return () => {
      active = false;
    };
  }, [copy.errors.favoriteUpdatesUnavailable]);

  useEffect(() => {
    const searchQuery = query.trim();
    if (!searchQuery) {
      setItems([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }

    let active = true;
    setItems([]);
    setSearchError(null);
    setSearchLoading(true);
    const load = async () => {
      try {
        const result = await getJson<SymbolSearchResponse>(
          `/api/trading/symbols/search?q=${encodeURIComponent(searchQuery)}&limit=20`,
        );
        if (!active) return;
        if (!result.ok) {
          setItems([]);
          setSearchError(`${copy.errors.searchUnavailable} HTTP ${result.status}`);
          return;
        }
        const data = result.data;
        const normalizedItems = data.items.map(normalizeSearchItem);
        setItems(normalizedItems);
        setSearchError(null);
      } catch {
        if (!active) return;
        setItems([]);
        setSearchError(copy.errors.searchUnavailable);
      } finally {
        if (active) setSearchLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [copy.errors.searchUnavailable, query]);

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
          setFavoriteSearchError(`${copy.errors.favoriteSearchUnavailable} HTTP ${result.status}`);
          return;
        }
        setFavoriteSearchItems(result.data.items.map(normalizeSearchItem));
        setFavoriteSearchError(null);
      } catch {
        if (!active) return;
        setFavoriteSearchItems([]);
        setFavoriteSearchError(copy.errors.favoriteSearchUnavailable);
      } finally {
        if (active) setFavoriteSearchLoading(false);
      }
    }, 150);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [copy.errors.favoriteSearchUnavailable, favoriteDialogOpen, favoriteSymbolInput]);

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
            setTrendingError(`${copy.errors.trendingUnavailable} HTTP ${result.status}`);
            return;
          }

          const mappedItems = mapRealtimeTrendingItems(result.data, copy);
          setTrendingItems(mappedItems.slice(0, trendingVisibleLimit));
          setTrendingResultCount(result.data.summary?.item_count ?? mappedItems.length);
          setTrendingMeta(`${result.data.status.toUpperCase()} · ${formatTrendingStatusDate(result.data.as_of)}`);
          return;
        }

        const result = await getJson<StoredTrendingResponse>(getTrendingEndpoint(trendingMode, trendingVisibleLimit));
        if (!active) return;
        if (!result.ok) {
          setTrendingError(`${copy.errors.trendingUnavailable} HTTP ${result.status}`);
          return;
        }

        const mappedItems = mapStoredTrendingItems(result.data, trendingMode, copy);
        setTrendingItems(mappedItems.slice(0, trendingVisibleLimit));
        setTrendingResultCount(result.data.summary?.count ?? mappedItems.length);
        setTrendingMeta(
          `${copy.trending.storedPrefix} ${trendingMode.toUpperCase()} · ${result.data.request?.resolved_market_date ?? UNKNOWN}`,
        );
      } catch {
        if (!active) return;
        setTrendingError(copy.errors.trendingUnavailable);
      } finally {
        if (active) setTrendingLoading(false);
      }
    };

    void loadTrending();
    return () => {
      active = false;
    };
  }, [copy, copy.errors.trendingUnavailable, trendingMode, trendingVisibleLimit]);

  useLayoutEffect(() => {
    if (trendingLoading || !trendingListRef.current) return;

    const list = trendingListRef.current;
    const previousMinHeight = list.style.minHeight;
    list.style.minHeight = "0px";
    const nextHeight = Math.ceil(list.getBoundingClientRect().height);
    list.style.minHeight = previousMinHeight;
    const nextReservedHeight = nextHeight > 0 ? nextHeight : null;
    const previousReservedHeight = trendingReservedHeight ?? 0;
    const resolvedReservedHeight = nextReservedHeight ?? 0;

    setTrendingReservedHeight(nextReservedHeight);

    if (pendingTrendingViewportCompensationRef.current) {
      setTrendingViewportSpacerHeight(
        resolvedReservedHeight < previousReservedHeight ? previousReservedHeight - resolvedReservedHeight : 0,
      );
      pendingTrendingViewportCompensationRef.current = false;
    }

  }, [trendingError, trendingItems, trendingLoading, trendingReservedHeight]);

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

  const trimmedQuery = query.trim();
  const searchSuggestions = trimmedQuery ? items.slice(0, 6) : [];
  const resultTitle = trimmedQuery
    ? locale === "ko"
      ? `"${trimmedQuery}" ${copy.results.resultPrefix}`
      : `${copy.results.resultPrefix} "${trimmedQuery}"`
    : copy.results.title;
  const selectedQuoteDate = quote ? formatDisplayTimestamp(quote.cached_at ?? quote.trade_date, UNKNOWN) : UNKNOWN;
  const favoriteSymbolCandidate = normalizeSymbolCode(favoriteSymbolInput);
  const favoriteInputItem = favoriteSymbolCandidate ? getValidatedFavoriteItem(favoriteSymbolCandidate) : null;
  const canAddFavorite = favoriteInputItem !== null && favoriteSavingSymbol === null;
  const quickAccessItems = favoriteItems;
  const selectedTrendingTab = trendingTabs.find((tab) => tab.mode === trendingMode) ?? trendingTabs[0];
  const canShowMoreTrending = trendingItems.length > 0 && trendingResultCount >= trendingVisibleLimit && !trendingLoading;
  const marketBadgeLabel =
    marketStatus.state === DEFAULT_MARKET_STATUS.state
      ? copy.status.marketPending
      : marketStatus.is_open
        ? copy.status.marketOpen
        : copy.status.marketClosed;

  const handleTrendingModeChange = (nextMode: TrendingMode) => {
    if (nextMode === trendingMode && trendingVisibleLimit === TRENDING_INITIAL_LIMIT) return;

    if (nextMode !== trendingMode) {
      pendingTrendingViewportCompensationRef.current = true;
      setTrendingLoading(true);
      resetTrendingResults();
    }
    setTrendingMode(nextMode);
    setTrendingVisibleLimit(TRENDING_INITIAL_LIMIT);
    setTrendingError(null);
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
      const href = buildSymbolHref(item, query);
      beginNavigation(href);
      router.push(href);
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
      setFavoriteError(copy.errors.enterSymbol);
      return;
    }

    if (!favoriteSourceItem) {
      setFavoriteStatus(null);
      setFavoriteError(copy.errors.selectSuggestion);
      return;
    }

    const symbol = favoriteSourceItem.symbol;
    setFavoriteSavingSymbol(symbol);
    setFavoriteStatus(null);
    setFavoriteError(null);

    try {
      const currentResult = await getJson<TrackedSymbolsResponse>("/api/trading/scanner/tracked-symbols");
      if (!currentResult.ok) {
        setTrackedSymbolsError(`${copy.errors.favoriteUpdatesUnavailable} HTTP ${currentResult.status}`);
        setFavoriteError(`${copy.errors.favoriteSaveBlocked} HTTP ${currentResult.status}`);
        return;
      }
      const currentTrackedSymbols = currentResult.data.tracked_symbols.map(normalizeSymbolCode);
      setTrackedSymbolsError(null);

      const nextSymbols = [symbol, ...currentTrackedSymbols.filter((currentSymbol) => currentSymbol !== symbol)];
      const result = await getJson<TrackedSymbolsResponse>("/api/trading/scanner/tracked-symbols", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ symbols: nextSymbols }),
      });

      if (!result.ok) {
        setFavoriteError(`${copy.errors.favoriteSaveFailed} HTTP ${result.status}`);
        return;
      }
      invalidateTradingApiCacheByPathPrefix([
        "/api/trading/scanner/tracked-symbols",
        "/api/trading/symbols/favorites",
        MOBILE_TOOLBAR_TRACKED_QUOTES_PATH,
      ]);
      setTrackedSymbolsError(null);
      setFavoriteListError(null);

      let refreshedFavorites: JsonResult<FavoriteSymbolsResponse>;
      try {
        refreshedFavorites = await getJson<FavoriteSymbolsResponse>("/api/trading/symbols/favorites");
      } catch {
        setFavoriteError(copy.errors.favoriteRefreshFailed);
        return;
      }

      if (!refreshedFavorites.ok) {
        setFavoriteError(`${copy.errors.favoriteRefreshFailed} HTTP ${refreshedFavorites.status}`);
        return;
      }

      setFavoriteItems(refreshedFavorites.data.items.map(normalizeSearchItem).slice(0, 4));
      setFavoriteDialogOpen(false);
      setFavoriteSearchItems([]);
      setFavoriteSearchError(null);
      setFavoriteSymbolInput("");
      setFavoriteStatus(`${symbol} ${copy.quickAccess.savedSuffix}`);
      void warmMobileToolbarViewData("search");
      window.setTimeout(() => favoriteOpenButtonRef.current?.focus(), 0);
    } catch {
      setFavoriteError(copy.errors.favoriteSaveFailed);
    } finally {
      setFavoriteSavingSymbol(null);
    }
  };

  return (
    <MobileAppChrome
      chrome={{
        activeNav: "search",
        status: { label: marketBadgeLabel, tone: marketStatus.is_open ? "positive" : "closed" },
      }}
    >
      <div className={styles.searchTerminal}>
        <section className={styles.heroPanel}>
          <ComponentTag label="search.terminal-shell" api="/api/trading/symbols/search" />
          <p className={styles.desktopBreadcrumb}>{copy.hero.breadcrumb}</p>
          <h1>{copy.hero.title}</h1>
          <p className={`${styles.heroCopy} clamp-3`}>
            {copy.hero.description}
          </p>
          <div className={styles.searchInputStack}>
            <label className={styles.searchInputFrame}>
              <span className={styles.srOnly}>{copy.hero.inputLabel}</span>
              <span className={styles.searchGlyph} aria-hidden="true" />
              <input
                value={query}
                onChange={(event) => handleQueryChange(event.target.value)}
                placeholder={copy.hero.inputPlaceholder}
                aria-label={copy.hero.inputLabel}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={Boolean(trimmedQuery)}
                aria-controls={trimmedQuery ? SEARCH_SUGGESTIONS_ID : undefined}
                autoComplete="off"
              />
              {query ? (
                <button type="button" onClick={() => handleQueryChange("")} aria-label={copy.hero.clearQuery}>
                  /
                </button>
              ) : (
                <kbd>/</kbd>
              )}
            </label>

            {trimmedQuery ? (
              <div
                id={SEARCH_SUGGESTIONS_ID}
                className={styles.searchSuggestions}
                aria-label={copy.hero.suggestions}
                aria-busy={searchLoading}
                aria-live="polite"
              >
                {searchError ? <PanelUnavailable message={searchError} label={copy.status.unavailable} /> : null}
                {searchSuggestions.map((item) => {
                  const isSelected = selected?.symbol === item.symbol;
                  const searchSuggestionBadge = getSearchSuggestionBadge({ symbol: item.symbol, market: item.market });
                  return (
                    <Link
                      key={item.symbol}
                      href={buildSymbolHref(item, query)}
                      className={`${styles.searchSuggestion} ${isSelected ? styles.searchSuggestionActive : ""}`.trim()}
                      onClick={() => handleSelect(item)}
                    >
                      <span
                        aria-hidden="true"
                        className={
                          searchSuggestionBadge
                            ? styles.symbolAvatar
                            : `${styles.symbolAvatar} ${styles.symbolAvatarPlaceholder}`
                        }
                      >
                        {searchSuggestionBadge ?? ""}
                      </span>
                      <span className={styles.resultIdentity}>
                        <strong className="clamp-3">{item.symbol}</strong>
                        <span className="clamp-3">{item.name_ko}</span>
                      </span>
                      <small className="clamp-3">{item.market}</small>
                    </Link>
                  );
                })}
                {searchLoading ? <p className={styles.searchSuggestionStatus}>{copy.status.searching}</p> : null}
                {!searchLoading && searchSuggestions.length === 0 && !searchError ? (
                  <div className={styles.emptyState}>
                    <strong>{copy.hero.noMatchesTitle}</strong>
                    <p className="clamp-3">{copy.hero.noMatchesBody}</p>
                  </div>
                ) : null}
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
            <h2>{copy.quickAccess.title}</h2>
            <div className={styles.sectionActions}>
              <button
                ref={favoriteOpenButtonRef}
                type="button"
                className={styles.quickAccessAddButton}
                onClick={handleOpenFavoriteDialog}
                disabled={favoriteSavingSymbol !== null}
                aria-label={copy.quickAccess.openFavoriteSearch}
                aria-haspopup="dialog"
                aria-expanded={favoriteDialogOpen}
                aria-controls={favoriteDialogOpen ? FAVORITE_DIALOG_ID : undefined}
              >
                <span className={styles.quickAccessAddGlyph} aria-hidden="true">
                  +
                </span>
                <span className={styles.quickAccessAddText}>
                  {favoriteListError
                    ? copy.status.unavailable
                    : favoriteItems.length > 0
                      ? copy.quickAccess.coreFavorites
                      : copy.quickAccess.noFavorites}
                </span>
              </button>
            </div>
          </div>
          <div className={styles.quickGrid}>
            {favoriteListError ? (
              <PanelUnavailable message={favoriteListError} label={copy.status.unavailable} />
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
                <strong>{copy.quickAccess.emptyTitle}</strong>
                <p className="clamp-3">{copy.quickAccess.emptyBody}</p>
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
                        <strong id="favorite-dialog-title">{copy.quickAccess.dialogTitle}</strong>
                        <span>{copy.quickAccess.dialogSubtitle}</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleCloseFavoriteDialog}
                        aria-label={copy.quickAccess.closeFavoriteSearch}
                      >
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
                        {copy.quickAccess.inputLabel}
                      </label>
                      <input
                        ref={favoriteSearchInputRef}
                        id="favorite-symbol-search"
                        value={favoriteSymbolInput}
                        onChange={(event) => setFavoriteSymbolInput(event.target.value)}
                        placeholder={copy.quickAccess.inputPlaceholder}
                        aria-label={copy.quickAccess.inputLabel}
                        role="combobox"
                        aria-autocomplete="list"
                        aria-expanded={favoriteSearchItems.length > 0}
                        aria-controls={FAVORITE_SUGGESTIONS_ID}
                        autoComplete="off"
                      />
                      <button type="submit" disabled={!canAddFavorite}>
                        {favoriteSavingSymbol ? copy.status.saving : copy.quickAccess.add}
                      </button>
                    </form>
                    {favoriteSearchError ? <div className={styles.feedback}>{favoriteSearchError}</div> : null}
                    {favoriteError ? <div className={styles.feedback}>{favoriteError}</div> : null}
                    <div
                      id={FAVORITE_SUGGESTIONS_ID}
                      className={styles.favoriteSuggestions}
                      aria-label={copy.quickAccess.suggestions}
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
                          <strong>{copy.quickAccess.noMatchesTitle}</strong>
                          <p className="clamp-3">{copy.quickAccess.noMatchesBody}</p>
                        </div>
                      ) : null}
                      {!favoriteSymbolInput.trim() ? (
                        <div className={styles.emptyState}>
                          <strong>{copy.quickAccess.startTypingTitle}</strong>
                          <p className="clamp-3">{copy.quickAccess.startTypingBody}</p>
                        </div>
                      ) : null}
                      {favoriteSearchLoading ? <p className={styles.favoriteSearchStatus}>{copy.status.searching}</p> : null}
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
            <h2>{copy.trending.title}</h2>
            <span>{trendingMeta ?? selectedTrendingTab.description}</span>
          </div>
          <div className={styles.trendingTabs} role="tablist" aria-label={copy.trending.source}>
            {trendingTabs.map((tab) => (
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
          {trendingError ? <PanelUnavailable message={trendingError} label={copy.status.unavailable} /> : null}
          <div
            ref={trendingListRef}
            className={styles.trendingList}
            aria-busy={trendingLoading || undefined}
            style={{ minHeight: trendingReservedHeight ? `${trendingReservedHeight}px` : undefined }}
          >
            {trendingItems.map((item) => {
              const isSelected = selected?.symbol === item.symbol;
              return (
                <button
                  key={item.symbol}
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
                    <strong className={getTrendingMetricClass(item)}>{formatTrendingMetric(item, numberLocale)}</strong>
                    <small className="clamp-3">
                      {item.metricLabel} · {item.sourceLabel} · {item.market}
                    </small>
                  </span>
                </button>
              );
            })}
            {trendingItems.length === 0 && !trendingLoading && !trendingError ? (
              <div className={styles.emptyState}>
                <strong>{UNKNOWN}</strong>
                <p className="clamp-3">
                  {copy.trending.noSymbolsPrefix} {selectedTrendingTab.label} {copy.trending.noSymbolsSuffix}
                </p>
              </div>
            ) : null}
          </div>
          {trendingLoading ? (
            <p className={styles.trendingStatus}>
              {copy.trending.loadingPrefix} {selectedTrendingTab.label} {copy.trending.loadingSuffix}
            </p>
          ) : null}
          {canShowMoreTrending ? (
            <button type="button" className={styles.trendingMoreButton} onClick={handleShowMoreTrending}>
              {copy.trending.more}
            </button>
          ) : null}
        </section>

        <section className={styles.desktopResultsPanel}>
          <ComponentTag label="search.desktop-results-table" api="/api/trading/symbols/search + selected /api/trading/quotes/{symbol}" />
          <div className={styles.desktopResultsHeader}>
            <div>
              <span aria-hidden="true">=</span>
              <h2>
                {query.trim() ? `${resultTitle} · ` : `${copy.results.title} `}({items.length} {copy.results.foundSuffix})
              </h2>
            </div>
            <div>
              <button type="button">{copy.results.filters}</button>
              <button type="button">{copy.results.export}</button>
            </div>
          </div>
          {searchError ? <PanelUnavailable message={searchError} label={copy.status.unavailable} /> : null}
          <div className={styles.resultsTableWrap}>
            <table className={styles.resultsTable}>
              <thead>
                <tr>
                  <th>{copy.results.columns.symbol}</th>
                  <th>{copy.results.columns.name}</th>
                  <th>{copy.results.columns.price}</th>
                  <th>{copy.results.columns.changePct}</th>
                  <th>{copy.results.columns.marketCap}</th>
                  <th>{copy.results.columns.coverage}</th>
                  <th>{copy.results.columns.freshness}</th>
                  <th>{copy.results.columns.detail}</th>
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
                        <Link href={buildSymbolHref(item, query)}>{copy.results.open}</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {items.length === 0 && !searchError ? (
              <div className={styles.emptyState}>
                <strong>{copy.results.emptyTitle}</strong>
                <p className="clamp-3">{copy.results.emptyBody}</p>
              </div>
            ) : null}
          </div>
        </section>
        {trendingViewportSpacerHeight > 0 ? (
          <div
            aria-hidden="true"
            className={styles.viewportSpacer}
            style={{ height: `${trendingViewportSpacerHeight}px` }}
          />
        ) : null}
      </div>
    </MobileAppChrome>
  );
}
