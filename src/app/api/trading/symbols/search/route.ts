import { NextRequest } from "next/server";

import { proxyTradingUpstreamJson } from "@/lib/trading-upstream";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const q = search.get("q") || "";
  const limit = search.get("limit") || "20";
  return proxyTradingUpstreamJson(`/symbols/search?q=${encodeURIComponent(q)}&limit=${encodeURIComponent(limit)}`);
}
