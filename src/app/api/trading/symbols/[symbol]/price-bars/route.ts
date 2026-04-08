import { NextRequest } from "next/server";

import { proxyTradingUpstreamJson } from "@/lib/trading-upstream";

export async function GET(request: NextRequest, context: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await context.params;
  const search = request.nextUrl.search;

  return proxyTradingUpstreamJson(`/symbols/${encodeURIComponent(symbol)}/price-bars${search}`);
}
