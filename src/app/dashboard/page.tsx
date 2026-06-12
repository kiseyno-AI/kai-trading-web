import type { Metadata } from "next";

import { LiveDashboardClient } from "./live-dashboard-client";
import type { CoreMarketStatus, CoreTrackedQuotesResponse } from "@/features/dashboard/live-dashboard-types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Trading Dashboard Home",
};

function getDashboardShellPayload() {
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
      server_time: null,
    } satisfies CoreMarketStatus,
    tracked: {
      market_state: "offline-placeholder",
      as_of: now,
      items: trackedItems,
    } satisfies CoreTrackedQuotesResponse,
  };
}

export default function DashboardPage() {
  const { market, tracked } = getDashboardShellPayload();

  return (
    <LiveDashboardClient
      initialError={null}
      initialMarket={market}
      initialTracked={tracked}
      initialFreshness={null}
      initialFundamentalsStatus={null}
      initialPipelineStatus={null}
      initialPiotroskiStatus={null}
      initialMarketRiskStatus={null}
      initialScoringValueFactors={null}
      initialScoringMomentumFactors={null}
      initialAgentFeedbackProgress={null}
      initialSignalDeciderFeedback={null}
      initialLatestSignalDeciderFeedback={null}
      initialPortfolioSummary={null}
      initialExecutionRuntimeStatus={null}
      initialExecutionRuntimeMonitoredSymbols={null}
      initialExecutionRuntimeDailyBoard={null}
    />
  );
}
