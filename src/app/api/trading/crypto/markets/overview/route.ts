import { CRYPTO_MARKET_OVERVIEW_UPSTREAM_PATH } from "@/lib/crypto-readonly";
import { proxyTradingUpstreamJson } from "@/lib/trading-upstream";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.toString();

  return proxyTradingUpstreamJson(
    query ? `${CRYPTO_MARKET_OVERVIEW_UPSTREAM_PATH}?${query}` : CRYPTO_MARKET_OVERVIEW_UPSTREAM_PATH,
  );
}
