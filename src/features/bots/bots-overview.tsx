"use client";

import { useAppState } from "@/components/providers/app-state-provider";
import { PageIntro } from "@/components/ui/page-intro";

export function BotsOverview() {
  const { t } = useAppState();
  const scaffoldRows = [
    { label: t.bots.dataSource, value: t.bots.dataSourceUnavailable },
    { label: t.bots.rosterState, value: t.bots.rosterUnavailable },
    { label: t.bots.executionControls, value: t.bots.controlsUnavailable },
    { label: t.bots.capitalAllocation, value: t.bots.capitalUnavailable },
  ];
  const plannedSurfaces = [
    { title: t.bots.apiBackedRoster, copy: t.bots.apiBackedRosterCopy },
    { title: t.bots.auditTrail, copy: t.bots.auditTrailCopy },
    { title: t.bots.safetyAnnotations, copy: t.bots.safetyAnnotationsCopy },
  ];

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
          <p className="eyebrow">{t.bots.scaffoldEyebrow}</p>
          <h2>{t.bots.scaffoldTitle}</h2>
          <p className="hero-copy">{t.bots.heroCopy}</p>
          <div className="hero-badges">
            <span className="pill neutral">{t.common.placeholderRoute}</span>
            <span className="pill neutral">{t.bots.readOnlyScaffold}</span>
            <span className="pill neutral">{t.bots.noLiveBotState}</span>
          </div>
        </div>

        <div className="glass hero-card surface-muted">
          <p className="eyebrow">{t.bots.sourceStatus}</p>
          <h2>{t.bots.noRuntimeSnapshot}</h2>
          <div className="detail-list">
            {scaffoldRows.map((row) => (
              <div className="detail-row" key={row.label}>
                <span>{row.label}</span>
                <strong>{row.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="content-grid single-column-grid">
        <div className="glass section-card">
          <div className="panel-head compact">
            <div>
              <p className="eyebrow">{t.bots.plannedSurfaces}</p>
              <h2>{t.bots.scaffoldSections}</h2>
            </div>
            <span className="pill neutral">{t.common.maintainableSplit}</span>
          </div>
          <div className="stack-list market-grid">
            {plannedSurfaces.map((surface) => (
              <article key={surface.title} className="glass-inner list-card">
                <strong>{surface.title}</strong>
                <p>{surface.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
