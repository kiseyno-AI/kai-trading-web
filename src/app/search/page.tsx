"use client";

import { useEffect, useMemo, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { PageIntro } from "@/components/ui/page-intro";
import { formatDisplayTimestamp, formatTurnover } from "@/lib/format";

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
          aside={
            <div className="search-intro-aside">
              <span className="pill neutral">1s polling</span>
              <span className="pill neutral">KIS core proxy</span>
              <span className="pill info">Search workspace</span>
            </div>
          }
        />

        <section className="search-page-grid">
          <section className="glass search-panel">
            <div className="search-panel-header">
              <div>
                <p className="eyebrow">Master Lookup</p>
                <h2>Search the live symbol master</h2>
                <p className="search-panel-copy">
                  Query the same trading-core backed symbol search used by the dashboard and select a name to keep its
                  quote pinned on the right.
                </p>
              </div>
              <div className="search-results-meta">
                <span className="pill neutral">20 result limit</span>
                <span className="pill neutral">No fake data</span>
              </div>
            </div>

            <label className="search-page-input-wrap">
              <span>회사명 또는 종목코드</span>
              <div className="search-page-input-shell">
                <span className="search-page-input-icon">SR</span>
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="삼성전자 / 005930" />
              </div>
            </label>

            {searchError ? <div className="search-feedback error">{searchError}</div> : null}

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

              {items.length === 0 && !searchError ? (
                <div className="search-empty-state">
                  <strong>Start typing to search the symbol master.</strong>
                  <p>Results appear immediately from the trading-core search endpoint and stay selectable for quote polling.</p>
                </div>
              ) : null}
            </div>
          </section>

          <section className="glass search-quote-panel">
            {!selected || !quote ? (
              <div className="search-empty-state">
                <strong>실시간 패널이 비어 있습니다.</strong>
                <p>왼쪽에서 종목을 선택하면 1초 주기로 갱신되는 현재가와 거래 지표를 표시합니다.</p>
              </div>
            ) : (
              <div className="search-quote-stack">
                {quoteError ? <div className="search-feedback error">{quoteError}</div> : null}

                <div className="search-detail-header">
                  <div>
                    <p className="eyebrow">Selected Symbol</p>
                    <h2>{quote.company_name || selected.name_ko}</h2>
                    <div className="search-quote-subtitle">
                      <span>{quote.symbol}</span>
                      <span>·</span>
                      <span>{selected.market}</span>
                      <span>·</span>
                      <span>{selected.standard_code}</span>
                    </div>
                  </div>
                  <div className="search-detail-meta">
                    <span className="pill neutral">{quote.market_state}</span>
                    <span className="pill neutral">{quote.is_live ? "live" : "cached"}</span>
                  </div>
                </div>

                <div className="search-quote-hero">
                  <div>
                    <div className="search-quote-label">Last Price</div>
                    <div className="search-quote-price">₩{quote.price.toLocaleString()}</div>
                    <div className="search-quote-change">
                      <span className={quote.change_pct >= 0 ? "positive" : "negative"}>
                        {quote.change_pct >= 0 ? "+" : ""}
                        {quote.change_pct.toFixed(2)}%
                      </span>
                      <span>
                        {quote.change >= 0 ? "+" : ""}
                        {quote.change.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="search-quote-status">
                    <div className="search-quote-status-card">
                      <span>Feed Source</span>
                      <strong>{quote.source}</strong>
                    </div>
                    <div className="search-quote-status-card">
                      <span>Update State</span>
                      <strong>{quote.is_live ? "Live" : "Cached"}</strong>
                    </div>
                    <div className="search-quote-status-card">
                      <span>Market</span>
                      <strong>{selected.market}</strong>
                    </div>
                  </div>
                </div>

                <div className="search-quote-metrics">
                  <div className="search-quote-metric">
                    <span>Volume</span>
                    <strong>{quote.volume.toLocaleString()}</strong>
                  </div>
                  <div className="search-quote-metric">
                    <span>Turnover</span>
                    <strong>{formatTurnover(quote.turnover)}</strong>
                  </div>
                  <div className="search-quote-metric">
                    <span>Fallback</span>
                    <strong>{quote.fallback ? "Yes" : "No"}</strong>
                  </div>
                  <div className="search-quote-metric">
                    <span>Cached At</span>
                    <strong>{formatDisplayTimestamp(quote.cached_at)}</strong>
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
