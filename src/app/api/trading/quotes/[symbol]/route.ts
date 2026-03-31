import { NextRequest } from "next/server";

import { proxyTradingUpstreamJson } from "@/lib/trading-upstream";

export async function GET(_: NextRequest, context: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await context.params;
  return proxyTradingUpstreamJson(`/quotes/${encodeURIComponent(symbol)}`);
}
