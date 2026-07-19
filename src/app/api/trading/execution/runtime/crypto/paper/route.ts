import { CRYPTO_PAPER_RUNTIME_UPSTREAM_PATH } from "@/lib/crypto-readonly";
import { proxyTradingUpstreamJsonFromRequest } from "@/lib/trading-upstream";

export async function GET(request: Request) {
  return proxyTradingUpstreamJsonFromRequest(request, CRYPTO_PAPER_RUNTIME_UPSTREAM_PATH);
}
