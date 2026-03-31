import {
  LiveDashboardClient,
  type CoreMarketStatus,
  type CoreTrackedQuotesResponse,
  type CoreTrackedSymbolsResponse,
} from "./live-dashboard-client";

export const dynamic = "force-dynamic";

const coreBase = process.env.TRADING_API_INTERNAL_BASE_URL || "http://127.0.0.1:8000";

async function getCoreJson<T>(path: string): Promise<T> {
  const response = await fetch(`${coreBase}${path}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export default async function DashboardPage() {
  try {
    const [market, tracked, symbols] = await Promise.all([
      getCoreJson<CoreMarketStatus>("/market/status"),
      getCoreJson<CoreTrackedQuotesResponse>("/quotes/tracked"),
      getCoreJson<CoreTrackedSymbolsResponse>("/scanner/tracked-symbols"),
    ]);

    return (
      <LiveDashboardClient
        initialMarket={market}
        initialTracked={tracked}
        initialSymbols={symbols}
      />
    );
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
}
