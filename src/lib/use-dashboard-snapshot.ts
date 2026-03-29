"use client";

import { useEffect, useState } from "react";

import { tradingApi } from "@/lib/trading-api";
import type { DashboardSnapshotDto } from "@/types/trading-api";

export function useDashboardSnapshot() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshotDto | null>(null);

  useEffect(() => {
    let active = true;

    tradingApi.getDashboardSnapshot().then((response) => {
      if (active) {
        setSnapshot(response.data);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return snapshot;
}
