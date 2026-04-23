"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ComponentTag } from "@/components/dev/component-tag";
import { DevModeToggle } from "@/components/dev/dev-mode-toggle";
import { MobileAppChrome } from "@/components/mobile/mobile-app-chrome";
import { useAppState } from "@/components/providers/app-state-provider";
import type { MessageTree } from "@/i18n/messages";
import { formatDisplayTimestamp, formatPrice, formatTurnover } from "@/lib/format";
import {
  MOBILE_TOOLBAR_FAVORITES_PATH,
  MOBILE_TOOLBAR_MARKET_STATUS_PATH,
  MOBILE_TOOLBAR_TRACKED_QUOTES_PATH,
} from "@/lib/mobile-toolbar-data";
import { getForwardableSymbolMetaSeedValue } from "@/lib/symbol-meta";
import {
  getTradingApiJsonResult,
  readTradingApiJsonCacheData,
  readTradingApiJsonSnapshot,
  seedTradingApiJsonSnapshot,
} from "@/lib/trading-api-cache";
import { resolveTradingApiClientPath } from "@/lib/trading-api-client-path";
import type { Locale } from "@/types/trading-api";

import styles from "./my-symbols-page.module.css";

type MySymbolsMessages = MessageTree["mySymbols"];

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
  state: "pending",
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

function getNumberLocale(locale: Locale) {
  return locale === "ko" ? "ko-KR" : "en-US";
}

function formatSignedPercent(value: number | null | undefined, fallback: string) {
  if (!hasNumber(value)) return fallback;
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatSignedNumber(value: number | null | undefined, fallback: string, locale: Locale) {
  if (!hasNumber(value)) return fallback;
  return `${value >= 0 ? "+" : ""}${value.toLocaleString(getNumberLocale(locale))}`;
}

function getAvailabilityLabel(item: TrackedQuote, copy: MySymbolsMessages) {
  if (!item.available) return copy.unavailable;
  if (item.is_live) return copy.live;
  if (item.fallback) return copy.fallback;
  return copy.synced;
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

function getQuoteSourceLabel(item: TrackedQuote, copy: MySymbolsMessages) {
  if (!item.available) {
    return item.unavailable_reason ? `${copy.quoteUnavailable} · ${item.unavailable_reason}` : copy.quoteUnavailable;
  }
  if (!item.fallback) {
    return item.is_live ? copy.liveKisQuote : item.source;
  }
  if (item.source === "daily_price_bar") {
    return item.trade_date ? `${copy.dbEodFallback} · ${item.trade_date}` : copy.dbEodFallback;
  }
  if (item.source === "db_cache") {
    return copy.sameDayDbQuoteCache;
  }
  if (item.source === "cache") {
    return copy.sameDayMemoryCache;
  }
  return `${item.source} ${copy.fallbackSuffix}`;
}

function getPriceFreshnessLabel(item: TrackedQuote, copy: MySymbolsMessages) {
  if (!item.available) return item.trade_date ?? copy.unavailable;
  if (item.is_live) return copy.live;
  if (item.trade_date) return item.trade_date;
  return formatDisplayTimestamp(item.as_of ?? item.cached_at, copy.pending);
}

function getMarketStateLabel(state: string, copy: MySymbolsMessages) {
  const normalizedState = state.trim().toLowerCase();
  if (!normalizedState || normalizedState === "pending" || normalizedState === "market status pending") {
    return copy.marketStatusPending;
  }

  return state;
}

function getMarketBadgeLabel(status: CoreMarketStatus, copy: MySymbolsMessages) {
  return status.is_open ? copy.marketOpen : getMarketStateLabel(status.state, copy);
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

async function loadJson<T>(path: string, label: string, copy: MySymbolsMessages): Promise<LoadResult<T>> {
  try {
    const result = await getTradingApiJsonResult<T>(resolveTradingApiClientPath(path));
    if (!result.ok) {
      return {
        data: null,
        error: `${label} ${copy.httpUnavailableSuffix} ${result.status}`,
      };
    }

    return {
      data: result.data,
      error: null,
    };
  } catch {
    return {
      data: null,
      error: `${label} ${copy.connectivityUnavailableSuffix}`,
    };
  }
}

function PanelUnavailable({ message, copy }: { message: string; copy: MySymbolsMessages }) {
  return (
    <div className={styles.panelState} role="status">
      <strong>{copy.unavailable}</strong>
      <p className="clamp-3">{message}</p>
    </div>
  );
}

function getInitialFavoriteItems() {
  return readTradingApiJsonCacheData<FavoriteSymbolsResponse>(MOBILE_TOOLBAR_FAVORITES_PATH)?.items ?? [];
}

export default function MySymbolsPageClient() {
  const { locale, t } = useAppState();
  const copy = t.mySymbols;
  const numberLocale = getNumberLocale(locale);
  const [marketStatus, setMarketStatus] = useState<CoreMarketStatus>(
    () => readTradingApiJsonSnapshot<CoreMarketStatus>(MOBILE_TOOLBAR_MARKET_STATUS_PATH) ?? DEFAULT_MARKET_STATUS,
  );
  const [marketError, setMarketError] = useState<string | null>(null);
  const [favoriteItems, setFavoriteItems] = useState<FavoriteSymbolItem[]>(() => getInitialFavoriteItems());
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [trackedQuotes, setTrackedQuotes] = useState<TrackedQuotesResponse>(
    () => readTradingApiJsonSnapshot<TrackedQuotesResponse>(MOBILE_TOOLBAR_TRACKED_QUOTES_PATH) ?? DEFAULT_TRACKED_QUOTES,
  );
  const [trackedError, setTrackedError] = useState<string | null>(null);
  const [loading, setLoading] = useState(
    () =>
      readTradingApiJsonSnapshot<CoreMarketStatus>(MOBILE_TOOLBAR_MARKET_STATUS_PATH) === null &&
      readTradingApiJsonCacheData<FavoriteSymbolsResponse>(MOBILE_TOOLBAR_FAVORITES_PATH) === null &&
      readTradingApiJsonSnapshot<TrackedQuotesResponse>(MOBILE_TOOLBAR_TRACKED_QUOTES_PATH) === null,
  );

  useEffect(() => {
    let cancelled = false;

    const loadPage = async () => {
      const [marketResult, favoriteResult, trackedResult] = await Promise.all([
        loadJson<CoreMarketStatus>("/api/trading/market/status", copy.marketStatus, copy),
        loadJson<FavoriteSymbolsResponse>("/api/trading/symbols/favorites", copy.favoriteSymbols, copy),
        loadJson<TrackedQuotesResponse>("/api/trading/quotes/tracked", copy.trackedSymbols, copy),
      ]);

      if (cancelled) return;

      if (marketResult.data) {
        seedTradingApiJsonSnapshot(MOBILE_TOOLBAR_MARKET_STATUS_PATH, marketResult.data);
      }
      if (trackedResult.data) {
        seedTradingApiJsonSnapshot(MOBILE_TOOLBAR_TRACKED_QUOTES_PATH, trackedResult.data);
      }

      setMarketStatus((current) => marketResult.data ?? current);
      setMarketError(marketResult.error);
      setFavoriteItems((current) => favoriteResult.data?.items ?? current);
      setFavoriteError(favoriteResult.error);
      setTrackedQuotes((current) => trackedResult.data ?? current);
      setTrackedError(trackedResult.error);
      setLoading(false);
    };

    void loadPage();

    return () => {
      cancelled = true;
    };
  }, [copy]);

  const favoriteBySymbol = Object.fromEntries(
    favoriteItems.map((item) => [normalizeSymbolCode(item.symbol), item] as const),
  );
  const favoriteSymbols = new Set(Object.keys(favoriteBySymbol));
  const trackedCount = trackedQuotes.items.length;
  const availableTrackedCount = trackedQuotes.items.filter((item) => item.available).length;
  const favoriteCount = favoriteItems.length;
  const lastRefreshLabel = formatDisplayTimestamp(
    trackedQuotes.as_of ?? marketStatus.server_time,
    loading ? copy.loading : copy.waitingForFirstRefresh,
  );
  const marketBadgeLabel = getMarketBadgeLabel(marketStatus, copy);
  const marketStateLabel = getMarketStateLabel(marketStatus.state, copy);

  return (
    <MobileAppChrome
      activeNav="symbols"
      mySymbolsHref="/my-symbols"
      header={
        <>
          <div className={styles.headerBrand}>
            <div className={styles.brandMark}>K</div>
            <div>
              <strong className={styles.brandTitle}>{copy.title}</strong>
              <span className={styles.brandMeta}>{copy.brandMeta}</span>
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
          <p className={styles.heroEyebrow}>{copy.breadcrumb}</p>
          <h1 className={styles.heroTitle}>{copy.title}</h1>
          <p className={`${styles.heroCopy} clamp-3`}>{copy.heroCopy}</p>

          <div className={styles.summaryGrid}>
            <article className={styles.summaryCard}>
              <span>{copy.coreFavoritesSummary}</span>
              <strong>{favoriteCount}</strong>
              <small>{favoriteError ? copy.favoriteFeedUnavailable : copy.symbolsPinnedFromSearch}</small>
            </article>
            <article className={styles.summaryCard}>
              <span>{copy.trackedQuotes}</span>
              <strong>{trackedCount}</strong>
              <small>{trackedError ? copy.trackedFeedUnavailable : `${availableTrackedCount} ${copy.currentlyAvailable}`}</small>
            </article>
            <article className={styles.summaryCard}>
              <span>{copy.lastRefresh}</span>
              <strong>{lastRefreshLabel}</strong>
              <small>{marketStateLabel}</small>
            </article>
          </div>

          <div className={styles.heroActions}>
            <Link href="/search" className={styles.primaryLink}>
              {copy.manageInSearch}
            </Link>
            <Link href="/dashboard" className={styles.secondaryLink}>
              {copy.backToDashboard}
            </Link>
          </div>

          {marketError ? <p className={styles.notice}>{marketError}</p> : null}
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionEyebrow}>{copy.coreFavorites}</p>
              <h2 className={styles.sectionTitle}>{copy.pinnedSymbols}</h2>
            </div>
            <span className={styles.sectionMeta}>{favoriteCount} {copy.saved}</span>
          </div>

          {favoriteError ? <PanelUnavailable message={favoriteError} copy={copy} /> : null}

          {!favoriteError && favoriteItems.length === 0 ? (
            <div className={styles.panelState}>
              <strong>{copy.noFavoritesSaved}</strong>
              <p className="clamp-3">{copy.noFavoritesCopy}</p>
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
                  <span>{item.market?.trim() || copy.marketPending}</span>
                </Link>
              ))}
            </div>
          ) : null}
        </section>

        <section className={styles.panel}>
          <div className={styles.sectionHeader}>
            <div>
              <p className={styles.sectionEyebrow}>{copy.trackedQuoteCoverage}</p>
              <h2 className={styles.sectionTitle}>{copy.fullTrackedList}</h2>
            </div>
            <span className={styles.sectionMeta}>{trackedCount} {copy.tracked}</span>
          </div>

          {trackedError ? <PanelUnavailable message={trackedError} copy={copy} /> : null}

          {!trackedError && trackedQuotes.items.length === 0 ? (
            <div className={styles.panelState}>
              <strong>{copy.noTrackedSymbolsYet}</strong>
              <p className="clamp-3">{copy.noTrackedSymbolsCopy}</p>
            </div>
          ) : null}

          {!trackedError && trackedQuotes.items.length > 0 ? (
            <div className={styles.trackedList} aria-label={copy.trackedSymbolsFullList}>
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
                          <span className={`${styles.badge} ${styles.badgeFavorite}`}>{copy.coreFavorite}</span>
                        ) : null}
                        <span className={`${styles.badge} ${getAvailabilityClassName(item)}`}>
                          {getAvailabilityLabel(item, copy)}
                        </span>
                      </div>
                    </div>

                    <div className={styles.priceRow}>
                      <div>
                        <strong>{item.available ? `₩${formatPrice(item.price, "-")}` : copy.notAvailable}</strong>
                        <span className={getChangeClassName(item.change_pct)}>
                          {item.available
                            ? `${formatSignedPercent(item.change_pct, copy.unavailable)} · ${formatSignedNumber(item.change, copy.unavailable, locale)}`
                            : item.unavailable_reason ?? copy.noFreshQuoteSource}
                        </span>
                      </div>
                      <span className={styles.updatedAt}>
                        {formatDisplayTimestamp(item.as_of ?? item.cached_at, copy.pending)}
                      </span>
                    </div>

                    <dl className={styles.metaGrid}>
                      <div>
                        <dt>{copy.priceFreshness}</dt>
                        <dd>{getPriceFreshnessLabel(item, copy)}</dd>
                      </div>
                      <div>
                        <dt>{copy.turnover}</dt>
                        <dd>{formatTurnover(item.turnover, "₩", copy.unavailable)}</dd>
                      </div>
                      <div>
                        <dt>{copy.volume}</dt>
                        <dd>{hasNumber(item.volume) ? item.volume.toLocaleString(numberLocale) : copy.unavailable}</dd>
                      </div>
                      <div>
                        <dt>{copy.source}</dt>
                        <dd>{getQuoteSourceLabel(item, copy)}</dd>
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
