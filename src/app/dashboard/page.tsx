import {
  LiveDashboardClient,
  type CoreMarketStatus,
  type CoreTrackedQuotesResponse,
  type CoreTrackedSymbolsResponse,
} from "./live-dashboard-client";
import { dashboardData } from "@/data/trading-dashboard";
import { fetchTradingUpstreamJson } from "@/lib/trading-upstream";

export const dynamic = "force-dynamic";

async function getCoreJson<T>(path: string): Promise<T> {
  return fetchTradingUpstreamJson<T>(path);
}

function getMockDashboardPayload() {
  const now = new Date().toISOString();

  const trackedItems = dashboardData.watchlist.map((item, index) => ({
    symbol: item.symbol,
    company_name: item.symbol,
    price: item.price,
    change: Math.round((item.price * item.change) / 100),
    change_pct: item.change,
    volume: 120_000 + index * 15_000,
    turnover: item.price * (120_000 + index * 15_000),
    as_of: now,
    market_state: "mock-session",
    source: "mock",
    fallback: true,
    is_live: false,
  }));

  return {
    market: {
      state: "MOCK MODE",
      is_open: false,
      server_time: now,
    } satisfies CoreMarketStatus,
    tracked: {
      market_state: "mock-session",
      as_of: now,
      items: trackedItems,
    } satisfies CoreTrackedQuotesResponse,
    symbols: {
      tracked_symbols: trackedItems.map((item) => item.symbol),
      count: trackedItems.length,
      last_updated_at: now,
    } satisfies CoreTrackedSymbolsResponse,
  };
}

export default async function DashboardPage() {
  let market: CoreMarketStatus;
  let tracked: CoreTrackedQuotesResponse;
  let symbols: CoreTrackedSymbolsResponse;

  try {
    [market, tracked, symbols] = await Promise.all([
      getCoreJson<CoreMarketStatus>("/market/status"),
      getCoreJson<CoreTrackedQuotesResponse>("/quotes/tracked"),
      getCoreJson<CoreTrackedSymbolsResponse>("/scanner/tracked-symbols"),
    ]);
  } catch (error) {
    console.error("Dashboard server render failed", error);
    ({ market, tracked, symbols } = getMockDashboardPayload());
  }

  return (
    <LiveDashboardClient
      initialMarket={market}
      initialTracked={tracked}
      initialSymbols={symbols}
    />
  );
}
