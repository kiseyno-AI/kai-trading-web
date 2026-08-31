"use client";

import { useParams, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  buildInitialSymbolMeta,
  createSymbolMetaResetToken,
  getSymbolDetailSectionVisibility,
  resolveSymbolDetailActiveNav,
  resolveSymbolDetailFeedbackReturnRoute,
  resolveSymbolDetailMode,
  resolveSymbolDetailModeFromPathname,
  resolveSymbolDetailNavContext,
  shouldFetchSymbolMeta,
  SYMBOL_DETAIL_FEEDBACK_ACTION_PARAM,
  SYMBOL_DETAIL_FEEDBACK_RETURN_NAV_CONTEXT_PARAM,
  SYMBOL_DETAIL_FEEDBACK_RETURN_ORIGIN_DATE_PARAM,
  SYMBOL_DETAIL_FEEDBACK_RETURN_ROUTE_PARAM,
  SYMBOL_DETAIL_FEEDBACK_SORT_PARAM,
  SYMBOL_DETAIL_NAV_CONTEXT_PARAM,
  SYMBOL_DETAIL_SEARCH_QUERY_PARAM,
  type SymbolDetailMode,
} from "@/app/dashboard/symbol/[symbol]/symbol-detail-state";
import type { SymbolDetailCopy } from "@/i18n/symbol-detail-copy";
import { MOBILE_TOOLBAR_MARKET_STATUS_PATH } from "@/lib/mobile-toolbar-data";
import { readDashboardRecommendationContext } from "@/lib/dashboard-recommendation-context";
import { getForwardableSymbolMetaSeedValue } from "@/lib/symbol-meta";
import {
  invalidateTradingApiCacheByPathPrefix,
  readTradingApiJsonSnapshot,
  seedTradingApiJsonSnapshot,
} from "@/lib/trading-api-cache";
import { useUnitData } from "@/lib/use-unit-data";
import type {
  EodFreshnessResponseDto,
  Locale,
  SymbolPriceBarDto,
  SymbolPriceBarsResponseDto,
} from "@/types/trading-api";

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
  buildSymbolDetailMarketDateBasisCopy,
  buildSymbolRouteQuery,
  getCurrentSeoulMarketDate,
  getLocalizedSymbolDetailModes,
  getMarketOpenState,
  getTrackingButtonLabel,
  normalizeSymbolCode,
  normalizeTrackedSymbols,
  pickSelectedBarTradeDate,
  readRouteParam,
  resolveQuotePollingDisplayState,
  resolveMarketStateValue,
  resolveSymbolDetailCurrentMarketDate,
  resolveSymbolDetailEffectiveMarketDate,
  shouldStopQuotePollingForClosedSession,
  buildPercentChange,
  buildPriceHistoryRangeMetrics,
} from "./symbol-detail-derived-state";
import type {
  MarketStatusResponse,
  PriceHistoryRange,
  QuoteResponse,
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

const PRICE_HISTORY_RETRY_INTERVAL_MS = 5_000;
const PRICE_HISTORY_MAX_AUTOMATIC_RETRIES = 1;

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
  const feedbackOriginDate = useMemo(
    () => searchParams.get(SYMBOL_DETAIL_FEEDBACK_RETURN_ORIGIN_DATE_PARAM),
    [searchParams],
  );
  const feedbackReturnRoute = useMemo(
    () => resolveSymbolDetailFeedbackReturnRoute(searchParams.get(SYMBOL_DETAIL_FEEDBACK_RETURN_ROUTE_PARAM)),
    [searchParams],
  );
  const symbolDetailActiveNav = resolveSymbolDetailActiveNav(navContext);
  const defaultMarketDate = useMemo(() => getCurrentSeoulMarketDate(), []);
  const fsDiv = useMemo(() => searchParams.get("fsDiv"), [searchParams]);
  const dashboardRecommendation = useMemo(
    () => readDashboardRecommendationContext(searchParams),
    [searchParams],
  );
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
  const [marketStatus, setMarketStatus] = useState<MarketStatusResponse | null>(null);
  const marketStatusRequestRef = useRef<Promise<void> | null>(null);
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
  const meta = needsSymbolMeta ? (metaResult.data ?? initialMeta) : initialMeta;
  const metaError =
    !needsSymbolMeta
      ? null
      : metaResult.error && !meta
        ? copy.errors.masterSymbolUnavailable
        : metaResult.hasData && metaResult.data === null
          ? copy.errors.masterSymbolNotFound
          : null;

  const quoteRequest = useMemo(
    () => ({
      enabled: symbolReady,
      key: ["symbol-detail", "quote", normalizedSymbol] as const,
      cachePolicy: "network-first" as const,
      ttlMs: 5_000,
      fetcher: () => fetchUnitJson<QuoteResponse>(`/api/trading/quotes/${encodeURIComponent(normalizedSymbol)}`),
    }),
    [normalizedSymbol, symbolReady],
  );
  const quoteResult = useUnitData<QuoteResponse>(quoteRequest);
  const refreshMarketStatus = useCallback(() => {
    if (marketStatusRequestRef.current) return marketStatusRequestRef.current;

    const request = fetchUnitJson<MarketStatusResponse>(MOBILE_TOOLBAR_MARKET_STATUS_PATH)
      .then((nextMarketStatus) => {
        seedTradingApiJsonSnapshot(MOBILE_TOOLBAR_MARKET_STATUS_PATH, nextMarketStatus);
        setMarketStatus(nextMarketStatus);
      })
      .catch(() => undefined)
      .finally(() => {
        marketStatusRequestRef.current = null;
      });

    marketStatusRequestRef.current = request;
    return request;
  }, []);

  useEffect(() => {
    if (!symbolReady) {
      setMarketStatus(null);
      return;
    }

    const dashboardMarketStatus = readTradingApiJsonSnapshot<MarketStatusResponse>(
      MOBILE_TOOLBAR_MARKET_STATUS_PATH,
    );
    if (dashboardMarketStatus) {
      setMarketStatus(dashboardMarketStatus);
    }
    void refreshMarketStatus();
  }, [refreshMarketStatus, symbolReady]);

  const quote = quoteResult.data;
  const loading = symbolReady ? quoteResult.isInitialLoading : true;
  const quoteError = quoteResult.error && !quote ? copy.errors.quoteUnavailable : null;
  const quotePollingStopped = shouldStopQuotePollingForClosedSession(marketStatus, quote);
  const quotePollingState = resolveQuotePollingDisplayState(marketStatus, quote);
  const refetchQuote = quoteResult.refetch;

  const freshnessBasisRequest = useMemo(
    () => ({
      enabled: symbolReady && !requestedMarketDate,
      key: ["symbol-detail", "freshness"] as const,
      ttlMs: 30_000,
      fetcher: async () => fetchUnitJson<EodFreshnessResponseDto>("/api/trading/eod/freshness"),
    }),
    [requestedMarketDate, symbolReady],
  );
  const freshnessBasisResult = useUnitData<EodFreshnessResponseDto>(freshnessBasisRequest);
  const freshnessBasis = requestedMarketDate ? null : freshnessBasisResult.data;
  const waitForFreshnessBasis =
    !requestedMarketDate &&
    symbolReady &&
    !freshnessBasisResult.hasData &&
    !freshnessBasisResult.error &&
    (freshnessBasisResult.isInitialLoading || freshnessBasisResult.source === "none");
  const marketDate = useMemo(
    () =>
      resolveSymbolDetailEffectiveMarketDate({
        defaultMarketDate,
        freshness: freshnessBasis,
        freshnessRequestFailed: Boolean(freshnessBasisResult.error),
        marketState: marketStatus?.state ?? quote?.market_state,
        quoteTradeDate: quote?.trade_date,
        requestedMarketDate,
        waitForFreshness: waitForFreshnessBasis,
      }),
    [
      defaultMarketDate,
      freshnessBasis,
      freshnessBasisResult.error,
      marketStatus?.state,
      quote?.market_state,
      quote?.trade_date,
      requestedMarketDate,
      waitForFreshnessBasis,
    ],
  );
  const currentMarketDate = useMemo(
    () => resolveSymbolDetailCurrentMarketDate(freshnessBasis, marketStatus, defaultMarketDate),
    [defaultMarketDate, freshnessBasis, marketStatus],
  );
  const marketDateBasisCopy = useMemo(
    () =>
      buildSymbolDetailMarketDateBasisCopy({
        copy,
        currentMarketDate,
        effectiveMarketDate: marketDate,
        hasExplicitMarketDate: Boolean(requestedMarketDate),
        marketState: marketStatus?.state ?? quote?.market_state,
      }),
    [copy, currentMarketDate, marketDate, marketStatus?.state, quote?.market_state, requestedMarketDate],
  );
  const marketDateLabel = requestedMarketDate ? copy.chart.requestedMarketDate : copy.chart.effectiveMarketDate;
  const fundamentalsEntryLimit = activeMode === "fundamentals-history" ? 8 : 4;
  const disclosureItemLimit = activeMode === "disclosure-coverage" ? 8 : 4;

  useEffect(() => {
    if (!symbolReady || quotePollingStopped) return;

    const timer = window.setInterval(() => {
      void refreshMarketStatus();
      if (quotePollingState === "active") {
        void refetchQuote();
      }
    }, 1_500);

    return () => {
      window.clearInterval(timer);
    };
  }, [quotePollingState, quotePollingStopped, refetchQuote, refreshMarketStatus, symbolReady]);

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
  const priceHistoryRetryAttempts = useRef(0);
  const priceHistory = shouldLoadPriceHistory ? priceHistoryResult.data : null;
  const historyLoading =
    shouldLoadPriceHistory && priceHistory === null && (marketDate === null ? symbolReady : priceHistoryResult.isInitialLoading);
  const historyHydrating =
    shouldLoadPriceHistory &&
    Boolean(priceHistory?.items.length) &&
    priceHistoryResult.isRefreshing;
  const historyError = priceHistoryResult.error && !priceHistory ? copy.errors.historyUnavailable : null;
  const refetchPriceHistory = priceHistoryResult.refetch;

  useEffect(() => {
    priceHistoryRetryAttempts.current = 0;
  }, [priceHistoryRequest]);

  useEffect(() => {
    if (
      !shouldLoadPriceHistory ||
      !marketDate ||
      priceHistory ||
      !priceHistoryResult.error ||
      priceHistoryRetryAttempts.current >= PRICE_HISTORY_MAX_AUTOMATIC_RETRIES
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      priceHistoryRetryAttempts.current += 1;
      void refetchPriceHistory();
    }, PRICE_HISTORY_RETRY_INTERVAL_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [marketDate, priceHistory, priceHistoryResult.error, refetchPriceHistory, shouldLoadPriceHistory]);

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
        feedbackReturnRoute,
        feedbackOriginDate,
      ),
    [
      feedbackActionFilter,
      feedbackAgent,
      feedbackNavContext,
      feedbackOriginDate,
      feedbackReturnRoute,
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
    dashboardRecommendation,
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
    marketDateBasisCopy,
    marketDateLabel,
    marketLabel,
    marketStateRows,
    normalizedSymbol,
    priceHistory,
    previousFocusBar,
    quote,
    quotePollingState,
    quoteSourceCopy,
    navContext,
    feedbackActionFilter,
    feedbackAgent,
    feedbackNavContext,
    feedbackOriginDate,
    feedbackReturnRoute,
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
