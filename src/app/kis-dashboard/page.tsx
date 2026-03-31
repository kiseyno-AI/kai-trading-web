type CoreMarketStatus = {
  state: string;
  is_open: boolean;
  server_time: string;
};

type CoreTrackedQuote = {
  symbol: string;
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

const shellStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #06101b 0%, #08111f 50%, #060d17 100%)",
  color: "#eef4ff",
  fontFamily: "Inter, system-ui, sans-serif",
  padding: 24,
};

async function getJson<T>(path: string): Promise<T> {
  const base = process.env.NEXT_PUBLIC_TRADING_API_BASE_URL || "http://127.0.0.1:8000";
  const response = await fetch(`${base}${path}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatCompactWon(value: number) {
  if (value >= 1_000_000_000) return `₩${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `₩${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `₩${(value / 1_000).toFixed(1)}K`;
  return `₩${value.toLocaleString()}`;
}

export default async function KisDashboardPage() {
  try {
    const [market, tracked, symbols] = await Promise.all([
      getJson<CoreMarketStatus>("/market/status"),
      getJson<CoreTrackedQuotesResponse>("/quotes/tracked"),
      getJson<CoreTrackedSymbolsResponse>("/scanner/tracked-symbols"),
    ]);

    const lead = tracked.items[0] ?? null;
    const averageMove = tracked.items.length
      ? tracked.items.reduce((sum, item) => sum + item.change_pct, 0) / tracked.items.length
      : 0;

    return (
      <main style={shellStyle}>
        <section style={{ marginBottom: 24, padding: 24, borderRadius: 20, border: "1px solid rgba(159,176,212,0.15)", background: "rgba(12,22,38,0.82)" }}>
          <p style={{ margin: 0, color: "#8ea4cc", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase" }}>Live KIS Dashboard</p>
          <h1 style={{ margin: "10px 0 8px", fontSize: 34 }}>Trading Dashboard Home</h1>
          <p style={{ margin: 0, color: "#a8b8d6" }}>Home dashboard route wired directly to trading-core and KIS-backed tracked quotes.</p>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, marginBottom: 24 }}>
          <article style={{ padding: 18, borderRadius: 18, border: "1px solid rgba(159,176,212,0.15)", background: "rgba(12,22,38,0.82)" }}>
            <div style={{ color: "#8ea4cc", fontSize: 12 }}>MARKET STATUS</div>
            <h2 style={{ margin: "10px 0" }}>{market.state}</h2>
            <p style={{ margin: 0, color: "#cbd7ee" }}>Open: {String(market.is_open)}</p>
            <p style={{ margin: "6px 0 0", color: "#9fb0cf" }}>{market.server_time}</p>
          </article>
          <article style={{ padding: 18, borderRadius: 18, border: "1px solid rgba(159,176,212,0.15)", background: "rgba(12,22,38,0.82)" }}>
            <div style={{ color: "#8ea4cc", fontSize: 12 }}>LEAD SYMBOL</div>
            <h2 style={{ margin: "10px 0" }}>{lead?.symbol ?? "N/A"}</h2>
            <p style={{ margin: 0, color: "#cbd7ee" }}>Price: ₩{lead?.price?.toLocaleString() ?? "-"}</p>
            <p style={{ margin: "6px 0 0", color: lead && lead.change_pct >= 0 ? "#35d07f" : "#ff6b7a" }}>{lead ? formatSignedPercent(lead.change_pct) : "-"}</p>
          </article>
          <article style={{ padding: 18, borderRadius: 18, border: "1px solid rgba(159,176,212,0.15)", background: "rgba(12,22,38,0.82)" }}>
            <div style={{ color: "#8ea4cc", fontSize: 12 }}>TRACKED SET</div>
            <h2 style={{ margin: "10px 0" }}>{symbols.count}</h2>
            <p style={{ margin: 0, color: "#cbd7ee" }}>{symbols.tracked_symbols.join(", ")}</p>
            <p style={{ margin: "6px 0 0", color: "#9fb0cf" }}>As of {tracked.as_of}</p>
          </article>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
          <article style={{ padding: 20, borderRadius: 18, border: "1px solid rgba(159,176,212,0.15)", background: "rgba(12,22,38,0.82)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 16 }}>
              <div>
                <p style={{ margin: 0, color: "#8ea4cc", fontSize: 12 }}>KIS WATCHLIST</p>
                <h2 style={{ margin: "8px 0 0" }}>Tracked Quotes</h2>
              </div>
              <strong style={{ color: averageMove >= 0 ? "#35d07f" : "#ff6b7a" }}>{formatSignedPercent(averageMove)}</strong>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {tracked.items.map((item) => (
                <div key={item.symbol} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: 14, borderRadius: 14, border: "1px solid rgba(159,176,212,0.10)", background: "rgba(255,255,255,0.03)" }}>
                  <div>
                    <strong>{item.symbol}</strong>
                    <div style={{ color: "#9fb0cf", marginTop: 6 }}>{item.is_live ? "Live KIS quote" : item.fallback ? "Cached fallback" : `State ${item.market_state}`}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div>₩{item.price.toLocaleString()}</div>
                    <div style={{ marginTop: 6, color: item.change_pct >= 0 ? "#35d07f" : "#ff6b7a" }}>{formatSignedPercent(item.change_pct)}</div>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article style={{ padding: 20, borderRadius: 18, border: "1px solid rgba(159,176,212,0.15)", background: "rgba(12,22,38,0.82)" }}>
            <p style={{ margin: 0, color: "#8ea4cc", fontSize: 12 }}>DESK INSIGHT</p>
            <h2 style={{ margin: "10px 0 14px" }}>Core Integration Summary</h2>
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <span style={{ color: "#9fb0cf" }}>Source</span>
                <div>{lead?.source ?? "api"}</div>
              </div>
              <div style={{ paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <span style={{ color: "#9fb0cf" }}>Turnover</span>
                <div>{formatCompactWon(tracked.items.reduce((sum, item) => sum + item.turnover, 0))}</div>
              </div>
              <div style={{ paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <span style={{ color: "#9fb0cf" }}>Lead change</span>
                <div style={{ color: lead && lead.change_pct >= 0 ? "#35d07f" : "#ff6b7a" }}>{lead ? formatSignedPercent(lead.change_pct) : "-"}</div>
              </div>
              <div>
                <span style={{ color: "#9fb0cf" }}>Tracked symbols</span>
                <div>{symbols.tracked_symbols.join(", ")}</div>
              </div>
            </div>
          </article>
        </section>
      </main>
    );
  } catch (error) {
    return <main style={shellStyle}>KIS DASHBOARD ERROR: {error instanceof Error ? error.message : String(error)}</main>;
  }
}
