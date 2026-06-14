"use client";

import { useCallback, useMemo } from "react";

import {
  CRYPTO_MARKET_OVERVIEW_CLIENT_PATH,
  CRYPTO_RUNTIME_READINESS_CLIENT_PATH,
  type CryptoReadOnlySnapshot,
} from "@/lib/crypto-readonly";
import { getTradingApiJsonResult } from "@/lib/trading-api-cache";
import { useUnitData } from "@/lib/use-unit-data";
import type {
  CryptoMarketOverviewResponseDto,
  CryptoRuntimeReadinessResponseDto,
} from "@/types/trading-api";

const CRYPTO_READ_ONLY_KEY = ["markets", "crypto", "read-only"] as const;

export function useCryptoReadOnlyResult() {
  const fetcher = useCallback(async (): Promise<CryptoReadOnlySnapshot> => {
    const [marketOverview, runtimeReadiness] = await Promise.all([
      getTradingApiJsonResult<CryptoMarketOverviewResponseDto>(CRYPTO_MARKET_OVERVIEW_CLIENT_PATH),
      getTradingApiJsonResult<CryptoRuntimeReadinessResponseDto>(CRYPTO_RUNTIME_READINESS_CLIENT_PATH),
    ]);

    return {
      marketOverview,
      runtimeReadiness,
    };
  }, []);
  const request = useMemo(
    () => ({
      key: CRYPTO_READ_ONLY_KEY,
      fetcher,
    }),
    [fetcher],
  );

  return useUnitData<CryptoReadOnlySnapshot>(request);
}
