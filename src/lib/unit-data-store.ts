const DEFAULT_UNIT_DATA_TTL_MS = 30_000;
const DEFAULT_UNIT_DATA_STORAGE_NAMESPACE = "kai.unit-data";

type UnitDataKeyPrimitive = string | number | boolean | null | undefined | Date;
type UnitDataKeyObject = {
  readonly [key: string]: UnitDataKeyValue;
};

export type UnitDataKeyValue = UnitDataKeyPrimitive | readonly UnitDataKeyValue[] | UnitDataKeyObject;
export type UnitDataKey = readonly UnitDataKeyValue[];

export type UnitDataCachePolicy = "cache-first-revalidate" | "network-first";
export type UnitDataSource = "none" | "memory" | "browser" | "network";

export type UnitDataSnapshot<T> = {
  data: T | null;
  error: Error | null;
  hasData: boolean;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  isCached: boolean;
  isStale: boolean;
  source: UnitDataSource;
  updatedAt: number | null;
};

export type UnitDataStorageAdapter = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type UnitDataPersistenceOptions<T> = {
  storage: UnitDataStorageAdapter | null;
  key?: string;
  maxAgeMs?: number;
  version: string;
  serialize?: (data: T) => unknown;
  deserialize?: (value: unknown) => T;
  shouldPersist?: (data: T) => boolean;
};

export type UnitDataRequestOptions<T> = {
  key: UnitDataKey;
  fetcher: () => Promise<T>;
  cachePolicy?: UnitDataCachePolicy;
  ttlMs?: number;
  persist?: false | UnitDataPersistenceOptions<T>;
};

type ResolvedUnitDataPersistenceOptions<T> = {
  storage: UnitDataStorageAdapter | null;
  storageKey: string;
  maxAgeMs: number;
  version: string;
  serialize: (data: T) => unknown;
  deserialize: (value: unknown) => T;
  shouldPersist: (data: T) => boolean;
};

type ResolvedUnitDataRequestOptions<T> = {
  cachePolicy: UnitDataCachePolicy;
  fetcher: () => Promise<T>;
  persist: ResolvedUnitDataPersistenceOptions<T> | null;
  requestKey: string;
  ttlMs: number;
};

type PersistedUnitDataRecord = {
  data: unknown;
  updatedAt: number;
  version: string;
};

type UnitDataEntry<T> = {
  data: T | null;
  error: Error | null;
  hasHydratedPersistenceKey: string | null;
  hasValue: boolean;
  inFlight: Promise<UnitDataSnapshot<T>> | null;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  listeners: Set<() => void>;
  snapshotCache: Map<number, UnitDataSnapshot<T>>;
  source: UnitDataSource;
  updatedAt: number | null;
};

type UnitDataStoreOptions = {
  now?: () => number;
};

function isDate(value: UnitDataKeyValue): value is Date {
  return value instanceof Date;
}

function isPlainObject(value: UnitDataKeyValue): value is UnitDataKeyObject {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !isDate(value);
}

function serializeUnitDataKeyValue(value: UnitDataKeyValue): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (isDate(value)) return `date:${value.toISOString()}`;
  if (Array.isArray(value)) return `[${value.map((item) => serializeUnitDataKeyValue(item)).join(",")}]`;
  if (isPlainObject(value)) {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${serializeUnitDataKeyValue(value[key])}`).join(",")}}`;
  }
  if (typeof value === "string") return `string:${JSON.stringify(value)}`;
  if (typeof value === "number") return Number.isFinite(value) ? `number:${String(value)}` : `number:${value.toString()}`;
  if (typeof value === "boolean") return `boolean:${value ? "true" : "false"}`;

  return `unknown:${String(value)}`;
}

export function getUnitDataRequestKey(key: UnitDataKey) {
  return key.map((part) => serializeUnitDataKeyValue(part)).join("|");
}

export function getUnitDataPersistenceKey(requestKey: string, storageKey?: string) {
  return `${DEFAULT_UNIT_DATA_STORAGE_NAMESPACE}:${storageKey ?? requestKey}`;
}

export function createBrowserStorageUnitDataAdapter(kind: "local" | "session"): UnitDataStorageAdapter | null {
  if (typeof window === "undefined") return null;

  let storage: Storage;
  try {
    storage = kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }

  return {
    getItem(key) {
      try {
        return storage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem(key, value) {
      try {
        storage.setItem(key, value);
      } catch {
        // Persistence is best-effort.
      }
    },
    removeItem(key) {
      try {
        storage.removeItem(key);
      } catch {
        // Persistence is best-effort.
      }
    },
  };
}

function getNow(defaultNow: () => number) {
  return defaultNow();
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(typeof error === "string" ? error : "Unknown unit data error");
}

function createEmptyEntry<T>(): UnitDataEntry<T> {
  return {
    data: null,
    error: null,
    hasHydratedPersistenceKey: null,
    hasValue: false,
    inFlight: null,
    isInitialLoading: false,
    isRefreshing: false,
    listeners: new Set(),
    snapshotCache: new Map(),
    source: "none",
    updatedAt: null,
  };
}

function getStableSnapshot<T>(entry: UnitDataEntry<T>, ttlMs: number, now: number): UnitDataSnapshot<T> {
  const hasData = entry.hasValue;
  const isStale = hasData && entry.updatedAt !== null ? entry.updatedAt + ttlMs <= now : false;
  const isCached = hasData && entry.source !== "network";
  const cachedSnapshot = entry.snapshotCache.get(ttlMs);

  if (
    cachedSnapshot &&
    cachedSnapshot.data === entry.data &&
    cachedSnapshot.error === entry.error &&
    cachedSnapshot.hasData === hasData &&
    cachedSnapshot.isCached === isCached &&
    cachedSnapshot.isInitialLoading === entry.isInitialLoading &&
    cachedSnapshot.isRefreshing === entry.isRefreshing &&
    cachedSnapshot.isStale === isStale &&
    cachedSnapshot.source === entry.source &&
    cachedSnapshot.updatedAt === entry.updatedAt
  ) {
    return cachedSnapshot;
  }

  const snapshot = {
    data: entry.data,
    error: entry.error,
    hasData,
    isCached,
    isInitialLoading: entry.isInitialLoading,
    isRefreshing: entry.isRefreshing,
    isStale,
    source: entry.source,
    updatedAt: entry.updatedAt,
  };

  entry.snapshotCache.set(ttlMs, snapshot);
  return snapshot;
}

function notifyEntry(entry: UnitDataEntry<unknown>) {
  for (const listener of entry.listeners) {
    listener();
  }
}

function parsePersistedUnitDataRecord(value: string | null): PersistedUnitDataRecord | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    const updatedAt = parsed.updatedAt;
    const version = parsed.version;

    if (typeof updatedAt !== "number" || !Number.isFinite(updatedAt) || typeof version !== "string") {
      return null;
    }

    return {
      data: parsed.data,
      updatedAt,
      version,
    };
  } catch {
    return null;
  }
}

function resolvePersistenceOptions<T>(
  requestKey: string,
  ttlMs: number,
  persist: UnitDataRequestOptions<T>["persist"],
): ResolvedUnitDataPersistenceOptions<T> | null {
  if (!persist) return null;

  return {
    deserialize: persist.deserialize ?? ((value) => value as T),
    maxAgeMs: persist.maxAgeMs ?? ttlMs,
    serialize: persist.serialize ?? ((value) => value),
    shouldPersist: persist.shouldPersist ?? (() => true),
    storage: persist.storage,
    storageKey: getUnitDataPersistenceKey(requestKey, persist.key),
    version: persist.version,
  };
}

function resolveRequestOptions<T>(options: UnitDataRequestOptions<T>): ResolvedUnitDataRequestOptions<T> {
  const requestKey = getUnitDataRequestKey(options.key);
  const ttlMs = options.ttlMs ?? DEFAULT_UNIT_DATA_TTL_MS;

  return {
    cachePolicy: options.cachePolicy ?? "cache-first-revalidate",
    fetcher: options.fetcher,
    persist: resolvePersistenceOptions(requestKey, ttlMs, options.persist),
    requestKey,
    ttlMs,
  };
}

function readPersistedSnapshot<T>(
  entry: UnitDataEntry<T>,
  resolved: ResolvedUnitDataRequestOptions<T>,
  now: number,
) {
  if (resolved.persist === null || entry.hasValue) {
    return;
  }

  const persistenceKey = `${resolved.persist.storageKey}:${resolved.persist.version}`;
  if (entry.hasHydratedPersistenceKey === persistenceKey) {
    return;
  }

  entry.hasHydratedPersistenceKey = persistenceKey;

  const raw = resolved.persist.storage?.getItem(resolved.persist.storageKey) ?? null;
  const record = parsePersistedUnitDataRecord(raw);
  if (!record) {
    resolved.persist.storage?.removeItem(resolved.persist.storageKey);
    return;
  }

  if (record.version !== resolved.persist.version || record.updatedAt + resolved.persist.maxAgeMs <= now) {
    resolved.persist.storage?.removeItem(resolved.persist.storageKey);
    return;
  }

  try {
    entry.data = resolved.persist.deserialize(record.data);
    entry.error = null;
    entry.hasValue = true;
    entry.source = "browser";
    entry.updatedAt = record.updatedAt;
  } catch {
    entry.data = null;
    entry.error = null;
    entry.hasValue = false;
    entry.source = "none";
    entry.updatedAt = null;
    resolved.persist.storage?.removeItem(resolved.persist.storageKey);
  }
}

function persistEntry<T>(entry: UnitDataEntry<T>, resolved: ResolvedUnitDataRequestOptions<T>) {
  if (resolved.persist === null || !entry.hasValue) return;
  const data = entry.data as T;

  if (!resolved.persist.shouldPersist(data)) {
    resolved.persist.storage?.removeItem(resolved.persist.storageKey);
    return;
  }

  try {
    const record: PersistedUnitDataRecord = {
      data: resolved.persist.serialize(data),
      updatedAt: entry.updatedAt ?? 0,
      version: resolved.persist.version,
    };

    resolved.persist.storage?.setItem(resolved.persist.storageKey, JSON.stringify(record));
  } catch {
    // Persistence is best-effort.
  }
}

function markCachedSource(entry: UnitDataEntry<unknown>) {
  if (entry.source === "network") {
    entry.source = "memory";
  }
}

export function createUnitDataStore({ now = Date.now }: UnitDataStoreOptions = {}) {
  const entries = new Map<string, UnitDataEntry<unknown>>();

  function getEntry<T>(resolved: ResolvedUnitDataRequestOptions<T>) {
    const existing = entries.get(resolved.requestKey) as UnitDataEntry<T> | undefined;
    if (existing) {
      return existing;
    }

    const created = createEmptyEntry<T>();
    entries.set(resolved.requestKey, created as UnitDataEntry<unknown>);
    return created;
  }

  function getSnapshot<T>(options: UnitDataRequestOptions<T>) {
    const resolved = resolveRequestOptions(options);
    const entry = getEntry(resolved);
    const currentNow = getNow(now);
    readPersistedSnapshot(entry, resolved, currentNow);
    return getStableSnapshot(entry, resolved.ttlMs, currentNow);
  }

  function subscribe<T>(options: UnitDataRequestOptions<T>, listener: () => void) {
    const resolved = resolveRequestOptions(options);
    const entry = getEntry(resolved);
    entry.listeners.add(listener);

    return () => {
      entry.listeners.delete(listener);
      if (entry.listeners.size === 0 && entry.inFlight === null && !entry.hasValue) {
        entries.delete(resolved.requestKey);
      }
    };
  }

  function runFetch<T>(
    entry: UnitDataEntry<T>,
    resolved: ResolvedUnitDataRequestOptions<T>,
  ): Promise<UnitDataSnapshot<T>> {
    const request = resolved.fetcher()
      .then((data) => {
        entry.data = data;
        entry.error = null;
        entry.hasValue = true;
        entry.isInitialLoading = false;
        entry.isRefreshing = false;
        entry.source = "network";
        entry.updatedAt = getNow(now);
        persistEntry(entry, resolved);
        notifyEntry(entry as UnitDataEntry<unknown>);
        return getStableSnapshot(entry, resolved.ttlMs, getNow(now));
      })
      .catch((error) => {
        entry.error = toError(error);
        entry.isInitialLoading = false;
        entry.isRefreshing = false;
        if (!entry.hasValue) {
          entry.source = "none";
        }
        notifyEntry(entry as UnitDataEntry<unknown>);
        return getStableSnapshot(entry, resolved.ttlMs, getNow(now));
      })
      .finally(() => {
        entry.inFlight = null;
      });

    entry.inFlight = request;
    return request;
  }

  function ensure<T>(options: UnitDataRequestOptions<T>, force = false) {
    const resolved = resolveRequestOptions(options);
    const entry = getEntry(resolved);
    const currentNow = getNow(now);

    readPersistedSnapshot(entry, resolved, currentNow);

    if (entry.inFlight) {
      return entry.inFlight;
    }

    const snapshot = getStableSnapshot(entry, resolved.ttlMs, currentNow);
    const shouldFetch =
      force ||
      !snapshot.hasData ||
      resolved.cachePolicy === "network-first" ||
      snapshot.isStale;

    if (!shouldFetch) {
      const previousSource = entry.source;
      markCachedSource(entry as UnitDataEntry<unknown>);
      if (entry.source !== previousSource) {
        notifyEntry(entry as UnitDataEntry<unknown>);
      }
      return Promise.resolve(getStableSnapshot(entry, resolved.ttlMs, getNow(now)));
    }

    if (snapshot.hasData) {
      entry.error = null;
      entry.isInitialLoading = false;
      entry.isRefreshing = true;
      markCachedSource(entry as UnitDataEntry<unknown>);
    } else {
      entry.error = null;
      entry.isInitialLoading = true;
      entry.isRefreshing = false;
    }

    notifyEntry(entry as UnitDataEntry<unknown>);
    return runFetch(entry, resolved);
  }

  function revalidate<T>(options: UnitDataRequestOptions<T>) {
    return ensure(options, true);
  }

  return {
    ensure,
    getSnapshot,
    revalidate,
    subscribe,
  };
}

export const unitDataStore = createUnitDataStore();
