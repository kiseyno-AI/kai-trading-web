"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

import {
  type UnitDataRequestOptions,
  type UnitDataSnapshot,
  unitDataStore,
} from "@/lib/unit-data-store";

type UseUnitDataOptions<T> = UnitDataRequestOptions<T> & {
  enabled?: boolean;
};

export type UseUnitDataResult<T> = UnitDataSnapshot<T> & {
  refetch: () => Promise<UnitDataSnapshot<T>>;
};

function createIdleSnapshot<T>(): UnitDataSnapshot<T> {
  return {
    data: null,
    error: null,
    hasData: false,
    isCached: false,
    isInitialLoading: false,
    isRefreshing: false,
    isStale: false,
    source: "none",
    updatedAt: null,
  };
}

export function useUnitData<T>(options: UseUnitDataOptions<T>): UseUnitDataResult<T> {
  const enabled = options.enabled ?? true;
  const idleSnapshot = useMemo(() => createIdleSnapshot<T>(), []);
  const resolvedRequestOptions = useMemo(() => {
    const requestOptions = { ...options } as UseUnitDataOptions<T>;
    delete requestOptions.enabled;
    return requestOptions as UnitDataRequestOptions<T>;
  }, [options]);
  const subscribe = useCallback(
    (listener: () => void) => {
      if (!enabled) {
        return () => {};
      }

      return unitDataStore.subscribe(resolvedRequestOptions, listener);
    },
    [enabled, resolvedRequestOptions],
  );

  const getServerSnapshot = useCallback(
    () => (enabled ? unitDataStore.getSnapshot(resolvedRequestOptions) : idleSnapshot),
    [enabled, idleSnapshot, resolvedRequestOptions],
  );

  const getSnapshot = useCallback(
    () => (enabled ? unitDataStore.getSnapshot(resolvedRequestOptions) : idleSnapshot),
    [enabled, idleSnapshot, resolvedRequestOptions],
  );

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    if (!enabled) return;

    void unitDataStore.ensure(resolvedRequestOptions);
  }, [enabled, resolvedRequestOptions]);

  const refetch = useCallback(
    () => (enabled ? unitDataStore.revalidate(resolvedRequestOptions) : Promise.resolve(idleSnapshot)),
    [enabled, idleSnapshot, resolvedRequestOptions],
  );

  return {
    ...snapshot,
    refetch,
  };
}
