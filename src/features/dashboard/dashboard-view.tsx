"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useAppState } from "@/components/providers/app-state-provider";
import { MetricCard } from "@/components/dashboard/metric-card";
import { WatchlistItem } from "@/components/dashboard/watchlist-item";
import { Button } from "@/components/ui/button";
import { readStoredValue, storeValue } from "@/lib/persistence";
import { tradingApi } from "@/lib/trading-api";
import type { BotCommand, DashboardSnapshotDto } from "@/types/trading-api";

const ACTIVE_TAB_KEY = "trading-web.dashboard.active-tab";
const ACTIVE_BOT_ACTION_KEY = "trading-web.dashboard.active-bot-action";

type DashboardViewProps = {
  snapshot: DashboardSnapshotDto;
};

export function DashboardView({ snapshot }: DashboardViewProps) {
  const { t } = useAppState();
  const [activeBotAction, setActiveBotAction] = useState<BotCommand | null>(() =>
    readStoredValue<BotCommand | null>(ACTIVE_BOT_ACTION_KEY, null),
  );
  const [activeTab, setActiveTab] = useState<string | null>(() => readStoredValue<string | null>(ACTIVE_TAB_KEY, null));
  const [botStatus, setBotStatus] = useState<string>("");

  const resolvedActiveTab = useMemo(() => activeTab ?? snapshot?.chart.activeTab ?? null, [activeTab, snapshot?.chart.activeTab]);
  const resolvedWatchlist = snapshot?.watchlist ?? [];

  if (!resolvedActiveTab) {
    return <section className="content-grid"><div className="glass section-card">Loading market surface…</div></section>;
  }

  const handleSetTab = (tab: string) => {
    setActiveTab(tab);
    storeValue(ACTIVE_TAB_KEY, tab);
  };

  const handleBotCommand = async (command: BotCommand) => {
    setActiveBotAction(command);
    storeValue(ACTIVE_BOT_ACTION_KEY, command);

    const response = await tradingApi.sendBotCommand("bot-1", { command });
    setBotStatus(response.data.statusLabel);
  };

  return (
    <section className="content-grid">
      <div className="center-column">
        <section className="glass section-card dashboard-search-entry">
          <div className="dashboard-search-entry-head">
            <div className="dashboard-search-entry-copy">
              <p className="eyebrow">Search</p>
              <h2>Find symbols and routes before you scroll</h2>
              <p className="dashboard-search-copy">
                Open the dedicated symbol lookup page to search by company name or code and inspect live quote updates.
              </p>
            </div>
            <Link href="/search" className="dashboard-search-link">
              <span className="dashboard-search-link-icon" aria-hidden="true">
                ⌕
              </span>
              <span>Open Search Workspace</span>
            </Link>
          </div>
          <div className="dashboard-search-meta">
            <span className="pill neutral">Server-rendered CTA</span>
            <span className="pill neutral">Above the fold on /dashboard</span>
          </div>
        </section>

        <section className="glass section-card" style={{ marginBottom: 18 }}>
          <div className="panel-head compact">
            <div>
              <p className="eyebrow">Live Core Feed</p>
              <h2>KIS / trading-core connected</h2>
            </div>
            <span className="pill positive">Real Data</span>
          </div>
          <div className="detail-list">
            <div className="detail-row"><span>Lead symbol</span><strong>{snapshot.chart.symbol}</strong></div>
            <div className="detail-row"><span>Tracked symbols</span><strong>{snapshot.insight.rows.find((row) => row.label === "Tracked symbols")?.value ?? "-"}</strong></div>
            <div className="detail-row"><span>Market state</span><strong>{snapshot.insight.rows.find((row) => row.label === "Market state")?.value ?? "-"}</strong></div>
          </div>
        </section>

        <section className="cards-row">
          {snapshot.metrics.map((metric) => (
            <MetricCard key={metric.id} metric={metric} />
          ))}
        </section>

        <section className="glass chart-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">{snapshot.chart.symbol}</p>
              <h2>{snapshot.chart.title}</h2>
            </div>
            <div className="chart-tabs">
              {snapshot.chart.tabs.map((tab) => (
                <Button key={tab} className={`tab ${resolvedActiveTab === tab ? "active" : ""}`} onClick={() => handleSetTab(tab)}>
                  {tab}
                </Button>
              ))}
            </div>
          </div>

          <div className="chart-grid">
            <div className="chart-area">
              <div className="chart-overlay y-top">{snapshot.chart.overlays.top}</div>
              <div className="chart-overlay y-mid">{snapshot.chart.overlays.mid}</div>
              <div className="chart-overlay y-low">{snapshot.chart.overlays.low}</div>
              <svg viewBox="0 0 760 360" className="main-chart" preserveAspectRatio="none" aria-label={`${snapshot.chart.symbol} ${resolvedActiveTab} chart`}>
                <defs>
                  <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(124, 92, 255, 0.35)" />
                    <stop offset="100%" stopColor="rgba(124, 92, 255, 0)" />
                  </linearGradient>
                </defs>
                <path className="chart-fill" d="M0 280 C70 220, 110 250, 170 180 S290 90, 360 140 S500 240, 570 175 S670 70, 760 105 L760 360 L0 360 Z" />
                <path className="chart-line" d="M0 280 C70 220, 110 250, 170 180 S290 90, 360 140 S500 240, 570 175 S670 70, 760 105" />
              </svg>

              {snapshot.chart.tradeMarkers.map((marker) => (
                <div key={`${marker.side}-${marker.left}-${marker.top}`} className={`trade-marker ${marker.side}`} style={{ left: marker.left, top: marker.top }}>
                  {marker.label}
                  <span>{marker.value}</span>
                </div>
              ))}
            </div>

            <aside className="glass-inner orderbook">
              <div className="orderbook-head">
                <h3>{t.dashboard.miniOrderBook}</h3>
                <span>Depth {snapshot.chart.orderBook.depth}</span>
              </div>

              <div className="book book-sell">
                {snapshot.chart.orderBook.sell.map((row) => (
                  <div key={`${row.price}-${row.size}`} className="book-row">
                    <span>{row.price}</span>
                    <span>{row.size}</span>
                  </div>
                ))}
              </div>

              <div className="mid-price">
                {snapshot.chart.orderBook.midPrice}
                <span>{snapshot.chart.orderBook.midChange}</span>
              </div>

              <div className="book book-buy">
                {snapshot.chart.orderBook.buy.map((row) => (
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
              <p className="eyebrow">{t.dashboard.automation}</p>
              <h2>{snapshot.botControls.title}</h2>
            </div>
            <div className={`bot-status ${activeBotAction ?? "idle"}`}>{botStatus || snapshot.botControls.idleLabel}</div>
          </div>
          <div className="bot-buttons">
            {snapshot.botControls.actions.map((action) => (
              <Button
                key={action.id}
                className={`control-btn ${action.id} ${activeBotAction === action.id ? "is-active" : ""}`}
                data-action={action.id}
                onClick={() => handleBotCommand(action.id)}
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
              <p className="eyebrow">{t.dashboard.radar}</p>
              <h2>{t.dashboard.watchlist}</h2>
            </div>
            <span className="pill neutral">{t.common.liveFeed}</span>
          </div>
          <div className="watchlist">
            {resolvedWatchlist.map((item) => (
              <WatchlistItem key={item.symbol} item={item} />
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
            {snapshot.insight.rows.map((row) => (
              <div className="detail-row" key={row.label}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="glass signal-panel">
          <div className="panel-head compact">
            <div>
              <p className="eyebrow">{t.dashboard.signalEngine}</p>
              <h2>{t.dashboard.aiInsight}</h2>
            </div>
            <span className="signal-score">{snapshot.insight.score}</span>
          </div>
          <div className="signal-card strong">
            <div className="signal-label">{snapshot.insight.label}</div>
            <h3>{snapshot.insight.title}</h3>
            <p>{snapshot.insight.description}</p>
          </div>
          <div className="signal-list">
            {snapshot.insight.rows.map((row) => (
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
