import { proxyTradingUpstreamJson } from "@/lib/trading-upstream";

export async function GET() {
  return proxyTradingUpstreamJson("/scanner/tracked-symbols");
}
