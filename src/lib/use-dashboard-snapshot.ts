"use client";

import { useEffect, useState } from "react";

import { tradingApi } from "@/lib/trading-api";
import type { DashboardSnapshotDto } from "@/types/trading-api";

export function useDashboardSnapshot() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshotDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    tradingApi
      .getDashboardSnapshot()
      .then((response) => {
        if (active) {
          setSnapshot(response.data);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return { snapshot, loading };
}
