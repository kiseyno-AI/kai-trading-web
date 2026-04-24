"use client";

import { useCallback, useMemo } from "react";

import { tradingApi } from "@/lib/trading-api";
import { useUnitData } from "@/lib/use-unit-data";
import type { DashboardSnapshotDto } from "@/types/trading-api";

const DASHBOARD_SNAPSHOT_KEY = ["dashboard", "snapshot"] as const;

export function useDashboardSnapshotResult() {
  const fetcher = useCallback(async () => (await tradingApi.getDashboardSnapshot()).data, []);
  const request = useMemo(
    () => ({
      key: DASHBOARD_SNAPSHOT_KEY,
      fetcher,
    }),
    [fetcher],
  );

  return useUnitData<DashboardSnapshotDto>(request);
}

export function useDashboardSnapshot() {
  const result = useDashboardSnapshotResult();

  return { snapshot: result.data, loading: result.isInitialLoading };
}
