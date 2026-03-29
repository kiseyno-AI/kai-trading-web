"use client";

import { useEffect, useState } from "react";

import { MetricCard } from "@/components/dashboard/metric-card";
import { WatchlistItem } from "@/components/dashboard/watchlist-item";
import { Button } from "@/components/ui/button";
import { botStatusMap, dashboardData, type BotAction } from "@/data/trading-dashboard";

export function DashboardView() {
  const [activeBotAction, setActiveBotAction] = useState<BotAction | null>(null);
  const [activeTab, setActiveTab] = useState(dashboardData.chart.tabs[0]);
  const [watchlist, setWatchlist] = useState(dashboardData.watchlist);
  const [flashSymbol, setFlashSymbol] = useState<string | null>(null);

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

  const botStatus = activeBotAction ? botStatusMap[activeBotAction] : dashboardData.bots.idleLabel;

  return (
    <section className="content-grid">
      <div className="center-column">
        <section className="cards-row">
          {dashboardData.metrics.map((metric) => (
            <MetricCard key={metric.id} metric={metric} />
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
                <Button key={tab} className={`tab ${activeTab === tab ? "active" : ""}`} onClick={() => setActiveTab(tab)}>
                  {tab}
                </Button>
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
            <div className={`bot-status ${activeBotAction ?? "idle"}`}>{botStatus}</div>
          </div>
          <div className="bot-buttons">
            {dashboardData.bots.actions.map((action) => (
              <Button
                key={action.id}
                className={`control-btn ${action.id} ${activeBotAction === action.id ? "is-active" : ""}`}
                data-action={action.id}
                onClick={() => setActiveBotAction(action.id)}
              >
                {action.label}
              </Button>
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
          <div className="watchlist">
            {watchlist.map((item) => (
              <WatchlistItem key={item.symbol} item={item} flashing={flashSymbol === item.symbol} />
            ))}
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
  );
}
