"use client";

import { useCallback, useMemo } from "react";

import { tradingApi } from "@/lib/trading-api";
import { useUnitData } from "@/lib/use-unit-data";
import type { BotsOverviewDto } from "@/types/trading-api";

const BOTS_OVERVIEW_KEY = ["bots", "overview"] as const;

export function useBotsOverviewResult() {
  const fetcher = useCallback(async () => (await tradingApi.getBotsOverview()).data, []);
  const request = useMemo(
    () => ({
      key: BOTS_OVERVIEW_KEY,
      fetcher,
    }),
    [fetcher],
  );

  return useUnitData<BotsOverviewDto>(request);
}

export function useBotsOverview() {
  return useBotsOverviewResult().data;
}
