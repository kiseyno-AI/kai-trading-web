"use client";

import { useAppState } from "@/components/providers/app-state-provider";
import { PageIntro } from "@/components/ui/page-intro";
import { useMarketsOverview } from "@/lib/use-markets-overview";

export function MarketsOverview() {
  const { t } = useAppState();
  const overview = useMarketsOverview();

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
          <p className="eyebrow">Market breadth</p>
          <h2>{t.markets.priorityPairs}</h2>
          <p className="hero-copy">
            Cross-market monitoring is ready for spot, futures, and strategy routing. This area is now structured for real data from trading-core without redesigning the page shell.
          </p>
          <div className="hero-badges">
            <span className="pill positive">{t.common.readyForApi}</span>
            <span className="pill neutral">Depth + Signals</span>
            <span className="pill neutral">KR / US Workflow</span>
          </div>
        </div>

        <div className="glass hero-card surface-muted">
          <p className="eyebrow">Overview</p>
          <h2>Session Status</h2>
          <div className="detail-list">
            <div className="detail-row"><span>Tracked markets</span><strong>{overview?.spotlight.length ?? 0}</strong></div>
            <div className="detail-row"><span>Scanner cadence</span><strong>1.5s</strong></div>
            <div className="detail-row"><span>Primary venue</span><strong>KIS + IBKR</strong></div>
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
