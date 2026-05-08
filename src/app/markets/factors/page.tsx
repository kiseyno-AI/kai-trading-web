import type { Metadata } from "next";

import { FactorScreening } from "@/features/markets/factor-screening";

import { MarketsRouteChrome } from "../markets-route-chrome";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Factor Screening",
};

export default function FactorScreeningPage() {
  return (
    <MarketsRouteChrome variant="factors">
      <FactorScreening />
    </MarketsRouteChrome>
  );
}
