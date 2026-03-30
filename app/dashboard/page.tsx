"use client";

import { useEffect, useState } from "react";

type CoreMarketStatus = {
  state: string;
  is_open: boolean;
  server_time: string;
};

type CoreTrackedQuote = {
  symbol: string;
  company_name?: string;
  price: number;
  change: number;
  change_pct: number;
  volume: number;
  turnover: number;
  as_of: string | null;
  market_state: string;
  source: string;
  fallback: boolean;
  is_live: boolean;
};

type CoreTrackedQuotesResponse = {
  market_state: string;
  as_of: string;
  items: CoreTrackedQuote[];
};

type CoreTrackedSymbolsResponse = {
  tracked_symbols: string[];
  count: number;
  last_updated_at: string | null;
};

function getCompanyName(item: CoreTrackedQuote | undefined): string {
  if (!item) return "N/A";
  return item.company_name || item.symbol;
}

async function getJson<T>(path: string): Promise<T> {
  const base = process.env.NEXT_PUBLIC_TRADING_API_BASE_URL || "http://127.0.0.1:8000";
  const response = await fetch(`${base}${path}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

export default function DashboardPage() {
  const [market, setMarket] = useState<CoreMarketStatus | null>(null);
  const [tracked, setTracked] = useState<CoreTrackedQuotesResponse | null>(null);
  const [symbols, setSymbols] = useState<CoreTrackedSymbolsResponse | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      getJson<CoreMarketStatus>("/market/status"),
      getJson<CoreTrackedQuotesResponse>("/quotes/tracked"),
      getJson<CoreTrackedSymbolsResponse>("/scanner/tracked-symbols"),
    ]).then(([marketData, trackedData, symbolsData]) => {
      if (!active) return;
      setMarket(marketData);
      setTracked(trackedData);
      setSymbols(symbolsData);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!market || !tracked || !symbols) {
    return <main style={{ padding: 24, fontFamily: "sans-serif" }}>KIS DASHBOARD LOADING…</main>;
  }

  const lead = tracked.items[0];

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif", background: "#07111f", color: "#eef4ff", minHeight: "100vh" }}>
      <div style={{ marginBottom: 24, padding: 20, border: "1px solid #2a3b57", borderRadius: 16, background: "#0b1728" }}>
        <p style={{ margin: 0, color: "#8ea4cc", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>LIVE KIS DASHBOARD</p>
        <h1 style={{ margin: "8px 0 0", fontSize: 32 }}>Trading Dashboard Home</h1>
        <p style={{ color: "#9fb0cf" }}>This page is directly wired to trading-core KIS-backed endpoints.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, marginBottom: 24 }}>
        <section style={{ padding: 18, border: "1px solid #2a3b57", borderRadius: 16, background: "#0b1728" }}>
          <div style={{ color: "#8ea4cc", fontSize: 12 }}>MARKET STATUS</div>
          <h2>{market.state}</h2>
          <p>Open: {String(market.is_open)}</p>
          <p>Server time: {market.server_time}</p>
        </section>
        <section style={{ padding: 18, border: "1px solid #2a3b57", borderRadius: 16, background: "#0b1728" }}>
          <div style={{ color: "#8ea4cc", fontSize: 12 }}>LEAD COMPANY</div>
          <h2>{getCompanyName(lead)}</h2>
          <p>Code: {lead?.symbol ?? "-"}</p>
          <p>Price: ₩{lead?.price?.toLocaleString() ?? "-"}</p>
          <p>Change: {lead?.change_pct?.toFixed(2)}%</p>
        </section>
        <section style={{ padding: 18, border: "1px solid #2a3b57", borderRadius: 16, background: "#0b1728" }}>
          <div style={{ color: "#8ea4cc", fontSize: 12 }}>TRACKED COMPANIES</div>
          <h2>{symbols.count}</h2>
          <p>{tracked.items.map((item) => getCompanyName(item)).join(", ")}</p>
          <p>As of: {tracked.as_of}</p>
        </section>
      </div>

      <section style={{ padding: 20, border: "1px solid #2a3b57", borderRadius: 16, background: "#0b1728" }}>
        <h2 style={{ marginTop: 0 }}>KIS Watchlist</h2>
        <div style={{ display: "grid", gap: 12 }}>
          {tracked.items.map((item) => (
            <div key={item.symbol} style={{ padding: 14, border: "1px solid #20324f", borderRadius: 12, display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <strong>{getCompanyName(item)}</strong>
                <div style={{ color: "#9fb0cf" }}>{item.symbol} · {item.is_live ? "Live KIS quote" : "Cached quote"}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div>₩{item.price.toLocaleString()}</div>
                <div style={{ color: item.change_pct >= 0 ? "#35d07f" : "#ff6b7a" }}>{item.change_pct.toFixed(2)}%</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
