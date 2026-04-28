import { proxyTradingUpstreamJson } from "@/lib/trading-upstream";

export async function GET() {
  return proxyTradingUpstreamJson("/market/snapshot");
}
