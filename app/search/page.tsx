"use client";

import { useEffect, useMemo, useState } from "react";

type SymbolSearchItem = {
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

type QuoteResponse = {
  symbol: string;
  company_name?: string;
  price: number;
  change: number;
  change_pct: number;
  volume: number;
  turnover: number;
  market_state: string;
  source: string;
  fallback: boolean;
  is_live: boolean;
  cached_at?: string | null;
};

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SymbolSearchItem[]>([]);
  const [selected, setSelected] = useState<SymbolSearchItem | null>(null);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await getJson<SymbolSearchResponse>(`/api/trading/symbols/search?q=${encodeURIComponent(query)}&limit=20`);
        if (!active) return;
        setItems(data.items);
        setSearchError(null);
      } catch (error) {
        console.error(error);
        if (!active) return;
        setItems([]);
        setSearchError("검색 데이터를 불러오지 못했습니다. 코어 서버 연결을 확인하세요.");
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [query]);

  useEffect(() => {
    if (!selected) return;
    let active = true;

    const loadQuote = async () => {
      try {
        const data = await getJson<QuoteResponse>(`/api/trading/quotes/${selected.symbol}`);
        if (!active) return;
        setQuote(data);
        setQuoteError(null);
      } catch (error) {
        console.error("Quote polling failed", error);
        if (!active) return;
        setQuoteError("실시간 데이터를 불러오지 못했습니다. 코어 서버 상태를 확인하세요.");
      }
    };

    loadQuote();
    const timer = window.setInterval(loadQuote, 1000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [selected]);

  const title = useMemo(() => {
    if (!selected) return "종목 검색";
    return `${selected.name_ko} · ${selected.symbol}`;
  }, [selected]);

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif", background: "#07111f", color: "#eef4ff", minHeight: "100vh" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0 }}>{title}</h1>
        <p style={{ color: "#9fb0cf" }}>회사명 또는 종목코드로 검색하고, 선택한 종목의 실시간 데이터를 1초마다 갱신합니다.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 20 }}>
        <section style={{ padding: 16, border: "1px solid #2a3b57", borderRadius: 16, background: "#0b1728" }}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="회사명 또는 종목코드 검색"
            style={{ width: "100%", padding: 12, borderRadius: 12, border: "1px solid #2a3b57", background: "#08111d", color: "#eef4ff" }}
          />
          {searchError ? <div style={{ color: "#ff909d", marginTop: 12 }}>{searchError}</div> : null}
          <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
            {items.map((item) => (
              <button
                key={item.symbol}
                onClick={() => setSelected(item)}
                style={{ textAlign: "left", padding: 12, borderRadius: 12, border: "1px solid #20324f", background: selected?.symbol === item.symbol ? "#10233d" : "#0b1728", color: "#eef4ff", cursor: "pointer" }}
              >
                <strong>{item.name_ko}</strong>
                <div style={{ color: "#9fb0cf", marginTop: 4 }}>{item.symbol} · {item.market}</div>
              </button>
            ))}
          </div>
        </section>

        <section style={{ padding: 20, border: "1px solid #2a3b57", borderRadius: 16, background: "#0b1728" }}>
          {!selected || !quote ? (
            <div style={{ color: "#9fb0cf" }}>종목을 선택하면 실시간 데이터를 표시합니다.</div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {quoteError ? <div style={{ color: "#ff909d" }}>{quoteError}</div> : null}
              <div>
                <div style={{ color: "#8ea4cc", fontSize: 12 }}>COMPANY</div>
                <h2 style={{ margin: "4px 0" }}>{quote.company_name || selected.name_ko}</h2>
                <div style={{ color: "#9fb0cf" }}>{quote.symbol} · {selected.market}</div>
              </div>
              <div>Price: ₩{quote.price.toLocaleString()}</div>
              <div>Change: <span style={{ color: quote.change_pct >= 0 ? "#35d07f" : "#ff6b7a" }}>{quote.change_pct.toFixed(2)}%</span></div>
              <div>Volume: {quote.volume.toLocaleString()}</div>
              <div>Turnover: ₩{quote.turnover.toLocaleString()}</div>
              <div>Market state: {quote.market_state}</div>
              <div>Source: {quote.source}</div>
              <div>Cached at: {quote.cached_at ?? "-"}</div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
