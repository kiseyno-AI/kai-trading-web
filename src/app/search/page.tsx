"use client";

import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { PageIntro } from "@/components/ui/page-intro";
import { formatDisplayTimestamp } from "@/lib/format";

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
    <AppShell currentPath="/search" title="Search" eyebrow="Routes & Symbols">
      <div className="page-stack">
        <PageIntro
          eyebrow="Search"
          title={title}
          description="회사명 또는 종목코드로 검색하고, 선택한 종목의 실시간 데이터를 1초마다 갱신합니다."
          aside={<div className="search-intro-aside"><span className="pill neutral">1s polling</span><span className="pill neutral">KIS core proxy</span></div>}
        />

        <section className="search-page-grid">
          <section className="glass search-panel">
            <label className="search-page-input-wrap">
              <span>회사명 또는 종목코드</span>
              <div className="search-page-input-shell">
                <span className="search-page-input-icon">⌕</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="삼성전자 / 005930" />
              </div>
            </label>

            {searchError ? <div style={{ color: "#ff909d" }}>{searchError}</div> : null}

            <div className="search-results-head">
              <span>검색 결과</span>
              <span>{items.length} symbols</span>
            </div>

            <div className="search-results-list">
              {items.map((item) => (
                <button
                  key={item.symbol}
                  onClick={() => setSelected(item)}
                  className={`search-result-card${selected?.symbol === item.symbol ? " active" : ""}`}
                >
                  <div className="search-result-main">
                    <div>
                      <strong>{item.name_ko}</strong>
                      <p>{item.symbol}</p>
                    </div>
                    <span className="pill neutral">{item.market}</span>
                  </div>
                  <div className="search-result-meta">
                    <span>{item.standard_code}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="glass search-quote-panel">
            {!selected || !quote ? (
              <div style={{ color: "#9fb0cf" }}>종목을 선택하면 실시간 데이터를 표시합니다.</div>
            ) : (
              <div className="search-quote-stack">
                {quoteError ? <div style={{ color: "#ff909d" }}>{quoteError}</div> : null}
                <div>
                  <div className="eyebrow">Selected Symbol</div>
                  <h2 style={{ margin: "6px 0 8px" }}>{quote.company_name || selected.name_ko}</h2>
                  <div className="search-quote-subtitle">
                    <span>{quote.symbol}</span>
                    <span>·</span>
                    <span>{selected.market}</span>
                  </div>
                </div>

                <div className="search-quote-price">₩{quote.price.toLocaleString()}</div>
                <div className="search-quote-change">
                  <span className={quote.change_pct >= 0 ? "positive" : "negative"}>{quote.change_pct.toFixed(2)}%</span>
                  <span>{quote.change >= 0 ? "+" : ""}{quote.change.toLocaleString()}</span>
                </div>

                <div className="search-quote-badges">
                  <span className="pill neutral">{quote.market_state}</span>
                </div>

                <div className="metric-grid two-up">
                  <div className="metric-card compact glass-subtle">
                    <span>Volume</span>
                    <strong>{quote.volume.toLocaleString()}</strong>
                  </div>
                  <div className="metric-card compact glass-subtle">
                    <span>Turnover</span>
                    <strong>₩{quote.turnover.toLocaleString()}</strong>
                  </div>
                </div>

                <div className="muted-note">Updated: {formatDisplayTimestamp(quote.cached_at)}</div>
              </div>
            )}
          </section>
        </section>
      </div>
    </AppShell>
  );
}
