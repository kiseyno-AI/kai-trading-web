import type { Metadata } from "next";
import { headers } from "next/headers";

import { LiveDashboardClient } from "./live-dashboard-client";
import type { CoreMarketStatus, CoreTrackedQuotesResponse } from "@/features/dashboard/live-dashboard-types";
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
  DART_FUNDAMENTALS_DAILY_INSPECT_UPSTREAM_PATH,
} from "@/lib/dart-fundamentals-daily";
import {
  buildEodPipelineStatusPath,
  EOD_PIPELINE_STATUS_UPSTREAM_PATH,
  EOD_PIPELINE_STATUS_REQUEST_TIMEOUT_MS,
} from "@/lib/eod-pipeline-status";
import { getLatestActionMarketDate } from "@/lib/eod-freshness-latest";
import {
  buildExecutionRuntimeMarketDatePath,
  EXECUTION_RUNTIME_DAILY_BOARD_UPSTREAM_PATH,
  EXECUTION_RUNTIME_MONITORED_SYMBOLS_UPSTREAM_PATH,
  EXECUTION_RUNTIME_STATUS_UPSTREAM_PATH,
} from "@/lib/execution-runtime";
import {
  buildSignalDeciderFeedbackPath,
  buildSignalDeciderLatestFeedbackPath,
  resolveSignalDeciderFeedbackResultLimit,
  resolveSignalDeciderLatestFeedbackMarketDate,
  SIGNAL_DECIDER_FEEDBACK_UPSTREAM_PATH,
} from "@/lib/signal-decider-feedback";
import { fetchServerTradingApiJson } from "@/lib/trading-upstream";
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

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Trading Dashboard Home",
};

function buildAgentFeedbackProgressPath(freshness: EodFreshnessResponseDto | null) {
  const marketDate = getAgentFeedbackProgressMarketDate(freshness);
  if (!marketDate) return null;

  const params = new URLSearchParams({ market_date: marketDate });
  return `/agent-context/feedback/progress?${params.toString()}`;
}

function getMockDashboardPayload() {
  const now = new Date().toISOString();
  const trackedItems = [
    { symbol: "005930", company_name: "Samsung Electronics", price: 71_500, change_pct: 0.84 },
    { symbol: "000660", company_name: "SK hynix", price: 183_400, change_pct: -0.41 },
    { symbol: "035420", company_name: "NAVER", price: 202_500, change_pct: 1.12 },
    { symbol: "005380", company_name: "Hyundai Motor", price: 238_000, change_pct: 0.27 },
  ].map((item, index) => {
    const volume = 120_000 + index * 18_000;
    const change = Math.round((item.price * item.change_pct) / 100);

    return {
      symbol: item.symbol,
      company_name: item.company_name,
      price: item.price,
      change,
      change_pct: item.change_pct,
      volume,
      turnover: item.price * volume,
      as_of: now,
      market_state: "offline-placeholder",
      source: "mock",
      fallback: true,
      is_live: false,
      available: true,
      trade_date: now.slice(0, 10),
      fallback_reason: "offline_placeholder",
      unavailable_reason: null,
    };
  });

  return {
    market: {
      state: "OFFLINE PLACEHOLDER",
      is_open: false,
      server_time: now,
    } satisfies CoreMarketStatus,
    tracked: {
      market_state: "offline-placeholder",
      as_of: now,
      items: trackedItems,
    } satisfies CoreTrackedQuotesResponse,
  };
}

export default async function DashboardPage() {
  let market: CoreMarketStatus;
  let tracked: CoreTrackedQuotesResponse;
  let freshness: EodFreshnessResponseDto | null = null;
  let fundamentalsStatus: DartFundamentalsDailyInspectResponseDto | null = null;
  let pipelineStatus: EodPipelineStatusResponseDto | null = null;
  let piotroskiStatus: EodPiotroskiFilterResultsResponseDto | null = null;
  let marketRiskStatus: EodMarketRiskFiltersResponseDto | null = null;
  let scoringValueFactors: EodValueFactorsResponseDto | null = null;
  let scoringMomentumFactors: EodMomentumFactorsResponseDto | null = null;
  let marketSnapshot: MarketSnapshotResponseDto | null = null;
  let agentFeedbackProgress: AgentFeedbackProgressResponseDto | null = null;
  let signalDeciderFeedback: AgentFeedbackListResponseDto | null = null;
  let latestSignalDeciderFeedback: AgentFeedbackListResponseDto | null = null;
  let portfolioSummary: PortfolioSummaryDto | null = null;
  let executionRuntimeStatus: ExecutionRuntimeStatusResponseDto | null = null;
  let executionRuntimeMonitoredSymbols: ExecutionRuntimeMonitoredSymbolsResponseDto | null = null;
  let executionRuntimeDailyBoard: ExecutionRuntimeDailyBoardResponseDto | null = null;
  let initialError: string | null = null;
  const requestHeaders = await headers();

  try {
    [market, tracked, freshness, portfolioSummary, marketSnapshot, executionRuntimeStatus] = await Promise.all([
      fetchServerTradingApiJson<CoreMarketStatus>("/market/status", requestHeaders),
      fetchServerTradingApiJson<CoreTrackedQuotesResponse>("/quotes/tracked", requestHeaders),
      fetchServerTradingApiJson<EodFreshnessResponseDto>("/eod/freshness", requestHeaders).catch(() => null),
      fetchServerTradingApiJson<PortfolioSummaryDto>("/portfolio/summary", requestHeaders).catch(() => null),
      fetchServerTradingApiJson<MarketSnapshotResponseDto>("/market/snapshot", requestHeaders).catch(() => null),
      fetchServerTradingApiJson<ExecutionRuntimeStatusResponseDto>(
        EXECUTION_RUNTIME_STATUS_UPSTREAM_PATH,
        requestHeaders,
      ).catch(() => null),
    ]);

    const pipelineRequestMarketDate = getDashboardProcessRequestMarketDate(
      freshness?.today?.trade_date,
      market.server_time,
    );
    const currentPipelineStatus = await fetchServerTradingApiJson<EodPipelineStatusResponseDto>(
      buildEodPipelineStatusPath(EOD_PIPELINE_STATUS_UPSTREAM_PATH, pipelineRequestMarketDate),
      requestHeaders,
      { timeoutMs: EOD_PIPELINE_STATUS_REQUEST_TIMEOUT_MS },
    ).catch(() => null);
    const latestCompletedPipelineMarketDate = getDashboardLatestCompletedPipelineMarketDate(
      freshness,
      pipelineRequestMarketDate,
    );
    const latestCompletedPipelineStatus =
      latestCompletedPipelineMarketDate &&
      shouldRequestLatestCompletedPipelineStatus({
        currentPipelineStatus,
        freshness,
        requestMarketDate: pipelineRequestMarketDate,
      })
        ? await fetchServerTradingApiJson<EodPipelineStatusResponseDto>(
            buildEodPipelineStatusPath(EOD_PIPELINE_STATUS_UPSTREAM_PATH, latestCompletedPipelineMarketDate),
            requestHeaders,
            { timeoutMs: EOD_PIPELINE_STATUS_REQUEST_TIMEOUT_MS },
          ).catch(() => null)
        : null;
    pipelineStatus = resolveDashboardProcessPipelineStatus({
      currentPipelineStatus,
      freshness,
      latestCompletedPipelineStatus,
      requestMarketDate: pipelineRequestMarketDate,
    });

    const resolvedDashboardProcessMarketDate = getDashboardProcessResolvedMarketDate(
      pipelineStatus,
      pipelineRequestMarketDate,
    );
    const executionRuntimeMarketDate = pipelineRequestMarketDate;

    const progressPath = buildAgentFeedbackProgressPath(freshness);
    [
      fundamentalsStatus,
      agentFeedbackProgress,
      piotroskiStatus,
      marketRiskStatus,
      scoringValueFactors,
      scoringMomentumFactors,
      executionRuntimeMonitoredSymbols,
      executionRuntimeDailyBoard,
    ] = await Promise.all([
      fetchServerTradingApiJson<DartFundamentalsDailyInspectResponseDto>(
        buildDartFundamentalsDailyInspectPath(
          DART_FUNDAMENTALS_DAILY_INSPECT_UPSTREAM_PATH,
          resolvedDashboardProcessMarketDate,
        ),
        requestHeaders,
      ).catch(() => null),
      progressPath
        ? fetchServerTradingApiJson<AgentFeedbackProgressResponseDto>(progressPath, requestHeaders).catch(() => null)
        : Promise.resolve(null),
      resolvedDashboardProcessMarketDate
        ? fetchServerTradingApiJson<EodPiotroskiFilterResultsResponseDto>(
            `/eod/piotroski-filter-results?market_date=${encodeURIComponent(resolvedDashboardProcessMarketDate)}`,
            requestHeaders,
          ).catch(() => null)
        : Promise.resolve(null),
      resolvedDashboardProcessMarketDate
        ? fetchServerTradingApiJson<EodMarketRiskFiltersResponseDto>(
            `/eod/market-risk-filters?market_date=${encodeURIComponent(resolvedDashboardProcessMarketDate)}`,
            requestHeaders,
          ).catch(() => null)
        : Promise.resolve(null),
      resolvedDashboardProcessMarketDate
        ? fetchServerTradingApiJson<EodValueFactorsResponseDto>(
            `/eod/value-factors?market_date=${encodeURIComponent(resolvedDashboardProcessMarketDate)}`,
            requestHeaders,
          ).catch(() => null)
        : Promise.resolve(null),
      resolvedDashboardProcessMarketDate
        ? fetchServerTradingApiJson<EodMomentumFactorsResponseDto>(
            `/eod/momentum-factors?market_date=${encodeURIComponent(resolvedDashboardProcessMarketDate)}`,
            requestHeaders,
          ).catch(() => null)
        : Promise.resolve(null),
      fetchServerTradingApiJson<ExecutionRuntimeMonitoredSymbolsResponseDto>(
        buildExecutionRuntimeMarketDatePath(
          EXECUTION_RUNTIME_MONITORED_SYMBOLS_UPSTREAM_PATH,
          executionRuntimeMarketDate,
        ),
        requestHeaders,
      ).catch(() => null),
      fetchServerTradingApiJson<ExecutionRuntimeDailyBoardResponseDto>(
        buildExecutionRuntimeMarketDatePath(
          EXECUTION_RUNTIME_DAILY_BOARD_UPSTREAM_PATH,
          executionRuntimeMarketDate,
        ),
        requestHeaders,
      ).catch(() => null),
    ]);

    const signalDeciderMarketDate = getAgentFeedbackProgressMarketDate(freshness);
    const signalDeciderResultLimit = resolveSignalDeciderFeedbackResultLimit(agentFeedbackProgress);
    const latestSignalDeciderCompletedMarketDate =
      latestCompletedPipelineMarketDate ?? getLatestActionMarketDate(freshness);
    const latestSignalDeciderFeedbackMarketDate = resolveSignalDeciderLatestFeedbackMarketDate({
      currentMarketDate: executionRuntimeMarketDate,
      latestCompletedMarketDate: latestSignalDeciderCompletedMarketDate,
      progressMarketDate: signalDeciderMarketDate,
      resolvedProcessMarketDate: resolvedDashboardProcessMarketDate,
    });
    const latestSignalDeciderFeedbackPath =
      latestSignalDeciderFeedbackMarketDate && latestSignalDeciderFeedbackMarketDate !== signalDeciderMarketDate
        ? buildSignalDeciderLatestFeedbackPath({
            basePath: SIGNAL_DECIDER_FEEDBACK_UPSTREAM_PATH,
            limit: signalDeciderResultLimit,
            marketDate: latestSignalDeciderFeedbackMarketDate,
          })
        : null;
    [signalDeciderFeedback, latestSignalDeciderFeedback] = await Promise.all([
      signalDeciderMarketDate
        ? fetchServerTradingApiJson<AgentFeedbackListResponseDto>(
            buildSignalDeciderFeedbackPath({
              basePath: SIGNAL_DECIDER_FEEDBACK_UPSTREAM_PATH,
              limit: signalDeciderResultLimit,
              marketDate: signalDeciderMarketDate,
            }),
            requestHeaders,
          ).catch(() => null)
        : Promise.resolve(null),
      latestSignalDeciderFeedbackPath
        ? fetchServerTradingApiJson<AgentFeedbackListResponseDto>(
            latestSignalDeciderFeedbackPath,
            requestHeaders,
          ).catch(() => null)
        : Promise.resolve(null),
    ]);
  } catch (error) {
    initialError = error instanceof Error ? error.message : "Unknown dashboard load failure";
    console.error("Dashboard server render failed", error);
    ({ market, tracked } = getMockDashboardPayload());
  }

  return (
    <LiveDashboardClient
      initialError={initialError}
      initialMarket={market}
      initialTracked={tracked}
      initialFreshness={freshness}
      initialFundamentalsStatus={fundamentalsStatus}
      initialPipelineStatus={pipelineStatus}
      initialPiotroskiStatus={piotroskiStatus}
      initialMarketRiskStatus={marketRiskStatus}
      initialScoringValueFactors={scoringValueFactors}
      initialScoringMomentumFactors={scoringMomentumFactors}
      initialMarketSnapshot={marketSnapshot}
      initialAgentFeedbackProgress={agentFeedbackProgress}
      initialSignalDeciderFeedback={signalDeciderFeedback}
      initialLatestSignalDeciderFeedback={latestSignalDeciderFeedback}
      initialPortfolioSummary={portfolioSummary}
      initialExecutionRuntimeStatus={executionRuntimeStatus}
      initialExecutionRuntimeMonitoredSymbols={executionRuntimeMonitoredSymbols}
      initialExecutionRuntimeDailyBoard={executionRuntimeDailyBoard}
    />
  );
}
