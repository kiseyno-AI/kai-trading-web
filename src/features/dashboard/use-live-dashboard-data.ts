import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";

import { getAgentFeedbackProgressMarketDate } from "@/lib/agent-feedback-progress";
import {
  getDashboardLatestCompletedPipelineMarketDate,
  getDashboardProcessRequestMarketDate,
  getDashboardProcessResolvedMarketDate,
  resolveDashboardProcessPipelineStatus,
  shouldRequestLatestCompletedPipelineStatus,
} from "@/lib/dashboard-process-market-date";
import {
  buildDartFundamentalsDailyInspectPath,
  DART_FUNDAMENTALS_DAILY_INSPECT_CLIENT_PATH,
} from "@/lib/dart-fundamentals-daily";
import { buildEodPipelineStatusPath, EOD_PIPELINE_STATUS_CLIENT_PATH } from "@/lib/eod-pipeline-status";
import {
  buildExecutionRuntimeMarketDatePath,
  EXECUTION_RUNTIME_DAILY_BOARD_CLIENT_PATH,
  EXECUTION_RUNTIME_MONITORED_SYMBOLS_CLIENT_PATH,
  EXECUTION_RUNTIME_STATUS_CLIENT_PATH,
} from "@/lib/execution-runtime";
import {
  MOBILE_TOOLBAR_MARKET_STATUS_PATH,
  PORTFOLIO_SUMMARY_PATH,
  MOBILE_TOOLBAR_TRACKED_QUOTES_PATH,
  warmMobileToolbarViewData,
} from "@/lib/mobile-toolbar-data";
import { resolveTradingApiClientPath } from "@/lib/trading-api-client-path";
import {
  buildSignalDeciderFeedbackPath,
  buildSignalDeciderLatestFeedbackPath,
  resolveSignalDeciderFeedbackResultLimit,
  SIGNAL_DECIDER_FEEDBACK_CLIENT_PATH,
} from "@/lib/signal-decider-feedback";
import {
  getCachedTradingApiJson,
  seedTradingApiJsonCache,
  seedTradingApiJsonSnapshot,
} from "@/lib/trading-api-cache";

import {
  getAgentFeedbackProgressPollDelayMs,
  getDashboardLoadErrorMessage,
  getEodPipelineStatusPollDelayMs,
  getMarketSnapshotPollDelayMs,
  getSignalDeciderFeedbackPollDelayMs,
  shouldRevalidateLatestAvailableFallback,
  shouldRevalidateFilteringFallback,
} from "./live-dashboard-derived-state";
import {
  hasCompletedFilteringReload,
  INITIAL_FILTERING_RELOAD_KEY,
  isFilteringBackgroundReload,
  type FilteringReloadKey,
} from "./filtering-fallback-revalidation";
import type {
  CoreMarketStatus,
  CoreTrackedQuotesResponse,
  FilteringStageLoadState,
  LiveDashboardClientProps,
} from "./live-dashboard-types";
import type {
  AgentFeedbackListResponseDto,
  AgentFeedbackProgressResponseDto,
  DartFundamentalsDailyInspectResponseDto,
  EodFreshnessResponseDto,
  EodMarketRiskFiltersResponseDto,
  EodMomentumFactorsResponseDto,
  EodPipelineStatusResponseDto,
  EodPiotroskiFilterResultsResponseDto,
  EodValueFactorsResponseDto,
  ExecutionRuntimeDailyBoardResponseDto,
  ExecutionRuntimeMonitoredSymbolsResponseDto,
  ExecutionRuntimeStatusResponseDto,
  MarketSnapshotResponseDto,
  PortfolioSummaryDto,
} from "@/types/trading-api";

const TRACKED_QUOTES_RETRY_DELAYS_MS = [5_000, 15_000, 30_000] as const;
const FILTERING_FALLBACK_REVALIDATE_DELAY_MS = 5_000;
const EXECUTION_RUNTIME_POLL_MS = 15_000;
const MARKET_SNAPSHOT_PATH = "/api/trading/market/snapshot";
const MARKET_SNAPSHOT_REQUEST_TIMEOUT_MS = 20_000;

type DashboardTimeoutApi = {
  clearTimeout: typeof globalThis.clearTimeout;
  setTimeout: typeof globalThis.setTimeout;
};

export function createMarketSnapshotRequestTimeout({
  timeoutApi = globalThis,
  timeoutMs = MARKET_SNAPSHOT_REQUEST_TIMEOUT_MS,
}: {
  timeoutApi?: DashboardTimeoutApi;
  timeoutMs?: number;
} = {}) {
  const abortController = new AbortController();
  let timeoutCleared = false;
  const timeout = timeoutApi.setTimeout(() => {
    abortController.abort(new Error(`Market snapshot request timed out after ${timeoutMs}ms.`));
  }, timeoutMs);

  function clear() {
    if (timeoutCleared) return;
    timeoutCleared = true;
    timeoutApi.clearTimeout(timeout);
  }

  return {
    abort() {
      clear();
      if (!abortController.signal.aborted) {
        abortController.abort();
      }
    },
    clear,
    signal: abortController.signal,
  };
}

function getJson<T>(path: string): Promise<T> {
  return getCachedTradingApiJson<T>(resolveTradingApiClientPath(path));
}

async function getJsonNoCache<T>(path: string, options: { signal?: AbortSignal } = {}): Promise<T> {
  const response = await fetch(resolveTradingApiClientPath(path), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
    },
    signal: options.signal,
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
    if (parsedBody && typeof parsedBody === "object") {
      const body = parsedBody as Record<string, unknown>;
      for (const key of ["detail", "message", "error"]) {
        const value = body[key];
        if (typeof value === "string" && value.trim()) {
          throw new Error(value.trim());
        }
      }
    }

    throw new Error(`HTTP ${response.status} for ${path}`);
  }

  return parsedBody as T;
}

type LatestAvailableMarketDateResponse = {
  market_date?: string | null;
  requested_market_date?: string | null;
  resolved_market_date?: string | null;
  is_latest_fallback?: boolean | null;
};

function normalizeMarketDateKey(value: string | null | undefined) {
  return value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null;
}

export function hasResponseForRequestedMarketDate(
  response: LatestAvailableMarketDateResponse | null | undefined,
  requestedMarketDate: string | null,
) {
  const requestedDate = normalizeMarketDateKey(requestedMarketDate);
  if (!response || !requestedDate) return false;
  const responseRequestedDate = normalizeMarketDateKey(response.requested_market_date);

  if (response.is_latest_fallback === true) {
    return responseRequestedDate === requestedDate;
  }

  return (
    normalizeMarketDateKey(response.market_date) === requestedDate ||
    normalizeMarketDateKey(response.resolved_market_date) === requestedDate ||
    responseRequestedDate === requestedDate
  );
}

export function useLiveDashboardData({
  initialError = null,
  initialMarket,
  initialTracked,
  initialFreshness,
  initialFundamentalsStatus,
  initialPipelineStatus,
  initialPiotroskiStatus = null,
  initialMarketRiskStatus = null,
  initialScoringValueFactors = null,
  initialScoringMomentumFactors = null,
  initialMarketSnapshot,
  initialAgentFeedbackProgress,
  initialSignalDeciderFeedback,
  initialLatestSignalDeciderFeedback = null,
  initialPortfolioSummary,
  initialExecutionRuntimeStatus,
  initialExecutionRuntimeMonitoredSymbols,
  initialExecutionRuntimeDailyBoard,
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
  const [marketSnapshot, setMarketSnapshot] = useState<MarketSnapshotResponseDto | null>(initialMarketSnapshot);
  const [marketSnapshotError, setMarketSnapshotError] = useState<string | null>(null);
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
  const [signalDeciderFeedback, setSignalDeciderFeedback] = useState<AgentFeedbackListResponseDto | null>(
    initialSignalDeciderFeedback,
  );
  const [latestSignalDeciderFeedback, setLatestSignalDeciderFeedback] =
    useState<AgentFeedbackListResponseDto | null>(initialLatestSignalDeciderFeedback);
  const [signalDeciderFeedbackError, setSignalDeciderFeedbackError] = useState<string | null>(null);
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummaryDto | null>(initialPortfolioSummary);
  const [portfolioSummaryError, setPortfolioSummaryError] = useState<string | null>(null);
  const [portfolioSummaryLoadState, setPortfolioSummaryLoadState] = useState<"error" | "loading" | "success">(
    initialPortfolioSummary ? "success" : "loading",
  );
  const [executionRuntimeStatus, setExecutionRuntimeStatus] = useState<ExecutionRuntimeStatusResponseDto | null>(
    initialExecutionRuntimeStatus,
  );
  const [executionRuntimeStatusError, setExecutionRuntimeStatusError] = useState<string | null>(null);
  const [executionRuntimeMonitoredSymbols, setExecutionRuntimeMonitoredSymbols] =
    useState<ExecutionRuntimeMonitoredSymbolsResponseDto | null>(initialExecutionRuntimeMonitoredSymbols);
  const [executionRuntimeMonitoredSymbolsError, setExecutionRuntimeMonitoredSymbolsError] =
    useState<string | null>(null);
  const [executionRuntimeDailyBoard, setExecutionRuntimeDailyBoard] =
    useState<ExecutionRuntimeDailyBoardResponseDto | null>(initialExecutionRuntimeDailyBoard);
  const [executionRuntimeDailyBoardError, setExecutionRuntimeDailyBoardError] = useState<string | null>(null);
  const [piotroskiStatus, setPiotroskiStatus] = useState<EodPiotroskiFilterResultsResponseDto | null>(
    initialPiotroskiStatus,
  );
  const piotroskiStatusRef = useRef<EodPiotroskiFilterResultsResponseDto | null>(initialPiotroskiStatus);
  const [piotroskiStatusError, setPiotroskiStatusError] = useState<string | null>(null);
  const [piotroskiStatusLoadState, setPiotroskiStatusLoadState] = useState<FilteringStageLoadState>(
    initialDashboardProcessMarketDate ? (initialPiotroskiStatus ? "ready" : "loading") : "idle",
  );
  const [marketRiskStatus, setMarketRiskStatus] = useState<EodMarketRiskFiltersResponseDto | null>(initialMarketRiskStatus);
  const marketRiskStatusRef = useRef<EodMarketRiskFiltersResponseDto | null>(initialMarketRiskStatus);
  const [marketRiskStatusError, setMarketRiskStatusError] = useState<string | null>(null);
  const [marketRiskStatusLoadState, setMarketRiskStatusLoadState] = useState<FilteringStageLoadState>(
    initialDashboardProcessMarketDate ? (initialMarketRiskStatus ? "ready" : "loading") : "idle",
  );
  const [filteringReloadCount, setFilteringReloadCount] = useState(0);
  const filteringReloadKeyRef = useRef<FilteringReloadKey>(INITIAL_FILTERING_RELOAD_KEY);
  const [filteringReloadCompletionKey, setFilteringReloadCompletionKey] = useState<FilteringReloadKey>(
    INITIAL_FILTERING_RELOAD_KEY,
  );
  const [scoringValueFactors, setScoringValueFactors] = useState<EodValueFactorsResponseDto | null>(
    initialScoringValueFactors,
  );
  const scoringValueFactorsRef = useRef<EodValueFactorsResponseDto | null>(initialScoringValueFactors);
  const [scoringValueFactorsError, setScoringValueFactorsError] = useState<string | null>(null);
  const [scoringValueFactorsLoadState, setScoringValueFactorsLoadState] = useState<FilteringStageLoadState>(
    initialDashboardProcessMarketDate ? (initialScoringValueFactors ? "ready" : "loading") : "idle",
  );
  const [scoringMomentumFactors, setScoringMomentumFactors] = useState<EodMomentumFactorsResponseDto | null>(
    initialScoringMomentumFactors,
  );
  const scoringMomentumFactorsRef = useRef<EodMomentumFactorsResponseDto | null>(initialScoringMomentumFactors);
  const [scoringMomentumFactorsError, setScoringMomentumFactorsError] = useState<string | null>(null);
  const [scoringMomentumFactorsLoadState, setScoringMomentumFactorsLoadState] = useState<FilteringStageLoadState>(
    initialDashboardProcessMarketDate ? (initialScoringMomentumFactors ? "ready" : "loading") : "idle",
  );
  const [scoringReloadCount, setScoringReloadCount] = useState(0);
  const scoringReloadKeyRef = useRef<FilteringReloadKey>(INITIAL_FILTERING_RELOAD_KEY);
  const [scoringReloadCompletionKey, setScoringReloadCompletionKey] = useState<FilteringReloadKey>(
    INITIAL_FILTERING_RELOAD_KEY,
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
  const latestCompletedPipelineMarketDate = getDashboardLatestCompletedPipelineMarketDate(
    freshness,
    pipelineRequestMarketDate,
  );
  const latestCompletedPipelineStatusPath = useMemo(
    () =>
      latestCompletedPipelineMarketDate
        ? buildEodPipelineStatusPath(EOD_PIPELINE_STATUS_CLIENT_PATH, latestCompletedPipelineMarketDate)
        : null,
    [latestCompletedPipelineMarketDate],
  );
  const executionRuntimeMarketDate = pipelineRequestMarketDate;

  useEffect(() => {
    seedTradingApiJsonSnapshot(MOBILE_TOOLBAR_MARKET_STATUS_PATH, initialMarket);
    seedTradingApiJsonSnapshot(MOBILE_TOOLBAR_TRACKED_QUOTES_PATH, initialTracked);
    seedTradingApiJsonSnapshot(PORTFOLIO_SUMMARY_PATH, initialPortfolioSummary);
    seedTradingApiJsonCache("/api/trading/eod/freshness", initialFreshness);
    seedTradingApiJsonCache(
      buildDartFundamentalsDailyInspectPath(
        DART_FUNDAMENTALS_DAILY_INSPECT_CLIENT_PATH,
        initialDashboardProcessMarketDate,
      ),
      initialFundamentalsStatus,
    );
    if (initialDashboardProcessMarketDate) {
      seedTradingApiJsonCache(
        `/api/trading/eod/piotroski-filter-results?market_date=${encodeURIComponent(initialDashboardProcessMarketDate)}`,
        initialPiotroskiStatus,
      );
      seedTradingApiJsonCache(
        `/api/trading/eod/market-risk-filters?market_date=${encodeURIComponent(initialDashboardProcessMarketDate)}`,
        initialMarketRiskStatus,
      );
      seedTradingApiJsonCache(
        `/api/trading/eod/value-factors?market_date=${encodeURIComponent(initialDashboardProcessMarketDate)}`,
        initialScoringValueFactors,
      );
      seedTradingApiJsonCache(
        `/api/trading/eod/momentum-factors?market_date=${encodeURIComponent(initialDashboardProcessMarketDate)}`,
        initialScoringMomentumFactors,
      );
    }
    void warmMobileToolbarViewData("dashboard");
  }, [
    initialDashboardProcessMarketDate,
    initialFreshness,
    initialFundamentalsStatus,
    initialMarket,
    initialMarketRiskStatus,
    initialPiotroskiStatus,
    initialPortfolioSummary,
    initialScoringMomentumFactors,
    initialScoringValueFactors,
    initialTracked,
  ]);

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

    const loadPortfolioSummary = async () => {
      try {
        const summary = await getJsonNoCache<PortfolioSummaryDto>(PORTFOLIO_SUMMARY_PATH);
        if (!active) return;
        setPortfolioSummary(summary);
        seedTradingApiJsonSnapshot(PORTFOLIO_SUMMARY_PATH, summary);
        setPortfolioSummaryError(null);
        setPortfolioSummaryLoadState("success");
      } catch (portfolioError) {
        console.error("Dashboard portfolio summary load failed", portfolioError);
        if (!active) return;
        setPortfolioSummaryError(getDashboardLoadErrorMessage(portfolioError));
        setPortfolioSummaryLoadState("error");
      }
    };

    void loadPortfolioSummary();
    const timer = window.setInterval(loadPortfolioSummary, 60_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;
    const monitoredSymbolsPath = buildExecutionRuntimeMarketDatePath(
      EXECUTION_RUNTIME_MONITORED_SYMBOLS_CLIENT_PATH,
      executionRuntimeMarketDate,
    );
    const dailyBoardPath = buildExecutionRuntimeMarketDatePath(
      EXECUTION_RUNTIME_DAILY_BOARD_CLIENT_PATH,
      executionRuntimeMarketDate,
    );

    const loadExecutionRuntime = async () => {
      const [statusResult, monitoredSymbolsResult, dailyBoardResult] = await Promise.allSettled([
        getJsonNoCache<ExecutionRuntimeStatusResponseDto>(EXECUTION_RUNTIME_STATUS_CLIENT_PATH),
        getJsonNoCache<ExecutionRuntimeMonitoredSymbolsResponseDto>(monitoredSymbolsPath),
        getJsonNoCache<ExecutionRuntimeDailyBoardResponseDto>(dailyBoardPath),
      ]);

      if (!active) return;

      if (statusResult.status === "fulfilled") {
        setExecutionRuntimeStatus(statusResult.value);
        setExecutionRuntimeStatusError(null);
      } else {
        console.error("Dashboard execution runtime status load failed", statusResult.reason);
        setExecutionRuntimeStatusError(getDashboardLoadErrorMessage(statusResult.reason));
      }

      if (monitoredSymbolsResult.status === "fulfilled") {
        setExecutionRuntimeMonitoredSymbols(monitoredSymbolsResult.value);
        setExecutionRuntimeMonitoredSymbolsError(null);
      } else {
        console.error("Dashboard execution runtime monitored symbols load failed", monitoredSymbolsResult.reason);
        setExecutionRuntimeMonitoredSymbolsError(getDashboardLoadErrorMessage(monitoredSymbolsResult.reason));
      }

      if (dailyBoardResult.status === "fulfilled") {
        setExecutionRuntimeDailyBoard(dailyBoardResult.value);
        setExecutionRuntimeDailyBoardError(null);
      } else {
        console.error("Dashboard execution runtime daily board load failed", dailyBoardResult.reason);
        setExecutionRuntimeDailyBoardError(getDashboardLoadErrorMessage(dailyBoardResult.reason));
      }
    };

    void loadExecutionRuntime();
    const timer = window.setInterval(loadExecutionRuntime, EXECUTION_RUNTIME_POLL_MS);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [executionRuntimeMarketDate]);

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

  useEffect(() => {
    let active = true;
    let consecutiveErrorCount = 0;
    let timer: number | null = null;
    let inFlightRequest: ReturnType<typeof createMarketSnapshotRequestTimeout> | null = null;

    function clearTimer() {
      if (timer === null) return;
      window.clearTimeout(timer);
      timer = null;
    }

    function scheduleNextLoad(hadError: boolean) {
      if (!active) return;
      clearTimer();
      timer = window.setTimeout(
        loadMarketSnapshot,
        getMarketSnapshotPollDelayMs({
          hadError,
          consecutiveErrorCount,
        }),
      );
    }

    async function loadMarketSnapshot() {
      const requestTimeout = createMarketSnapshotRequestTimeout();
      inFlightRequest = requestTimeout;

      try {
        const snapshot = await getJsonNoCache<MarketSnapshotResponseDto>(MARKET_SNAPSHOT_PATH, {
          signal: requestTimeout.signal,
        });
        if (!active) return;
        consecutiveErrorCount = 0;
        setMarketSnapshot(snapshot);
        setMarketSnapshotError(null);
        scheduleNextLoad(false);
      } catch (snapshotError) {
        console.error("Dashboard market snapshot load failed", snapshotError);
        if (!active) return;
        consecutiveErrorCount += 1;
        setMarketSnapshotError(getDashboardLoadErrorMessage(snapshotError));
        scheduleNextLoad(true);
      } finally {
        requestTimeout.clear();
        if (inFlightRequest === requestTimeout) {
          inFlightRequest = null;
        }
      }
    }

    void loadMarketSnapshot();

    return () => {
      active = false;
      clearTimer();
      inFlightRequest?.abort();
    };
  }, []);

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
  const shouldScheduleFilteringFallbackRevalidation = shouldRevalidateFilteringFallback({
    requestedMarketDate: filteringMarketDate,
    piotroskiStatus,
    marketRiskStatus,
    pipelineStatus,
    agentFeedbackProgress,
  });
  const hasCompletedActiveFilteringReload = hasCompletedFilteringReload({
    completionKey: filteringReloadCompletionKey,
    currentMarketDate: filteringMarketDate,
    reloadCount: filteringReloadCount,
  });
  const scoringMarketDate = dashboardProcessMarketDate;
  const shouldScheduleScoringFallbackRevalidation = shouldRevalidateLatestAvailableFallback({
    requestedMarketDate: scoringMarketDate,
    latestFallbackStatuses: [scoringValueFactors, scoringMomentumFactors],
    pipelineStatus,
    agentFeedbackProgress,
  });
  const hasCompletedActiveScoringReload = hasCompletedFilteringReload({
    completionKey: scoringReloadCompletionKey,
    currentMarketDate: scoringMarketDate,
    reloadCount: scoringReloadCount,
  });

  useEffect(() => {
    if (!filteringMarketDate) return;

    let active = true;
    const isBackgroundReload = isFilteringBackgroundReload({
      currentMarketDate: filteringMarketDate,
      previousReloadKey: filteringReloadKeyRef.current,
      reloadCount: filteringReloadCount,
    });
    filteringReloadKeyRef.current = {
      marketDate: filteringMarketDate,
      reloadCount: filteringReloadCount,
    };

    const loadFilteringStatus = async () => {
      const hasCurrentPiotroskiSnapshot = hasResponseForRequestedMarketDate(
        piotroskiStatusRef.current,
        filteringMarketDate,
      );
      const hasCurrentMarketRiskSnapshot = hasResponseForRequestedMarketDate(
        marketRiskStatusRef.current,
        filteringMarketDate,
      );
      const canReuseCurrentFilteringSnapshot =
        !isBackgroundReload &&
        hasCurrentPiotroskiSnapshot &&
        hasCurrentMarketRiskSnapshot;

      if (!isBackgroundReload && !canReuseCurrentFilteringSnapshot) {
        piotroskiStatusRef.current = null;
        setPiotroskiStatus(null);
        setPiotroskiStatusError(null);
        setPiotroskiStatusLoadState("loading");
        marketRiskStatusRef.current = null;
        setMarketRiskStatus(null);
        setMarketRiskStatusError(null);
        setMarketRiskStatusLoadState("loading");
      }

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
        piotroskiStatusRef.current = piotroskiResult.value;
        setPiotroskiStatus(piotroskiResult.value);
        setPiotroskiStatusError(null);
        setPiotroskiStatusLoadState("ready");
      } else {
        console.error("Dashboard Piotroski status load failed", piotroskiResult.reason);
        if (!isBackgroundReload) {
          piotroskiStatusRef.current = null;
          setPiotroskiStatus(null);
          setPiotroskiStatusError(getDashboardLoadErrorMessage(piotroskiResult.reason));
          setPiotroskiStatusLoadState("error");
        }
      }

      if (marketRiskResult.status === "fulfilled") {
        marketRiskStatusRef.current = marketRiskResult.value;
        setMarketRiskStatus(marketRiskResult.value);
        setMarketRiskStatusError(null);
        setMarketRiskStatusLoadState("ready");
      } else {
        console.error("Dashboard market risk status load failed", marketRiskResult.reason);
        if (!isBackgroundReload) {
          marketRiskStatusRef.current = null;
          setMarketRiskStatus(null);
          setMarketRiskStatusError(getDashboardLoadErrorMessage(marketRiskResult.reason));
          setMarketRiskStatusLoadState("error");
        }
      }

      setFilteringReloadCompletionKey({
        marketDate: filteringMarketDate,
        reloadCount: filteringReloadCount,
      });
    };

    void loadFilteringStatus();

    return () => {
      active = false;
    };
  }, [filteringMarketDate, filteringReloadCount]);

  useEffect(() => {
    if (
      !filteringMarketDate ||
      !shouldScheduleFilteringFallbackRevalidation ||
      !hasCompletedActiveFilteringReload
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      setFilteringReloadCount((current) => current + 1);
    }, FILTERING_FALLBACK_REVALIDATE_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    filteringMarketDate,
    filteringReloadCount,
    hasCompletedActiveFilteringReload,
    shouldScheduleFilteringFallbackRevalidation,
  ]);

  useEffect(() => {
    if (!scoringMarketDate) return;

    let active = true;
    const isBackgroundReload = isFilteringBackgroundReload({
      currentMarketDate: scoringMarketDate,
      previousReloadKey: scoringReloadKeyRef.current,
      reloadCount: scoringReloadCount,
    });
    scoringReloadKeyRef.current = {
      marketDate: scoringMarketDate,
      reloadCount: scoringReloadCount,
    };

    const loadScoringStatus = async () => {
      const hasCurrentValueSnapshot = hasResponseForRequestedMarketDate(
        scoringValueFactorsRef.current,
        scoringMarketDate,
      );
      const hasCurrentMomentumSnapshot = hasResponseForRequestedMarketDate(
        scoringMomentumFactorsRef.current,
        scoringMarketDate,
      );
      const canReuseCurrentScoringSnapshot =
        !isBackgroundReload &&
        hasCurrentValueSnapshot &&
        hasCurrentMomentumSnapshot;

      if (!isBackgroundReload && !canReuseCurrentScoringSnapshot) {
        scoringValueFactorsRef.current = null;
        setScoringValueFactors(null);
        setScoringValueFactorsError(null);
        setScoringValueFactorsLoadState("loading");
        scoringMomentumFactorsRef.current = null;
        setScoringMomentumFactors(null);
        setScoringMomentumFactorsError(null);
        setScoringMomentumFactorsLoadState("loading");
      }

      const marketDateParam = encodeURIComponent(scoringMarketDate);
      const [valueResult, momentumResult] = await Promise.allSettled([
        getJsonNoCache<EodValueFactorsResponseDto>(
          `/api/trading/eod/value-factors?market_date=${marketDateParam}`,
        ),
        getJsonNoCache<EodMomentumFactorsResponseDto>(
          `/api/trading/eod/momentum-factors?market_date=${marketDateParam}`,
        ),
      ]);

      if (!active) return;

      if (valueResult.status === "fulfilled") {
        scoringValueFactorsRef.current = valueResult.value;
        setScoringValueFactors(valueResult.value);
        setScoringValueFactorsError(null);
        setScoringValueFactorsLoadState("ready");
      } else {
        console.error("Dashboard value scoring summary load failed", valueResult.reason);
        if (!isBackgroundReload) {
          scoringValueFactorsRef.current = null;
          setScoringValueFactors(null);
          setScoringValueFactorsError(getDashboardLoadErrorMessage(valueResult.reason));
          setScoringValueFactorsLoadState("error");
        }
      }

      if (momentumResult.status === "fulfilled") {
        scoringMomentumFactorsRef.current = momentumResult.value;
        setScoringMomentumFactors(momentumResult.value);
        setScoringMomentumFactorsError(null);
        setScoringMomentumFactorsLoadState("ready");
      } else {
        console.error("Dashboard momentum scoring summary load failed", momentumResult.reason);
        if (!isBackgroundReload) {
          scoringMomentumFactorsRef.current = null;
          setScoringMomentumFactors(null);
          setScoringMomentumFactorsError(getDashboardLoadErrorMessage(momentumResult.reason));
          setScoringMomentumFactorsLoadState("error");
        }
      }

      setScoringReloadCompletionKey({
        marketDate: scoringMarketDate,
        reloadCount: scoringReloadCount,
      });
    };

    void loadScoringStatus();

    return () => {
      active = false;
    };
  }, [scoringMarketDate, scoringReloadCount]);

  useEffect(() => {
    if (
      !scoringMarketDate ||
      !shouldScheduleScoringFallbackRevalidation ||
      !hasCompletedActiveScoringReload
    ) {
      return;
    }

    const timer = window.setTimeout(() => {
      setScoringReloadCount((current) => current + 1);
    }, FILTERING_FALLBACK_REVALIDATE_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    hasCompletedActiveScoringReload,
    scoringMarketDate,
    scoringReloadCount,
    shouldScheduleScoringFallbackRevalidation,
  ]);

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
        const currentPipelineStatus = await getJson<EodPipelineStatusResponseDto>(pipelineStatusPath);
        const latestCompletedPipelineStatus =
          latestCompletedPipelineStatusPath &&
          shouldRequestLatestCompletedPipelineStatus({
            currentPipelineStatus,
            freshness,
            requestMarketDate: pipelineRequestMarketDate,
          })
            ? await getJson<EodPipelineStatusResponseDto>(latestCompletedPipelineStatusPath).catch(() => null)
            : null;
        const data = resolveDashboardProcessPipelineStatus({
          currentPipelineStatus,
          freshness,
          latestCompletedPipelineStatus,
          requestMarketDate: pipelineRequestMarketDate,
        });
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
  }, [freshness, latestCompletedPipelineStatusPath, pipelineRequestMarketDate, pipelineStatusPath]);

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
        const data = await getJsonNoCache<AgentFeedbackProgressResponseDto>(progressPath);
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

  const signalDeciderFeedbackRefreshKey = [
    agentProgressMarketDate,
    resolveSignalDeciderFeedbackResultLimit(agentFeedbackProgress),
    agentFeedbackProgress?.summary?.latest_feedback_at ?? "",
    agentFeedbackProgress?.summary?.run_completed_at ?? "",
    agentFeedbackProgress?.summary?.run_status ?? "",
  ].join(":");

  useEffect(() => {
    if (!agentProgressMarketDate) {
      return;
    }

    let active = true;
    let timer: number | null = null;
    const feedbackPath = buildSignalDeciderFeedbackPath({
      basePath: SIGNAL_DECIDER_FEEDBACK_CLIENT_PATH,
      limit: resolveSignalDeciderFeedbackResultLimit(agentFeedbackProgressRef.current),
      marketDate: agentProgressMarketDate,
    });

    function clearTimer() {
      if (timer === null) return;
      window.clearTimeout(timer);
      timer = null;
    }

    function scheduleNextLoad(hadError: boolean) {
      if (!active) return;
      clearTimer();
      const nextDelayMs = getSignalDeciderFeedbackPollDelayMs({
        progress: agentFeedbackProgressRef.current,
        hadError,
      });
      if (nextDelayMs === null) return;
      timer = window.setTimeout(loadSignalDeciderFeedback, nextDelayMs);
    }

    async function loadSignalDeciderFeedback() {
      try {
        const data = await getJsonNoCache<AgentFeedbackListResponseDto>(feedbackPath);
        if (!active) return;
        setSignalDeciderFeedback(data);
        setSignalDeciderFeedbackError(null);
        scheduleNextLoad(false);
      } catch (feedbackError) {
        console.error("Dashboard signal decider feedback load failed", feedbackError);
        if (!active) return;
        setSignalDeciderFeedbackError(getDashboardLoadErrorMessage(feedbackError));
        scheduleNextLoad(true);
      }
    }

    void loadSignalDeciderFeedback();

    return () => {
      active = false;
      clearTimer();
    };
  }, [agentProgressMarketDate, signalDeciderFeedbackRefreshKey]);

  useEffect(() => {
    let active = true;
    const latestFeedbackPath = buildSignalDeciderLatestFeedbackPath({
      basePath: SIGNAL_DECIDER_FEEDBACK_CLIENT_PATH,
      limit: resolveSignalDeciderFeedbackResultLimit(agentFeedbackProgressRef.current),
    });

    const loadLatestSignalDeciderFeedback = async () => {
      try {
        const data = await getJsonNoCache<AgentFeedbackListResponseDto>(latestFeedbackPath);
        if (!active) return;
        setLatestSignalDeciderFeedback(data);
      } catch (feedbackError) {
        console.error("Dashboard latest signal decider feedback load failed", feedbackError);
        if (!active) return;
        setLatestSignalDeciderFeedback((current) => current);
      }
    };

    void loadLatestSignalDeciderFeedback();

    return () => {
      active = false;
    };
  }, [signalDeciderFeedbackRefreshKey]);

  return {
    agentFeedbackProgress,
    agentFeedbackProgressError,
    dashboardProcessMarketDate,
    executionRuntimeDailyBoard,
    executionRuntimeDailyBoardError,
    executionRuntimeMarketDate,
    executionRuntimeMonitoredSymbols,
    executionRuntimeMonitoredSymbolsError,
    executionRuntimeStatus,
    executionRuntimeStatusError,
    market,
    marketSnapshot,
    marketSnapshotError,
    marketRiskStatus: filteringMarketDate ? marketRiskStatus : null,
    marketRiskStatusError: filteringMarketDate ? marketRiskStatusError : null,
    marketRiskStatusLoadState: filteringMarketDate ? marketRiskStatusLoadState : "idle",
    marketError,
    piotroskiStatus: filteringMarketDate ? piotroskiStatus : null,
    piotroskiStatusError: filteringMarketDate ? piotroskiStatusError : null,
    piotroskiStatusLoadState: filteringMarketDate ? piotroskiStatusLoadState : "idle",
    pipelineStatus,
    portfolioSummary,
    portfolioSummaryError,
    portfolioSummaryLoadState,
    scoringMomentumFactors: scoringMarketDate ? scoringMomentumFactors : null,
    scoringMomentumFactorsError: scoringMarketDate ? scoringMomentumFactorsError : null,
    scoringMomentumFactorsLoadState: scoringMarketDate ? scoringMomentumFactorsLoadState : "idle",
    scoringValueFactors: scoringMarketDate ? scoringValueFactors : null,
    scoringValueFactorsError: scoringMarketDate ? scoringValueFactorsError : null,
    scoringValueFactorsLoadState: scoringMarketDate ? scoringValueFactorsLoadState : "idle",
    setAgentFeedbackProgress,
    setAgentFeedbackProgressError,
    signalDeciderFeedback:
      agentProgressMarketDate && signalDeciderFeedback?.request?.market_date === agentProgressMarketDate
        ? signalDeciderFeedback
        : null,
    latestSignalDeciderFeedback,
    signalDeciderFeedbackError: agentProgressMarketDate ? signalDeciderFeedbackError : null,
    tracked,
    trackedError,
    freshness,
    fundamentalsStatus,
  };
}
