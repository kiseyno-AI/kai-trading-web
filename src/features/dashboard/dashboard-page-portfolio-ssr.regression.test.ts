import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test(
  "TC-DASH-540-01 dashboard SSR no longer blocks on portfolio summary during the initial request batch",
  () => {
    const pageSource = readFileSync(new URL("../../app/dashboard/page.tsx", import.meta.url), "utf8");

    assert.equal(
      pageSource.includes('fetchServerTradingApiJson<PortfolioSummaryDto>("/portfolio/summary", requestHeaders)'),
      false,
      "portfolio/summary should not be awaited in the initial server-render fetch batch",
    );
  },
);

test("TC-DASH-540-02 dashboard SSR renders a shell without waiting on trading API reads", () => {
  const pageSource = readFileSync(new URL("../../app/dashboard/page.tsx", import.meta.url), "utf8");

  assert.equal(
    pageSource.includes("fetchServerTradingApiJson"),
    false,
    "dashboard page should not await upstream trading API reads before first HTML",
  );
  assert.equal(
    pageSource.includes('from "next/headers"'),
    false,
    "dashboard page should not need request headers for server-side trading API reads",
  );
});

test("TC-DASH-540-03 dashboard SSR shell starts unavailable without inventing market or quote data", () => {
  const pageSource = readFileSync(new URL("../../app/dashboard/page.tsx", import.meta.url), "utf8");

  assert.match(
    pageSource,
    /initialFreshness=\{null\}/,
    "dashboard shell should still defer freshness to the client",
  );
  assert.match(
    pageSource,
    /state:\s*["']UNAVAILABLE["'][\s\S]*?server_time:\s*null/,
    "market state should remain unavailable until a validated API response arrives",
  );
  assert.match(
    pageSource,
    /market_state:\s*["']unavailable["'][\s\S]*?as_of:\s*null[\s\S]*?items:\s*\[\]/,
    "tracked quotes should remain empty until a validated API response arrives",
  );
  assert.doesNotMatch(pageSource, /source:\s*["']mock["']/, "mock quotes must never seed the dashboard");
  assert.doesNotMatch(
    pageSource,
    /Samsung Electronics|SK hynix|NAVER|Hyundai Motor/,
    "plausible security data must not be embedded in the production dashboard shell",
  );
  assert.doesNotMatch(pageSource, /new Date\(\)\.toISOString\(\)/, "render time must not masquerade as data time");
});

test("TC-DASH-540-04 dashboard is a read-only overview with one process-detail surface", () => {
  const clientSource = readFileSync(new URL("../../app/dashboard/live-dashboard-client.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(
    clientSource,
    /agent-context\/internal\/core\/control|SIGKILL|AgentContextCoreControl/,
    "the Web overview must not expose a Core process-control path",
  );
  assert.doesNotMatch(
    clientSource,
    /data-dashboard-filtering-scoring=["']inline["']/,
    "filtering and scoring belong in the process drawer instead of a duplicate inline grid",
  );
  assert.doesNotMatch(
    clientSource,
    /bottomAccessory:\s*\(/,
    "the mobile process trigger should stay in document flow instead of consuming fixed navigation space",
  );
});

test("TC-DASH-540-05 unreachable synthetic dashboard adapters stay removed", () => {
  const retiredModules = [
    "../../data/trading-dashboard.ts",
    "../../lib/trading-api.ts",
    "../../lib/use-dashboard-snapshot.ts",
    "../../lib/use-markets-overview.ts",
    "../dashboard/dashboard-view.tsx",
    "../dashboard/execution-runtime-panel.tsx",
    "../markets/markets-overview.tsx",
    "../../components/dashboard/metric-card.tsx",
    "../../components/dashboard/watchlist-item.tsx",
  ];

  assert.deepEqual(
    retiredModules.filter((path) => existsSync(new URL(path, import.meta.url))),
    [],
  );
});

test("TC-DASH-540-06 desktop overview fills both columns without a blank grid row", () => {
  const cssSource = readFileSync(
    new URL("../../app/dashboard/live-dashboard-client.module.css", import.meta.url),
    "utf8",
  );

  assert.match(
    cssSource,
    /grid-template-areas:\s*[\s\S]*?["']decision portfolio["'][\s\S]*?["']market portfolio["']/,
  );
  assert.match(cssSource, /\.portfolioStateCard\s*\{\s*grid-area:\s*portfolio;/s);
  assert.match(cssSource, /\.marketOverviewCard\s*\{\s*grid-area:\s*market;/s);
});
