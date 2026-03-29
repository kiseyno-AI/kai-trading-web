"use client";

import { useEffect, useState } from "react";

import { tradingApi } from "@/lib/trading-api";
import type { MarketsOverviewDto } from "@/types/trading-api";

export function useMarketsOverview() {
  const [overview, setOverview] = useState<MarketsOverviewDto | null>(null);

  useEffect(() => {
    let active = true;

    tradingApi.getMarketsOverview().then((response) => {
      if (active) {
        setOverview(response.data);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return overview;
}
