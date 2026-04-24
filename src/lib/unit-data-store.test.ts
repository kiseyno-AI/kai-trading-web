import assert from "node:assert/strict";
import test from "node:test";

import {
  createUnitDataStore,
  getUnitDataPersistenceKey,
  getUnitDataRequestKey,
  type UnitDataRequestOptions,
  type UnitDataSnapshot,
  type UnitDataStorageAdapter,
} from "./unit-data-store";

type Clock = {
  advance: (ms: number) => void;
  now: () => number;
};

type Deferred<T> = {
  promise: Promise<T>;
  reject: (reason?: unknown) => void;
  resolve: (value: T) => void;
};

function createClock(initialValue = 0): Clock {
  let value = initialValue;

  return {
    advance(ms) {
      value += ms;
    },
    now() {
      return value;
    },
  };
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return {
    promise,
    reject,
    resolve,
  };
}

function createMemoryStorage(initialEntries: Record<string, string> = {}) {
  const values = new Map(Object.entries(initialEntries));

  const storage: UnitDataStorageAdapter = {
    getItem(key) {
      return values.get(key) ?? null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };

  return { storage, values };
}

function createRequest<T>(options: UnitDataRequestOptions<T>): UnitDataRequestOptions<T> {
  return options;
}

function readSnapshots<T>(
  snapshots: Array<UnitDataSnapshot<T>>,
  predicate: (snapshot: UnitDataSnapshot<T>) => boolean,
) {
  return snapshots.some(predicate);
}

test("creates deterministic request keys for nested object dimensions", () => {
  const first = getUnitDataRequestKey([
    "freshness",
    {
      filters: {
        includePreMarket: false,
        range: "1D",
      },
      symbol: "005930",
    },
  ]);

  const second = getUnitDataRequestKey([
    "freshness",
    {
      symbol: "005930",
      filters: {
        range: "1D",
        includePreMarket: false,
      },
    },
  ]);

  assert.equal(first, second);
});

test("returns in-memory cached data on repeated requests without refetching while fresh", async () => {
  const clock = createClock(1_000);
  const store = createUnitDataStore({ now: clock.now });
  let fetchCount = 0;

  const request = createRequest({
    fetcher: async () => {
      fetchCount += 1;
      return { value: fetchCount };
    },
    key: ["unit", "cache-hit"],
    ttlMs: 1_000,
  });

  const first = await store.ensure(request);
  assert.equal(fetchCount, 1);
  assert.equal(first.data?.value, 1);
  assert.equal(first.source, "network");
  assert.equal(first.isCached, false);

  const second = await store.ensure(request);
  assert.equal(fetchCount, 1);
  assert.equal(second.data?.value, 1);
  assert.equal(second.source, "memory");
  assert.equal(second.isCached, true);
  assert.equal(second.isStale, false);
});

test("revalidates stale cached data in the background and notifies subscribers with the refreshed result", async () => {
  const clock = createClock(10_000);
  const store = createUnitDataStore({ now: clock.now });
  const initialFetch = createDeferred<{ value: string }>();
  const refreshFetch = createDeferred<{ value: string }>();
  const snapshots: Array<UnitDataSnapshot<{ value: string }>> = [];
  let fetchCount = 0;

  const request = createRequest({
    fetcher: () => {
      fetchCount += 1;
      return fetchCount === 1 ? initialFetch.promise : refreshFetch.promise;
    },
    key: ["unit", "background-refresh"],
    ttlMs: 100,
  });

  const unsubscribe = store.subscribe(request, () => {
    snapshots.push(store.getSnapshot(request));
  });

  const firstPromise = store.ensure(request);
  assert.equal(store.getSnapshot(request).isInitialLoading, true);
  initialFetch.resolve({ value: "cached" });
  await firstPromise;

  clock.advance(150);

  const refreshPromise = store.ensure(request);
  const refreshing = store.getSnapshot(request);
  assert.equal(refreshing.data?.value, "cached");
  assert.equal(refreshing.isRefreshing, true);
  assert.equal(refreshing.isStale, true);
  assert.equal(refreshing.source, "memory");

  refreshFetch.resolve({ value: "fresh" });
  const refreshed = await refreshPromise;
  unsubscribe();

  assert.equal(refreshed.data?.value, "fresh");
  assert.equal(refreshed.isRefreshing, false);
  assert.equal(refreshed.source, "network");
  assert.ok(readSnapshots(snapshots, (snapshot) => snapshot.isRefreshing && snapshot.data?.value === "cached"));
  assert.ok(readSnapshots(snapshots, (snapshot) => !snapshot.isRefreshing && snapshot.data?.value === "fresh"));
});

test("deduplicates overlapping in-flight requests for the same key", async () => {
  const clock = createClock(5_000);
  const store = createUnitDataStore({ now: clock.now });
  const deferred = createDeferred<{ value: string }>();
  let fetchCount = 0;

  const request = createRequest({
    fetcher: () => {
      fetchCount += 1;
      return deferred.promise;
    },
    key: ["unit", "dedupe"],
    ttlMs: 1_000,
  });

  const first = store.ensure(request);
  const second = store.ensure(request);

  assert.equal(fetchCount, 1);
  assert.strictEqual(first, second);

  deferred.resolve({ value: "shared" });
  const [firstResult, secondResult] = await Promise.all([first, second]);

  assert.deepEqual(firstResult, secondResult);
  assert.equal(firstResult.data?.value, "shared");
});

test("keeps different request keys isolated from one another", async () => {
  const clock = createClock(2_000);
  const store = createUnitDataStore({ now: clock.now });

  const dailyRequest = createRequest({
    fetcher: async () => ({ scope: "daily" }),
    key: ["summary", { range: "1D", symbol: "005930" }],
    ttlMs: 1_000,
  });

  const weeklyRequest = createRequest({
    fetcher: async () => ({ scope: "weekly" }),
    key: ["summary", { range: "1W", symbol: "005930" }],
    ttlMs: 1_000,
  });

  await Promise.all([store.ensure(dailyRequest), store.ensure(weeklyRequest)]);

  assert.equal(store.getSnapshot(dailyRequest).data?.scope, "daily");
  assert.equal(store.getSnapshot(weeklyRequest).data?.scope, "weekly");
});

test("restores only safe persisted data and drops invalid persisted payloads", () => {
  const clock = createClock(20_000);
  const validRequestKey = getUnitDataRequestKey(["unit", "persisted-valid"]);
  const invalidRequestKey = getUnitDataRequestKey(["unit", "persisted-invalid"]);
  const { storage, values } = createMemoryStorage({
    [getUnitDataPersistenceKey(validRequestKey)]: JSON.stringify({
      data: { value: "persisted" },
      updatedAt: 19_500,
      version: "v1",
    }),
    [getUnitDataPersistenceKey(invalidRequestKey)]: JSON.stringify({
      data: { wrong: true },
      updatedAt: 19_500,
      version: "v1",
    }),
  });

  const store = createUnitDataStore({ now: clock.now });

  const validRequest = createRequest({
    fetcher: async () => ({ value: "network" }),
    key: ["unit", "persisted-valid"],
    persist: {
      deserialize(value) {
        if (
          typeof value !== "object" ||
          value === null ||
          !("value" in value) ||
          typeof value.value !== "string"
        ) {
          throw new Error("Invalid persisted unit data");
        }

        return { value: value.value };
      },
      storage,
      version: "v1",
    },
    ttlMs: 1_000,
  });

  const invalidRequest = createRequest({
    fetcher: async () => ({ value: "network" }),
    key: ["unit", "persisted-invalid"],
    persist: {
      deserialize(value) {
        if (
          typeof value !== "object" ||
          value === null ||
          !("value" in value) ||
          typeof value.value !== "string"
        ) {
          throw new Error("Invalid persisted unit data");
        }

        return { value: value.value };
      },
      storage,
      version: "v1",
    },
    ttlMs: 1_000,
  });

  const validSnapshot = store.getSnapshot(validRequest);
  const invalidSnapshot = store.getSnapshot(invalidRequest);

  assert.equal(validSnapshot.data?.value, "persisted");
  assert.equal(validSnapshot.source, "browser");
  assert.equal(validSnapshot.hasData, true);
  assert.equal(invalidSnapshot.hasData, false);
  assert.equal(values.has(getUnitDataPersistenceKey(invalidRequestKey)), false);
});

test("keeps cached data visible when background refresh fails", async () => {
  const clock = createClock(50_000);
  const store = createUnitDataStore({ now: clock.now });
  const initialFetch = createDeferred<{ value: string }>();
  const refreshFetch = createDeferred<{ value: string }>();
  let fetchCount = 0;

  const request = createRequest({
    fetcher: () => {
      fetchCount += 1;
      return fetchCount === 1 ? initialFetch.promise : refreshFetch.promise;
    },
    key: ["unit", "refresh-failure"],
    ttlMs: 100,
  });

  const firstPromise = store.ensure(request);
  initialFetch.resolve({ value: "cached" });
  await firstPromise;

  clock.advance(150);

  const refreshPromise = store.ensure(request);
  assert.equal(store.getSnapshot(request).data?.value, "cached");
  assert.equal(store.getSnapshot(request).isRefreshing, true);

  refreshFetch.reject(new Error("refresh failed"));
  const failed = await refreshPromise;

  assert.equal(failed.data?.value, "cached");
  assert.equal(failed.error?.message, "refresh failed");
  assert.equal(failed.hasData, true);
  assert.equal(failed.isRefreshing, false);
  assert.equal(failed.isStale, true);
  assert.equal(failed.source, "memory");
});
