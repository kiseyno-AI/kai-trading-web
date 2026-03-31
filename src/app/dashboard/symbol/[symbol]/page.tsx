"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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

export default function SymbolDetailPage() {
  const params = useParams<{ symbol: string }>();
  const searchParams = useSearchParams();
  const symbol = useMemo(() => decodeURIComponent(params.symbol), [params.symbol]);
  const [meta, setMeta] = useState<SymbolSearchItem | null>(() => {
    const name = searchParams.get("name");
    const market = searchParams.get("market");
    const standardCode = searchParams.get("standardCode");

    if (!name && !market && !standardCode) {
      return null;
    }

    return {
      symbol,
      name_ko: name ?? symbol,
      market: market ?? "-",
      standard_code: standardCode ?? "-",
    };
  });
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadMeta = async () => {
      if (meta) return;

      try {
        const data = await getJson<SymbolSearchResponse>(`/api/trading/symbols/search?q=${encodeURIComponent(symbol)}&limit=20`);
        if (!active) return;
        const exactMatch = data.items.find((item) => item.symbol === symbol) ?? data.items[0] ?? null;
        setMeta(exactMatch);
        setMetaError(exactMatch ? null : "Master symbol information was not found for this code.");
      } catch (metaLoadError) {
        console.error("Symbol metadata load failed", metaLoadError);
        if (!active) return;
        setMetaError("Unable to load master symbol information.");
      }
    };

    loadMeta();

    return () => {
      active = false;
    };
  }, [meta, symbol]);

  useEffect(() => {
    let active = true;

    const loadQuote = async () => {
      try {
        const data = await getJson<QuoteResponse>(`/api/trading/quotes/${encodeURIComponent(symbol)}`);
        if (!active) return;
        setQuote(data);
        setQuoteError(null);
      } catch (quoteLoadError) {
        console.error("Symbol quote load failed", quoteLoadError);
        if (!active) return;
        setQuoteError("Unable to load symbol quote details from trading-core.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadQuote();
    const timer = window.setInterval(loadQuote, 1000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [symbol]);

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif", background: "#07111f", color: "#eef4ff", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, color: "#8ea4cc", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>SYMBOL DETAIL WINDOW</p>
          <h1 style={{ margin: "8px 0 6px", fontSize: 30 }}>{quote?.company_name || meta?.name_ko || symbol}</h1>
          <p style={{ color: "#9fb0cf" }}>
            {symbol}
            {meta?.market ? ` · ${meta.market}` : ""}
            {meta?.standard_code ? ` · ${meta.standard_code}` : ""}
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => window.close()}
            style={{ minHeight: 44, padding: "0 16px", borderRadius: 12, border: "1px solid #2a3b57", background: "#0b1728", color: "#eef4ff" }}
          >
            Close window
          </button>
          <Link
            href="/dashboard"
            style={{ display: "inline-flex", alignItems: "center", minHeight: 44, padding: "0 16px", borderRadius: 12, border: "1px solid #2a3b57", background: "#0b1728", color: "#eef4ff" }}
          >
            Back to dashboard
          </Link>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16, marginBottom: 24 }}>
        <section style={{ padding: 20, border: "1px solid #2a3b57", borderRadius: 16, background: "#0b1728" }}>
          <div style={{ color: "#8ea4cc", fontSize: 12, marginBottom: 8 }}>LAST PRICE</div>
          <div style={{ fontSize: 34, fontWeight: 700 }}>{loading && !quote ? "Loading…" : `₩${quote?.price.toLocaleString() ?? "-"}`}</div>
          <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ color: (quote?.change_pct ?? 0) >= 0 ? "#35d07f" : "#ff6b7a", fontSize: 18, fontWeight: 600 }}>
              {quote ? `${quote.change_pct >= 0 ? "+" : ""}${quote.change_pct.toFixed(2)}%` : "-"}
            </span>
            <span style={{ color: "#9fb0cf" }}>
              {quote ? `${quote.change >= 0 ? "+" : ""}${quote.change.toLocaleString()}` : "-"}
            </span>
          </div>
        </section>

        <section style={{ padding: 20, border: "1px solid #2a3b57", borderRadius: 16, background: "#0b1728" }}>
          <div style={{ color: "#8ea4cc", fontSize: 12, marginBottom: 8 }}>QUOTE DETAILS</div>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span style={{ color: "#9fb0cf" }}>Market state</span><strong>{quote?.market_state ?? "-"}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span style={{ color: "#9fb0cf" }}>Updated</span><strong>{formatDisplayTimestamp(quote?.cached_at)}</strong></div>
          </div>
        </section>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 16 }}>
        <section style={{ padding: 20, border: "1px solid #2a3b57", borderRadius: 16, background: "#0b1728" }}>
          <h2 style={{ marginBottom: 14 }}>Master Symbol Information</h2>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span style={{ color: "#9fb0cf" }}>Company</span><strong>{meta?.name_ko ?? quote?.company_name ?? "-"}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span style={{ color: "#9fb0cf" }}>Symbol</span><strong>{symbol}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span style={{ color: "#9fb0cf" }}>Market</span><strong>{meta?.market ?? "-"}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span style={{ color: "#9fb0cf" }}>Standard code</span><strong>{meta?.standard_code ?? "-"}</strong></div>
          </div>
          {metaError ? <p style={{ color: "#ff909d", marginTop: 14 }}>{metaError}</p> : null}
        </section>

        <section style={{ padding: 20, border: "1px solid #2a3b57", borderRadius: 16, background: "#0b1728" }}>
          <h2 style={{ marginBottom: 14 }}>Market Activity</h2>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span style={{ color: "#9fb0cf" }}>Volume</span><strong>{quote?.volume.toLocaleString() ?? "-"}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span style={{ color: "#9fb0cf" }}>Turnover</span><strong>{quote ? `₩${quote.turnover.toLocaleString()}` : "-"}</strong></div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}><span style={{ color: "#9fb0cf" }}>Fallback</span><strong>{quote ? String(quote.fallback) : "-"}</strong></div>
          </div>
          {quoteError ? <p style={{ color: "#ff909d", marginTop: 14 }}>{quoteError}</p> : null}
        </section>
      </div>
    </main>
  );
}
