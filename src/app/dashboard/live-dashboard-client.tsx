"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ComponentTag } from "@/components/dev/component-tag";
import { DevModeToggle } from "@/components/dev/dev-mode-toggle";
import { MobileAppChrome } from "@/components/mobile/mobile-app-chrome";
import { formatDisplayTimestamp, formatPrice, formatTurnover } from "@/lib/format";
import type { EodFreshnessResponseDto } from "@/types/trading-api";

import styles from "./live-dashboard-client.module.css";

export type CoreMarketStatus = {
  state: string;
  is_open: boolean;
  server_time: string;
};

export type CoreTrackedQuote = {
  symbol: string;
  company_name?: string;
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
  cached_at?: string | null;
  fallback_reason?: string | null;
  unavailable_reason?: string | null;
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

type LiveDashboardClientProps = {
  initialError?: string | null;
  initialMarket: CoreMarketStatus;
  initialTracked: CoreTrackedQuotesResponse;
  initialSymbols: CoreTrackedSymbolsResponse;
  initialFreshness: EodFreshnessResponseDto | null;
};

function hasNumber(value: number | null | undefined): value is number {
  return typeof value === "number";
}

function formatSignedPercent(value: number | null | undefined, fallback = "Unavailable"): string {
  if (!hasNumber(value)) return fallback;
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatSignedNumber(value: number | null | undefined, fallback = "Unavailable"): string {
  if (!hasNumber(value)) return fallback;
  return `${value >= 0 ? "+" : ""}${value.toLocaleString("ko-KR")}`;
}

function getCompanyName(item: CoreTrackedQuote | undefined): string {
  if (!item) return "N/A";
  return item.company_name || item.symbol;
}

function getJson<T>(path: string): Promise<T> {
  return fetch(path, { cache: "no-store" }).then((response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json() as Promise<T>;
  });
}

function getQuoteToneClass(value: number | null | undefined): string {
  if (!hasNumber(value)) return "";
  return value >= 0 ? styles.positive : styles.negative;
}

function describeQuoteSource(item: CoreTrackedQuote | undefined): string {
  if (!item) return "N/A";
  if (!item.available) {
    return item.unavailable_reason ? `Quote unavailable · ${item.unavailable_reason}` : "Quote unavailable";
  }
  if (!item.fallback) {
    return item.is_live ? "Live KIS quote" : item.source;
  }
  if (item.source === "daily_price_bar") {
    return item.trade_date ? `DB EOD fallback · ${item.trade_date}` : "DB EOD fallback";
  }
  if (item.source === "db_cache") {
    return "Same-day DB quote cache";
  }
  if (item.source === "cache") {
    return "Same-day memory cache";
  }
  return `${item.source} fallback`;
}

function getPriceFreshnessLabel(item: CoreTrackedQuote) {
  if (!item.available) return item.trade_date ?? "Unavailable";
  if (item.is_live) return "Live";
  if (item.trade_date) return item.trade_date;
  return formatDisplayTimestamp(item.as_of ?? item.cached_at, "Pending");
}

function getTechnicalFreshnessLabel(freshness: EodFreshnessResponseDto | null) {
  return freshness?.technical?.latest_date ?? freshness?.latest?.technical_market_date ?? "[확인 필요]";
}

function getFreshnessTone(status: string | null | undefined) {
  if (!status) return "warning";
  if (status === "completed") return "positive";
  if (status === "completed_with_errors") return "warning";
  if (status === "running") return "info";
  return "neutral";
}

function humanizeStatus(status: string | null | undefined) {
  if (!status) return "[확인 필요]";
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildTrackedDetailHref(item: CoreTrackedQuote) {
  const params = new URLSearchParams();
  params.set("name", item.company_name ?? item.symbol);
  return `/dashboard/symbol/${encodeURIComponent(item.symbol)}?${params.toString()}`;
}

export function LiveDashboardClient({
  initialError = null,
  initialMarket,
  initialTracked,
  initialSymbols,
  initialFreshness,
}: LiveDashboardClientProps) {
  const [market, setMarket] = useState<CoreMarketStatus>(initialMarket);
  const [tracked, setTracked] = useState<CoreTrackedQuotesResponse>(initialTracked);
  const [symbols, setSymbols] = useState<CoreTrackedSymbolsResponse>(initialSymbols);
  const [freshness, setFreshness] = useState<EodFreshnessResponseDto | null>(initialFreshness);
  const [error, setError] = useState<string | null>(initialError);
  const [coreUnavailable, setCoreUnavailable] = useState(() => initialMarket.state === "OFFLINE PLACEHOLDER");

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
        setCoreUnavailable(false);
      } catch (loadError) {
        console.error("Dashboard polling failed", loadError);
        if (!active) return;
        setCoreUnavailable(true);
        setError(loadError instanceof Error ? loadError.message : "Failed to refresh dashboard data.");
      }
    };

    load();
    const timer = window.setInterval(load, 4_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadFreshness = async () => {
      try {
        const data = await getJson<EodFreshnessResponseDto>("/api/trading/eod/freshness");
        if (!active) return;
        setFreshness(data);
      } catch (freshnessError) {
        console.error("Dashboard freshness load failed", freshnessError);
        if (!active) return;
        setFreshness((current) => current);
      }
    };

    loadFreshness();
    const timer = window.setInterval(loadFreshness, 30_000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const lead = tracked.items[0];
  const availableItems = tracked.items.filter((item) => item.available);
  const liveCount = tracked.items.filter((item) => item.is_live).length;
  const fallbackCount = tracked.items.filter((item) => item.fallback).length;
  const unavailableCount = tracked.items.filter((item) => !item.available).length;
  const positiveCount = availableItems.filter((item) => (item.change_pct ?? 0) >= 0).length;
  const totalTurnover = availableItems.reduce((sum, item) => sum + (item.turnover ?? 0), 0);
  const breadthRatio = availableItems.length ? Math.round((positiveCount / availableItems.length) * 100) : 0;
  const movers = useMemo(
    () =>
      [...tracked.items]
        .filter((item) => item.available && hasNumber(item.change_pct))
        .sort((left, right) => Math.abs((right.change_pct ?? 0)) - Math.abs((left.change_pct ?? 0)))
        .slice(0, 3),
    [tracked.items],
  );

  const moduleRows = [
    {
      id: "price",
      label: "Price Module",
      status: lead?.available ? "Optimal" : "Unavailable",
      meta: freshness?.latest?.price_trade_date ?? lead?.trade_date ?? "[확인 필요]",
      coverage: `${availableItems.length}/${tracked.items.length} symbols ready`,
      tone: lead?.available ? "positive" : "warning",
    },
    {
      id: "technical",
      label: "Technical Analysis",
      status:
        freshness?.technical?.success || freshness?.technical?.latest_date || freshness?.latest?.technical_market_date
          ? "Synced"
          : "[확인 필요]",
      meta: freshness?.technical?.latest_date ?? freshness?.latest?.technical_market_date ?? "[확인 필요]",
      coverage: "EOD-derived snapshot date",
      tone:
        freshness?.technical?.success || freshness?.technical?.latest_date || freshness?.latest?.technical_market_date
          ? "info"
          : "warning",
    },
    {
      id: "action",
      label: "Action Summary",
      status: freshness?.latest?.action_market_date ? "Synced" : "[확인 필요]",
      meta: freshness?.latest?.action_market_date ?? "[확인 필요]",
      coverage: "Deterministic action layer",
      tone: freshness?.latest?.action_market_date ? "info" : "warning",
    },
    {
      id: "fundamentals",
      label: "Fundamentals",
      status: "[확인 필요]",
      meta: "[확인 필요]",
      coverage: "Freshness API not exposed in current web layer",
      tone: "neutral",
    },
  ] as const;
  const integrityModuleRows = moduleRows.filter((row) => row.id !== "price");

  const statusTone = getFreshnessTone(freshness?.today?.eod_status);
  const statusLabel = humanizeStatus(freshness?.today?.eod_status);
  const portfolioHeadline = totalTurnover > 0 ? formatTurnover(totalTurnover) : "[확인 필요]";
  const marketBadgeLabel = market.is_open ? "Market Open" : "Market Closed";

  return (
    <MobileAppChrome
      activeNav="dashboard"
      header={
        <>
          <div className={styles.appHeaderBrand}>
            <div className={styles.brandMark}>K</div>
            <div>
              <p className={styles.brandEyebrow}>Obsidian Ledger</p>
              <strong className={styles.brandTitle}>Trading Dashboard</strong>
            </div>
          </div>

          <div className={styles.appHeaderActions}>
            <span className={`pill ${market.is_open ? "positive" : "info"}`}>{marketBadgeLabel}</span>
            <DevModeToggle />
          </div>
        </>
      }
    >
      <div className={`${styles.stack} ${styles.dashboardWideShell}`}>
        {coreUnavailable ? (
          <section className={`${styles.panel} ${styles.alertPanel}`}>
            <ComponentTag label="dashboard.core-unavailable" api="/api/trading/market/status + /api/trading/quotes/tracked" />
            <p className={styles.sectionEyebrow}>Core unavailable</p>
            <strong className={styles.alertTitle}>Offline placeholder active</strong>
            <p className="clamp-3">
              {error ?? "Core feed unreachable. Showing placeholder values until the upstream endpoints recover."}
            </p>
          </section>
        ) : null}

        <section className={`${styles.panel} ${styles.integrityPanel}`} id="dashboard-freshness">
          <ComponentTag label="dashboard.operational-integrity" api="/api/trading/eod/freshness + /api/trading/market/status" />

          <div className={styles.panelHeader}>
            <div>
              <p className={styles.sectionEyebrow}>Market Freshness Registry</p>
              <h1 className={styles.heroTitle}>Operational Integrity</h1>
            </div>
            <span className={`pill ${statusTone}`}>{statusLabel}</span>
          </div>

          <div className={styles.integrityGrid}>
            <article className={styles.integrityStat}>
              <span>EOD Status</span>
              <strong>{statusLabel}</strong>
              <p className="clamp-3">{freshness?.today?.trade_date ?? "[확인 필요]"}</p>
            </article>
            <article className={styles.integrityStat}>
              <span>Market State</span>
              <strong>{market.state}</strong>
              <p className="clamp-3">Server time {formatDisplayTimestamp(market.server_time)}</p>
            </article>
            <article className={styles.integrityStat}>
              <span>Latest Update</span>
              <strong>{freshness?.latest?.price_trade_date ?? lead?.trade_date ?? "[확인 필요]"}</strong>
              <p className="clamp-3">Tracked board refreshed {formatDisplayTimestamp(tracked.as_of)}</p>
            </article>
          </div>

          <div className={styles.moduleList}>
            {integrityModuleRows.map((row) => (
              <article key={row.id} className={styles.moduleRow}>
                <div>
                  <strong>{row.label}</strong>
                  <p className="clamp-3">{row.coverage}</p>
                </div>
                <div className={styles.moduleAside}>
                  <span>{row.meta}</span>
                  <span className={`pill ${row.tone}`}>{row.status}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={`${styles.panel} ${styles.snapshotPanel}`}>
          <ComponentTag label="dashboard.watch-snapshot" api="/api/trading/quotes/tracked + /api/trading/scanner/tracked-symbols" />

          <div className={styles.snapshotTopRow}>
            <div>
              <p className={styles.sectionEyebrow}>Tracked Snapshot</p>
              <strong className={styles.snapshotValue}>{portfolioHeadline}</strong>
            </div>
            <span className={styles.snapshotDelta}>{breadthRatio}% breadth</span>
          </div>

          <div className={styles.snapshotMetrics}>
            <div className={styles.snapshotMetric}>
              <span>Tracked</span>
              <strong>{symbols.count}</strong>
            </div>
            <div className={styles.snapshotMetric}>
              <span>Live</span>
              <strong>{liveCount}</strong>
            </div>
            <div className={styles.snapshotMetric}>
              <span>Fallback</span>
              <strong>{fallbackCount}</strong>
            </div>
            <div className={styles.snapshotMetric}>
              <span>Unavailable</span>
              <strong>{unavailableCount}</strong>
            </div>
          </div>

          <div className={styles.snapshotRows}>
            <div className={styles.snapshotRow}>
              <span>Lead symbol</span>
              <strong>{lead ? `${lead.symbol} ${formatSignedPercent(lead.change_pct, "N/A")}` : "[확인 필요]"}</strong>
            </div>
            <div className={styles.snapshotRow}>
              <span>Price freshness</span>
              <strong>{freshness?.latest?.price_trade_date ?? "[확인 필요]"}</strong>
            </div>
            <div className={styles.snapshotRow}>
              <span>Technical freshness</span>
              <strong>{getTechnicalFreshnessLabel(freshness)}</strong>
            </div>
          </div>
        </section>

        <section className={`${styles.panel} ${styles.supportPanel} ${styles.desktopAuditPanel}`}>
          <ComponentTag label="dashboard.audit-feed" api="/api/trading/eod/freshness + /api/trading/quotes/tracked" />
          <p className={styles.sectionEyebrow}>Real-Time Audit Feed</p>
          <h2 className={styles.sectionTitle}>Layer sync events</h2>
          <div className={styles.auditList}>
            {moduleRows.slice(0, 3).map((row) => (
              <article key={row.id} className={styles.auditItem}>
                <span>{row.meta}</span>
                <p className="clamp-3">
                  {row.label} status is {row.status}. {row.coverage}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.sectionHeaderRow} id="tracked-symbols">
          <div>
            <p className={styles.sectionEyebrow}>Tracked Symbols</p>
            <h2 className={styles.sectionTitle}>Today&apos;s ledger recommendations</h2>
          </div>
          <Link href="/search" className={styles.sectionLink}>
            Manage Feed
          </Link>
        </section>

        <div className={styles.trackedList}>
          {tracked.items.map((item) => (
            <Link
              key={item.symbol}
              href={buildTrackedDetailHref(item)}
              className={`${styles.trackedCard} ${!item.available ? styles.trackedCardMuted : ""}`.trim()}
            >
              <ComponentTag label={`dashboard.symbol-card.${item.symbol}`} api="/api/trading/quotes/tracked" />

              <div className={styles.trackedCardTop}>
                <div>
                  <strong className={styles.symbolLabel}>{item.symbol}</strong>
                  <p className={`clamp-3 ${styles.companyLabel}`}>{getCompanyName(item)}</p>
                </div>
                <span className={`pill ${item.available ? (item.change_pct ?? 0) >= 0 ? "positive" : "negative" : "warning"}`}>
                  {item.available ? (item.is_live ? "Live" : "Fallback") : "Unavailable"}
                </span>
              </div>

              <div className={styles.priceBlock}>
                <strong>{item.available ? `₩${formatPrice(item.price)}` : "N/A"}</strong>
                <span className={getQuoteToneClass(item.change_pct)}>
                  {item.available
                    ? `${formatSignedPercent(item.change_pct)} · ${formatSignedNumber(item.change)}`
                    : item.unavailable_reason ?? "No fresh quote source"}
                </span>
              </div>

              <div className={styles.cardMeta}>
                <div>
                  <span>Price Freshness</span>
                  <strong>{getPriceFreshnessLabel(item)}</strong>
                </div>
                <div>
                  <span>TA Freshness</span>
                  <strong>{getTechnicalFreshnessLabel(freshness)}</strong>
                </div>
              </div>

              <div className={styles.cardFooter}>
                <span className="clamp-3">{describeQuoteSource(item)}</span>
                <span className="clamp-3">Turnover {formatTurnover(item.turnover)}</span>
              </div>
            </Link>
          ))}
        </div>

        <section className={styles.supportGrid}>
          <section className={`${styles.panel} ${styles.supportPanel}`}>
            <ComponentTag label="dashboard.momentum-board" api="/api/trading/quotes/tracked" />
            <p className={styles.sectionEyebrow}>Global Sentiment Distribution</p>
            <h2 className={styles.sectionTitle}>Highest absolute movers</h2>
            <div className={styles.supportList}>
              {movers.length > 0 ? (
                movers.map((item) => (
                  <article key={item.symbol} className={styles.supportRow}>
                    <div>
                      <strong>{item.symbol}</strong>
                      <p className="clamp-3">{getCompanyName(item)}</p>
                    </div>
                    <span className={getQuoteToneClass(item.change_pct)}>{formatSignedPercent(item.change_pct)}</span>
                  </article>
                ))
              ) : (
                <div className={styles.emptyState}>Tracked momentum is waiting for live quote coverage.</div>
              )}
            </div>
          </section>

          <section className={`${styles.panel} ${styles.supportPanel}`}>
            <ComponentTag label="dashboard.coverage-note" api="/api/trading/eod/freshness + /api/trading/quotes/tracked" />
            <p className={styles.sectionEyebrow}>Coverage Notes</p>
            <h2 className={styles.sectionTitle}>Ledger coverage notes</h2>
            <div className={styles.noteStack}>
              <article className={styles.noteCard}>
                <strong>{unavailableCount > 0 ? `${unavailableCount} symbol(s) need attention` : "Fallback pressure is contained"}</strong>
                <p className="clamp-3">
                  {unavailableCount > 0
                    ? "Unavailable quotes stay explicit instead of collapsing to zero, so gaps are visible before action."
                    : `${fallbackCount} symbol(s) are on fallback paths, but live coverage is still present for ${liveCount} names.`}
                </p>
              </article>
              <article className={styles.noteCard}>
                <strong>Freshness stays layer-specific</strong>
                <p className="clamp-3">
                  Price latest {freshness?.latest?.price_trade_date ?? "[확인 필요]"} · Technical latest{" "}
                  {freshness?.technical?.latest_date ?? freshness?.latest?.technical_market_date ?? "[확인 필요]"} · Action latest{" "}
                  {freshness?.latest?.action_market_date ?? "[확인 필요]"}.
                </p>
              </article>
            </div>
          </section>
        </section>
      </div>
    </MobileAppChrome>
  );
}
