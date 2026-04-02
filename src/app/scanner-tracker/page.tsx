import { headers } from "next/headers";

import { formatDisplayTimestamp } from "@/lib/format";
import { fetchServerTradingApiJson } from "@/lib/trading-upstream";

type TrackedSymbolsResponse = {
  tracked_symbols: string[];
  count: number;
  last_updated_at: string | null;
};

type TrackedSymbolsLoadResult = TrackedSymbolsResponse & {
  error: string | null;
};

async function getTrackedSymbols() {
  const requestHeaders = await headers();

  try {
    const data = await fetchServerTradingApiJson<TrackedSymbolsResponse>(
      "/scanner/tracked-symbols",
      requestHeaders,
    );

    return {
      ...data,
      error: null,
    } satisfies TrackedSymbolsLoadResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      tracked_symbols: [],
      count: 0,
      last_updated_at: null,
      error: message,
    } satisfies TrackedSymbolsLoadResult;
  }
}

export default async function ScannerTrackerPage() {
  const data = await getTrackedSymbols();

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>Tracked Symbols</h1>
      <p>Symbols currently collected in the scanner&apos;s high-frequency tracking layer.</p>
      <div style={{ margin: "16px 0", padding: 16, border: "1px solid #333", borderRadius: 12 }}>
        <div><strong>Count:</strong> {data.count}</div>
        <div><strong>Last updated:</strong> {formatDisplayTimestamp(data.last_updated_at, "not updated yet")}</div>
      </div>
      {data.error ? (
        <div style={{ margin: "16px 0", padding: 16, border: "1px solid #7f1d1d", borderRadius: 12, background: "#fff1f2", color: "#881337" }}>
          <strong>Scanner feed unavailable:</strong> {data.error}
        </div>
      ) : null}
      <ul>
        {(data.tracked_symbols || []).map((symbol: string) => (
          <li key={symbol}>{symbol}</li>
        ))}
      </ul>
    </main>
  );
}
