"use client";

import type { ReactNode } from "react";

import { MobileAppChrome } from "@/components/mobile/mobile-app-chrome";
import { useAppState } from "@/components/providers/app-state-provider";

type MarketsRouteChromeProps = {
  children: ReactNode;
  variant?: "factors" | "overview";
};

export function MarketsRouteChrome({ children, variant = "overview" }: MarketsRouteChromeProps) {
  const { t } = useAppState();
  const isFactors = variant === "factors";

  return (
    <MobileAppChrome
      chrome={{
        activeNav: "markets",
        title: isFactors ? t.markets.factorScreeningTitle : t.markets.title,
        subtitle: isFactors ? t.markets.factorScreeningSubtitle : t.markets.chromeSubtitle,
        status: {
          label: isFactors ? t.markets.factorScreeningStatus : t.markets.statusUnavailable,
          tone: isFactors ? "info" : "warning",
        },
        toolbarAction: "none",
      }}
    >
      {children}
    </MobileAppChrome>
  );
}
