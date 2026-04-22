import {
  DEFAULT_TRADING_API_SNAPSHOT_TTL_MS,
  getTradingApiJsonResult,
  seedTradingApiJsonSnapshot,
} from "@/lib/trading-api-cache";
import { resolveTradingApiClientPath } from "@/lib/trading-api-client-path";

export type MobileToolbarViewKey = "dashboard" | "search" | "symbols";

export const MOBILE_TOOLBAR_MARKET_STATUS_PATH = "/api/trading/market/status";
export const MOBILE_TOOLBAR_TRACKED_QUOTES_PATH = "/api/trading/quotes/tracked";
export const MOBILE_TOOLBAR_FAVORITES_PATH = "/api/trading/symbols/favorites";
export const MOBILE_TOOLBAR_TRACKED_SYMBOLS_PATH = "/api/trading/scanner/tracked-symbols";
export const MOBILE_TOOLBAR_INITIAL_TRENDING_LIMIT = 5;

const MOBILE_TOOLBAR_TRENDING_SOURCES = "volume-rank,fluctuation,hts-top-view";

let searchViewWarmPromise: Promise<void> | null = null;
let trackedQuotesWarmPromise: Promise<void> | null = null;

export function buildMobileToolbarTrendingPath(limit = MOBILE_TOOLBAR_INITIAL_TRENDING_LIMIT) {
  const params = new URLSearchParams({
    limit: String(limit),
    market_code: "J",
    sources: MOBILE_TOOLBAR_TRENDING_SOURCES,
  });

  return `/api/trading/scanner/realtime-trending?${params.toString()}`;
}

function warmSearchViewData() {
  if (typeof window === "undefined") return Promise.resolve();
  if (searchViewWarmPromise) return searchViewWarmPromise;

  searchViewWarmPromise = Promise.allSettled([
    getTradingApiJsonResult(MOBILE_TOOLBAR_FAVORITES_PATH),
    getTradingApiJsonResult(MOBILE_TOOLBAR_TRACKED_SYMBOLS_PATH),
    getTradingApiJsonResult(buildMobileToolbarTrendingPath()),
  ])
    .then(() => undefined)
    .finally(() => {
      searchViewWarmPromise = null;
    });

  return searchViewWarmPromise;
}

function warmTrackedQuotesData() {
  if (typeof window === "undefined") return Promise.resolve();
  if (trackedQuotesWarmPromise) return trackedQuotesWarmPromise;

  trackedQuotesWarmPromise = fetch(resolveTradingApiClientPath(MOBILE_TOOLBAR_TRACKED_QUOTES_PATH), {
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok) return;
      const data = (await response.json()) as unknown;
      seedTradingApiJsonSnapshot(
        MOBILE_TOOLBAR_TRACKED_QUOTES_PATH,
        data,
        DEFAULT_TRADING_API_SNAPSHOT_TTL_MS,
      );
    })
    .catch(() => undefined)
    .finally(() => {
      trackedQuotesWarmPromise = null;
    });

  return trackedQuotesWarmPromise;
}

export function warmMobileToolbarViewData(activeView: MobileToolbarViewKey) {
  if (activeView === "dashboard") {
    return warmSearchViewData();
  }

  if (activeView === "search") {
    return warmTrackedQuotesData();
  }

  return warmSearchViewData();
}
