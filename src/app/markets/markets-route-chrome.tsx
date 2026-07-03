"use client";

import type { ReactNode } from "react";

import { MobileAppChrome } from "@/components/mobile/mobile-app-chrome";
import { useAppState } from "@/components/providers/app-state-provider";

type MarketsRouteChromeProps = {
  children: ReactNode;
  variant?: "crypto" | "factors" | "overview";
};

export function MarketsRouteChrome({ children, variant = "overview" }: MarketsRouteChromeProps) {
  const { t } = useAppState();
  const isFactors = variant === "factors";
  const isCrypto = variant === "crypto";
  const title = isCrypto ? t.markets.cryptoTitle : isFactors ? t.markets.factorScreeningTitle : t.markets.title;
  const subtitle = isCrypto
    ? t.markets.cryptoChromeSubtitle
    : isFactors
      ? t.markets.factorScreeningSubtitle
      : t.markets.chromeSubtitle;
  const statusLabel = isCrypto
    ? t.markets.cryptoChromeStatus
    : isFactors
      ? t.markets.factorScreeningStatus
      : t.markets.statusUnavailable;

  return (
    <MobileAppChrome
      chrome={{
        activeNav: "markets",
        title,
        subtitle,
        status: {
          label: statusLabel,
          tone: isFactors ? "info" : "warning",
        },
        toolbarAction: "none",
      }}
    >
      {children}
    </MobileAppChrome>
  );
}
