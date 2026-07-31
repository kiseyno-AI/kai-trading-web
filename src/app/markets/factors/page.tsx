import type { Metadata } from "next";

import { FactorScreeningRoute } from "./factor-screening-route";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Factor Screening",
};

export default function FactorScreeningPage() {
  return <FactorScreeningRoute />;
}
