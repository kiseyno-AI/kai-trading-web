"use client";

import { useEffect, useState } from "react";

import { formatDisplayTimestamp } from "@/lib/format";

export type CoreMarketStatus = {
  state: string;
  is_open: boolean;
  server_time: string;
};

export type CoreTrackedQuote = {
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

export type CoreTrackedQuotesResponse = {
  market_state: string;
  as_of: string;
  items: CoreTrackedQuote[];
};

export type CoreTrackedSymbolsResponse = {
  tracked_symbols: string[];
  count: number;
  last_updated_at: string | null;
};

export type SymbolSearchItem = {
  symbol: string;
  standard_code: string;
  name_ko: string;
  market: string;
};

type SymbolSearchResponse = {
  query: string;
  count: number;
  items: SymbolSearchItem[];
};

type LiveDashboardClientProps = {
  initialMarket: CoreMarketStatus;
  initialTracked: CoreTrackedQuotesResponse;
  initialSymbols: CoreTrackedSymbolsResponse;
};

function getCompanyName(item: CoreTrackedQuote | undefined): string {
  if (!item) return "N/A";
  return item.company_name || item.symbol;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

export function LiveDashboardClient({
  initialMarket,
  initialTracked,
  initialSymbols,
}: LiveDashboardClientProps) {
  const [market, setMarket] = useState<CoreMarketStatus>(initialMarket);
  const [tracked, setTracked] = useState<CoreTrackedQuotesResponse>(initialTracked);
  const [symbols, setSymbols] = useState<CoreTrackedSymbolsResponse>(initialSymbols);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchItems, setSearchItems] = useState<SymbolSearchItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [marketData, trackedData, symbolsData] = await Promise.all([
          getJson<CoreMarketStatus>("/api/trading/market/status"),
          getJson<CoreTrackedQuotesResponse>("/api/trading/quotes/tracked"),
          getJson<CoreTrackedSymbolsResponse>("/api/trading/scanner/tracked-symbols"),
        ]);
        if (!active) return;
        setMarket(marketData);
        setTracked(trackedData);
        setSymbols(symbolsData);
        setError(null);
      } catch (loadError) {
        console.error("Dashboard polling failed", loadError);
        if (!active) return;
        setError("대시보드 데이터를 불러오지 못했습니다. 코어 서버 또는 외부 API 연결을 확인하세요.");
      }
    };

    const timer = window.setInterval(load, 1000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const trimmedQuery = searchQuery.trim();

    if (trimmedQuery.length < 2) {
      setSearchItems([]);
      setSearchLoading(false);
      setSearchError(null);
      return;
    }

    let active = true;
    setSearchLoading(true);

    const timer = window.setTimeout(async () => {
      try {
        const data = await getJson<SymbolSearchResponse>(
          `/api/trading/symbols/search?q=${encodeURIComponent(trimmedQuery)}&limit=8`,
        );
        if (!active) return;
        setSearchItems(data.items);
        setSearchError(null);
      } catch (searchLoadError) {
        console.error("Symbol search failed", searchLoadError);
        if (!active) return;
        setSearchItems([]);
        setSearchError("심볼 검색을 불러오지 못했습니다. 코어 심볼 마스터 연결을 확인하세요.");
      } finally {
        if (active) {
          setSearchLoading(false);
        }
      }
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  const openSymbolDetail = (item: SymbolSearchItem) => {
    const detailUrl = `/dashboard/symbol/${encodeURIComponent(item.symbol)}?name=${encodeURIComponent(item.name_ko)}&market=${encodeURIComponent(item.market)}&standardCode=${encodeURIComponent(item.standard_code)}`;
    window.open(detailUrl, "_blank", "noopener,noreferrer");
  };

  if (error) {
    return (
      <main style={{ padding: 24, fontFamily: "sans-serif", background: "#07111f", color: "#eef4ff", minHeight: "100vh" }}>
        <h1 style={{ marginTop: 0 }}>KIS DASHBOARD ERROR</h1>
        <p style={{ color: "#ff909d" }}>{error}</p>
        <p style={{ color: "#9fb0cf" }}>로딩이 계속되는 대신 실패 원인을 표시하도록 수정했습니다.</p>
      </main>
    );
  }

  const lead = tracked.items[0];

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif", background: "#07111f", color: "#eef4ff", minHeight: "100vh" }}>
      <div style={{ marginBottom: 24, padding: 20, border: "1px solid #2a3b57", borderRadius: 16, background: "#0b1728" }}>
        <p style={{ margin: 0, color: "#8ea4cc", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>LIVE KIS DASHBOARD</p>
        <h1 style={{ margin: "8px 0 0", fontSize: 32 }}>Trading Dashboard Home</h1>
        <p style={{ color: "#9fb0cf" }}>This page is directly wired to trading-core KIS-backed endpoints.</p>
      </div>

      <section style={{ marginBottom: 24, padding: 20, border: "1px solid #2a3b57", borderRadius: 16, background: "#0b1728" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, color: "#8ea4cc", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>MASTER SYMBOL SEARCH</p>
            <h2 style={{ margin: "8px 0 6px" }}>Open symbol detail from the dashboard</h2>
            <p style={{ color: "#9fb0cf", maxWidth: 720 }}>
              Search the master symbol list by company name or code. Selecting a result opens a dedicated detail window for that symbol.
            </p>
          </div>
          <div style={{ color: "#8ea4cc", fontSize: 12 }}>Minimum 2 characters</div>
        </div>

        <label style={{ display: "grid", gap: 10 }}>
          <span style={{ color: "#cdd8ef", fontSize: 14 }}>Company name or symbol</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Samsung / 005930"
            style={{
              width: "100%",
              minHeight: 52,
              borderRadius: 12,
              border: "1px solid #2a3b57",
              background: "#07111f",
              color: "#eef4ff",
              padding: "0 16px",
              outline: "none",
            }}
          />
        </label>

        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", marginTop: 14, color: "#8ea4cc", fontSize: 13, flexWrap: "wrap" }}>
          <span>
            {searchLoading
              ? "Searching master symbols…"
              : searchQuery.trim().length < 2
                ? "Type at least 2 characters to search."
                : `${searchItems.length} matching symbols`}
          </span>
          {searchError ? <span style={{ color: "#ff909d" }}>{searchError}</span> : null}
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          {searchItems.map((item) => (
            <button
              key={`${item.symbol}-${item.standard_code}`}
              type="button"
              onClick={() => openSymbolDetail(item)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                alignItems: "center",
                width: "100%",
                padding: 16,
                borderRadius: 14,
                border: "1px solid #20324f",
                background: "#07111f",
                color: "#eef4ff",
                textAlign: "left",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <strong style={{ display: "block", fontSize: 16 }}>{item.name_ko}</strong>
                <div style={{ color: "#9fb0cf", marginTop: 4 }}>{item.symbol} · {item.standard_code}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                <span style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid #2a3b57", color: "#cdd8ef", fontSize: 12 }}>
                  {item.market}
                </span>
                <span style={{ color: "#8ea4cc", fontSize: 13 }}>Open detail ↗</span>
              </div>
            </button>
          ))}
          {!searchLoading && searchQuery.trim().length >= 2 && searchItems.length === 0 && !searchError ? (
            <div style={{ padding: 16, borderRadius: 14, border: "1px dashed #2a3b57", color: "#9fb0cf" }}>
              No matching symbol or company was found in the master list.
            </div>
          ) : null}
        </div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, marginBottom: 24 }}>
        <section style={{ padding: 18, border: "1px solid #2a3b57", borderRadius: 16, background: "#0b1728" }}>
          <div style={{ color: "#8ea4cc", fontSize: 12 }}>MARKET STATUS</div>
          <h2>{market.state}</h2>
          <p>Open: {String(market.is_open)}</p>
          <p>Server time: {formatDisplayTimestamp(market.server_time)}</p>
        </section>

        <section style={{ padding: 18, border: "1px solid #2a3b57", borderRadius: 16, background: "#0b1728" }}>
          <div style={{ color: "#8ea4cc", fontSize: 12 }}>TRACKED SYMBOLS</div>
          <h2>{symbols.count}</h2>
          <p>Universe: {symbols.tracked_symbols.join(", ")}</p>
          <p>Updated: {formatDisplayTimestamp(symbols.last_updated_at, "N/A")}</p>
        </section>

        <section style={{ padding: 18, border: "1px solid #2a3b57", borderRadius: 16, background: "#0b1728" }}>
          <div style={{ color: "#8ea4cc", fontSize: 12 }}>LEAD QUOTE</div>
          <h2>{getCompanyName(lead)}</h2>
          <p>{lead?.symbol ?? "N/A"}</p>
          <p>
            {lead ? `${lead.change_pct >= 0 ? "+" : ""}${lead.change_pct.toFixed(2)}%` : "N/A"} /{" "}
            {lead ? `${lead.change >= 0 ? "+" : ""}${lead.change.toLocaleString()}` : "N/A"}
          </p>
        </section>
      </div>

      <section style={{ padding: 20, border: "1px solid #2a3b57", borderRadius: 16, background: "#0b1728" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, color: "#8ea4cc", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>TRACKED QUOTES</p>
            <h2 style={{ margin: "8px 0 4px" }}>Realtime KIS-backed watchlist</h2>
            <p style={{ color: "#9fb0cf" }}>Market state: {tracked.market_state} · Updated {formatDisplayTimestamp(tracked.as_of)}</p>
          </div>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {tracked.items.map((item) => (
            <article
              key={item.symbol}
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.4fr) repeat(5, minmax(0, 1fr))",
                gap: 12,
                alignItems: "center",
                padding: 14,
                borderRadius: 14,
                border: "1px solid #20324f",
                background: "#07111f",
              }}
            >
              <div>
                <strong style={{ display: "block", fontSize: 16 }}>{getCompanyName(item)}</strong>
                <span style={{ color: "#8ea4cc", fontSize: 13 }}>{item.symbol}</span>
              </div>
              <div>
                <div style={{ color: "#8ea4cc", fontSize: 12 }}>Price</div>
                <strong>₩{item.price.toLocaleString()}</strong>
              </div>
              <div>
                <div style={{ color: "#8ea4cc", fontSize: 12 }}>Change</div>
                <strong style={{ color: item.change_pct >= 0 ? "#35d07f" : "#ff6b7a" }}>
                  {item.change_pct >= 0 ? "+" : ""}
                  {item.change_pct.toFixed(2)}%
                </strong>
              </div>
              <div>
                <div style={{ color: "#8ea4cc", fontSize: 12 }}>Volume</div>
                <strong>{item.volume.toLocaleString()}</strong>
              </div>
              <div>
                <div style={{ color: "#8ea4cc", fontSize: 12 }}>Turnover</div>
                <strong>₩{item.turnover.toLocaleString()}</strong>
              </div>
              <div>
                <div style={{ color: "#8ea4cc", fontSize: 12 }}>Updated</div>
                <strong>{formatDisplayTimestamp(item.as_of)}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
