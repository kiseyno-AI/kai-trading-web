"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ComponentTag } from "@/components/dev/component-tag";
import { DevModeToggle } from "@/components/dev/dev-mode-toggle";
import { MobileAppChrome } from "@/components/mobile/mobile-app-chrome";
import { formatDisplayTimestamp, formatPrice, formatTurnover } from "@/lib/format";
import { getForwardableSymbolMetaSeedValue } from "@/lib/symbol-meta";
import { getTradingApiJsonResult } from "@/lib/trading-api-cache";
import { resolveTradingApiClientPath } from "@/lib/trading-api-client-path";

import styles from "./my-symbols-page.module.css";

type CoreMarketStatus = {
  state: string;
  is_open: boolean;
  server_time: string | null;
};

type FavoriteSymbolItem = {
  symbol: string;
  standard_code: string | null;
  name_ko: string | null;
  market: string | null;
};

type FavoriteSymbolsResponse = {
  count: number;
  items: FavoriteSymbolItem[];
};

type TrackedQuote = {
  symbol: string;
  company_name?: string | null;
  name?: string | null;
  name_ko?: string | null;
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

type TrackedQuotesResponse = {
  market_state: string;
  as_of: string | null;
  items: TrackedQuote[];
};

type LoadResult<T> = {
  data: T | null;
  error: string | null;
};

const DEFAULT_MARKET_STATUS: CoreMarketStatus = {
  state: "MARKET STATUS PENDING",
  is_open: false,
  server_time: null,
};

const DEFAULT_TRACKED_QUOTES: TrackedQuotesResponse = {
  market_state: "pending",
  as_of: null,
  items: [],
};

function hasNumber(value: number | null | undefined): value is number {
  return typeof value === "number";
}

function normalizeSymbolCode(value: string) {
  return value.trim().toUpperCase();
}

function formatSignedPercent(value: number | null | undefined, fallback = "Unavailable") {
  if (!hasNumber(value)) return fallback;
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatSignedNumber(value: number | null | undefined, fallback = "Unavailable") {
  if (!hasNumber(value)) return fallback;
  return `${value >= 0 ? "+" : ""}${value.toLocaleString("ko-KR")}`;
}

function getAvailabilityLabel(item: TrackedQuote) {
  if (!item.available) return "Unavailable";
  if (item.is_live) return "Live";
  if (item.fallback) return "Fallback";
  return "Synced";
}

function getAvailabilityClassName(item: TrackedQuote) {
  if (!item.available) return styles.badgeWarning;
  if (item.is_live) return styles.badgePositive;
  return styles.badgeInfo;
}

function getChangeClassName(value: number | null | undefined) {
  if (!hasNumber(value)) return styles.neutralText;
  return value >= 0 ? styles.positiveText : styles.negativeText;
}

function getDisplayName(item: TrackedQuote, favoriteItem?: FavoriteSymbolItem | null) {
  const normalizedSymbol = normalizeSymbolCode(item.symbol);
  const candidates = [
    item.company_name,
    item.name_ko,
    item.name,
    favoriteItem?.name_ko,
  ];

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed && normalizeSymbolCode(trimmed) !== normalizedSymbol) {
      return trimmed;
    }
  }

  return normalizedSymbol;
}

function getQuoteSourceLabel(item: TrackedQuote) {
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

function getPriceFreshnessLabel(item: TrackedQuote) {
  if (!item.available) return item.trade_date ?? "Unavailable";
  if (item.is_live) return "Live";
  if (item.trade_date) return item.trade_date;
  return formatDisplayTimestamp(item.as_of ?? item.cached_at, "Pending");
}

function buildSymbolHref(symbol: string, favoriteItem?: FavoriteSymbolItem | null) {
  const params = new URLSearchParams();
  const name = getForwardableSymbolMetaSeedValue(favoriteItem?.name_ko);
  const market = getForwardableSymbolMetaSeedValue(favoriteItem?.market);
  const standardCode = getForwardableSymbolMetaSeedValue(favoriteItem?.standard_code);

  if (name) params.set("name", name);
  if (market) params.set("market", market);
  if (standardCode) params.set("standardCode", standardCode);

  const query = params.toString();
  return `/dashboard/symbol/${encodeURIComponent(symbol)}${query ? `?${query}` : ""}`;
}

async function loadJson<T>(path: string, label: string): Promise<LoadResult<T>> {
  try {
    const result = await getTradingApiJsonResult<T>(resolveTradingApiClientPath(path));
    if (!result.ok) {
      return {
        data: null,
        error: `${label} unavailable. HTTP ${result.status}`,
      };
    }

    return {
      data: result.data,
      error: null,
    };
  } catch {
    return {
      data: null,
      error: `${label} unavailable. Check trading-core connectivity.`,
    };
  }
}

function PanelUnavailable({ message }: { message: string }) {
  return (
    <div className={styles.panelState} role="status">
      <strong>Unavailable</strong>
      <p className="clamp-3">{message}</p>
    </div>
  );
}

export default function MySymbolsPageClient() {
  const [marketStatus, setMarketStatus] = useState<CoreMarketStatus>(DEFAULT_MARKET_STATUS);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [favoriteItems, setFavoriteItems] = useState<FavoriteSymbolItem[]>([]);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [trackedQuotes, setTrackedQuotes] = useState<TrackedQuotesResponse>(DEFAULT_TRACKED_QUOTES);
  const [trackedError, setTrackedError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const loadPage = async () => {
      setLoading(true);

      const [marketResult, favoriteResult, trackedResult] = await Promise.all([
        loadJson<CoreMarketStatus>("/api/trading/market/status", "Market status"),
        loadJson<FavoriteSymbolsResponse>("/api/trading/symbols/favorites", "Favorite symbols"),
        loadJson<TrackedQuotesResponse>("/api/trading/quotes/tracked", "Tracked symbols"),
      ]);

      if (cancelled) return;

      setMarketStatus(marketResult.data ?? DEFAULT_MARKET_STATUS);
      setMarketError(marketResult.error);
      setFavoriteItems(favoriteResult.data?.items ?? []);
      setFavoriteError(favoriteResult.error);
      setTrackedQuotes(trackedResult.data ?? DEFAULT_TRACKED_QUOTES);
      setTrackedError(trackedResult.error);
      setLoading(false);
    };

    void loadPage();

    return () => {
      cancelled = true;
    };
  }, []);

  const favoriteBySymbol = Object.fromEntries(
    favoriteItems.map((item) => [normalizeSymbolCode(item.symbol), item] as const),
  );
  const favoriteSymbols = new Set(Object.keys(favoriteBySymbol));
  const trackedCount = trackedQuotes.items.length;
  const availableTrackedCount = trackedQuotes.items.filter((item) => item.available).length;
  const favoriteCount = favoriteItems.length;
  const lastRefreshLabel = formatDisplayTimestamp(
    trackedQuotes.as_of ?? marketStatus.server_time,
    loading ? "Loading..." : "Waiting for first refresh",
  );
  const marketBadgeLabel = marketStatus.is_open ? "Market Open" : marketStatus.state;

  return (
    <MobileAppChrome
      activeNav="symbols"
      mySymbolsHref="/my-symbols"
      header={
        <>
          <div className={styles.headerBrand}>
            <div className={styles.brandMark}>K</div>
            <div>
              <strong className={styles.brandTitle}>My Symbols</strong>
              <span className={styles.brandMeta}>Tracked and favorite coverage</span>
            </div>
          </div>

          <div className={styles.headerActions}>
            <span className={`${styles.marketPill} ${marketStatus.is_open ? styles.marketPillPositive : styles.marketPillNeutral}`}>
              {marketBadgeLabel}
            </span>
            <DevModeToggle />
          </div>
        </>
      }
    >
      <div className={styles.page}>
        <section className={`${styles.panel} ${styles.heroPanel}`}>
          <ComponentTag label="my-symbols.summary" api="/api/trading/market/status + /api/trading/symbols/favorites + /api/trading/quotes/tracked" />
          <p className={styles.heroEyebrow}>Toolbar &gt; My Symbols</p>
          <h1 className={styles.heroTitle}>My Symbols</h1>
          <p className={`${styles.heroCopy} clamp-3`}>
            Keep core favorites pinned at the top and open the full tracked quote list without jumping back into the
            dashboard panel.
          </p>

          <div className={styles.summaryGrid}>
            <article className={styles.summaryCard}>
              <span>Core favorites</span>
              <strong>{favoriteCount}</strong>
              <small>{favoriteError ? "Favorite feed unavailable" : "Symbols pinned from search"}</small>
            </article>
            <article className={styles.summaryCard}>
              <span>Tracked quotes</span>
              <strong>{trackedCount}</strong>
              <small>{trackedError ? "Tracked feed unavailable" : `${availableTrackedCount} currently available`}</small>
            </article>
            <article className={styles.summaryCard}>
              <span>Last refresh</span>
              <strong>{lastRefreshLabel}</strong>
              <small>{marketStatus.state}</small>
            </article>
          </div>

          <div className={styles.heroActions}>
            <Link href="/search" className={styles.primaryLink}>
              Manage in Search
            </Link>
            <Link href="/dashboard" className={styles.secondaryLink}>
              Back to Dashboard
            </Link>
          </div>

          {marketError ? <p className={styles.notice}>{marketError}</p> : null}
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionEyebrow}>Core Favorites</p>
              <h2 className={styles.sectionTitle}>Pinned symbols</h2>
            </div>
            <span className={styles.sectionMeta}>{favoriteCount} saved</span>
          </div>

          {favoriteError ? <PanelUnavailable message={favoriteError} /> : null}

          {!favoriteError && favoriteItems.length === 0 ? (
            <div className={styles.panelState}>
              <strong>No favorites saved.</strong>
              <p className="clamp-3">Use the search page to pin core favorites that should stay at the top of My Symbols.</p>
            </div>
          ) : null}

          {!favoriteError && favoriteItems.length > 0 ? (
            <div className={styles.favoriteGrid}>
              {favoriteItems.map((item) => (
                <Link
                  key={item.symbol}
                  href={buildSymbolHref(item.symbol, item)}
                  className={styles.favoriteCard}
                >
                  <div>
                    <strong>{item.name_ko?.trim() || item.symbol}</strong>
                    <p>{item.symbol}</p>
                  </div>
                  <span>{item.market?.trim() || "Market pending"}</span>
                </Link>
              ))}
            </div>
          ) : null}
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionEyebrow}>Tracked Quote Coverage</p>
              <h2 className={styles.sectionTitle}>Full tracked list</h2>
            </div>
            <span className={styles.sectionMeta}>{trackedCount} tracked</span>
          </div>

          {trackedError ? <PanelUnavailable message={trackedError} /> : null}

          {!trackedError && trackedQuotes.items.length === 0 ? (
            <div className={styles.panelState}>
              <strong>No tracked symbols yet.</strong>
              <p className="clamp-3">Tracked quotes will appear here once the scanner is following at least one symbol.</p>
            </div>
          ) : null}

          {!trackedError && trackedQuotes.items.length > 0 ? (
            <div className={styles.trackedList} aria-label="Tracked symbols full list">
              {trackedQuotes.items.map((item) => {
                const favoriteItem = favoriteBySymbol[normalizeSymbolCode(item.symbol)] ?? null;

                return (
                  <Link
                    key={item.symbol}
                    href={buildSymbolHref(item.symbol, favoriteItem)}
                    className={styles.trackedCard}
                  >
                    <div className={styles.cardHeader}>
                      <div className={styles.identityBlock}>
                        <strong>{getDisplayName(item, favoriteItem)}</strong>
                        <p>{item.symbol}</p>
                      </div>

                      <div className={styles.badgeGroup}>
                        {favoriteSymbols.has(normalizeSymbolCode(item.symbol)) ? (
                          <span className={`${styles.badge} ${styles.badgeFavorite}`}>Core favorite</span>
                        ) : null}
                        <span className={`${styles.badge} ${getAvailabilityClassName(item)}`}>
                          {getAvailabilityLabel(item)}
                        </span>
                      </div>
                    </div>

                    <div className={styles.priceRow}>
                      <div>
                        <strong>{item.available ? `₩${formatPrice(item.price, "-")}` : "N/A"}</strong>
                        <span className={getChangeClassName(item.change_pct)}>
                          {item.available
                            ? `${formatSignedPercent(item.change_pct)} · ${formatSignedNumber(item.change)}`
                            : item.unavailable_reason ?? "No fresh quote source"}
                        </span>
                      </div>
                      <span className={styles.updatedAt}>
                        {formatDisplayTimestamp(item.as_of ?? item.cached_at, "Pending")}
                      </span>
                    </div>

                    <dl className={styles.metaGrid}>
                      <div>
                        <dt>Price freshness</dt>
                        <dd>{getPriceFreshnessLabel(item)}</dd>
                      </div>
                      <div>
                        <dt>Turnover</dt>
                        <dd>{formatTurnover(item.turnover, "₩", "Unavailable")}</dd>
                      </div>
                      <div>
                        <dt>Volume</dt>
                        <dd>{hasNumber(item.volume) ? item.volume.toLocaleString("ko-KR") : "Unavailable"}</dd>
                      </div>
                      <div>
                        <dt>Source</dt>
                        <dd>{getQuoteSourceLabel(item)}</dd>
                      </div>
                    </dl>
                  </Link>
                );
              })}
            </div>
          ) : null}
        </section>
      </div>
    </MobileAppChrome>
  );
}
