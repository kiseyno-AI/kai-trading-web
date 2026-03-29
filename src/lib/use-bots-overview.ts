"use client";

import { useEffect, useState } from "react";

import { tradingApi } from "@/lib/trading-api";
import type { BotsOverviewDto } from "@/types/trading-api";

export function useBotsOverview() {
  const [overview, setOverview] = useState<BotsOverviewDto | null>(null);

  useEffect(() => {
    let active = true;

    tradingApi.getBotsOverview().then((response) => {
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
