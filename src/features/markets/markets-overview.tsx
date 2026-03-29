import { marketSpotlight } from "@/data/trading-dashboard";
import { PageIntro } from "@/components/ui/page-intro";

export function MarketsOverview() {
  return (
    <div className="page-stack">
      <PageIntro
        eyebrow="Market Surface"
        title="Markets"
        description="A dedicated route for screening leaders, tracking volume shifts, and plugging in live market data later without bloating the dashboard page."
        aside={<span className="pill neutral">Placeholder route</span>}
      />

      <section className="content-grid single-column-grid">
        <div className="glass section-card">
          <div className="panel-head compact">
            <div>
              <p className="eyebrow">Spotlight</p>
              <h2>Priority pairs</h2>
            </div>
            <span className="pill positive">Ready for API wiring</span>
          </div>
          <div className="stack-list market-grid">
            {marketSpotlight.map((market) => (
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
