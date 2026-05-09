"use client";

import { useParams, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  buildInitialSymbolMeta,
  createSymbolMetaResetToken,
  getSymbolDetailSectionVisibility,
  resolveSymbolDetailActiveNav,
  resolveSymbolDetailMode,
  resolveSymbolDetailModeFromPathname,
  resolveSymbolDetailNavContext,
  shouldFetchSymbolMeta,
  SYMBOL_DETAIL_FEEDBACK_ACTION_PARAM,
  SYMBOL_DETAIL_FEEDBACK_RETURN_NAV_CONTEXT_PARAM,
  SYMBOL_DETAIL_FEEDBACK_SORT_PARAM,
  SYMBOL_DETAIL_NAV_CONTEXT_PARAM,
  SYMBOL_DETAIL_SEARCH_QUERY_PARAM,
  type SymbolDetailMode,
} from "@/app/dashboard/symbol/[symbol]/symbol-detail-state";
import type { SymbolDetailCopy } from "@/i18n/symbol-detail-copy";
import { getForwardableSymbolMetaSeedValue } from "@/lib/symbol-meta";
import { invalidateTradingApiCacheByPathPrefix } from "@/lib/trading-api-cache";
import { useUnitData } from "@/lib/use-unit-data";
import type { Locale, SymbolPriceBarDto, SymbolPriceBarsResponseDto } from "@/types/trading-api";

import {
  fetchUnitJson,
  getSymbolDetailJsonResult,
  loadTrackedSymbolsSnapshot,
} from "./symbol-detail-api";
import {
  buildFocusCandleRows,
  findPriceBarByTradeDate,
  buildMarketStateRows,
  buildPriceHistoryQuery,
  buildQuoteSourceLabel,
  buildSymbolRouteQuery,
  getCurrentSeoulMarketDate,
  getLocalizedSymbolDetailModes,
  getMarketOpenState,
  getTrackingButtonLabel,
  normalizeSymbolCode,
  normalizeTrackedSymbols,
  pickSelectedBarTradeDate,
  readRouteParam,
  resolveMarketStateValue,
  shouldStopQuotePollingForClosedSession,
  buildPercentChange,
  buildPriceHistoryRangeMetrics,
} from "./symbol-detail-derived-state";
import type {
  MarketStatusResponse,
  PriceHistoryRange,
  QuoteResponse,
  QuoteWorkspaceSnapshot,
  SymbolSearchItem,
  SymbolSearchResponse,
  TrackedSymbolsResponse,
} from "./symbol-detail-types";

type UseSymbolDetailDataOptions = {
  copy: SymbolDetailCopy;
  locale: Locale;
  mode: SymbolDetailMode;
  numberLocale: string;
  serverSymbol?: string;
};

export function useSymbolDetailData({
  copy,
  locale,
  mode,
  numberLocale,
  serverSymbol,
}: UseSymbolDetailDataOptions) {
  const [activeMode, setActiveMode] = useState(mode);
  const params = useParams<{ symbol?: string | string[] }>();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const symbol = useMemo(() => {
    if (typeof serverSymbol === "string" && serverSymbol.trim().length > 0) {
      return serverSymbol;
    }

    return readRouteParam(params.symbol);
  }, [params.symbol, serverSymbol]);
  const normalizedSymbol = useMemo(() => normalizeSymbolCode(symbol), [symbol]);
  const symbolReady = normalizedSymbol.length > 0;
  const requestedMarketDate = useMemo(() => searchParams.get("marketDate"), [searchParams]);
  const requestedViewMode = useMemo(() => resolveSymbolDetailMode(searchParams.get("view")), [searchParams]);
  const navContext = useMemo(
    () => resolveSymbolDetailNavContext(searchParams.get(SYMBOL_DETAIL_NAV_CONTEXT_PARAM)),
    [searchParams],
  );
  const searchContextQuery = useMemo(() => searchParams.get(SYMBOL_DETAIL_SEARCH_QUERY_PARAM), [searchParams]);
  const feedbackActionFilter = useMemo(() => searchParams.get(SYMBOL_DETAIL_FEEDBACK_ACTION_PARAM), [searchParams]);
  const feedbackSortMode = useMemo(() => searchParams.get(SYMBOL_DETAIL_FEEDBACK_SORT_PARAM), [searchParams]);
  const feedbackAgent = useMemo(() => searchParams.get("agent"), [searchParams]);
  const feedbackStatusFilter = useMemo(() => searchParams.get("feedbackStatus"), [searchParams]);
  const feedbackNavContext = useMemo(() => searchParams.get(SYMBOL_DETAIL_FEEDBACK_RETURN_NAV_CONTEXT_PARAM), [searchParams]);
  const symbolDetailActiveNav = resolveSymbolDetailActiveNav(navContext);
  const defaultMarketDate = useMemo(() => getCurrentSeoulMarketDate(), []);
  const fsDiv = useMemo(() => searchParams.get("fsDiv"), [searchParams]);
  const initialMeta = useMemo(() => {
    return buildInitialSymbolMeta(symbol, {
      name: searchParams.get("name"),
      market: searchParams.get("market"),
      standardCode: searchParams.get("standardCode"),
    });
  }, [searchParams, symbol]);
  const resetToken = useMemo(() => createSymbolMetaResetToken(symbol, initialMeta), [initialMeta, symbol]);
  const needsSymbolMeta = shouldFetchSymbolMeta(initialMeta);
  const [selectedRange, setSelectedRange] = useState<PriceHistoryRange>("1Y");
  const [selectedBarTradeDate, setSelectedBarTradeDate] = useState<string | null>(null);
  const [trackedSymbols, setTrackedSymbols] = useState<string[]>([]);
  const [trackedSymbolsLoaded, setTrackedSymbolsLoaded] = useState(false);
  const [trackingSaving, setTrackingSaving] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const localizedModes = useMemo(() => getLocalizedSymbolDetailModes(copy), [copy]);

  useEffect(() => {
    setActiveMode(requestedViewMode ?? resolveSymbolDetailModeFromPathname(pathname, symbol) ?? mode);
  }, [mode, pathname, requestedViewMode, symbol]);

  useEffect(() => {
    setSelectedRange("1Y");
    setSelectedBarTradeDate(null);
    setTrackingSaving(false);
    setTrackingError(null);
  }, [resetToken]);

  const isOverviewMode = activeMode === "overview";
  const shouldLoadPriceHistory = isOverviewMode || activeMode === "technical-analysis";

  const metaRequest = useMemo(
    () => ({
      enabled: symbolReady && needsSymbolMeta,
      key: ["symbol-detail", "meta", normalizedSymbol] as const,
      ttlMs: 5 * 60_000,
      fetcher: async () => {
        const data = await fetchUnitJson<SymbolSearchResponse>(
          `/api/trading/symbols/search?q=${encodeURIComponent(normalizedSymbol)}&limit=20`,
        );

        return data.items.find((item) => item.symbol === normalizedSymbol) ?? data.items[0] ?? null;
      },
    }),
    [needsSymbolMeta, normalizedSymbol, symbolReady],
  );
  const metaResult = useUnitData<SymbolSearchItem | null>(metaRequest);
  const meta = needsSymbolMeta ? metaResult.data : initialMeta;
  const metaError =
    !needsSymbolMeta
      ? null
      : metaResult.error && !meta
        ? copy.errors.masterSymbolUnavailable
        : metaResult.hasData && metaResult.data === null
          ? copy.errors.masterSymbolNotFound
          : null;

  const quoteBundleRequest = useMemo(
    () => ({
      enabled: symbolReady,
      key: ["symbol-detail", "quote-bundle", normalizedSymbol] as const,
      cachePolicy: "network-first" as const,
      ttlMs: 5_000,
      fetcher: async () => {
        const [quote, marketStatus] = await Promise.all([
          fetchUnitJson<QuoteResponse>(`/api/trading/quotes/${encodeURIComponent(normalizedSymbol)}`),
          fetchUnitJson<MarketStatusResponse>("/api/trading/market/status"),
        ]);

        return {
          marketStatus,
          quote,
        } satisfies QuoteWorkspaceSnapshot;
      },
    }),
    [normalizedSymbol, symbolReady],
  );
  const quoteBundleResult = useUnitData<QuoteWorkspaceSnapshot>(quoteBundleRequest);
  const quote = quoteBundleResult.data?.quote ?? null;
  const marketStatus = quoteBundleResult.data?.marketStatus ?? null;
  const loading = symbolReady ? quoteBundleResult.isInitialLoading : true;
  const quoteError = quoteBundleResult.error && !quote ? copy.errors.quoteUnavailable : null;
  const quotePollingStopped = shouldStopQuotePollingForClosedSession(marketStatus, quote);
  const refetchQuoteBundle = quoteBundleResult.refetch;

  const marketDate = useMemo(() => {
    if (requestedMarketDate) return requestedMarketDate;
    if (quote?.trade_date) return quote.trade_date;
    if (!loading) return defaultMarketDate;
    return null;
  }, [defaultMarketDate, loading, quote?.trade_date, requestedMarketDate]);
  const fundamentalsEntryLimit = activeMode === "fundamentals-history" ? 8 : 4;
  const disclosureItemLimit = activeMode === "disclosure-coverage" ? 8 : 4;

  useEffect(() => {
    if (!symbolReady || quotePollingStopped) return;

    const timer = window.setInterval(() => {
      void refetchQuoteBundle();
    }, 1_500);

    return () => {
      window.clearInterval(timer);
    };
  }, [quotePollingStopped, refetchQuoteBundle, symbolReady]);

  useEffect(() => {
    let active = true;

    const loadTrackedSymbols = async () => {
      if (!symbolReady) {
        setTrackedSymbols([]);
        setTrackedSymbolsLoaded(false);
        setTrackingError(null);
        return;
      }

      try {
        const result = await loadTrackedSymbolsSnapshot(copy);
        if (!active) return;

        if (!result.ok) {
          setTrackedSymbols([]);
          setTrackedSymbolsLoaded(false);
          setTrackingError(result.message);
          return;
        }

        setTrackedSymbols(result.symbols);
        setTrackedSymbolsLoaded(true);
        setTrackingError(null);
      } catch {
        if (!active) return;
        setTrackedSymbols([]);
        setTrackedSymbolsLoaded(false);
        setTrackingError(copy.errors.trackingStatusUnavailable);
      }
    };

    void loadTrackedSymbols();
    return () => {
      active = false;
    };
  }, [copy, normalizedSymbol, symbolReady]);

  const priceHistoryRequest = useMemo(
    () => ({
      enabled: symbolReady && shouldLoadPriceHistory && Boolean(marketDate),
      key: ["symbol-detail", "price-history", normalizedSymbol, marketDate ?? "pending", selectedRange] as const,
      cachePolicy: "network-first" as const,
      ttlMs: 30_000,
      fetcher: async () => {
        if (!marketDate) {
          throw new Error("Market date pending");
        }

        const query = buildPriceHistoryQuery(selectedRange, marketDate);
        return fetchUnitJson<SymbolPriceBarsResponseDto>(
          `/api/trading/symbols/${encodeURIComponent(normalizedSymbol)}/price-bars?${query}`,
        );
      },
    }),
    [marketDate, normalizedSymbol, selectedRange, shouldLoadPriceHistory, symbolReady],
  );
  const priceHistoryResult = useUnitData<SymbolPriceBarsResponseDto>(priceHistoryRequest);
  const priceHistory = shouldLoadPriceHistory ? priceHistoryResult.data : null;
  const historyLoading =
    shouldLoadPriceHistory && priceHistory === null && (marketDate === null ? symbolReady : priceHistoryResult.isInitialLoading);
  const historyHydrating =
    shouldLoadPriceHistory &&
    Boolean(priceHistory?.items.length) &&
    priceHistoryResult.isRefreshing;
  const historyError = priceHistoryResult.error && !priceHistory ? copy.errors.historyUnavailable : null;

  useEffect(() => {
    if (!shouldLoadPriceHistory) {
      return;
    }

    if (!priceHistory?.items.length) {
      setSelectedBarTradeDate(null);
      return;
    }

    setSelectedBarTradeDate((current) => pickSelectedBarTradeDate(priceHistory.items, current));
  }, [priceHistory, shouldLoadPriceHistory]);

  const selectedBar = useMemo(
    () => findPriceBarByTradeDate(priceHistory?.items ?? [], selectedBarTradeDate),
    [priceHistory?.items, selectedBarTradeDate],
  );
  const setSelectedBar = useCallback((bar: SymbolPriceBarDto | null) => {
    setSelectedBarTradeDate(bar?.trade_date ?? null);
  }, []);

  const metaCompanyName = getForwardableSymbolMetaSeedValue(meta?.name_ko);
  const quoteCompanyName = getForwardableSymbolMetaSeedValue(quote?.company_name);
  const metaMarket = getForwardableSymbolMetaSeedValue(meta?.market);
  const introTitle = metaCompanyName ?? quoteCompanyName ?? symbol;
  const marketLabel =
    metaMarket ??
    (quote?.market_state ? resolveMarketStateValue(quote.market_state, copy) : copy.header.marketPending);
  const detailErrors = [quoteError, metaError, historyError].filter(
    (value): value is string => Boolean(value),
  );
  const isTrackedSymbol = trackedSymbols.includes(normalizedSymbol);
  const trackingButtonLabel = getTrackingButtonLabel(
    locale,
    normalizedSymbol,
    trackedSymbolsLoaded,
    isTrackedSymbol,
    trackingSaving,
  );

  const handleToggleTrackedSymbol = async () => {
    if (trackingSaving) return;

    if (!normalizedSymbol) {
      setTrackingError(copy.errors.trackingUpdateUnavailable);
      return;
    }

    setTrackingSaving(true);
    setTrackingError(null);

    try {
      invalidateTradingApiCacheByPathPrefix([
        "/api/trading/scanner/tracked-symbols",
        "/api/trading/quotes/tracked",
      ]);
      const currentResult = await loadTrackedSymbolsSnapshot(copy);
      if (!currentResult.ok) {
        setTrackedSymbols([]);
        setTrackedSymbolsLoaded(false);
        setTrackingError(currentResult.message);
        return;
      }

      const currentTrackedSymbols = currentResult.symbols;
      const currentlyTracked = currentTrackedSymbols.includes(normalizedSymbol);
      const nextSymbols = currentlyTracked
        ? currentTrackedSymbols.filter((currentSymbol) => currentSymbol !== normalizedSymbol)
        : [normalizedSymbol, ...currentTrackedSymbols.filter((currentSymbol) => currentSymbol !== normalizedSymbol)];

      setTrackedSymbols(currentTrackedSymbols);
      setTrackedSymbolsLoaded(true);

      const result = await getSymbolDetailJsonResult<TrackedSymbolsResponse>("/api/trading/scanner/tracked-symbols", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ symbols: nextSymbols }),
      });

      if (!result.ok) {
        setTrackingError(`${copy.errors.trackingUpdateFailed} HTTP ${result.status}`);
        return;
      }

      const normalizedTrackedSymbols = normalizeTrackedSymbols(result.data.tracked_symbols);
      invalidateTradingApiCacheByPathPrefix([
        "/api/trading/scanner/tracked-symbols",
        "/api/trading/symbols/favorites",
        "/api/trading/quotes/tracked",
      ]);
      setTrackedSymbols(normalizedTrackedSymbols);
      setTrackedSymbolsLoaded(true);
      setTrackingError(null);
    } catch {
      setTrackingError(copy.errors.trackingUpdateFailed);
    } finally {
      setTrackingSaving(false);
    }
  };

  const marketStateRows = useMemo(
    () => buildMarketStateRows(marketStatus, metaMarket, copy),
    [copy, marketStatus, metaMarket],
  );
  const toolbarMarketOpenState = getMarketOpenState(marketStatus);
  const routeQueryString = useMemo(
    () =>
      buildSymbolRouteQuery(
        meta,
        marketDate,
        fsDiv,
        navContext,
        searchContextQuery,
        feedbackActionFilter,
        feedbackSortMode,
        feedbackAgent,
        feedbackStatusFilter,
        feedbackNavContext,
      ),
    [
      feedbackActionFilter,
      feedbackAgent,
      feedbackNavContext,
      feedbackSortMode,
      feedbackStatusFilter,
      fsDiv,
      marketDate,
      meta,
      navContext,
      searchContextQuery,
    ],
  );
  const hasSelectedRangeHistoryLoaded = Boolean(priceHistoryResult.data);

  const chartMetrics = useMemo(() => {
    return buildPriceHistoryRangeMetrics(priceHistory);
  }, [priceHistory]);

  const isPriceHistoryReturnBasisInvalid = chartMetrics === null && hasSelectedRangeHistoryLoaded && Boolean(priceHistory?.items.length);
  const quoteSourceCopy = quote?.is_live ? null : buildQuoteSourceLabel(quote, copy, {
    isPriceHistoryBasisInvalid: isPriceHistoryReturnBasisInvalid && quote?.source === "daily_price_bar",
  });

  const focusBar = selectedBar ?? priceHistory?.items[priceHistory.items.length - 1] ?? null;
  const focusBarIndex =
    focusBar && priceHistory
      ? priceHistory.items.findIndex((item) => item.trade_date === focusBar.trade_date)
      : -1;
  const previousFocusBar =
    focusBarIndex > 0 && priceHistory ? priceHistory.items[focusBarIndex - 1] ?? null : null;
  const focusMovePct = focusBar && previousFocusBar ? buildPercentChange(focusBar.close_price, previousFocusBar.close_price) : null;
  const focusCandleRows = buildFocusCandleRows(focusBar, copy, numberLocale);
  const focusCandleValue =
    focusCandleRows.length > 0
      ? null
      : shouldLoadPriceHistory
        ? historyLoading
          ? copy.hero.priceLoading
          : copy.chart.noCandleSelected
        : copy.chart.technicalTitle;
  const focusCandleDetail =
    focusCandleRows.length > 0
      ? null
      : shouldLoadPriceHistory
        ? copy.chart.selectCandle
        : copy.chart.selectCandle;
  const activeDetailMode = localizedModes[activeMode];
  const sectionVisibility = getSymbolDetailSectionVisibility(activeMode);
  const chartUnitRefreshing =
    sectionVisibility.showChartSection &&
    priceHistory !== null &&
    priceHistoryResult.isRefreshing;

  return {
    activeDetailMode,
    activeMode,
    chartMetrics,
    chartUnitRefreshing,
    detailErrors,
    disclosureItemLimit,
    focusBar,
    focusCandleDetail,
    focusCandleRows,
    focusCandleValue,
    focusMovePct,
    fundamentalsEntryLimit,
    fsDiv,
    handleToggleTrackedSymbol,
    hasSelectedRangeHistoryLoaded,
    historyHydrating,
    historyLoading,
    introTitle,
    isTrackedSymbol,
    loading,
    localizedModes,
    marketDate,
    marketLabel,
    marketStateRows,
    normalizedSymbol,
    priceHistory,
    previousFocusBar,
    quote,
    quotePollingStopped,
    quoteSourceCopy,
    navContext,
    feedbackActionFilter,
    feedbackAgent,
    feedbackNavContext,
    feedbackSortMode,
    feedbackStatusFilter,
    routeQueryString,
    searchContextQuery,
    selectedBar,
    selectedRange,
    setActiveMode,
    setSelectedBar,
    setSelectedRange,
    symbolDetailActiveNav,
    symbol,
    symbolReady,
    toolbarMarketOpenState,
    trackingButtonLabel,
    trackingError,
    trackingSaving,
    ...sectionVisibility,
  };
}
