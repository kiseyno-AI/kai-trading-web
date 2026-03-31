type CoreMarketStatus = {
  state: string;
  is_open: boolean;
  server_time: string;
};

type CoreTrackedQuote = {
  symbol: string;
  company_name?: string;
  price: number;
  change: number;
  change_pct: number;
  volume: number;
  turnover: number;
  as_of: string | null;
  market_state: string;
  source: string;
  fallback: boolean;
  is_live: boolean;
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

type SymbolSearchItem = {
  symbol: string;
  standard_code: string;
  name_ko: string;
  market: string;
};

type SymbolSearchResponse = {
  query: string;
  count: number;
  items: SymbolSearchItem[];
};

type DashboardPageProps = {
  searchParams?: Promise<{
    q?: string | string[];
  }>;
};

export const dynamic = "force-dynamic";

const coreBase = process.env.TRADING_API_INTERNAL_BASE_URL || "http://127.0.0.1:8000";

async function getCoreJson<T>(path: string): Promise<T> {
  const response = await fetch(`${coreBase}${path}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function getCompanyName(item: CoreTrackedQuote | undefined): string {
  if (!item) return "N/A";
  return item.company_name || item.symbol;
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const queryParam = resolvedSearchParams?.q;
  const searchQuery = (Array.isArray(queryParam) ? queryParam[0] : queryParam)?.trim() ?? "";
  const shouldSearch = searchQuery.length >= 2;

  try {
    const [market, tracked, symbols, symbolSearch] = await Promise.all([
      getCoreJson<CoreMarketStatus>("/market/status"),
      getCoreJson<CoreTrackedQuotesResponse>("/quotes/tracked"),
      getCoreJson<CoreTrackedSymbolsResponse>("/scanner/tracked-symbols"),
      shouldSearch
        ? getCoreJson<SymbolSearchResponse>(`/symbols/search?q=${encodeURIComponent(searchQuery)}&limit=8`)
        : Promise.resolve<SymbolSearchResponse>({
            query: searchQuery,
            count: 0,
            items: [],
          }),
    ]);

    const lead = tracked.items[0];

    return (
      <main style={{ padding: 24, fontFamily: "sans-serif", background: "#07111f", color: "#eef4ff", minHeight: "100vh" }}>
        <div style={{ marginBottom: 24, padding: 20, border: "1px solid #2a3b57", borderRadius: 16, background: "#0b1728" }}>
          <p style={{ margin: 0, color: "#8ea4cc", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>LIVE KIS DASHBOARD</p>
          <h1 style={{ margin: "8px 0 0", fontSize: 32 }}>Trading Dashboard Home</h1>
          <p style={{ color: "#9fb0cf" }}>This page is directly wired to trading-core KIS-backed endpoints.</p>
        </div>

        <section style={{ marginBottom: 24, padding: 20, border: "1px solid #2a3b57", borderRadius: 16, background: "#0b1728" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", marginBottom: 14, flexWrap: "wrap" }}>
            <div>
              <p style={{ margin: 0, color: "#8ea4cc", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>MASTER SYMBOL SEARCH</p>
              <h2 style={{ margin: "8px 0 6px" }}>Open symbol detail from the dashboard</h2>
              <p style={{ color: "#9fb0cf", maxWidth: 720 }}>
                Search the master symbol list by company name or code. Selecting a result opens a dedicated detail window for that symbol.
              </p>
            </div>
            <div style={{ color: "#8ea4cc", fontSize: 12 }}>Minimum 2 characters</div>
          </div>

          <form action="/dashboard" method="get" style={{ display: "grid", gap: 10 }}>
            <span style={{ color: "#cdd8ef", fontSize: 14 }}>Company name or symbol</span>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <input
                type="text"
                name="q"
                defaultValue={searchQuery}
                placeholder="Samsung / 005930"
                style={{
                  flex: "1 1 320px",
                  minHeight: 52,
                  borderRadius: 12,
                  border: "1px solid #2a3b57",
                  background: "#07111f",
                  color: "#eef4ff",
                  padding: "0 16px",
                  outline: "none",
                }}
              />
              <button
                type="submit"
                style={{
                  minHeight: 52,
                  padding: "0 18px",
                  borderRadius: 12,
                  border: "1px solid #2a3b57",
                  background: "#13233a",
                  color: "#eef4ff",
                  fontWeight: 600,
                }}
              >
                Search
              </button>
            </div>
          </form>

          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", marginTop: 14, color: "#8ea4cc", fontSize: 13, flexWrap: "wrap" }}>
            <span>
              {shouldSearch
                ? `${symbolSearch.items.length} matching symbols`
                : "Type at least 2 characters to search."}
            </span>
          </div>

          <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
            {symbolSearch.items.map((item) => (
              <a
                key={`${item.symbol}-${item.standard_code}`}
                href={`/dashboard/symbol/${encodeURIComponent(item.symbol)}?name=${encodeURIComponent(item.name_ko)}&market=${encodeURIComponent(item.market)}&standardCode=${encodeURIComponent(item.standard_code)}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 16,
                  alignItems: "center",
                  width: "100%",
                  padding: 16,
                  borderRadius: 14,
                  border: "1px solid #20324f",
                  background: "#07111f",
                  color: "#eef4ff",
                  textAlign: "left",
                  textDecoration: "none",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: "block", fontSize: 16 }}>{item.name_ko}</strong>
                  <div style={{ color: "#9fb0cf", marginTop: 4 }}>{item.symbol} · {item.standard_code}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <span style={{ padding: "6px 10px", borderRadius: 999, border: "1px solid #2a3b57", color: "#cdd8ef", fontSize: 12 }}>
                    {item.market}
                  </span>
                  <span style={{ color: "#8ea4cc", fontSize: 13 }}>Open detail ↗</span>
                </div>
              </a>
            ))}
            {shouldSearch && symbolSearch.items.length === 0 ? (
              <div style={{ padding: 16, borderRadius: 14, border: "1px dashed #2a3b57", color: "#9fb0cf" }}>
                No matching symbol or company was found in the master list.
              </div>
            ) : null}
          </div>
        </section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 16, marginBottom: 24 }}>
          <section style={{ padding: 18, border: "1px solid #2a3b57", borderRadius: 16, background: "#0b1728" }}>
            <div style={{ color: "#8ea4cc", fontSize: 12 }}>MARKET STATUS</div>
            <h2>{market.state}</h2>
            <p>Open: {String(market.is_open)}</p>
            <p>Server time: {market.server_time}</p>
          </section>

          <section style={{ padding: 18, border: "1px solid #2a3b57", borderRadius: 16, background: "#0b1728" }}>
            <div style={{ color: "#8ea4cc", fontSize: 12 }}>TRACKED SYMBOLS</div>
            <h2>{symbols.count}</h2>
            <p>Universe: {symbols.tracked_symbols.join(", ")}</p>
            <p>Updated: {symbols.last_updated_at ?? "N/A"}</p>
          </section>

          <section style={{ padding: 18, border: "1px solid #2a3b57", borderRadius: 16, background: "#0b1728" }}>
            <div style={{ color: "#8ea4cc", fontSize: 12 }}>LEAD QUOTE</div>
            <h2>{getCompanyName(lead)}</h2>
            <p>{lead?.symbol ?? "N/A"}</p>
            <p>
              {lead ? `${lead.change_pct >= 0 ? "+" : ""}${lead.change_pct.toFixed(2)}%` : "N/A"} /{" "}
              {lead ? `${lead.change >= 0 ? "+" : ""}${lead.change.toLocaleString()}` : "N/A"}
            </p>
          </section>
        </div>

        <section style={{ padding: 20, border: "1px solid #2a3b57", borderRadius: 16, background: "#0b1728" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
            <div>
              <p style={{ margin: 0, color: "#8ea4cc", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase" }}>TRACKED QUOTES</p>
              <h2 style={{ margin: "8px 0 4px" }}>Realtime KIS-backed watchlist</h2>
              <p style={{ color: "#9fb0cf" }}>Market state: {tracked.market_state} · As of {tracked.as_of}</p>
            </div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {tracked.items.map((item) => (
              <article
                key={item.symbol}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1.4fr) repeat(5, minmax(0, 1fr))",
                  gap: 12,
                  alignItems: "center",
                  padding: 14,
                  borderRadius: 14,
                  border: "1px solid #20324f",
                  background: "#07111f",
                }}
              >
                <div>
                  <strong style={{ display: "block", fontSize: 16 }}>{getCompanyName(item)}</strong>
                  <span style={{ color: "#8ea4cc", fontSize: 13 }}>{item.symbol}</span>
                </div>
                <div>
                  <div style={{ color: "#8ea4cc", fontSize: 12 }}>Price</div>
                  <strong>₩{item.price.toLocaleString()}</strong>
                </div>
                <div>
                  <div style={{ color: "#8ea4cc", fontSize: 12 }}>Change</div>
                  <strong style={{ color: item.change_pct >= 0 ? "#35d07f" : "#ff6b7a" }}>
                    {item.change_pct >= 0 ? "+" : ""}
                    {item.change_pct.toFixed(2)}%
                  </strong>
                </div>
                <div>
                  <div style={{ color: "#8ea4cc", fontSize: 12 }}>Volume</div>
                  <strong>{item.volume.toLocaleString()}</strong>
                </div>
                <div>
                  <div style={{ color: "#8ea4cc", fontSize: 12 }}>Turnover</div>
                  <strong>₩{item.turnover.toLocaleString()}</strong>
                </div>
                <div>
                  <div style={{ color: "#8ea4cc", fontSize: 12 }}>Feed</div>
                  <strong>{item.is_live ? "Live" : "Cached"}</strong>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    );
  } catch (error) {
    console.error("Dashboard server render failed", error);

    return (
      <main
        style={{
          padding: 24,
          fontFamily: "sans-serif",
          background: "#07111f",
          color: "#eef4ff",
          minHeight: "100vh",
        }}
      >
        <h1 style={{ marginTop: 0 }}>KIS DASHBOARD ERROR</h1>
        <p style={{ color: "#ff909d" }}>
          대시보드 데이터를 서버에서 불러오지 못했습니다. 코어 서버 연결을 확인하세요.
        </p>
      </main>
    );
  }
}
