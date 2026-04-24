"use client";

import { useCallback, useMemo } from "react";

import { tradingApi } from "@/lib/trading-api";
import { useUnitData } from "@/lib/use-unit-data";
import type { MarketsOverviewDto } from "@/types/trading-api";

const MARKETS_OVERVIEW_KEY = ["markets", "overview"] as const;

export function useMarketsOverviewResult() {
  const fetcher = useCallback(async () => (await tradingApi.getMarketsOverview()).data, []);
  const request = useMemo(
    () => ({
      key: MARKETS_OVERVIEW_KEY,
      fetcher,
    }),
    [fetcher],
  );

  return useUnitData<MarketsOverviewDto>(request);
}

export function useMarketsOverview() {
  return useMarketsOverviewResult().data;
}
