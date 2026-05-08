"use client";

import Link from "next/link";

import { ComponentTag } from "@/components/dev/component-tag";
import { useAppState } from "@/components/providers/app-state-provider";
import { useMarketsOverviewResult } from "@/lib/use-markets-overview";

import styles from "./markets-overview.module.css";

type ActionCardProps = {
  body: string;
  href: string;
  label: string;
  title: string;
};

function ActionCard({ body, href, label, title }: ActionCardProps) {
  return (
    <Link href={href} className={styles.actionCard}>
      <strong>{title}</strong>
      <p>{body}</p>
      <span>{label}</span>
    </Link>
  );
}

export function MarketsOverview() {
  const { t } = useAppState();
  const overviewResult = useMarketsOverviewResult();
  const spotlight = overviewResult.data?.spotlight ?? [];
  const hasSpotlightRows = spotlight.length > 0;
  const previewStateLabel = overviewResult.isInitialLoading
    ? t.markets.loading
    : overviewResult.error
      ? t.markets.loadError
      : hasSpotlightRows
        ? `${spotlight.length.toLocaleString()} ${t.markets.trackedMarkets}`
        : t.markets.noPreviewRows;

  return (
    <div className={styles.page}>
      <section className={`${styles.panel} ${styles.heroPanel}`}>
        <ComponentTag label="markets.overview" api="/api/trading/quotes/tracked pending dedicated breadth/flow API" />
        <p className={styles.eyebrow}>{t.markets.stateEyebrow}</p>
        <h1>{t.markets.title}</h1>
        <strong className={styles.stateTitle}>{t.markets.unavailableTitle}</strong>
        <p className={styles.heroCopy}>{t.markets.unavailableCopy}</p>

        <div className={styles.statusGrid} aria-label={t.markets.sourceStatus}>
          <div>
            <span>{t.markets.breadthFlow}</span>
            <strong>{t.markets.pending}</strong>
            <small>{t.markets.notConnected}</small>
          </div>
          <div>
            <span>{t.markets.dashboardSnapshot}</span>
            <strong>{t.markets.available}</strong>
            <small>{t.markets.marketBreadth}</small>
          </div>
          <div>
            <span>{t.markets.factorScreening}</span>
            <strong>{t.markets.ready}</strong>
            <small>{t.markets.krUsWorkflow}</small>
          </div>
        </div>

        <div className={styles.heroActions}>
          <Link href="/markets/factors" className={styles.primaryLink}>
            {t.markets.openFactorScreening}
          </Link>
          <Link href="/dashboard" className={styles.secondaryLink}>
            {t.markets.backToDashboard}
          </Link>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHead}>
          <div>
            <p className={styles.eyebrow}>{t.markets.availableNow}</p>
            <h2>{t.markets.sourceStatus}</h2>
          </div>
          <span className="pill warning">{t.markets.statusUnavailable}</span>
        </div>
        <p className={styles.panelCopy}>{t.markets.availableNowCopy}</p>

        <div className={styles.actionGrid}>
          <ActionCard
            href="/markets/factors"
            title={t.markets.factorScreening}
            body={t.markets.factorScreeningCopy}
            label={t.markets.openFactorScreening}
          />
          <ActionCard
            href="/dashboard"
            title={t.markets.dashboardSnapshot}
            body={t.markets.dashboardSnapshotCopy}
            label={t.markets.backToDashboard}
          />
          <ActionCard
            href="/my-symbols"
            title={t.mobileChrome.mySymbols}
            body={t.markets.mySymbolsCopy}
            label={t.markets.openMySymbols}
          />
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHead}>
          <div>
            <p className={styles.eyebrow}>{t.markets.trackedPreview}</p>
            <h2>{previewStateLabel}</h2>
          </div>
          <span className={`pill ${hasSpotlightRows ? "info" : "neutral"}`}>
            {hasSpotlightRows ? t.markets.available : t.markets.pending}
          </span>
        </div>
        <p className={styles.panelCopy}>{t.markets.trackedPreviewCopy}</p>

        {overviewResult.error ? <p className={styles.notice}>{overviewResult.error.message}</p> : null}

        {hasSpotlightRows ? (
          <div className={styles.previewGrid}>
            {spotlight.map((market) => (
              <article key={market.symbol} className={styles.previewCard}>
                <strong>{market.symbol}</strong>
                <p>{market.trend}</p>
                <div>
                  <span>{market.volume}</span>
                  <span>{market.change}</span>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
