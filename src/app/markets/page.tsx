import { MarketsOverview } from "@/features/markets/markets-overview";

import { MarketsRouteChrome } from "./markets-route-chrome";

export default function MarketsPage() {
  return (
    <MarketsRouteChrome>
      <MarketsOverview />
    </MarketsRouteChrome>
  );
}
