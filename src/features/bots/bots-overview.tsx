"use client";

import { useAppState } from "@/components/providers/app-state-provider";
import { PageIntro } from "@/components/ui/page-intro";
import { useBotsOverview } from "@/lib/use-bots-overview";

export function BotsOverview() {
  const { t } = useAppState();
  const overview = useBotsOverview();

  return (
    <div className="page-stack">
      <PageIntro
        eyebrow={t.bots.eyebrow}
        title={t.bots.title}
        description={t.bots.description}
        aside={<span className="pill neutral">{t.common.placeholderRoute}</span>}
      />

      <section className="hero-strip">
        <div className="glass hero-card">
          <p className="eyebrow">{t.bots.automationFleet}</p>
          <h2>{t.bots.roster}</h2>
          <p className="hero-copy">{t.bots.heroCopy}</p>
          <div className="hero-badges">
            <span className="pill neutral">{t.common.maintainableSplit}</span>
            <span className="pill positive">{t.bots.commandReady}</span>
            <span className="pill neutral">{t.bots.riskAware}</span>
          </div>
        </div>

        <div className="glass hero-card surface-muted">
          <p className="eyebrow">{t.bots.opsSnapshot}</p>
          <h2>{t.bots.fleetStatus}</h2>
          <div className="detail-list">
            <div className="detail-row"><span>{t.bots.registeredBots}</span><strong>{overview?.bots.length ?? 0}</strong></div>
            <div className="detail-row"><span>{t.bots.executionMode}</span><strong>{t.bots.supervised}</strong></div>
            <div className="detail-row"><span>{t.bots.riskLock}</span><strong>{t.bots.available}</strong></div>
          </div>
        </div>
      </section>

      <section className="content-grid single-column-grid">
        <div className="glass section-card">
          <div className="panel-head compact">
            <div>
              <p className="eyebrow">{t.bots.playbooks}</p>
              <h2>{t.bots.roster}</h2>
            </div>
            <span className="pill neutral">{t.common.maintainableSplit}</span>
          </div>
          <div className="stack-list market-grid">
            {overview?.bots.map((bot) => (
              <article key={bot.id} className="glass-inner list-card">
                <strong>{bot.name}</strong>
                <p>{bot.mode}</p>
                <div className="list-meta">
                  <span>{t.bots.risk} {bot.risk}</span>
                  <span>{bot.allocation} {t.bots.capital}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
