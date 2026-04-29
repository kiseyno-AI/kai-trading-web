"use client";

import Link from "next/link";

import { useAppState } from "@/components/providers/app-state-provider";
import { PageIntro } from "@/components/ui/page-intro";
import { useMarketsOverview } from "@/lib/use-markets-overview";

export function MarketsOverview() {
  const { locale, t } = useAppState();
  const overview = useMarketsOverview();
  const factorScreeningLabel = locale === "ko" ? "팩터 스크리닝 열기" : "Open factor screening";
  const factorScreeningCopy =
    locale === "ko"
      ? "구현된 팩터 inspect API를 기반으로 시장 날짜별 순위와 적격성 필터를 확인합니다."
      : "Use the implemented factor inspect APIs for market-date ranking and eligibility-aware screening.";

  return (
    <div className="page-stack">
      <PageIntro
        eyebrow={t.markets.eyebrow}
        title={t.markets.title}
        description={t.markets.description}
        aside={<span className="pill neutral">{t.common.placeholderRoute}</span>}
      />

      <section className="hero-strip">
        <div className="glass hero-card">
          <p className="eyebrow">{t.markets.marketBreadth}</p>
          <h2>{t.markets.priorityPairs}</h2>
          <p className="hero-copy">{t.markets.heroCopy}</p>
          <div className="hero-badges">
            <span className="pill positive">{t.common.readyForApi}</span>
            <span className="pill neutral">{t.markets.depthSignals}</span>
            <span className="pill neutral">{t.markets.krUsWorkflow}</span>
          </div>
          <div className="detail-list" style={{ marginTop: 18 }}>
            <div className="detail-row">
              <span>Factor screening</span>
              <strong>{factorScreeningCopy}</strong>
            </div>
          </div>
          <Link href="/markets/factors" className="ui-button ui-button-glass">
            <span>{factorScreeningLabel}</span>
          </Link>
        </div>

        <div className="glass hero-card surface-muted">
          <p className="eyebrow">{t.markets.overview}</p>
          <h2>{t.markets.sessionStatus}</h2>
          <div className="detail-list">
            <div className="detail-row"><span>{t.markets.trackedMarkets}</span><strong>{overview?.spotlight.length ?? 0}</strong></div>
            <div className="detail-row"><span>{t.markets.scannerCadence}</span><strong>1.5s</strong></div>
            <div className="detail-row"><span>{t.markets.primaryVenue}</span><strong>KIS + IBKR</strong></div>
          </div>
        </div>
      </section>

      <section className="content-grid single-column-grid">
        <div className="glass section-card">
          <div className="panel-head compact">
            <div>
              <p className="eyebrow">{t.markets.spotlight}</p>
              <h2>{t.markets.priorityPairs}</h2>
            </div>
            <span className="pill positive">{t.common.readyForApi}</span>
          </div>
          <div className="stack-list market-grid">
            {overview?.spotlight.map((market) => (
              <article key={market.symbol} className="glass-inner list-card">
                <strong>{market.symbol}</strong>
                <p>{market.trend}</p>
                <div className="list-meta">
                  <span>{market.volume}</span>
                  <span>{market.change}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
