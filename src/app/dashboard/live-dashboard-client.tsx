"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { ComponentTag } from "@/components/dev/component-tag";
import { DevModeToggle } from "@/components/dev/dev-mode-toggle";
import { MobileAppChrome } from "@/components/mobile/mobile-app-chrome";
import { formatDisplayTimestamp, formatPrice, formatTurnover } from "@/lib/format";
import { getCachedTradingApiJson, seedTradingApiJsonCache } from "@/lib/trading-api-cache";
import type {
  DartFundamentalsDailyInspectResponseDto,
  DartFundamentalsDailyRunDto,
  EodFreshnessLayerStatusDto,
  EodFreshnessResponseDto,
} from "@/types/trading-api";

import styles from "./live-dashboard-client.module.css";

const UNKNOWN_LABEL = "[확인 필요]";

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

type LiveDashboardClientProps = {
  initialError?: string | null;
  initialMarket: CoreMarketStatus;
  initialTracked: CoreTrackedQuotesResponse;
  initialFreshness: EodFreshnessResponseDto | null;
  initialFundamentalsStatus: DartFundamentalsDailyInspectResponseDto | null;
};

type DetailItem = {
  label: string;
  value: string;
};

type FundamentalsFailureDetails = {
  key: string;
  title: string;
  reason: string;
  details: DetailItem[];
  metadata: DetailItem[];
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
  return getCachedTradingApiJson<T>(path);
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

function getFundamentalsFreshnessLayer(
  freshness: EodFreshnessResponseDto | null,
): EodFreshnessLayerStatusDto | null {
  return freshness?.fundamentals ?? freshness?.fundamental ?? null;
}

function getLatestFundamentalsRun(
  fundamentalsStatus: DartFundamentalsDailyInspectResponseDto | null,
): DartFundamentalsDailyRunDto | null {
  return fundamentalsStatus?.latest_run ?? fundamentalsStatus?.runs?.[0] ?? null;
}

function getDatePart(value: string | null | undefined) {
  if (!hasTextValue(value)) return null;
  return value.slice(0, 10);
}

function getFundamentalsRunDate(run: DartFundamentalsDailyRunDto | null) {
  return run?.market_date ?? getDatePart(run?.completed_at) ?? getDatePart(run?.started_at);
}

function getFundamentalsFreshnessDate(
  freshness: EodFreshnessResponseDto | null,
  fundamentalsStatus: DartFundamentalsDailyInspectResponseDto | null,
) {
  return (
    getFundamentalsFreshnessLayer(freshness)?.latest_date ??
    getFundamentalsRunDate(getLatestFundamentalsRun(fundamentalsStatus))
  );
}

function humanizeToken(value: string | null | undefined, fallback = UNKNOWN_LABEL) {
  if (!hasTextValue(value)) return fallback;
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function getFundamentalsStatusLabel(
  freshness: EodFreshnessResponseDto | null,
  fundamentalsStatus: DartFundamentalsDailyInspectResponseDto | null,
  latestFundamentalsDate: string | null,
) {
  const runStatus = getLatestFundamentalsRun(fundamentalsStatus)?.status;
  if (hasTextValue(runStatus)) return humanizeToken(runStatus);

  const freshnessLayer = getFundamentalsFreshnessLayer(freshness);
  if (freshnessLayer?.success === true) return "Available";
  if (freshnessLayer?.success === false) return "Needs review";
  if (hasTextValue(latestFundamentalsDate)) return "Available";

  return UNKNOWN_LABEL;
}

function getFundamentalsTone(statusLabel: string, latestFundamentalsDate: string | null) {
  const normalized = statusLabel.toLowerCase();
  if (normalized === "completed" || normalized === "available") return "info";
  if (normalized === "running") return "info";
  if (normalized === "failed" || normalized === "partial" || normalized === "needs review") return "warning";
  if (hasTextValue(latestFundamentalsDate)) return "warning";
  return "warning";
}

function getHumanCount(value: number | null | undefined) {
  if (!hasNumber(value)) return UNKNOWN_LABEL;
  return value.toLocaleString("ko-KR");
}

function getFailureCountPhrase(count: number, singularLabel: string, pluralLabel: string) {
  const label = count === 1 ? singularLabel : pluralLabel;
  return `${count.toLocaleString("ko-KR")} ${label}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatMetadataValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return hasTextValue(value) ? value : null;
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getFailureMetadata(run: DartFundamentalsDailyRunDto | null): DetailItem[] {
  if (!isRecord(run?.run_metadata)) return [];

  return Object.entries(run.run_metadata)
    .filter(([key, value]) => /(error|fail|reason|exception|message|missing|stale)/i.test(key) && value !== null)
    .map(([key, value]) => ({
      label: humanizeToken(key, key),
      value: formatMetadataValue(value) ?? UNKNOWN_LABEL,
    }))
    .filter((item) => item.value !== UNKNOWN_LABEL)
    .slice(0, 8);
}

function hasFundamentalsFailureSignal(
  freshness: EodFreshnessResponseDto | null,
  run: DartFundamentalsDailyRunDto | null,
  statusLabel: string,
) {
  const normalizedStatus = statusLabel.toLowerCase();
  const symbolsFailed = run?.symbols_failed;
  const eventsFailed = run?.events_failed;
  return (
    normalizedStatus === "failed" ||
    normalizedStatus === "partial" ||
    normalizedStatus === "needs review" ||
    (hasNumber(symbolsFailed) && symbolsFailed > 0) ||
    (hasNumber(eventsFailed) && eventsFailed > 0) ||
    Boolean(hasTextValue(run?.error_message)) ||
    getFundamentalsFreshnessLayer(freshness)?.success === false
  );
}

function getFundamentalsFailureReason(
  freshness: EodFreshnessResponseDto | null,
  run: DartFundamentalsDailyRunDto | null,
  statusLabel: string,
) {
  if (hasTextValue(run?.error_message)) return run.error_message.trim();

  const failedCounts: string[] = [];
  const symbolsFailed = run?.symbols_failed;
  const eventsFailed = run?.events_failed;
  if (hasNumber(symbolsFailed) && symbolsFailed > 0) {
    failedCounts.push(getFailureCountPhrase(symbolsFailed, "failed symbol", "failed symbols"));
  }
  if (hasNumber(eventsFailed) && eventsFailed > 0) {
    failedCounts.push(getFailureCountPhrase(eventsFailed, "failed event", "failed events"));
  }

  if (failedCounts.length > 0) {
    return `Trading-core reported ${failedCounts.join(" and ")} for this fundamentals run.`;
  }

  if (getFundamentalsFreshnessLayer(freshness)?.success === false) {
    return "The freshness registry marked the fundamentals layer as unsuccessful.";
  }

  return `Trading-core marked this fundamentals run as ${statusLabel}.`;
}

function getFundamentalsFailureDetails(
  freshness: EodFreshnessResponseDto | null,
  fundamentalsStatus: DartFundamentalsDailyInspectResponseDto | null,
  latestFundamentalsDate: string | null,
  statusLabel: string,
): FundamentalsFailureDetails | null {
  const run = getLatestFundamentalsRun(fundamentalsStatus);

  if (!hasFundamentalsFailureSignal(freshness, run, statusLabel)) return null;

  const runDate = getFundamentalsRunDate(run) ?? latestFundamentalsDate ?? UNKNOWN_LABEL;

  return {
    key: `${run?.id ?? "freshness"}:${runDate}:${statusLabel}`,
    title: `DART fundamentals ${statusLabel.toLowerCase()}`,
    reason: getFundamentalsFailureReason(freshness, run, statusLabel),
    details: [
      { label: "Run date", value: runDate },
      { label: "Status", value: statusLabel },
      { label: "FS division", value: run?.fs_div ?? UNKNOWN_LABEL },
      { label: "Trigger", value: humanizeToken(run?.trigger) },
      { label: "Symbols total", value: getHumanCount(run?.symbols_total) },
      { label: "Symbols checked", value: getHumanCount(run?.symbols_checked) },
      { label: "Symbols missing", value: getHumanCount(run?.symbols_missing) },
      { label: "Symbols stale", value: getHumanCount(run?.symbols_stale) },
      { label: "Symbols fresh", value: getHumanCount(run?.symbols_fresh) },
      { label: "Symbols refreshed", value: getHumanCount(run?.symbols_refreshed) },
      { label: "Symbols failed", value: getHumanCount(run?.symbols_failed) },
      { label: "Events detected", value: getHumanCount(run?.events_detected) },
      { label: "Events captured", value: getHumanCount(run?.events_captured) },
      { label: "Events failed", value: getHumanCount(run?.events_failed) },
      { label: "Started", value: formatDisplayTimestamp(run?.started_at, UNKNOWN_LABEL) },
      { label: "Completed", value: formatDisplayTimestamp(run?.completed_at, UNKNOWN_LABEL) },
    ],
    metadata: getFailureMetadata(run),
  };
}

function getEodReceivedTone(received: boolean | null | undefined) {
  if (received === true) return "positive";
  if (received === false) return "warning";
  return "neutral";
}

function hasTextValue(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasEodReadinessSignal(freshness: EodFreshnessResponseDto | null) {
  return (
    hasTextValue(freshness?.latest?.price_trade_date) ||
    hasNumber(getEodSymbolsSucceeded(freshness)) ||
    hasNumber(getEodSymbolsTotal(freshness))
  );
}

function getEodFreshnessTone(freshness: EodFreshnessResponseDto | null) {
  if (freshness?.today?.received !== null && freshness?.today?.received !== undefined) {
    return getEodReceivedTone(freshness.today.received);
  }
  return hasEodReadinessSignal(freshness) ? "info" : "neutral";
}

function getEodStatusLabel(freshness: EodFreshnessResponseDto | null) {
  const received = freshness?.today?.received;
  const eodStatus = freshness?.today?.eod_status;
  if (received === true) return "Received";
  if (received === false) return "Not received";

  if (hasTextValue(eodStatus)) {
    return eodStatus;
  }
  if (hasEodReadinessSignal(freshness)) {
    return "Freshness available";
  }
  return UNKNOWN_LABEL;
}

function formatEodSymbolCount(value: number | null | undefined) {
  if (!hasNumber(value)) return UNKNOWN_LABEL;
  return value.toLocaleString("ko-KR");
}

function getEodSymbolsSucceeded(freshness: EodFreshnessResponseDto | null) {
  return freshness?.today?.symbols_succeeded ?? freshness?.latest?.symbols_succeeded;
}

function getEodSymbolsTotal(freshness: EodFreshnessResponseDto | null) {
  return freshness?.today?.symbols_total ?? freshness?.latest?.symbols_total;
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
  initialFreshness,
  initialFundamentalsStatus,
}: LiveDashboardClientProps) {
  const [market, setMarket] = useState<CoreMarketStatus>(initialMarket);
  const [tracked, setTracked] = useState<CoreTrackedQuotesResponse>(initialTracked);
  const [freshness, setFreshness] = useState<EodFreshnessResponseDto | null>(initialFreshness);
  const [fundamentalsStatus, setFundamentalsStatus] = useState<DartFundamentalsDailyInspectResponseDto | null>(
    initialFundamentalsStatus,
  );
  const [openFundamentalsFailureKey, setOpenFundamentalsFailureKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(initialError);
  const [coreUnavailable, setCoreUnavailable] = useState(() => initialMarket.state === "OFFLINE PLACEHOLDER");

  useEffect(() => {
    seedTradingApiJsonCache("/api/trading/eod/freshness", initialFreshness);
    seedTradingApiJsonCache(
      "/api/trading/disclosures/dart/fundamentals/daily/inspect?runs_limit=1",
      initialFundamentalsStatus,
    );
  }, [initialFreshness, initialFundamentalsStatus]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const [marketData, trackedData] = await Promise.all([
          getJson<CoreMarketStatus>("/api/trading/market/status"),
          getJson<CoreTrackedQuotesResponse>("/api/trading/quotes/tracked"),
        ]);

        if (!active) return;
        setMarket(marketData);
        setTracked(trackedData);
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

  useEffect(() => {
    let active = true;

    const loadFundamentalsStatus = async () => {
      try {
        const data = await getJson<DartFundamentalsDailyInspectResponseDto>(
          "/api/trading/disclosures/dart/fundamentals/daily/inspect?runs_limit=1",
        );
        if (!active) return;
        setFundamentalsStatus(data);
      } catch (fundamentalsStatusError) {
        console.error("Dashboard fundamentals status load failed", fundamentalsStatusError);
        if (!active) return;
        setFundamentalsStatus((current) => current);
      }
    };

    loadFundamentalsStatus();
    const timer = window.setInterval(loadFundamentalsStatus, 60_000);

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
  const latestFundamentalsDate = getFundamentalsFreshnessDate(freshness, fundamentalsStatus);
  const fundamentalsStatusLabel = getFundamentalsStatusLabel(freshness, fundamentalsStatus, latestFundamentalsDate);
  const fundamentalsTone = getFundamentalsTone(fundamentalsStatusLabel, latestFundamentalsDate);
  const fundamentalsFailureDetails = useMemo(
    () =>
      getFundamentalsFailureDetails(
        freshness,
        fundamentalsStatus,
        latestFundamentalsDate,
        fundamentalsStatusLabel,
      ),
    [freshness, fundamentalsStatus, latestFundamentalsDate, fundamentalsStatusLabel],
  );
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
      status: fundamentalsStatusLabel,
      meta: latestFundamentalsDate ?? "[확인 필요]",
      coverage: "Latest fundamentals update date",
      tone: fundamentalsTone,
    },
  ] as const;
  const integrityModuleRows = moduleRows.filter((row) => row.id !== "price");

  const eodStatusTone = getEodFreshnessTone(freshness);
  const eodStatusLabel = getEodStatusLabel(freshness);
  const hasEodStatusLabel = eodStatusLabel !== UNKNOWN_LABEL;
  const eodMarketDate = freshness?.today?.trade_date ?? UNKNOWN_LABEL;
  const eodLatestPriceDate = freshness?.latest?.price_trade_date ?? UNKNOWN_LABEL;
  const eodSuccessCount = formatEodSymbolCount(getEodSymbolsSucceeded(freshness));
  const eodTotalCount = formatEodSymbolCount(getEodSymbolsTotal(freshness));
  const marketBadgeLabel = market.is_open ? "Market Open" : "Market Closed";
  const fundamentalsDialogOpen =
    Boolean(fundamentalsFailureDetails) && openFundamentalsFailureKey === fundamentalsFailureDetails?.key;

  useEffect(() => {
    if (!fundamentalsDialogOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenFundamentalsFailureKey(null);
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [fundamentalsDialogOpen]);

  return (
    <MobileAppChrome
      activeNav="dashboard"
      header={
        <>
          <div className={styles.appHeaderBrand}>
            <div className={styles.brandMark}>K</div>
            <div>
              <strong className={styles.brandTitle}>Trading Dashboard</strong>
            </div>
          </div>

          <div className={styles.appHeaderActions}>
            <span className={`pill ${styles.marketStatusPill} ${market.is_open ? "positive" : "info"}`}>{marketBadgeLabel}</span>
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
            {hasEodStatusLabel ? <span className={`pill ${eodStatusTone}`}>{eodStatusLabel}</span> : null}
          </div>

          <div className={styles.integrityGrid}>
            <article className={styles.integrityStat}>
              <span>EOD Status</span>
              <strong>{eodStatusLabel}</strong>
              <p className={styles.eodStatusDetails}>
                Market date {eodMarketDate}
                <br />
                Latest EOD date {eodLatestPriceDate}
                <br />
                Success count {eodSuccessCount}
                <br />
                Total count {eodTotalCount}
              </p>
            </article>
            <article className={styles.integrityStat}>
              <span>Market State</span>
              <strong>{market.state}</strong>
              <p className="clamp-3">Server time {formatDisplayTimestamp(market.server_time)}</p>
            </article>
          </div>

          <div className={styles.moduleList}>
            {integrityModuleRows.map((row) => {
              const emphasizeSynced =
                row.status === "Synced" &&
                (row.id === "technical" || row.id === "action" || row.id === "fundamentals");

              return (
                <article key={row.id} className={styles.moduleRow}>
                  <div>
                    <strong>{row.label}</strong>
                    <p className="clamp-3">{row.coverage}</p>
                  </div>
                  <div className={styles.moduleAside}>
                    <span>{row.meta}</span>
                    {row.id === "fundamentals" && fundamentalsFailureDetails ? (
                      <button
                        type="button"
                        className={`pill ${row.tone} ${styles.statusButton}`}
                        aria-haspopup="dialog"
                        aria-expanded={fundamentalsDialogOpen}
                        aria-controls="fundamentals-failure-dialog"
                        onClick={() => setOpenFundamentalsFailureKey(fundamentalsFailureDetails.key)}
                      >
                        {row.status}
                      </button>
                    ) : (
                      <span className={`pill ${row.tone} ${emphasizeSynced ? styles.syncedStatusPill : ""}`}>{row.status}</span>
                    )}
                  </div>
                </article>
              );
            })}
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

      {fundamentalsDialogOpen && fundamentalsFailureDetails
        ? createPortal(
            <div className={styles.dialogBackdrop} onMouseDown={() => setOpenFundamentalsFailureKey(null)}>
              <section
                id="fundamentals-failure-dialog"
                className={styles.failureDialog}
                role="dialog"
                aria-modal="true"
                aria-labelledby="fundamentals-failure-title"
                aria-describedby="fundamentals-failure-reason"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <div className={styles.dialogHeader}>
                  <div>
                    <p className={styles.sectionEyebrow}>D2 Fundamentals</p>
                    <h2 id="fundamentals-failure-title" className={styles.dialogTitle}>
                      {fundamentalsFailureDetails.title}
                    </h2>
                  </div>
                  <button
                    type="button"
                    className={styles.dialogCloseButton}
                    onClick={() => setOpenFundamentalsFailureKey(null)}
                    aria-label="Close fundamentals failure details"
                    autoFocus
                  >
                    Close
                  </button>
                </div>

                <p id="fundamentals-failure-reason" className={styles.failureReason}>
                  {fundamentalsFailureDetails.reason}
                </p>

                <dl className={styles.failureDetailGrid}>
                  {fundamentalsFailureDetails.details.map((item) => (
                    <div key={item.label} className={styles.failureDetailItem}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
                    </div>
                  ))}
                </dl>

                {fundamentalsFailureDetails.metadata.length > 0 ? (
                  <div className={styles.metadataBlock}>
                    <strong>Failure metadata</strong>
                    <dl>
                      {fundamentalsFailureDetails.metadata.map((item) => (
                        <div key={item.label}>
                          <dt>{item.label}</dt>
                          <dd>{item.value}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ) : null}
              </section>
            </div>,
            document.body,
          )
        : null}
    </MobileAppChrome>
  );
}
