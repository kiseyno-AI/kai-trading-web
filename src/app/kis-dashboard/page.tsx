import { headers } from "next/headers";

import { formatDisplayTimestamp } from "@/lib/format";
import { fetchServerTradingApiJson } from "@/lib/trading-upstream";

type CoreMarketStatus = {
  state: string;
  is_open: boolean;
  server_time: string;
};

type CoreTrackedQuote = {
  symbol: string;
  price: number | null;
  change: number | null;
  change_pct: number | null;
  volume: number | null;
  turnover: number | null;
  as_of: string | null;
  market_state: string;
  source: string;
  fallback: boolean;
  is_live: boolean;
  available: boolean;
  trade_date?: string | null;
  unavailable_reason?: string | null;
};

type CoreTrackedQuotesResponse = {
  market_state: string;
  as_of: string;
  items: CoreTrackedQuote[];
};

type CoreTrackedSymbolsResponse = {
  tracked_symbols: string[];
  count: number;
  last_updated_at: string | null;
};

type SectionStatus<T> = {
  data: T | null;
  error: string | null;
};

const shellStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #06101b 0%, #08111f 50%, #060d17 100%)",
  color: "#eef4ff",
  fontFamily: "Inter, system-ui, sans-serif",
  padding: 24,
};

export const dynamic = "force-dynamic";

async function loadSection<T>(
  label: string,
  path: string,
  requestHeaders: Headers,
): Promise<SectionStatus<T>> {
  try {
    return {
      data: await fetchServerTradingApiJson<T>(path, requestHeaders),
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`KIS dashboard failed to load ${label}`, error);

    return {
      data: null,
      error: `${label}: ${message}`,
    };
  }
}

function formatSignedPercent(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function hasNumber(value: number | null | undefined): value is number {
  return typeof value === "number";
}

function formatCompactWon(value: number) {
  if (value >= 1_000_000_000) return `₩${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `₩${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `₩${(value / 1_000).toFixed(1)}K`;
  return `₩${value.toLocaleString()}`;
}

export default async function KisDashboardPage() {
  const requestHeaders = await headers();
  const [marketStatus, trackedStatus, symbolsStatus] = await Promise.all([
    loadSection<CoreMarketStatus>("market/status", "/market/status", requestHeaders),
    loadSection<CoreTrackedQuotesResponse>("quotes/tracked", "/quotes/tracked", requestHeaders),
    loadSection<CoreTrackedSymbolsResponse>("scanner/tracked-symbols", "/scanner/tracked-symbols", requestHeaders),
  ]);

  const market = marketStatus.data;
  const tracked = trackedStatus.data;
  const symbols = symbolsStatus.data;
  const failures = [marketStatus.error, trackedStatus.error, symbolsStatus.error].filter(
    (value): value is string => Boolean(value),
  );

  if (!market && !tracked && !symbols) {
    return (
      <main style={shellStyle}>
        <section
          style={{
            marginBottom: 24,
            padding: 24,
            borderRadius: 20,
            border: "1px solid rgba(255,107,122,0.24)",
            background: "rgba(56,17,24,0.72)",
          }}
        >
          <p style={{ margin: 0, color: "#ff9ba5", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            Live KIS Dashboard
          </p>
          <h1 style={{ margin: "10px 0 8px", fontSize: 34 }}>All upstream sections failed</h1>
          <p style={{ margin: 0, color: "#ffd4da" }}>
            The page stayed up, but no upstream data source responded successfully.
          </p>
          <div style={{ marginTop: 16, color: "#ffd4da" }}>{failures.join(" | ")}</div>
        </section>
      </main>
    );
  }

  const trackedItems = tracked?.items ?? [];
  const lead = trackedItems[0] ?? null;
  const availableItems = trackedItems.filter((item) => item.available);
  const averageMove = availableItems.length
    ? availableItems.reduce((sum, item) => sum + (item.change_pct ?? 0), 0) / availableItems.length
    : 0;
  const trackedSymbols = symbols?.tracked_symbols ?? trackedItems.map((item) => item.symbol);
  const trackedCount = symbols?.count ?? trackedSymbols.length;
  const trackedUpdatedAt = tracked?.as_of ?? symbols?.last_updated_at ?? market?.server_time ?? null;
  const totalTurnover = availableItems.reduce((sum, item) => sum + (item.turnover ?? 0), 0);

  return (
    <main style={shellStyle}>
      <section style={{ marginBottom: 24, padding: 24, borderRadius: 20, border: "1px solid rgba(159,176,212,0.15)", background: "rgba(12,22,38,0.82)" }}>
        <p style={{ margin: 0, color: "#8ea4cc", fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase" }}>Live KIS Dashboard</p>
        <h1 style={{ margin: "10px 0 8px", fontSize: 34 }}>Trading Dashboard Home</h1>
        <p style={{ margin: 0, color: "#a8b8d6" }}>Home dashboard route wired through the server-side trading API with KIS-backed tracked quotes.</p>
      </section>

      {failures.length ? (
        <section
          style={{
            marginBottom: 24,
            padding: 18,
            borderRadius: 18,
            border: "1px solid rgba(255,193,94,0.24)",
            background: "rgba(64,45,14,0.52)",
            color: "#ffe2a6",
          }}
        >
          Partial upstream failure: {failures.join(" | ")}
        </section>
      ) : null}

      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, marginBottom: 24 }}>
        <article style={{ padding: 18, borderRadius: 18, border: "1px solid rgba(159,176,212,0.15)", background: "rgba(12,22,38,0.82)" }}>
          <div style={{ color: "#8ea4cc", fontSize: 12 }}>MARKET STATUS</div>
          <h2 style={{ margin: "10px 0" }}>{market?.state ?? "Unavailable"}</h2>
          <p style={{ margin: 0, color: "#cbd7ee" }}>Open: {market ? String(market.is_open) : "Unknown"}</p>
          <p style={{ margin: "6px 0 0", color: "#9fb0cf" }}>
            {market?.server_time ? formatDisplayTimestamp(market.server_time) : "Awaiting market feed"}
          </p>
        </article>
        <article style={{ padding: 18, borderRadius: 18, border: "1px solid rgba(159,176,212,0.15)", background: "rgba(12,22,38,0.82)" }}>
          <div style={{ color: "#8ea4cc", fontSize: 12 }}>LEAD SYMBOL</div>
          <h2 style={{ margin: "10px 0" }}>{lead?.symbol ?? trackedSymbols[0] ?? "N/A"}</h2>
          <p style={{ margin: 0, color: "#cbd7ee" }}>Price: {lead && hasNumber(lead.price) ? `₩${lead.price.toLocaleString()}` : "-"}</p>
          <p style={{ margin: "6px 0 0", color: lead && (lead.change_pct ?? 0) >= 0 ? "#35d07f" : "#ff6b7a" }}>
            {lead && hasNumber(lead.change_pct) ? formatSignedPercent(lead.change_pct) : (lead?.unavailable_reason ?? "Tracked quote feed unavailable")}
          </p>
        </article>
        <article style={{ padding: 18, borderRadius: 18, border: "1px solid rgba(159,176,212,0.15)", background: "rgba(12,22,38,0.82)" }}>
          <div style={{ color: "#8ea4cc", fontSize: 12 }}>TRACKED SET</div>
          <h2 style={{ margin: "10px 0" }}>{trackedCount}</h2>
          <p style={{ margin: 0, color: "#cbd7ee" }}>{trackedSymbols.length ? trackedSymbols.join(", ") : "Scanner feed unavailable"}</p>
          <p style={{ margin: "6px 0 0", color: "#9fb0cf" }}>
            {trackedUpdatedAt ? `Updated ${formatDisplayTimestamp(trackedUpdatedAt)}` : "No scanner timestamp"}
          </p>
        </article>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
        <article style={{ padding: 20, borderRadius: 18, border: "1px solid rgba(159,176,212,0.15)", background: "rgba(12,22,38,0.82)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 16 }}>
            <div>
              <p style={{ margin: 0, color: "#8ea4cc", fontSize: 12 }}>KIS WATCHLIST</p>
              <h2 style={{ margin: "8px 0 0" }}>Tracked Quotes</h2>
            </div>
            <strong style={{ color: averageMove >= 0 ? "#35d07f" : "#ff6b7a" }}>
              {trackedItems.length ? formatSignedPercent(averageMove) : "No quote data"}
            </strong>
          </div>
          {trackedItems.length ? (
            <div style={{ display: "grid", gap: 12 }}>
              {trackedItems.map((item) => (
                <div key={item.symbol} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: 14, borderRadius: 14, border: "1px solid rgba(159,176,212,0.10)", background: "rgba(255,255,255,0.03)" }}>
                  <div>
                    <strong>{item.symbol}</strong>
                    <div style={{ color: "#9fb0cf", marginTop: 6 }}>{item.as_of ? `Updated ${formatDisplayTimestamp(item.as_of)}` : item.trade_date ?? item.market_state}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div>{hasNumber(item.price) ? `₩${item.price.toLocaleString()}` : "Unavailable"}</div>
                    <div style={{ marginTop: 6, color: (item.change_pct ?? 0) >= 0 ? "#35d07f" : "#ff6b7a" }}>
                      {hasNumber(item.change_pct) ? formatSignedPercent(item.change_pct) : (item.unavailable_reason ?? "Unavailable")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: "#9fb0cf" }}>Tracked quotes are currently unavailable, but the rest of the dashboard remains usable.</div>
          )}
        </article>

        <article style={{ padding: 20, borderRadius: 18, border: "1px solid rgba(159,176,212,0.15)", background: "rgba(12,22,38,0.82)" }}>
          <p style={{ margin: 0, color: "#8ea4cc", fontSize: 12 }}>DESK INSIGHT</p>
          <h2 style={{ margin: "10px 0 14px" }}>Core Integration Summary</h2>
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <span style={{ color: "#9fb0cf" }}>Updated</span>
              <div>{trackedUpdatedAt ? formatDisplayTimestamp(trackedUpdatedAt) : "Unavailable"}</div>
            </div>
            <div style={{ paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <span style={{ color: "#9fb0cf" }}>Turnover</span>
              <div>{trackedItems.length ? formatCompactWon(totalTurnover) : "Unavailable"}</div>
            </div>
            <div style={{ paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <span style={{ color: "#9fb0cf" }}>Lead change</span>
              <div style={{ color: lead && (lead.change_pct ?? 0) >= 0 ? "#35d07f" : "#ff6b7a" }}>
                {lead && hasNumber(lead.change_pct) ? formatSignedPercent(lead.change_pct) : (lead?.unavailable_reason ?? "Unavailable")}
              </div>
            </div>
            <div>
              <span style={{ color: "#9fb0cf" }}>Tracked symbols</span>
              <div>{trackedSymbols.length ? trackedSymbols.join(", ") : "Unavailable"}</div>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}
