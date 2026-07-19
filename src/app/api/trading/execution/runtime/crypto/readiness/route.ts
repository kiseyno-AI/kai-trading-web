import { CRYPTO_RUNTIME_READINESS_UPSTREAM_PATH } from "@/lib/crypto-readonly";
import { proxyTradingUpstreamJsonFromRequest } from "@/lib/trading-upstream";

export async function GET(request: Request) {
  return proxyTradingUpstreamJsonFromRequest(request, CRYPTO_RUNTIME_READINESS_UPSTREAM_PATH);
}
