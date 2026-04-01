import {
  LiveDashboardClient,
  type CoreMarketStatus,
  type CoreTrackedQuotesResponse,
  type CoreTrackedSymbolsResponse,
} from "./live-dashboard-client";
import { fetchTradingUpstreamJson } from "@/lib/trading-upstream";

export const dynamic = "force-dynamic";

async function getCoreJson<T>(path: string): Promise<T> {
  return fetchTradingUpstreamJson<T>(path);
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

    return (
      <main
        style={{
          padding: 24,
          fontFamily: "sans-serif",
          background: "#07111f",
          color: "#eef4ff",
          minHeight: "100vh",
        }}
      >
        <h1 style={{ marginTop: 0 }}>KIS DASHBOARD ERROR</h1>
        <p style={{ color: "#ff909d" }}>
          대시보드 데이터를 서버에서 불러오지 못했습니다. 코어 서버 연결을 확인하세요.
        </p>
      </main>
    );
  }

  return (
    <LiveDashboardClient
      initialMarket={market}
      initialTracked={tracked}
      initialSymbols={symbols}
    />
  );
}
