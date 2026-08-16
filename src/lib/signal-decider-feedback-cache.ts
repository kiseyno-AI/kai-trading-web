import type {
  AgentFeedbackListResponseDto,
  AgentFeedbackProgressResponseDto,
} from "@/types/trading-api";

import { normalizeSignalDeciderFeedbackItems } from "./signal-decider-feedback";

const CACHE_VERSION = 1;
const CACHE_PREFIX = "kai.signalDeciderFeedback.v1";
const CACHE_INDEX_KEY = `${CACHE_PREFIX}:dates`;
const CACHE_TTL_MS = 30 * 60 * 1000;
const RECOVERY_HINT_KEY = "kai.signalDeciderFeedbackRecovery.v1";

type CacheStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type SignalDeciderFeedbackCacheSource = "dashboard" | "detail" | "calendar";
export type SignalDeciderFeedbackRecoverySource = "backend-feedback" | "cached-feedback" | "dashboard";

export type SignalDeciderFeedbackCacheEntry = {
  cachedAt: number;
  feedback: AgentFeedbackListResponseDto;
  marketDate: string;
  progress: AgentFeedbackProgressResponseDto | null;
  source: SignalDeciderFeedbackCacheSource;
  version: typeof CACHE_VERSION;
};

type CacheIndex = {
  marketDates: string[];
  version: typeof CACHE_VERSION;
};

type SignalDeciderFeedbackRecoveryHint = {
  cachedAt: number;
  marketDate: string;
  source: "dashboard";
  version: typeof CACHE_VERSION;
};

export type SignalDeciderFeedbackRecoveryDate = {
  marketDate: string;
  source: SignalDeciderFeedbackRecoverySource;
};

function hasTextValue(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeMarketDate(value: string | null | undefined) {
  if (!hasTextValue(value)) return null;
  const trimmed = value.trim();
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
  return match?.[1] ?? trimmed;
}

function normalizeRecoveryMarketDate(value: string | null | undefined) {
  const normalized = normalizeMarketDate(value);
  return normalized && /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function getStorage(storage?: CacheStorage | null) {
  if (storage) return storage;
  if (typeof window === "undefined") return null;

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function getCacheKey(marketDate: string) {
  return `${CACHE_PREFIX}:${marketDate}`;
}

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function readIndex(storage: CacheStorage): CacheIndex {
  const parsed = parseJson<CacheIndex>(storage.getItem(CACHE_INDEX_KEY));

  if (parsed?.version === CACHE_VERSION && Array.isArray(parsed.marketDates)) {
    return {
      version: CACHE_VERSION,
      marketDates: parsed.marketDates.filter((date): date is string => typeof date === "string"),
    };
  }

  return {
    version: CACHE_VERSION,
    marketDates: [],
  };
}

function writeIndex(storage: CacheStorage, marketDates: string[]) {
  const uniqueDates = Array.from(new Set(marketDates.filter(hasTextValue)));
  storage.setItem(
    CACHE_INDEX_KEY,
    JSON.stringify({
      version: CACHE_VERSION,
      marketDates: uniqueDates,
    } satisfies CacheIndex),
  );
}

function removeCacheEntry(storage: CacheStorage, marketDate: string) {
  storage.removeItem(getCacheKey(marketDate));
  const index = readIndex(storage);
  writeIndex(
    storage,
    index.marketDates.filter((date) => date !== marketDate),
  );
}

export function getSignalDeciderFeedbackStoredRowCount(
  feedback: AgentFeedbackListResponseDto | null | undefined,
) {
  return normalizeSignalDeciderFeedbackItems(feedback).length;
}

export function isSignalDeciderFeedbackResponseForMarketDate(
  feedback: AgentFeedbackListResponseDto | null | undefined,
  marketDate: string,
) {
  if (!feedback) return false;

  const requestedMarketDate = normalizeMarketDate(feedback.request?.market_date);
  const items = normalizeSignalDeciderFeedbackItems(feedback);
  if (items.length > 0) {
    return items.every((item) => normalizeMarketDate(item.marketDate) === marketDate);
  }

  return requestedMarketDate === marketDate;
}

function isUsableCacheEntry(
  entry: SignalDeciderFeedbackCacheEntry | null,
  marketDate: string,
  now: number,
) {
  return (
    entry?.version === CACHE_VERSION &&
    entry.marketDate === marketDate &&
    now - entry.cachedAt <= CACHE_TTL_MS &&
    isSignalDeciderFeedbackResponseForMarketDate(entry.feedback, marketDate)
  );
}

export function writeSignalDeciderFeedbackCache({
  feedback,
  marketDate,
  now = Date.now(),
  progress,
  source,
  storage,
}: {
  feedback: AgentFeedbackListResponseDto | null | undefined;
  marketDate: string | null | undefined;
  now?: number;
  progress: AgentFeedbackProgressResponseDto | null | undefined;
  source: SignalDeciderFeedbackCacheSource;
  storage?: CacheStorage | null;
}) {
  const normalizedMarketDate = normalizeMarketDate(marketDate);
  const targetStorage = getStorage(storage);

  if (
    !normalizedMarketDate ||
    !targetStorage ||
    !feedback ||
    getSignalDeciderFeedbackStoredRowCount(feedback) <= 0 ||
    !isSignalDeciderFeedbackResponseForMarketDate(feedback, normalizedMarketDate)
  ) {
    return false;
  }

  const entry: SignalDeciderFeedbackCacheEntry = {
    version: CACHE_VERSION,
    marketDate: normalizedMarketDate,
    cachedAt: now,
    source,
    feedback,
    progress: progress ?? null,
  };

  try {
    targetStorage.setItem(getCacheKey(normalizedMarketDate), JSON.stringify(entry));
    const index = readIndex(targetStorage);
    writeIndex(targetStorage, [normalizedMarketDate, ...index.marketDates]);
    return true;
  } catch {
    return false;
  }
}

export function readSignalDeciderFeedbackCache(
  marketDate: string | null | undefined,
  {
    now = Date.now(),
    storage,
  }: {
    now?: number;
    storage?: CacheStorage | null;
  } = {},
) {
  const normalizedMarketDate = normalizeMarketDate(marketDate);
  const targetStorage = getStorage(storage);
  if (!normalizedMarketDate || !targetStorage) return null;

  const entry = parseJson<SignalDeciderFeedbackCacheEntry>(targetStorage.getItem(getCacheKey(normalizedMarketDate)));
  if (isUsableCacheEntry(entry, normalizedMarketDate, now)) return entry;

  removeCacheEntry(targetStorage, normalizedMarketDate);
  return null;
}

export function readLatestSignalDeciderFeedbackCache({
  now = Date.now(),
  storage,
}: {
  now?: number;
  storage?: CacheStorage | null;
} = {}) {
  const targetStorage = getStorage(storage);
  if (!targetStorage) return null;

  return readIndex(targetStorage)
    .marketDates.map((marketDate) => readSignalDeciderFeedbackCache(marketDate, { now, storage: targetStorage }))
    .filter((entry): entry is SignalDeciderFeedbackCacheEntry => entry !== null)
    .sort((left, right) => right.cachedAt - left.cachedAt)[0] ?? null;
}

export function readLatestSignalDeciderFeedbackCacheByMarketDate({
  now = Date.now(),
  storage,
}: {
  now?: number;
  storage?: CacheStorage | null;
} = {}) {
  const targetStorage = getStorage(storage);
  if (!targetStorage) return null;

  return readIndex(targetStorage)
    .marketDates.map((marketDate) => readSignalDeciderFeedbackCache(marketDate, { now, storage: targetStorage }))
    .filter((entry): entry is SignalDeciderFeedbackCacheEntry => entry !== null)
    .filter((entry) => getSignalDeciderFeedbackStoredRowCount(entry.feedback) > 0)
    .sort((left, right) => {
      const marketDateOrder = right.marketDate.localeCompare(left.marketDate);
      return marketDateOrder !== 0 ? marketDateOrder : right.cachedAt - left.cachedAt;
    })[0] ?? null;
}

export function writeSignalDeciderFeedbackRecoveryHint({
  marketDate,
  now = Date.now(),
  storage,
}: {
  marketDate: string | null | undefined;
  now?: number;
  storage?: CacheStorage | null;
}) {
  const normalizedMarketDate = normalizeRecoveryMarketDate(marketDate);
  const targetStorage = getStorage(storage);
  if (!normalizedMarketDate || !targetStorage) return false;

  const currentHint = readSignalDeciderFeedbackRecoveryHint({ now, storage: targetStorage });
  if (currentHint && currentHint.marketDate > normalizedMarketDate) return false;

  try {
    targetStorage.setItem(
      RECOVERY_HINT_KEY,
      JSON.stringify({
        version: CACHE_VERSION,
        marketDate: normalizedMarketDate,
        cachedAt: now,
        source: "dashboard",
      } satisfies SignalDeciderFeedbackRecoveryHint),
    );
    return true;
  } catch {
    return false;
  }
}

function readSignalDeciderFeedbackRecoveryHint({
  now = Date.now(),
  storage,
}: {
  now?: number;
  storage?: CacheStorage | null;
} = {}) {
  const targetStorage = getStorage(storage);
  if (!targetStorage) return null;

  const hint = parseJson<SignalDeciderFeedbackRecoveryHint>(targetStorage.getItem(RECOVERY_HINT_KEY));
  if (
    hint?.version === CACHE_VERSION &&
    hint.source === "dashboard" &&
    normalizeRecoveryMarketDate(hint.marketDate) === hint.marketDate &&
    now - hint.cachedAt <= CACHE_TTL_MS
  ) {
    return hint;
  }

  targetStorage.removeItem(RECOVERY_HINT_KEY);
  return null;
}

export function readLatestSignalDeciderFeedbackRecoveryDate({
  now = Date.now(),
  storage,
}: {
  now?: number;
  storage?: CacheStorage | null;
} = {}): SignalDeciderFeedbackRecoveryDate | null {
  const latestCacheEntry = readLatestSignalDeciderFeedbackCacheByMarketDate({ now, storage });
  const dashboardHint = readSignalDeciderFeedbackRecoveryHint({ now, storage });

  if (latestCacheEntry && (!dashboardHint || latestCacheEntry.marketDate >= dashboardHint.marketDate)) {
    return {
      marketDate: latestCacheEntry.marketDate,
      source: "cached-feedback",
    };
  }

  if (dashboardHint) {
    return {
      marketDate: dashboardHint.marketDate,
      source: dashboardHint.source,
    };
  }

  return null;
}

export function readSignalDeciderFeedbackCacheForMonth(
  monthKey: string,
  {
    now = Date.now(),
    storage,
  }: {
    now?: number;
    storage?: CacheStorage | null;
  } = {},
) {
  const targetStorage = getStorage(storage);
  if (!targetStorage) return [];

  return readIndex(targetStorage)
    .marketDates.filter((marketDate) => marketDate.startsWith(monthKey))
    .map((marketDate) => readSignalDeciderFeedbackCache(marketDate, { now, storage: targetStorage }))
    .filter((entry): entry is SignalDeciderFeedbackCacheEntry => entry !== null);
}

export function selectSignalDeciderFeedbackResponse({
  cached,
  fetched,
}: {
  cached: SignalDeciderFeedbackCacheEntry | null;
  fetched: AgentFeedbackListResponseDto;
}) {
  const cachedRowCount = getSignalDeciderFeedbackStoredRowCount(cached?.feedback);
  const fetchedRowCount = getSignalDeciderFeedbackStoredRowCount(fetched);

  if (cached && cachedRowCount > 0 && fetchedRowCount === 0) return cached.feedback;
  return fetched;
}
