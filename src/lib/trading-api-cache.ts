import { getTradingApiClientBasePath, resolveTradingApiClientPath } from "@/lib/trading-api-client-path";
import { logWebDiagnostic, startWebDiagnosticSpan } from "@/lib/web-diagnostics";

const CACHE_STORAGE_KEY = "kai.trading-api.cache.v1";
const DEFAULT_CACHE_TTL_MS = 60 * 60 * 1000;
const TRENDING_CACHE_TTL_MS = 10 * 60 * 1000;
const SNAPSHOT_CACHE_KEY_PREFIX = "SNAPSHOT ";
// Daily batch status can move after EOD or DART jobs finish, but it is not quote-level market polling.
const DAILY_STATUS_CACHE_TTL_MS = 10 * 60 * 1000;
export const DEFAULT_TRADING_API_SNAPSHOT_TTL_MS = 60_000;

type TradingApiCacheEntry<T = unknown> = {
  cachedAt: number;
  expiresAt: number;
  data: T;
};

type TradingApiCacheStore = Record<string, TradingApiCacheEntry>;

type TradingApiCachePolicy = {
  ttlMs: number;
};

export type TradingApiJsonResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string | null; status: number };

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
  const resolvedInput = resolveTradingApiClientPath(input);
  if (typeof window === "undefined") return resolvedInput;

  try {
    const url = new URL(resolvedInput, window.location.origin);
    return url.origin === window.location.origin ? `${url.pathname}${url.search}` : url.toString();
  } catch {
    return resolvedInput;
  }
}

function normalizeTradingApiPolicyPath(path: string) {
  const resolvedPath = resolveTradingApiClientPath(path);
  try {
    const url = typeof window === "undefined" ? new URL(resolvedPath, "http://kai.local") : new URL(resolvedPath, window.location.origin);
    return url.pathname.replace(getTradingApiClientBasePath(), "/api/trading");
  } catch {
    return resolvedPath.split("?")[0]?.replace(getTradingApiClientBasePath(), "/api/trading") ?? resolvedPath;
  }
}

export function getTradingApiCacheTtlMs(path: string, init?: RequestInit) {
  if (getRequestMethod(init) !== "GET") return null;

  const pathname = normalizeTradingApiPolicyPath(path);
  if (!pathname.startsWith("/api/trading/")) return null;
  if (pathname.startsWith("/api/trading/quotes/")) return null;
  if (pathname === "/api/trading/market/status") return null;
  if (pathname === "/api/trading/market/snapshot") return null;
  if (pathname === "/api/trading/agent-context/feedback") return null;
  if (pathname === "/api/trading/agent-context/feedback/progress") return null;
  if (pathname === "/api/trading/eod/pipeline/status") return null;
  if (pathname.startsWith("/api/trading/execution/runtime/")) return null;
  if (pathname === "/api/trading/eod/freshness") return DAILY_STATUS_CACHE_TTL_MS;
  if (pathname === "/api/trading/disclosures/dart/fundamentals/daily/inspect") return DAILY_STATUS_CACHE_TTL_MS;

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

function getSnapshotCacheKey(path: string, init?: RequestInit) {
  return `${SNAPSHOT_CACHE_KEY_PREFIX}${getCacheKey(path, init)}`;
}

function getJsonErrorMessage(parsedBody: unknown) {
  if (!parsedBody || typeof parsedBody !== "object") return null;

  const body = parsedBody as Record<string, unknown>;
  for (const key of ["detail", "message", "error"]) {
    const value = body[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return null;
}

async function readJsonErrorMessage(response: Response) {
  const responseText = await response.text();
  if (!responseText) return null;

  try {
    return getJsonErrorMessage(JSON.parse(responseText));
  } catch {
    return responseText.trim() || null;
  }
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

export function readTradingApiJsonCacheData<T>(path: string, init?: RequestInit) {
  const policy = getCachePolicy(path, init);
  if (!policy) return null;

  return readCacheEntry<T>(getCacheKey(path, init))?.data ?? null;
}

export function readTradingApiJsonSnapshot<T>(path: string, init?: RequestInit) {
  return readCacheEntry<T>(getSnapshotCacheKey(path, init))?.data ?? null;
}

async function fetchTradingApiJsonResult<T>(path: string, init?: RequestInit): Promise<TradingApiJsonResult<T>> {
  const method = getRequestMethod(init);
  const span = startWebDiagnosticSpan("http", "request", {
    method,
    path,
    scope: "client-cache",
  });

  try {
    const response = await fetch(path, { ...init, cache: "no-store" });
    span.end({
      method,
      ok: response.ok,
      path: response.url || path,
      scope: "client-cache",
      status: response.status,
    });

    if (!response.ok) {
      const message = await readJsonErrorMessage(response);
      return { ok: false, message, status: response.status };
    }

    const data = (await response.json()) as T;
    return { ok: true, data };
  } catch (error) {
    span.fail(error, {
      method,
      path,
      scope: "client-cache",
    });
    throw error;
  }
}

export async function getTradingApiJsonResult<T>(path: string, init?: RequestInit): Promise<TradingApiJsonResult<T>> {
  const method = getRequestMethod(init);
  const policy = getCachePolicy(path, init);
  if (!policy) {
    logWebDiagnostic("http", "cache-bypass", {
      method,
      path,
      scope: "client-cache",
    });
    return fetchTradingApiJsonResult<T>(path, init);
  }

  const cacheKey = getCacheKey(path, init);
  const cached = readCacheEntry<T>(cacheKey);
  if (cached) {
    logWebDiagnostic("http", "cache-hit", {
      expiresInMs: Math.max(0, cached.expiresAt - getNow()),
      method,
      path,
      scope: "client-cache",
    });
    return { ok: true, data: cached.data };
  }

  logWebDiagnostic("http", "cache-miss", {
    method,
    path,
    scope: "client-cache",
    ttlMs: policy.ttlMs,
  });

  const inFlight = inFlightRequests.get(cacheKey);
  if (inFlight) {
    logWebDiagnostic("http", "cache-inflight-reuse", {
      method,
      path,
      scope: "client-cache",
    });
    return inFlight as Promise<TradingApiJsonResult<T>>;
  }

  const request = fetchTradingApiJsonResult<T>(path, init)
    .then((result) => {
      if (result.ok) {
        writeCacheEntry(cacheKey, result.data, policy.ttlMs);
        logWebDiagnostic("http", "cache-write", {
          method,
          path,
          scope: "client-cache",
          ttlMs: policy.ttlMs,
        });
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

export function seedTradingApiJsonSnapshot<T>(
  path: string,
  data: T,
  ttlMs = DEFAULT_TRADING_API_SNAPSHOT_TTL_MS,
  init?: RequestInit,
) {
  if (data === null || data === undefined) return;
  writeCacheEntry(getSnapshotCacheKey(path, init), data, ttlMs);
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
