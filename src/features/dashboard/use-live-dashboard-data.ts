import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";

import { getAgentFeedbackProgressMarketDate } from "@/lib/agent-feedback-progress";
import {
  getDashboardProcessRequestMarketDate,
  getDashboardProcessResolvedMarketDate,
} from "@/lib/dashboard-process-market-date";
import {
  buildDartFundamentalsDailyInspectPath,
  DART_FUNDAMENTALS_DAILY_INSPECT_CLIENT_PATH,
} from "@/lib/dart-fundamentals-daily";
import { buildEodPipelineStatusPath, EOD_PIPELINE_STATUS_CLIENT_PATH } from "@/lib/eod-pipeline-status";
import {
  MOBILE_TOOLBAR_MARKET_STATUS_PATH,
  MOBILE_TOOLBAR_TRACKED_QUOTES_PATH,
  warmMobileToolbarViewData,
} from "@/lib/mobile-toolbar-data";
import { resolveTradingApiClientPath } from "@/lib/trading-api-client-path";
import {
  getCachedTradingApiJson,
  seedTradingApiJsonCache,
  seedTradingApiJsonSnapshot,
} from "@/lib/trading-api-cache";

import {
  getAgentFeedbackProgressPollDelayMs,
  getDashboardLoadErrorMessage,
  getEodPipelineStatusPollDelayMs,
  getQuoteCompanyName,
  pickSymbolMetadata,
} from "./live-dashboard-derived-state";
import type {
  CoreMarketStatus,
  CoreTrackedQuotesResponse,
  FilteringStageLoadState,
  LiveDashboardClientProps,
  SymbolMetadataItem,
  SymbolSearchResponse,
} from "./live-dashboard-types";
import type {
  AgentFeedbackProgressResponseDto,
  DartFundamentalsDailyInspectResponseDto,
  EodFreshnessResponseDto,
  EodMarketRiskFiltersResponseDto,
  EodPipelineStatusResponseDto,
  EodPiotroskiFilterResultsResponseDto,
} from "@/types/trading-api";

const TRACKED_QUOTES_RETRY_DELAYS_MS = [5_000, 15_000, 30_000] as const;

function getJson<T>(path: string): Promise<T> {
  return getCachedTradingApiJson<T>(resolveTradingApiClientPath(path));
}

async function getJsonNoCache<T>(path: string): Promise<T> {
  const response = await fetch(resolveTradingApiClientPath(path), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
  });
  const responseText = await response.text();
  let parsedBody: unknown = null;

  if (responseText) {
    try {
      parsedBody = JSON.parse(responseText) as T;
    } catch (error) {
      throw new Error(`Failed to parse JSON for ${path}: ${getDashboardLoadErrorMessage(error)}`);
    }
  }

  if (!response.ok) {
    if (
      parsedBody &&
      typeof parsedBody === "object" &&
      "detail" in parsedBody &&
      typeof parsedBody.detail === "string"
    ) {
      throw new Error(parsedBody.detail);
    }

    throw new Error(`HTTP ${response.status} for ${path}`);
  }

  return parsedBody as T;
}

export function useLiveDashboardData({
  initialError = null,
  initialMarket,
  initialTracked,
  initialFreshness,
  initialFundamentalsStatus,
  initialPipelineStatus,
  initialAgentFeedbackProgress,
}: LiveDashboardClientProps) {
  const initialPipelineRequestMarketDate = getDashboardProcessRequestMarketDate(
    initialFreshness?.today?.trade_date,
    initialMarket.server_time,
  );
  const initialDashboardProcessMarketDate = getDashboardProcessResolvedMarketDate(
    initialPipelineStatus,
    initialPipelineRequestMarketDate,
  );
  const [market, setMarket] = useState<CoreMarketStatus>(initialMarket);
  const [tracked, setTracked] = useState<CoreTrackedQuotesResponse>(initialTracked);
  const [freshness, setFreshness] = useState<EodFreshnessResponseDto | null>(initialFreshness);
  const [fundamentalsStatus, setFundamentalsStatus] = useState<DartFundamentalsDailyInspectResponseDto | null>(
    initialFundamentalsStatus,
  );
  const [pipelineStatus, setPipelineStatus] = useState<EodPipelineStatusResponseDto | null>(initialPipelineStatus);
  const pipelineStatusRef = useRef<EodPipelineStatusResponseDto | null>(initialPipelineStatus);
  const pipelineStatusRequestDateRef = useRef<string | null>(initialPipelineRequestMarketDate);
  const marketServerTimeRef = useRef<string | null>(initialMarket.server_time ?? null);
  const freshnessTradeDateRef = useRef<string | null>(initialFreshness?.today?.trade_date ?? null);
  const [agentFeedbackProgress, setAgentFeedbackProgressState] = useState<AgentFeedbackProgressResponseDto | null>(
    initialAgentFeedbackProgress,
  );
  const agentFeedbackProgressRef = useRef<AgentFeedbackProgressResponseDto | null>(initialAgentFeedbackProgress);
  const setAgentFeedbackProgress: Dispatch<SetStateAction<AgentFeedbackProgressResponseDto | null>> = (nextValue) => {
    setAgentFeedbackProgressState((current) => {
      const resolvedValue = typeof nextValue === "function" ? nextValue(current) : nextValue;
      agentFeedbackProgressRef.current = resolvedValue;
      return resolvedValue;
    });
  };
  const [agentFeedbackProgressError, setAgentFeedbackProgressError] = useState<string | null>(null);
  const [symbolMetaBySymbol, setSymbolMetaBySymbol] = useState<Record<string, SymbolMetadataItem | null>>({});
  const [piotroskiStatus, setPiotroskiStatus] = useState<EodPiotroskiFilterResultsResponseDto | null>(null);
  const [piotroskiStatusError, setPiotroskiStatusError] = useState<string | null>(null);
  const [piotroskiStatusLoadState, setPiotroskiStatusLoadState] = useState<FilteringStageLoadState>(
    initialDashboardProcessMarketDate ? "loading" : "idle",
  );
  const [marketRiskStatus, setMarketRiskStatus] = useState<EodMarketRiskFiltersResponseDto | null>(null);
  const [marketRiskStatusError, setMarketRiskStatusError] = useState<string | null>(null);
  const [marketRiskStatusLoadState, setMarketRiskStatusLoadState] = useState<FilteringStageLoadState>(
    initialDashboardProcessMarketDate ? "loading" : "idle",
  );
  const [marketError, setMarketError] = useState<string | null>(initialError);
  const [trackedError, setTrackedError] = useState<string | null>(initialError);

  const pipelineRequestMarketDate = getDashboardProcessRequestMarketDate(
    freshness?.today?.trade_date,
    market.server_time,
  );
  const dashboardProcessMarketDate = getDashboardProcessResolvedMarketDate(
    pipelineStatus,
    pipelineRequestMarketDate,
  );
  const fundamentalsInspectPath = useMemo(
    () => buildDartFundamentalsDailyInspectPath(DART_FUNDAMENTALS_DAILY_INSPECT_CLIENT_PATH, dashboardProcessMarketDate),
    [dashboardProcessMarketDate],
  );
  const pipelineStatusPath = useMemo(
    () => buildEodPipelineStatusPath(EOD_PIPELINE_STATUS_CLIENT_PATH, pipelineRequestMarketDate),
    [pipelineRequestMarketDate],
  );

  useEffect(() => {
    seedTradingApiJsonSnapshot(MOBILE_TOOLBAR_MARKET_STATUS_PATH, initialMarket);
    seedTradingApiJsonSnapshot(MOBILE_TOOLBAR_TRACKED_QUOTES_PATH, initialTracked);
    seedTradingApiJsonCache("/api/trading/eod/freshness", initialFreshness);
    seedTradingApiJsonCache(
      buildDartFundamentalsDailyInspectPath(
        DART_FUNDAMENTALS_DAILY_INSPECT_CLIENT_PATH,
        initialDashboardProcessMarketDate,
      ),
      initialFundamentalsStatus,
    );
    void warmMobileToolbarViewData("dashboard");
  }, [initialDashboardProcessMarketDate, initialFreshness, initialFundamentalsStatus, initialMarket, initialTracked]);

  useEffect(() => {
    let active = true;
    let retryIndex = 0;
    let retryTimer: number | null = null;

    function clearRetryTimer() {
      if (retryTimer === null) return;
      window.clearTimeout(retryTimer);
      retryTimer = null;
    }

    function scheduleRetry() {
      if (!active || retryIndex >= TRACKED_QUOTES_RETRY_DELAYS_MS.length) return;
      const retryDelayMs = TRACKED_QUOTES_RETRY_DELAYS_MS[retryIndex];
      retryIndex += 1;
      retryTimer = window.setTimeout(() => {
        retryTimer = null;
        void loadTracked();
      }, retryDelayMs);
    }

    async function loadTracked() {
      try {
        const trackedData = await getJson<CoreTrackedQuotesResponse>("/api/trading/quotes/tracked");
        if (!active) return;
        clearRetryTimer();
        setTracked(trackedData);
        seedTradingApiJsonSnapshot(MOBILE_TOOLBAR_TRACKED_QUOTES_PATH, trackedData);
        setTrackedError(null);
      } catch (loadError) {
        console.error("Dashboard tracked quote load failed", loadError);
        if (!active) return;
        setTrackedError(getDashboardLoadErrorMessage(loadError));
        scheduleRetry();
      }
    }

    void loadTracked();

    return () => {
      active = false;
      clearRetryTimer();
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadMarket = async () => {
      try {
        const marketData = await getJson<CoreMarketStatus>("/api/trading/market/status");
        if (!active) return;
        const nextServerTime = marketData.server_time ?? null;
        marketServerTimeRef.current = nextServerTime;
        const nextRequestMarketDate = getDashboardProcessRequestMarketDate(
          freshnessTradeDateRef.current,
          nextServerTime,
        );
        if (pipelineStatusRequestDateRef.current !== nextRequestMarketDate) {
          pipelineStatusRequestDateRef.current = nextRequestMarketDate;
          pipelineStatusRef.current = null;
          setPipelineStatus(null);
        }
        setMarket(marketData);
        seedTradingApiJsonSnapshot(MOBILE_TOOLBAR_MARKET_STATUS_PATH, marketData);
        setMarketError(null);
      } catch (loadError) {
        console.error("Dashboard market status polling failed", loadError);
        if (!active) return;
        setMarketError(getDashboardLoadErrorMessage(loadError));
      }
    };

    void loadMarket();
    const timer = window.setInterval(loadMarket, 60_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const symbolsNeedingCompanyName = useMemo(
    () => {
      const missingSymbols = new Set<string>();

      for (const item of tracked.items) {
        if (getQuoteCompanyName(item)) continue;
        if (Object.prototype.hasOwnProperty.call(symbolMetaBySymbol, item.symbol)) continue;
        missingSymbols.add(item.symbol);
      }

      return Array.from(missingSymbols).sort();
    },
    [symbolMetaBySymbol, tracked.items],
  );
  const symbolMetadataLookupKey = symbolsNeedingCompanyName.join("|");

  useEffect(() => {
    if (!symbolMetadataLookupKey) return;

    let active = true;
    const symbols = symbolMetadataLookupKey.split("|").filter(Boolean);

    const loadSymbolMetadata = async () => {
      const entries = await Promise.all(
        symbols.map(async (symbol) => {
          try {
            const data = await getJson<SymbolSearchResponse>(
              `/api/trading/symbols/search?q=${encodeURIComponent(symbol)}&limit=8`,
            );
            return [symbol, pickSymbolMetadata(symbol, data)] as const;
          } catch (metadataError) {
            console.error("Dashboard symbol metadata load failed", metadataError);
            return [symbol, null] as const;
          }
        }),
      );

      if (!active) return;
      setSymbolMetaBySymbol((current) => {
        let didChange = false;
        const next = { ...current };
        for (const [symbol, metadata] of entries) {
          if (current[symbol] === metadata) {
            continue;
          }

          next[symbol] = metadata;
          didChange = true;
        }
        return didChange ? next : current;
      });
    };

    void loadSymbolMetadata();

    return () => {
      active = false;
    };
  }, [symbolMetadataLookupKey]);

  useEffect(() => {
    let active = true;

    const loadFreshness = async () => {
      try {
        const data = await getJson<EodFreshnessResponseDto>("/api/trading/eod/freshness");
        if (!active) return;
        const nextTradeDate = data?.today?.trade_date ?? null;
        freshnessTradeDateRef.current = nextTradeDate;
        const nextRequestMarketDate = getDashboardProcessRequestMarketDate(
          nextTradeDate,
          marketServerTimeRef.current,
        );
        if (pipelineStatusRequestDateRef.current !== nextRequestMarketDate) {
          pipelineStatusRequestDateRef.current = nextRequestMarketDate;
          pipelineStatusRef.current = null;
          setPipelineStatus(null);
        }
        setFreshness(data);
      } catch (freshnessError) {
        console.error("Dashboard freshness load failed", freshnessError);
        if (!active) return;
        setFreshness((current) => current);
      }
    };

    void loadFreshness();
    const timer = window.setInterval(loadFreshness, 30_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const filteringMarketDate = dashboardProcessMarketDate;

  useEffect(() => {
    if (!filteringMarketDate) return;

    let active = true;

    const loadFilteringStatus = async () => {
      setPiotroskiStatus(null);
      setPiotroskiStatusError(null);
      setPiotroskiStatusLoadState("loading");
      setMarketRiskStatus(null);
      setMarketRiskStatusError(null);
      setMarketRiskStatusLoadState("loading");

      const marketDateParam = encodeURIComponent(filteringMarketDate);
      const [piotroskiResult, marketRiskResult] = await Promise.allSettled([
        getJsonNoCache<EodPiotroskiFilterResultsResponseDto>(
          `/api/trading/eod/piotroski-filter-results?market_date=${marketDateParam}`,
        ),
        getJsonNoCache<EodMarketRiskFiltersResponseDto>(
          `/api/trading/eod/market-risk-filters?market_date=${marketDateParam}`,
        ),
      ]);

      if (!active) return;

      if (piotroskiResult.status === "fulfilled") {
        setPiotroskiStatus(piotroskiResult.value);
        setPiotroskiStatusLoadState("ready");
      } else {
        console.error("Dashboard Piotroski status load failed", piotroskiResult.reason);
        setPiotroskiStatus(null);
        setPiotroskiStatusError(getDashboardLoadErrorMessage(piotroskiResult.reason));
        setPiotroskiStatusLoadState("error");
      }

      if (marketRiskResult.status === "fulfilled") {
        setMarketRiskStatus(marketRiskResult.value);
        setMarketRiskStatusLoadState("ready");
      } else {
        console.error("Dashboard market risk status load failed", marketRiskResult.reason);
        setMarketRiskStatus(null);
        setMarketRiskStatusError(getDashboardLoadErrorMessage(marketRiskResult.reason));
        setMarketRiskStatusLoadState("error");
      }
    };

    void loadFilteringStatus();

    return () => {
      active = false;
    };
  }, [filteringMarketDate]);

  useEffect(() => {
    let active = true;
    let timer: number | null = null;

    function clearTimer() {
      if (timer === null) return;
      window.clearTimeout(timer);
      timer = null;
    }

    function scheduleNextLoad(nextPipelineStatus: EodPipelineStatusResponseDto | null) {
      if (!active) return;
      clearTimer();
      timer = window.setTimeout(loadPipelineStatus, getEodPipelineStatusPollDelayMs(nextPipelineStatus));
    }

    async function loadPipelineStatus() {
      try {
        const data = await getJson<EodPipelineStatusResponseDto>(pipelineStatusPath);
        if (!active) return;
        pipelineStatusRequestDateRef.current = pipelineRequestMarketDate;
        pipelineStatusRef.current = data;
        setPipelineStatus(data);
        scheduleNextLoad(data);
      } catch (pipelineStatusError) {
        console.error("Dashboard EOD pipeline status load failed", pipelineStatusError);
        if (!active) return;
        scheduleNextLoad(pipelineStatusRef.current);
      }
    }

    void loadPipelineStatus();

    return () => {
      active = false;
      clearTimer();
    };
  }, [pipelineRequestMarketDate, pipelineStatusPath]);

  useEffect(() => {
    let active = true;

    const loadFundamentalsStatus = async () => {
      try {
        const data = await getJson<DartFundamentalsDailyInspectResponseDto>(
          fundamentalsInspectPath,
        );
        if (!active) return;
        setFundamentalsStatus(data);
      } catch (fundamentalsStatusError) {
        console.error("Dashboard fundamentals status load failed", fundamentalsStatusError);
        if (!active) return;
        setFundamentalsStatus((current) => current);
      }
    };

    void loadFundamentalsStatus();
    const timer = window.setInterval(loadFundamentalsStatus, 60_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [fundamentalsInspectPath]);

  const agentProgressMarketDate = getAgentFeedbackProgressMarketDate(freshness);

  useEffect(() => {
    if (!agentProgressMarketDate) return;

    let active = true;
    const progressPath = `/api/trading/agent-context/feedback/progress?market_date=${encodeURIComponent(
      agentProgressMarketDate,
    )}`;
    let timer: number | null = null;

    if (agentFeedbackProgressRef.current?.request.market_date !== agentProgressMarketDate) {
      agentFeedbackProgressRef.current = null;
    }

    function clearTimer() {
      if (timer === null) return;
      window.clearTimeout(timer);
      timer = null;
    }

    function scheduleNextLoad(progress: AgentFeedbackProgressResponseDto | null) {
      if (!active) return;
      clearTimer();
      timer = window.setTimeout(loadAgentFeedbackProgress, getAgentFeedbackProgressPollDelayMs(progress));
    }

    async function loadAgentFeedbackProgress() {
      try {
        const data = await getJson<AgentFeedbackProgressResponseDto>(progressPath);
        if (!active) return;
        setAgentFeedbackProgress(data);
        setAgentFeedbackProgressError(null);
        scheduleNextLoad(data);
      } catch (progressError) {
        console.error("Dashboard agent feedback progress load failed", progressError);
        if (!active) return;
        setAgentFeedbackProgressError(getDashboardLoadErrorMessage(progressError));
        scheduleNextLoad(agentFeedbackProgressRef.current);
      }
    }

    void loadAgentFeedbackProgress();

    return () => {
      active = false;
      clearTimer();
    };
  }, [agentProgressMarketDate]);

  return {
    agentFeedbackProgress,
    agentFeedbackProgressError,
    dashboardProcessMarketDate,
    market,
    marketRiskStatus: filteringMarketDate ? marketRiskStatus : null,
    marketRiskStatusError: filteringMarketDate ? marketRiskStatusError : null,
    marketRiskStatusLoadState: filteringMarketDate ? marketRiskStatusLoadState : "idle",
    marketError,
    piotroskiStatus: filteringMarketDate ? piotroskiStatus : null,
    piotroskiStatusError: filteringMarketDate ? piotroskiStatusError : null,
    piotroskiStatusLoadState: filteringMarketDate ? piotroskiStatusLoadState : "idle",
    pipelineStatus,
    setAgentFeedbackProgress,
    setAgentFeedbackProgressError,
    symbolMetaBySymbol,
    tracked,
    trackedError,
    freshness,
    fundamentalsStatus,
  };
}
