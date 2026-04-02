import type { Metadata } from "next";
import { headers } from "next/headers";

import {
  LiveDashboardClient,
  type CoreMarketStatus,
  type CoreTrackedQuotesResponse,
  type CoreTrackedSymbolsResponse,
} from "./live-dashboard-client";
import { fetchServerTradingApiJson } from "@/lib/trading-upstream";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Trading Dashboard Home",
};

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
  let initialError: string | null = null;
  const requestHeaders = await headers();

  try {
    [market, tracked, symbols] = await Promise.all([
      fetchServerTradingApiJson<CoreMarketStatus>("/market/status", requestHeaders),
      fetchServerTradingApiJson<CoreTrackedQuotesResponse>("/quotes/tracked", requestHeaders),
      fetchServerTradingApiJson<CoreTrackedSymbolsResponse>("/scanner/tracked-symbols", requestHeaders),
    ]);
  } catch (error) {
    initialError = error instanceof Error ? error.message : "Unknown dashboard load failure";
    console.error("Dashboard server render failed", error);
    ({ market, tracked, symbols } = getMockDashboardPayload());
  }

  return (
    <LiveDashboardClient
      initialError={initialError}
      initialMarket={market}
      initialTracked={tracked}
      initialSymbols={symbols}
    />
  );
}
