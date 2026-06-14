"use client";

import Link from "next/link";
import { useMemo } from "react";

import { ComponentTag } from "@/components/dev/component-tag";
import { useAppState } from "@/components/providers/app-state-provider";
import { buildCryptoReadOnlySurfaceModel, type CryptoReadOnlySourceState } from "@/lib/crypto-readonly";
import { useCryptoReadOnlyResult } from "@/lib/use-crypto-readonly";

import styles from "./markets-overview.module.css";

function getPillClass(state: CryptoReadOnlySourceState) {
  if (state === "ready") return "pill info";
  if (state === "unavailable") return "pill warning";
  return "pill neutral";
}

export function CryptoMarketsOverview() {
  const { t } = useAppState();
  const cryptoResult = useCryptoReadOnlyResult();
  const model = useMemo(
    () =>
      buildCryptoReadOnlySurfaceModel({
        marketOverview: cryptoResult.data?.marketOverview,
        runtimeReadiness: cryptoResult.data?.runtimeReadiness,
      }),
    [cryptoResult.data],
  );
  const hasRows = model.rows.length > 0;
  const rowStateLabel = cryptoResult.isInitialLoading
    ? t.markets.cryptoLoading
    : hasRows
      ? `${model.rows.length.toLocaleString()} ${t.markets.cryptoRowsReady}`
      : t.markets.cryptoNoRows;

  return (
    <div className={styles.page}>
      <section className={`${styles.panel} ${styles.heroPanel}`}>
        <ComponentTag
          label="markets.crypto"
          api="/api/trading/crypto/markets/overview + /api/trading/execution/runtime/crypto/readiness"
        />
        <p className={styles.eyebrow}>{t.markets.cryptoEyebrow}</p>
        <h1>{t.markets.cryptoTitle}</h1>
        <strong className={styles.stateTitle}>{t.markets.cryptoStateTitle}</strong>
        <p className={styles.heroCopy}>{t.markets.cryptoHeroCopy}</p>

        <div className={styles.statusGrid} aria-label={t.markets.cryptoSourceStatus}>
          <div>
            <span>{t.markets.cryptoMarketOverview}</span>
            <strong>{model.marketSource.label}</strong>
            <small>{t.markets.cryptoMarketOverviewPath}</small>
          </div>
          <div>
            <span>{t.markets.cryptoRuntimeReadiness}</span>
            <strong>{model.readinessSource.label}</strong>
            <small>{t.markets.cryptoRuntimeReadinessPath}</small>
          </div>
          <div>
            <span>{t.markets.cryptoOrderControls}</span>
            <strong>{t.markets.cryptoNoOrderControls}</strong>
            <small>{t.markets.cryptoReadOnlyOnly}</small>
          </div>
        </div>

        <div className={styles.heroActions}>
          <Link href="/markets" className={styles.primaryLink}>
            {t.markets.backToMarkets}
          </Link>
          <Link href="/bots" className={styles.secondaryLink}>
            {t.markets.openBotsRuntime}
          </Link>
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHead}>
          <div>
            <p className={styles.eyebrow}>{t.markets.cryptoSourceStatus}</p>
            <h2>{t.markets.cryptoEndpointState}</h2>
          </div>
          <div className={styles.pillGroup}>
            <span className={getPillClass(model.marketSource.state)}>{model.marketSource.label}</span>
            <span className={getPillClass(model.readinessSource.state)}>{model.readinessSource.label}</span>
          </div>
        </div>
        <p className={styles.panelCopy}>{t.markets.cryptoEndpointStateCopy}</p>

        {model.marketSource.detail ? (
          <p className={styles.notice}>
            {t.markets.cryptoMarketOverview}: {model.marketSource.detail}
          </p>
        ) : null}
        {model.readinessSource.detail ? (
          <p className={styles.notice}>
            {t.markets.cryptoRuntimeReadiness}: {model.readinessSource.detail}
          </p>
        ) : null}
      </section>

      <section className={styles.panel}>
        <div className={styles.sectionHead}>
          <div>
            <p className={styles.eyebrow}>{t.markets.cryptoRuntimeRows}</p>
            <h2>{rowStateLabel}</h2>
          </div>
          <span className={`pill ${hasRows ? "info" : "neutral"}`}>
            {hasRows ? t.markets.available : t.markets.pending}
          </span>
        </div>
        <p className={styles.panelCopy}>{t.markets.cryptoRuntimeRowsCopy}</p>

        {cryptoResult.error ? <p className={styles.notice}>{cryptoResult.error.message}</p> : null}
        {cryptoResult.isInitialLoading ? <p className={styles.notice}>{t.markets.cryptoLoading}</p> : null}

        {hasRows ? (
          <div className={styles.previewGrid}>
            {model.rows.map((row) => (
              <article key={row.key} className={styles.previewCard}>
                <strong>{row.pairLabel}</strong>
                <p>{row.name ?? t.markets.cryptoNamePending}</p>
                <dl className={styles.detailRows}>
                  <div>
                    <dt>{t.markets.cryptoAssetClass}</dt>
                    <dd>{row.assetClass}</dd>
                  </div>
                  <div>
                    <dt>{t.markets.cryptoVenue}</dt>
                    <dd>{row.venue}</dd>
                  </div>
                  <div>
                    <dt>{t.markets.cryptoQuoteCurrency}</dt>
                    <dd>{row.quoteCurrency}</dd>
                  </div>
                  <div>
                    <dt>{t.markets.cryptoLastPrice}</dt>
                    <dd>{row.lastPriceLabel}</dd>
                  </div>
                  <div>
                    <dt>{t.markets.cryptoMarketStatus}</dt>
                    <dd>{row.marketStatusLabel}</dd>
                  </div>
                  <div>
                    <dt>{t.markets.cryptoReadiness}</dt>
                    <dd>{row.readinessLabel}</dd>
                  </div>
                  <div>
                    <dt>{t.markets.cryptoPaperState}</dt>
                    <dd>{row.paperStatusLabel}</dd>
                  </div>
                  <div>
                    <dt>{t.markets.cryptoLiveControls}</dt>
                    <dd>{row.liveControlsLabel}</dd>
                  </div>
                </dl>
                <p className={styles.cardMeta}>
                  {t.markets.cryptoUpdatedAt}: {row.updatedAtLabel}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.notice}>{t.markets.cryptoNoRowsCopy}</p>
        )}
      </section>
    </div>
  );
}
