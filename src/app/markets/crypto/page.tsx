import { CryptoMarketsOverview } from "@/features/markets/crypto-markets-overview";

import { MarketsRouteChrome } from "../markets-route-chrome";

export default function CryptoMarketsPage() {
  return (
    <MarketsRouteChrome variant="crypto">
      <CryptoMarketsOverview />
    </MarketsRouteChrome>
  );
}
