const CACHE_STORAGE_KEY = "kai.trading-api.cache.v1";
const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000;
const TRENDING_CACHE_TTL_MS = 10 * 60 * 1000;

type TradingApiCacheEntry<T = unknown> = {
  cachedAt: number;
  expiresAt: number;
  data: T;
};

type TradingApiCacheStore = Record<string, TradingApiCacheEntry>;

type TradingApiCachePolicy = {
  ttlMs: number;
};

export type TradingApiJsonResult<T> = { ok: true; data: T } | { ok: false; status: number };

const memoryCache = new Map<string, TradingApiCacheEntry>();
const inFlightRequests = new Map<string, Promise<TradingApiJsonResult<unknown>>>();

function canUseSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function getNow() {
  return Date.now();
}

function parseCacheStore(value: string | null): TradingApiCacheStore {
  if (!value) return {};

  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as TradingApiCacheStore)
      : {};
  } catch {
    return {};
  }
}

function readCacheStore() {
  if (!canUseSessionStorage()) return {};
  return parseCacheStore(window.sessionStorage.getItem(CACHE_STORAGE_KEY));
}

function writeCacheStore(store: TradingApiCacheStore) {
  if (!canUseSessionStorage()) return;

  try {
    window.sessionStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Cache writes are best-effort; API reads should still work when storage is full or blocked.
  }
}

function getRequestMethod(init?: RequestInit) {
  return (init?.method ?? "GET").toUpperCase();
}

function normalizeTradingApiPath(input: string) {
  if (typeof window === "undefined") return input;

  try {
    const url = new URL(input, window.location.origin);
    return url.origin === window.location.origin ? `${url.pathname}${url.search}` : url.toString();
  } catch {
    return input;
  }
}

function normalizeTradingApiPolicyPath(path: string) {
  try {
    const url = typeof window === "undefined" ? new URL(path, "http://kai.local") : new URL(path, window.location.origin);
    return url.pathname;
  } catch {
    return path.split("?")[0] ?? path;
  }
}

export function getTradingApiCacheTtlMs(path: string, init?: RequestInit) {
  if (getRequestMethod(init) !== "GET") return null;

  const pathname = normalizeTradingApiPolicyPath(path);
  if (!pathname.startsWith("/api/trading/")) return null;
  if (pathname.startsWith("/api/trading/quotes/")) return null;
  if (pathname === "/api/trading/market/status") return null;
  if (pathname === "/api/trading/eod/freshness") return null;
  if (pathname === "/api/trading/disclosures/dart/fundamentals/daily/inspect") return null;

  if (
    pathname.startsWith("/api/trading/scanner/realtime-trending") ||
    pathname.startsWith("/api/trading/scanner/trending-stocks")
  ) {
    return TRENDING_CACHE_TTL_MS;
  }

  if (
    pathname.startsWith("/api/trading/eod/") ||
    pathname.startsWith("/api/trading/disclosures/dart/fundamentals/") ||
    pathname.startsWith("/api/trading/agent-context/") ||
    pathname.startsWith("/api/trading/symbols/") ||
    pathname.startsWith("/api/trading/scanner/tracked-symbols")
  ) {
    return DEFAULT_CACHE_TTL_MS;
  }

  return null;
}

function getCachePolicy(path: string, init?: RequestInit): TradingApiCachePolicy | null {
  const ttlMs = getTradingApiCacheTtlMs(path, init);
  return ttlMs === null ? null : { ttlMs };
}

function getCacheKey(path: string, init?: RequestInit) {
  return `${getRequestMethod(init)} ${normalizeTradingApiPath(path)}`;
}

function getFreshMemoryEntry<T>(cacheKey: string, now: number) {
  const entry = memoryCache.get(cacheKey);
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    memoryCache.delete(cacheKey);
    return null;
  }
  return entry as TradingApiCacheEntry<T>;
}

function getFreshSessionEntry<T>(cacheKey: string, now: number) {
  const store = readCacheStore();
  const entry = store[cacheKey];
  if (!entry) return null;
  if (entry.expiresAt <= now) {
    delete store[cacheKey];
    writeCacheStore(store);
    return null;
  }

  memoryCache.set(cacheKey, entry);
  return entry as TradingApiCacheEntry<T>;
}

function writeCacheEntry<T>(cacheKey: string, data: T, ttlMs: number) {
  const now = getNow();
  const entry: TradingApiCacheEntry<T> = {
    cachedAt: now,
    expiresAt: now + ttlMs,
    data,
  };

  memoryCache.set(cacheKey, entry);

  const store = readCacheStore();
  for (const [key, currentEntry] of Object.entries(store)) {
    if (currentEntry.expiresAt <= now) {
      delete store[key];
      memoryCache.delete(key);
    }
  }
  store[cacheKey] = entry;
  writeCacheStore(store);
}

function readCacheEntry<T>(cacheKey: string) {
  const now = getNow();
  return getFreshMemoryEntry<T>(cacheKey, now) ?? getFreshSessionEntry<T>(cacheKey, now);
}

async function fetchTradingApiJsonResult<T>(path: string, init?: RequestInit): Promise<TradingApiJsonResult<T>> {
  const response = await fetch(path, { ...init, cache: "no-store" });
  if (!response.ok) return { ok: false, status: response.status };
  const data = (await response.json()) as T;
  return { ok: true, data };
}

export async function getTradingApiJsonResult<T>(path: string, init?: RequestInit): Promise<TradingApiJsonResult<T>> {
  const policy = getCachePolicy(path, init);
  if (!policy) return fetchTradingApiJsonResult<T>(path, init);

  const cacheKey = getCacheKey(path, init);
  const cached = readCacheEntry<T>(cacheKey);
  if (cached) return { ok: true, data: cached.data };

  const inFlight = inFlightRequests.get(cacheKey);
  if (inFlight) return inFlight as Promise<TradingApiJsonResult<T>>;

  const request = fetchTradingApiJsonResult<T>(path, init)
    .then((result) => {
      if (result.ok) {
        writeCacheEntry(cacheKey, result.data, policy.ttlMs);
      }
      return result;
    })
    .finally(() => {
      inFlightRequests.delete(cacheKey);
    });

  inFlightRequests.set(cacheKey, request as Promise<TradingApiJsonResult<unknown>>);
  return request;
}

export async function getCachedTradingApiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const result = await getTradingApiJsonResult<T>(path, init);
  if (!result.ok) throw new Error(`HTTP ${result.status}`);
  return result.data;
}

export function seedTradingApiJsonCache<T>(path: string, data: T, init?: RequestInit) {
  const policy = getCachePolicy(path, init);
  if (!policy || data === null || data === undefined) return;
  writeCacheEntry(getCacheKey(path, init), data, policy.ttlMs);
}

export function invalidateTradingApiCacheByPathPrefix(prefixes: string[]) {
  const normalizedPrefixes = prefixes.map((prefix) => normalizeTradingApiPath(prefix));

  for (const key of memoryCache.keys()) {
    if (normalizedPrefixes.some((prefix) => key.includes(prefix))) {
      memoryCache.delete(key);
    }
  }

  const store = readCacheStore();
  let changed = false;
  for (const key of Object.keys(store)) {
    if (normalizedPrefixes.some((prefix) => key.includes(prefix))) {
      delete store[key];
      changed = true;
    }
  }

  if (changed) {
    writeCacheStore(store);
  }
}
