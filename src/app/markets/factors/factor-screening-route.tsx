"use client";

import { useState } from "react";

import { FactorScreening } from "@/features/markets/factor-screening";
import type { FactorScreeningRouteStatus } from "@/lib/factor-screening";

import { MarketsRouteChrome } from "../markets-route-chrome";

export function FactorScreeningRoute() {
  const [status, setStatus] = useState<FactorScreeningRouteStatus>("pending");

  return (
    <MarketsRouteChrome variant="factors" factorStatus={status}>
      <FactorScreening onRouteStatusChange={setStatus} />
    </MarketsRouteChrome>
  );
}
