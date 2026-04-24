"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";

import {
  type UnitDataRequestOptions,
  type UnitDataSnapshot,
  unitDataStore,
} from "@/lib/unit-data-store";

export type UseUnitDataResult<T> = UnitDataSnapshot<T> & {
  refetch: () => Promise<UnitDataSnapshot<T>>;
};

export function useUnitData<T>(options: UnitDataRequestOptions<T>): UseUnitDataResult<T> {
  const subscribe = useCallback(
    (listener: () => void) => unitDataStore.subscribe(options, listener),
    [options],
  );

  const getSnapshot = useCallback(
    () => unitDataStore.getSnapshot(options),
    [options],
  );

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    void unitDataStore.ensure(options);
  }, [options]);

  const refetch = useCallback(
    () => unitDataStore.revalidate(options),
    [options],
  );

  return {
    ...snapshot,
    refetch,
  };
}
