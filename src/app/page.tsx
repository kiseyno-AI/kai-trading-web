"use client";

import { useEffect, useMemo, useState } from "react";

type NavItem = { id: string; label: string; icon: string };
type SearchSuggestion = { label: string; type: string };
type MetricCard = {
  id: string;
  title: string;
  value: string;
  delta: string;
  tone?: "positive" | "neutral";
  subtitle?: string;
  sparkline?: number[];
  donut?: { value: number; summary: string };
};
type TradeMarker = { type: "buy" | "sell"; label: string; value: string; left: string; top: string };
type OrderBookRow = { price: string; size: string };
type BotAction = "start" | "pause" | "hedge" | "stop";
type WatchItem = { symbol: string; context: string; price: number; change: number };

type DashboardData = {
  nav: NavItem[];
  searchSuggestions: SearchSuggestion[];
  metrics: MetricCard[];
  chart: {
    symbol: string;
    title: string;
    tabs: string[];
    overlays: { top: string; mid: string; low: string };
    tradeMarkers: TradeMarker[];
    orderBook: { sell: OrderBookRow[]; midPrice: string; midChange: string; buy: OrderBookRow[] };
  };
  bots: { title: string; idleLabel: string; actions: { id: BotAction; label: string }[] };
  watchlist: WatchItem[];
  insight: {
    score: string;
    label: string;
    title: string;
    description: string;
    rows: { label: string; value: string }[];
  };
};

const dashboardData: DashboardData = {
  nav: [
    { id: "dashboard", label: "Dashboard", icon: "◫" },
    { id: "markets", label: "Markets", icon: "◌" },
    { id: "bots", label: "Bots", icon: "◎" },
    { id: "analytics", label: "Analytics", icon: "◭" },
    { id: "settings", label: "Settings", icon: "⚙" },
  ],
  searchSuggestions: [
    { label: "BTC/USDT · Perpetual", type: "Market" },
    { label: "ETH/KRW · Spot", type: "Market" },
    { label: "Mean Reversion Bot", type: "Strategy" },
    { label: "Momentum Breakout Engine", type: "Strategy" },
    { label: "SOL/USDT · Watchlist", type: "Market" },
  ],
  metrics: [
    {
      id: "balance",
      title: "Total Balance",
      value: "$4,284,390",
      delta: "+2.48%",
      tone: "positive",
      subtitle: "Across spot, futures, and bot allocations",
    },
    {
      id: "pnl",
      title: "Live PNL",
      value: "+$182,440",
      delta: "Realtime",
      tone: "positive",
      subtitle: "Session return +4.21%",
      sparkline: [58, 49, 52, 36, 39, 25, 34, 18, 23, 11, 15],
    },
    {
      id: "winrate",
      title: "Win Rate",
      value: "78%",
      delta: "30D",
      tone: "neutral",
      donut: { value: 78, summary: "214 wins · 101 losses" },
    },
  ],
  chart: {
    symbol: "BTC/USDT",
    title: "Execution Chart",
    tabs: ["1H", "4H", "1D"],
    overlays: { top: "87,880", mid: "87,430", low: "86,980" },
    tradeMarkers: [
      { type: "buy", label: "Buy", value: "87,140", left: "19%", top: "64%" },
      { type: "sell", label: "Sell", value: "87,690", left: "43%", top: "26%" },
      { type: "buy", label: "Buy", value: "87,310", left: "72%", top: "48%" },
    ],
    orderBook: {
      sell: [
        { price: "87,688", size: "1.82 BTC" },
        { price: "87,676", size: "1.14 BTC" },
        { price: "87,661", size: "0.92 BTC" },
      ],
      midPrice: "87,430.18",
      midChange: "+1.8%",
      buy: [
        { price: "87,418", size: "2.03 BTC" },
        { price: "87,401", size: "1.67 BTC" },
        { price: "87,390", size: "1.21 BTC" },
      ],
    },
  },
  bots: {
    title: "Bot Controls",
    idleLabel: "Bot idle · Awaiting command",
    actions: [
      { id: "start", label: "Start Bot" },
      { id: "pause", label: "Pause" },
      { id: "hedge", label: "Hedge" },
      { id: "stop", label: "Stop" },
    ],
  },
  watchlist: [
    { symbol: "BTC/USDT", context: "Momentum intact", price: 87430, change: 1.82 },
    { symbol: "ETH/USDT", context: "Testing VWAP", price: 4884, change: -0.44 },
    { symbol: "SOL/USDT", context: "Breakout setup", price: 182.74, change: 3.15 },
    { symbol: "LINK/USDT", context: "Range compression", price: 29.18, change: 0.62 },
  ],
  insight: {
    score: "87 / 100",
    label: "Primary Bias",
    title: "Long continuation with guarded leverage",
    description:
      "Order-flow delta remains positive while short-term funding stays manageable. Watch 87,180 as the invalidation shelf.",
    rows: [
      { label: "Confidence", value: "High" },
      { label: "Volatility", value: "Elevated" },
      { label: "Suggested action", value: "Scale in slowly" },
    ],
  },
};

const botStatusMap: Record<BotAction, string> = {
  start: "Bot running · Momentum strategy engaged",
  pause: "Bot paused · Monitoring only",
  hedge: "Hedge active · Delta exposure reduced",
  stop: "Bot stopped · Manual review required",
};

const formatPrice = (price: number) =>
  price.toLocaleString(undefined, {
    minimumFractionDigits: price >= 1000 ? 0 : 2,
    maximumFractionDigits: price >= 1000 ? 0 : 2,
  });

const formatChange = (change: number) => `${change >= 0 ? "+" : ""}${change.toFixed(2)}%`;

const Sparkline = ({ points }: { points: number[] }) => {
  const line = points.map((value, index) => `${index * 22},${value}`).join(" ");
  const area = `${line} 220,70 0,70`;
  return (
    <svg className="sparkline" viewBox="0 0 220 70" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(53, 208, 127, 0.45)" />
          <stop offset="100%" stopColor="rgba(53, 208, 127, 0)" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#sparkFill)" />
      <polyline points={line} />
    </svg>
  );
};

const Donut = ({ value }: { value: number }) => {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg viewBox="0 0 120 120" className="donut-chart" aria-label={`Win rate ${value} percent`}>
      <circle cx="60" cy="60" r={radius} className="donut-track" />
      <circle
        cx="60"
        cy="60"
        r={radius}
        className="donut-value"
        style={{ strokeDasharray: circumference, strokeDashoffset: offset }}
      />
    </svg>
  );
};

export default function Home() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [notificationsOn, setNotificationsOn] = useState(true);
  const [activeBotAction, setActiveBotAction] = useState<BotAction | null>(null);
  const [activeTab, setActiveTab] = useState(dashboardData.chart.tabs[0]);
  const [watchlist, setWatchlist] = useState(dashboardData.watchlist);
  const [flashSymbol, setFlashSymbol] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isOpenShortcut = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
      if (isOpenShortcut) {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setMobileNavOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setWatchlist((current) => {
        const next = [...current];
        const index = Math.floor(Math.random() * next.length);
        const item = next[index];
        const drift = (Math.random() - 0.48) * item.price * 0.004;
        const price = Math.max(1, item.price + drift);
        const change = Number(((Math.random() - 0.45) * 4.8).toFixed(2));
        next[index] = { ...item, price, change };
        setFlashSymbol(item.symbol);
        window.setTimeout(() => setFlashSymbol((value) => (value === item.symbol ? null : value)), 650);
        return next;
      });
    }, 1800);

    return () => window.clearInterval(timer);
  }, []);

  const filteredSuggestions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return dashboardData.searchSuggestions;
    return dashboardData.searchSuggestions.filter(
      (item) => item.label.toLowerCase().includes(normalized) || item.type.toLowerCase().includes(normalized),
    );
  }, [query]);

  const botStatus = activeBotAction ? botStatusMap[activeBotAction] : dashboardData.bots.idleLabel;

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand-mark">PX</div>
        <nav className="side-nav">
          {dashboardData.nav.slice(0, 4).map((item, index) => (
            <button key={item.id} className={`nav-icon ${index === 0 ? "active" : ""}`} aria-label={item.label}>
              {item.icon}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="nav-icon" aria-label="Settings">
            ⚙
          </button>
        </div>
      </aside>

      <main className="main-layout">
        <header className="glass topbar">
          <div>
            <p className="eyebrow">Precision &amp; Clarity</p>
            <h1>Trading Command Surface</h1>
          </div>

          <button className="mobile-menu-button" onClick={() => setMobileNavOpen((value) => !value)} aria-label="Open navigation">
            ☰
          </button>

          <div className="topbar-actions">
            <div className="search-wrap">
              <button
                id="searchToggle"
                className="search-button"
                aria-expanded={searchOpen}
                aria-controls="searchMenu"
                onClick={() => setSearchOpen((value) => !value)}
              >
                <span>{query ? query : "Search markets, bots, signals"}</span>
                <kbd>⌘K</kbd>
              </button>

              <div id="searchMenu" className={`search-menu ${searchOpen ? "" : "hidden"}`}>
                <label className="search-input-wrap">
                  <span>Quick find</span>
                  <input
                    id="quickSearch"
                    type="text"
                    placeholder="BTC/USDT, Delta Bot, momentum signal..."
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    autoFocus={searchOpen}
                  />
                </label>
                <div className="search-suggestions">
                  {filteredSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.label}
                      className="suggestion"
                      onClick={() => {
                        setQuery(suggestion.label);
                        setSearchOpen(false);
                      }}
                    >
                      <span>{suggestion.label}</span>
                      <em>{suggestion.type}</em>
                    </button>
                  ))}
                  {filteredSuggestions.length === 0 ? <div className="suggestion empty">No matches found</div> : null}
                </div>
              </div>
            </div>

            <button
              id="notifToggle"
              className={`icon-pill ${notificationsOn ? "" : "muted-toggle"}`}
              aria-pressed={notificationsOn}
              onClick={() => setNotificationsOn((value) => !value)}
            >
              {notificationsOn ? "Notifications On" : "Notifications Off"}
            </button>

            <div className="profile-pill">
              <span className="status-dot" />
              Alpha Desk
            </div>
          </div>
        </header>

        <div className={`mobile-nav glass ${mobileNavOpen ? "open" : ""}`}>
          {dashboardData.nav.map((item, index) => (
            <button key={item.id} className={`mobile-nav-item ${index === 0 ? "active" : ""}`}>
              <span>{item.icon}</span>
              <em>{item.label}</em>
            </button>
          ))}
        </div>

        <section className="content-grid">
          <div className="center-column">
            <section className="cards-row">
              {dashboardData.metrics.map((metric) => (
                <article key={metric.id} className={`glass metric-card ${metric.id === "pnl" ? "pnl-card" : ""}`}>
                  <div className="card-head">
                    <span>{metric.title}</span>
                    <span className={`pill ${metric.tone ?? "neutral"}`}>{metric.delta}</span>
                  </div>
                  <div className="metric-main">{metric.value}</div>
                  {metric.subtitle ? <p className="metric-sub">{metric.subtitle}</p> : null}
                  {metric.sparkline ? <Sparkline points={metric.sparkline} /> : null}
                  {metric.donut ? (
                    <div className="donut-wrap">
                      <Donut value={metric.donut.value} />
                      <div>
                        <div className="metric-main">{metric.value}</div>
                        <p className="metric-sub">{metric.donut.summary}</p>
                      </div>
                    </div>
                  ) : null}
                </article>
              ))}
            </section>

            <section className="glass chart-panel">
              <div className="panel-head">
                <div>
                  <p className="eyebrow">{dashboardData.chart.symbol}</p>
                  <h2>{dashboardData.chart.title}</h2>
                </div>
                <div className="chart-tabs">
                  {dashboardData.chart.tabs.map((tab) => (
                    <button key={tab} className={`tab ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)}>
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              <div className="chart-grid">
                <div className="chart-area">
                  <div className="chart-overlay y-top">{dashboardData.chart.overlays.top}</div>
                  <div className="chart-overlay y-mid">{dashboardData.chart.overlays.mid}</div>
                  <div className="chart-overlay y-low">{dashboardData.chart.overlays.low}</div>
                  <svg viewBox="0 0 760 360" className="main-chart" preserveAspectRatio="none" aria-label={`${dashboardData.chart.symbol} ${activeTab} chart`}>
                    <defs>
                      <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgba(124, 92, 255, 0.35)" />
                        <stop offset="100%" stopColor="rgba(124, 92, 255, 0)" />
                      </linearGradient>
                    </defs>
                    <path className="chart-fill" d="M0 280 C70 220, 110 250, 170 180 S290 90, 360 140 S500 240, 570 175 S670 70, 760 105 L760 360 L0 360 Z" />
                    <path className="chart-line" d="M0 280 C70 220, 110 250, 170 180 S290 90, 360 140 S500 240, 570 175 S670 70, 760 105" />
                  </svg>

                  {dashboardData.chart.tradeMarkers.map((marker) => (
                    <div key={`${marker.type}-${marker.left}-${marker.top}`} className={`trade-marker ${marker.type}`} style={{ left: marker.left, top: marker.top }}>
                      {marker.label}
                      <span>{marker.value}</span>
                    </div>
                  ))}
                </div>

                <aside className="glass-inner orderbook">
                  <div className="orderbook-head">
                    <h3>Mini Order Book</h3>
                    <span>Depth 10</span>
                  </div>

                  <div className="book book-sell">
                    {dashboardData.chart.orderBook.sell.map((row) => (
                      <div key={`${row.price}-${row.size}`} className="book-row">
                        <span>{row.price}</span>
                        <span>{row.size}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mid-price">
                    {dashboardData.chart.orderBook.midPrice}
                    <span>{dashboardData.chart.orderBook.midChange}</span>
                  </div>

                  <div className="book book-buy">
                    {dashboardData.chart.orderBook.buy.map((row) => (
                      <div key={`${row.price}-${row.size}`} className="book-row">
                        <span>{row.price}</span>
                        <span>{row.size}</span>
                      </div>
                    ))}
                  </div>
                </aside>
              </div>
            </section>

            <section className="glass bot-controls">
              <div className="panel-head compact">
                <div>
                  <p className="eyebrow">Automation</p>
                  <h2>{dashboardData.bots.title}</h2>
                </div>
                <div id="botStatus" className={`bot-status ${activeBotAction ?? "idle"}`}>
                  {botStatus}
                </div>
              </div>
              <div className="bot-buttons">
                {dashboardData.bots.actions.map((action) => (
                  <button
                    key={action.id}
                    className={`control-btn ${action.id} ${activeBotAction === action.id ? "is-active" : ""}`}
                    data-action={action.id}
                    onClick={() => setActiveBotAction(action.id)}
                  >
                    {action.label}
                  </button>
                ))}
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
                <span className="pill neutral">Live feed</span>
              </div>
              <div id="watchlist" className="watchlist">
                {watchlist.map((item) => {
                  const isUp = item.change >= 0;
                  const flashClass = flashSymbol === item.symbol ? (isUp ? "flash-up" : "flash-down") : "";
                  return (
                    <button key={item.symbol} className={`watch-item ${flashClass}`} onClick={() => { setQuery(item.symbol); setSearchOpen(true); }}>
                      <div>
                        <strong>{item.symbol}</strong>
                        <span>{item.context}</span>
                      </div>
                      <div className="watch-price">
                        <strong>{formatPrice(item.price)}</strong>
                        <span>{formatChange(item.change)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="glass signal-panel">
              <div className="panel-head compact">
                <div>
                  <p className="eyebrow">Signal Engine</p>
                  <h2>AI Insight</h2>
                </div>
                <span className="signal-score">{dashboardData.insight.score}</span>
              </div>
              <div className="signal-card strong">
                <div className="signal-label">{dashboardData.insight.label}</div>
                <h3>{dashboardData.insight.title}</h3>
                <p>{dashboardData.insight.description}</p>
              </div>
              <div className="signal-list">
                {dashboardData.insight.rows.map((row) => (
                  <div key={row.label} className="signal-row">
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </section>
      </main>
    </div>
  );
}
