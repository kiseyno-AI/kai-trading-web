import type { Metadata } from "next";

import { AppShell } from "@/components/layout/app-shell";
import { FactorScreening } from "@/features/markets/factor-screening";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Factor Screening",
};

export default function FactorScreeningPage() {
  return (
    <AppShell currentPath="/markets">
      <FactorScreening />
    </AppShell>
  );
}
