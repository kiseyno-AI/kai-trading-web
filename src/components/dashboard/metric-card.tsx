import type { Metric } from "@/data/trading-dashboard";

function Sparkline({ points }: { points: number[] }) {
  const line = points.map((value, index) => `${index * 22},${value}`).join(" ");
  const area = `${line} 220,70 0,70`;

  return (
    <svg className="sparkline" viewBox="0 0 220 70" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`sparkFill-${points.length}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(53, 208, 127, 0.45)" />
          <stop offset="100%" stopColor="rgba(53, 208, 127, 0)" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#sparkFill-${points.length})`} />
      <polyline points={line} />
    </svg>
  );
}

function Donut({ value }: { value: number }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg viewBox="0 0 120 120" className="donut-chart" aria-label={`Win rate ${value} percent`}>
      <circle cx="60" cy="60" r={radius} className="donut-track" />
      <circle
        cx="60"
        cy="60"
        r={radius}
        className="donut-value"
        style={{ strokeDasharray: circumference, strokeDashoffset: offset }}
      />
    </svg>
  );
}

export function MetricCard({ metric }: { metric: Metric }) {
  return (
    <article className={`glass metric-card ${metric.id === "pnl" ? "pnl-card" : ""}`}>
      <div className="card-head">
        <span>{metric.title}</span>
        <span className={`pill ${metric.tone ?? "neutral"}`}>{metric.delta}</span>
      </div>
      <div className="metric-main">{metric.value}</div>
      {metric.subtitle ? <p className="metric-sub">{metric.subtitle}</p> : null}
      {metric.sparkline ? <Sparkline points={metric.sparkline} /> : null}
      {metric.donut ? (
        <div className="donut-wrap">
          <Donut value={metric.donut.value} />
          <div>
            <div className="metric-main">{metric.value}</div>
            <p className="metric-sub">{metric.donut.summary}</p>
          </div>
        </div>
      ) : null}
    </article>
  );
}
