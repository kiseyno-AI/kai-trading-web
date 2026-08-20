"use client";

import type { ReactNode } from "react";

import { MobileAppChrome } from "@/components/mobile/mobile-app-chrome";
import { useAppState } from "@/components/providers/app-state-provider";
import { MARKETS_ROUTE_CHROME_ROUTE_KEYS } from "@/lib/app-chrome-routes";
import type { FactorScreeningRouteStatus } from "@/lib/factor-screening";

type MarketsRouteChromeProps = {
  children: ReactNode;
  factorStatus?: FactorScreeningRouteStatus;
  variant?: "crypto" | "factors" | "overview";
};

export function MarketsRouteChrome({
  children,
  factorStatus = "pending",
  variant = "overview",
}: MarketsRouteChromeProps) {
  const { t } = useAppState();
  const isFactors = variant === "factors";
  const isCrypto = variant === "crypto";
  const title = isCrypto ? t.markets.cryptoTitle : isFactors ? t.markets.factorScreeningTitle : t.markets.title;
  const subtitle = isCrypto
    ? t.markets.cryptoChromeSubtitle
    : isFactors
      ? t.markets.factorScreeningSubtitle
      : t.markets.chromeSubtitle;
  const factorStatusDisplay = {
    partial: {
      label: t.markets.factorScreeningStatusPartial,
      tone: "warning" as const,
    },
    pending: {
      label: t.markets.factorScreeningStatusPending,
      tone: "neutral" as const,
    },
    ready: {
      label: t.markets.factorScreeningStatus,
      tone: "info" as const,
    },
    unavailable: {
      label: t.markets.factorScreeningStatusUnavailable,
      tone: "warning" as const,
    },
  }[factorStatus];
  const statusDisplay = isCrypto
    ? t.markets.cryptoChromeStatus
    : isFactors
      ? factorStatusDisplay.label
      : t.markets.statusUnavailable;

  return (
    <MobileAppChrome
      chrome={{
        activeNav: "markets",
        navRouteKeys: MARKETS_ROUTE_CHROME_ROUTE_KEYS,
        title,
        subtitle,
        status: {
          label: statusDisplay,
          tone: isFactors ? factorStatusDisplay.tone : "warning",
        },
        toolbarAction: "none",
      }}
    >
      {children}
    </MobileAppChrome>
  );
}
