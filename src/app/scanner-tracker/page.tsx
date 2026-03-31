const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

async function getTrackedSymbols() {
  const res = await fetch(`${API_BASE}/scanner/tracked-symbols`, { cache: "no-store" });
  if (!res.ok) {
    return { tracked_symbols: [], count: 0, last_updated_at: null, error: true };
  }
  return res.json();
}

export default async function ScannerTrackerPage() {
  const data = await getTrackedSymbols();

  return (
    <main style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1>Tracked Symbols</h1>
      <p>Symbols currently collected in the scanner&apos;s high-frequency tracking layer.</p>
      <div style={{ margin: "16px 0", padding: 16, border: "1px solid #333", borderRadius: 12 }}>
        <div><strong>Count:</strong> {data.count}</div>
        <div><strong>Last updated:</strong> {data.last_updated_at || "not updated yet"}</div>
      </div>
      <ul>
        {(data.tracked_symbols || []).map((symbol: string) => (
          <li key={symbol}>{symbol}</li>
        ))}
      </ul>
    </main>
  );
}
