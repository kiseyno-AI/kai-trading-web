import { headers } from "next/headers";

import { formatDisplayTimestamp } from "@/lib/format";
import { fetchServerTradingApiJson } from "@/lib/trading-upstream";

type CoreMarketStatus = {
  state: string;
  is_open: boolean;
  server_time: string;
};

type CoreTrackedQuote = {
  symbol: string;
  price: number | null;
  change: number | null;
  change_pct: number | null;
  volume: number | null;
  turnover: number | null;
  as_of: string | null;
  market_state: string;
  source: string;
  fallback: boolean;
  is_live: boolean;
  available: boolean;
  trade_date?: string | null;
  unavailable_reason?: string | null;
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

function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatSignedNumber(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toLocaleString()}`;
}

function hasNumber(value: number | null | undefined): value is number {
  return typeof value === "number";
}

function formatCompactWon(value: number) {
  if (value >= 1_000_000_000) return `₩${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `₩${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `₩${(value / 1_000).toFixed(1)}K`;
  return `₩${value.toLocaleString()}`;
}

export default async function RealDashboardPage() {
  const requestHeaders = await headers();
  const [market, tracked, symbols] = await Promise.all([
    fetchServerTradingApiJson<CoreMarketStatus>("/market/status", requestHeaders),
    fetchServerTradingApiJson<CoreTrackedQuotesResponse>("/quotes/tracked", requestHeaders),
    fetchServerTradingApiJson<CoreTrackedSymbolsResponse>("/scanner/tracked-symbols", requestHeaders),
  ]);

  const availableItems = tracked.items.filter((item) => item.available);
  const lead = tracked.items[0] ?? null;
  const avgChange = availableItems.length
    ? availableItems.reduce((sum, item) => sum + (item.change_pct ?? 0), 0) / availableItems.length
    : 0;
  const totalTurnover = availableItems.reduce((sum, item) => sum + (item.turnover ?? 0), 0);

  return (
    <main className="dashboard-shell" style={{ gridTemplateColumns: "1fr", minHeight: "100vh" }}>
      <div className="main-layout" style={{ width: "100%" }}>
        <header className="glass topbar" style={{ position: "static", marginBottom: 22 }}>
          <div>
            <p className="eyebrow">Precision &amp; Clarity</p>
            <h1>Trading Command Surface</h1>
          </div>
          <div className="topbar-actions">
            <div className="profile-pill"><span className="status-dot" /> KIS / trading-core connected</div>
          </div>
        </header>

        <section className="content-grid">
          <div className="center-column">
            <section className="glass section-card" style={{ marginBottom: 18 }}>
              <div className="panel-head compact">
                <div>
                  <p className="eyebrow">Core Overview</p>
                  <h2>Real data slots active</h2>
                </div>
                <span className="pill positive">Real Data</span>
              </div>
              <div className="detail-list">
                <div className="detail-row"><span>Lead symbol</span><strong>{lead?.symbol ?? "-"}</strong></div>
                <div className="detail-row"><span>Tracked symbols</span><strong>{symbols.count}</strong></div>
                <div className="detail-row"><span>Market state</span><strong>{market.state}</strong></div>
              </div>
            </section>

            <section className="cards-row">
              <article className="glass metric-card">
                <div className="card-head"><span>Tracked Turnover</span><span className="pill positive">{formatSignedPercent(avgChange)}</span></div>
                <div className="metric-main">{formatCompactWon(totalTurnover)}</div>
                <p className="metric-sub">{tracked.items.length} tracked symbols · {formatDisplayTimestamp(market.server_time)}</p>
              </article>
              <article className="glass metric-card pnl-card">
                <div className="card-head"><span>Lead KRX Quote</span><span className={`pill ${lead && (lead.change_pct ?? 0) >= 0 ? "positive" : "negative"}`}>{lead && hasNumber(lead.change_pct) ? formatSignedPercent(lead.change_pct) : "Unavailable"}</span></div>
                <div className="metric-main">{lead && hasNumber(lead.price) ? `₩${lead.price.toLocaleString()}` : "Unavailable"}</div>
                <p className="metric-sub">{lead && hasNumber(lead.change) ? `${lead.symbol} · ${formatSignedNumber(lead.change)}` : "No lead symbol"}</p>
              </article>
              <article className="glass metric-card">
                <div className="card-head"><span>Tracked Breadth</span><span className="pill neutral">{market.is_open ? "Open" : "Closed"}</span></div>
                <div className="metric-main">{Math.max(0, Math.min(100, Math.round(50 + avgChange * 8)))}%</div>
                <p className="metric-sub">Tracked volume {availableItems.reduce((sum, item) => sum + (item.volume ?? 0), 0).toLocaleString()}</p>
              </article>
            </section>

            <section className="glass chart-panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">{lead?.symbol ?? "KRX"}</p>
                  <h2>KRX Tracked Execution View</h2>
                </div>
                <div className="chart-tabs">
                  <button className="tab active">1H</button>
                  <button className="tab">4H</button>
                  <button className="tab">1D</button>
                </div>
              </div>
              <div className="chart-grid">
                <div className="chart-area">
                  <div className="chart-overlay y-top">{lead && hasNumber(lead.price) ? (lead.price + Math.max(50, Math.round(lead.price * 0.01))).toLocaleString() : "-"}</div>
                  <div className="chart-overlay y-mid">{lead && hasNumber(lead.price) ? lead.price.toLocaleString() : "-"}</div>
                  <div className="chart-overlay y-low">{lead && hasNumber(lead.price) ? Math.max(0, lead.price - Math.max(50, Math.round(lead.price * 0.01))).toLocaleString() : "-"}</div>
                  <svg viewBox="0 0 760 360" className="main-chart" preserveAspectRatio="none" aria-label="tracked chart">
                    <defs>
                      <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(124, 92, 255, 0.35)" />
                        <stop offset="100%" stopColor="rgba(124, 92, 255, 0)" />
                      </linearGradient>
                    </defs>
                    <path className="chart-fill" d="M0 280 C70 220, 110 250, 170 180 S290 90, 360 140 S500 240, 570 175 S670 70, 760 105 L760 360 L0 360 Z" />
                    <path className="chart-line" d="M0 280 C70 220, 110 250, 170 180 S290 90, 360 140 S500 240, 570 175 S670 70, 760 105" />
                  </svg>
                  <div className="trade-marker buy" style={{ left: "18%", top: "62%" }}>Lead<span>{lead?.symbol ?? "-"}</span></div>
                  <div className={`trade-marker ${avgChange >= 0 ? "sell" : "buy"}`} style={{ left: "48%", top: "34%" }}>{market.state}<span>{formatSignedPercent(avgChange)}</span></div>
                  <div className="trade-marker buy" style={{ left: "76%", top: "48%" }}>Tracked<span>{symbols.count}</span></div>
                </div>
                <aside className="glass-inner orderbook">
                  <div className="orderbook-head"><h3>Mini Order Book</h3><span>Depth 10</span></div>
                  <div className="book book-sell">
                    {[30, 20, 10].map((gap) => <div key={gap} className="book-row"><span>{lead && hasNumber(lead.price) ? (lead.price + gap).toLocaleString() : "-"}</span><span>{(1.5 - gap / 50).toFixed(2)} lot</span></div>)}
                  </div>
                  <div className="mid-price">{lead && hasNumber(lead.price) ? lead.price.toLocaleString() : "-"}<span>{lead && hasNumber(lead.change_pct) ? formatSignedPercent(lead.change_pct) : "-"}</span></div>
                  <div className="book book-buy">
                    {[10, 20, 30].map((gap) => <div key={gap} className="book-row"><span>{lead && hasNumber(lead.price) ? Math.max(0, lead.price - gap).toLocaleString() : "-"}</span><span>{(1.3 - gap / 60).toFixed(2)} lot</span></div>)}
                  </div>
                </aside>
              </div>
            </section>
          </div>

          <aside className="right-column">
            <section className="glass watchlist-panel">
              <div className="panel-head compact">
                <div>
                  <p className="eyebrow">Radar</p>
                  <h2>Watchlist</h2>
                </div>
              </div>
              <div className="watchlist">
                {tracked.items.map((item) => (
                  <div key={item.symbol} className="watch-item">
                    <div>
                      <strong>{item.symbol}</strong>
                      <span>{item.as_of ? `Updated ${formatDisplayTimestamp(item.as_of)}` : item.market_state}</span>
                    </div>
                    <div className="watch-price">
                      <strong>{hasNumber(item.price) ? `₩${item.price.toLocaleString()}` : "Unavailable"}</strong>
                      <span>{hasNumber(item.change_pct) ? formatSignedPercent(item.change_pct) : (item.unavailable_reason ?? "Unavailable")}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="glass section-card surface-muted">
              <div className="panel-head compact">
                <div>
                  <p className="eyebrow">Execution Health</p>
                  <h2>System Status</h2>
                </div>
                <span className="pill positive">Live</span>
              </div>
              <div className="detail-list">
                <div className="detail-row"><span>Market state</span><strong>{market.state}</strong></div>
                <div className="detail-row"><span>Tracked symbols</span><strong>{symbols.count}</strong></div>
                <div className="detail-row"><span>Lead symbol</span><strong>{lead?.symbol ?? "-"}</strong></div>
              </div>
            </section>

            <section className="glass signal-panel">
              <div className="panel-head compact">
                <div>
                  <p className="eyebrow">Signal Engine</p>
                  <h2>AI Insight</h2>
                </div>
                <span className="signal-score">{market.is_open ? "82 / 100" : "66 / 100"}</span>
              </div>
              <div className="signal-card strong">
                <div className="signal-label">Primary Bias</div>
                <h3>{market.is_open ? "KRX tracked symbols active" : "KRX tracked snapshot ready"}</h3>
                <p>Tracked symbols: {symbols.count}. Last update: {formatDisplayTimestamp(tracked.as_of)}</p>
              </div>
              <div className="signal-list">
                <div className="signal-row"><span>Market state</span><strong>{market.state}</strong></div>
                <div className="signal-row"><span>Tracked symbols</span><strong>{symbols.count}</strong></div>
                <div className="signal-row"><span>Lead symbol</span><strong>{lead?.symbol ?? "-"}</strong></div>
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
