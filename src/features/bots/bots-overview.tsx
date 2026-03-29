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
          <p className="eyebrow">Automation Fleet</p>
          <h2>{t.bots.roster}</h2>
          <p className="hero-copy">
            Bot operations are now split into a maintainable feature surface. This view is ready to evolve into live controls, audit logs, and execution safety panels.
          </p>
          <div className="hero-badges">
            <span className="pill neutral">{t.common.maintainableSplit}</span>
            <span className="pill positive">Command-ready</span>
            <span className="pill neutral">Risk-aware</span>
          </div>
        </div>

        <div className="glass hero-card surface-muted">
          <p className="eyebrow">Ops Snapshot</p>
          <h2>Fleet Status</h2>
          <div className="detail-list">
            <div className="detail-row"><span>Registered bots</span><strong>{overview?.bots.length ?? 0}</strong></div>
            <div className="detail-row"><span>Execution mode</span><strong>Supervised</strong></div>
            <div className="detail-row"><span>Risk lock</span><strong>Available</strong></div>
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
