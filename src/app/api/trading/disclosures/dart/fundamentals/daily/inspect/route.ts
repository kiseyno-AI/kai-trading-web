import { proxyTradingUpstreamJson } from "@/lib/trading-upstream";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();

  return proxyTradingUpstreamJson(
    query
      ? `/disclosures/dart/fundamentals/daily/inspect?${query}`
      : "/disclosures/dart/fundamentals/daily/inspect",
  );
}
