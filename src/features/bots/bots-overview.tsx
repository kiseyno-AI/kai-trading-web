import { botPlaybooks } from "@/data/trading-dashboard";
import { PageIntro } from "@/components/ui/page-intro";

export function BotsOverview() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Automation Desk"
        title="Bots"
        description="A focused route for strategy states, allocation controls, and future execution logs. The dashboard can stay lean while automation expands here."
        aside={<span className="pill neutral">Placeholder route</span>}
      />

      <section className="content-grid single-column-grid">
        <div className="glass section-card">
          <div className="panel-head compact">
            <div>
              <p className="eyebrow">Playbooks</p>
              <h2>Bot roster</h2>
            </div>
            <span className="pill neutral">Maintainable split</span>
          </div>
          <div className="stack-list market-grid">
            {botPlaybooks.map((bot) => (
              <article key={bot.name} className="glass-inner list-card">
                <strong>{bot.name}</strong>
                <p>{bot.mode}</p>
                <div className="list-meta">
                  <span>Risk {bot.risk}</span>
                  <span>{bot.allocation} capital</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
