"use client";

import type { ReactNode } from "react";

import { useAppState } from "@/components/providers/app-state-provider";
import { getDashboardLiveCopy } from "@/i18n/dashboard-live-copy";
import { RELEASE_VERSION_LABEL } from "@/lib/release-version";
import { cn } from "@/lib/utils";

import styles from "./dashboard-toolbar.module.css";

export type DashboardToolbarStatusTone = "positive" | "negative" | "neutral" | "info" | "warning" | "closed";

export type DashboardToolbarProps = {
  actions?: ReactNode;
  className?: string;
  leading?: ReactNode;
  releaseTestId?: string | null;
  status?: ReactNode;
  subtitle?: ReactNode | null;
  subtitleAriaLabel?: string;
  title?: ReactNode;
};

type DashboardToolbarStatusProps = {
  children: ReactNode;
  className?: string;
  tone?: DashboardToolbarStatusTone;
};

export function DashboardToolbar({
  actions,
  className,
  leading,
  releaseTestId = "dashboard-header-release",
  status,
  subtitle,
  subtitleAriaLabel,
  title,
}: DashboardToolbarProps) {
  const { locale, t } = useAppState();
  const dashboardCopy = getDashboardLiveCopy(locale);
  const resolvedSubtitle = subtitle === undefined ? RELEASE_VERSION_LABEL : subtitle;
  const isDefaultReleaseSubtitle = subtitle === undefined;

  return (
    <div
      className={cn(styles.toolbar, className)}
      data-dashboard-toolbar
      data-has-leading={leading ? "true" : "false"}
    >
      <div className={styles.brandCluster}>
        {leading ? <div className={styles.leading}>{leading}</div> : null}
        <div className={styles.brandMark} aria-hidden="true" />
        <div className={styles.brandCopy}>
          <strong className={styles.brandTitle}>{title ?? dashboardCopy.brandTitle}</strong>
          {resolvedSubtitle ? (
            <span
              className={styles.brandSubtitle}
              aria-label={subtitleAriaLabel ?? (isDefaultReleaseSubtitle ? t.mobileChrome.releaseVersion : undefined)}
              data-default-release={isDefaultReleaseSubtitle ? "true" : "false"}
              data-testid={isDefaultReleaseSubtitle ? releaseTestId ?? undefined : undefined}
            >
              {resolvedSubtitle}
            </span>
          ) : null}
        </div>
      </div>

      {status || actions ? (
        <div className={styles.actions}>
          {status}
          {actions}
        </div>
      ) : null}
    </div>
  );
}

export function DashboardToolbarStatus({ children, className, tone = "neutral" }: DashboardToolbarStatusProps) {
  const globalToneClass = tone === "closed" ? null : tone;

  return (
    <span
      className={cn("pill", styles.statusPill, globalToneClass, tone === "closed" && styles.statusPillClosed, className)}
      suppressHydrationWarning
    >
      {children}
    </span>
  );
}
