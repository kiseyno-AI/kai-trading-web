import type { Metadata } from "next";

import { LiveDashboardClient } from "./live-dashboard-client";
import type { CoreMarketStatus, CoreTrackedQuotesResponse } from "@/features/dashboard/live-dashboard-types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Trading Dashboard Home",
};

const INITIAL_MARKET_STATE = {
  state: "UNAVAILABLE",
  is_open: false,
  server_time: null,
  as_of: null,
  reason: "Awaiting a validated market status response",
} satisfies CoreMarketStatus;

const INITIAL_TRACKED_QUOTES = {
  market_state: "unavailable",
  as_of: null,
  items: [],
} satisfies CoreTrackedQuotesResponse;

export default function DashboardPage() {
  return (
    <LiveDashboardClient
      initialError={null}
      initialMarket={INITIAL_MARKET_STATE}
      initialTracked={INITIAL_TRACKED_QUOTES}
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
