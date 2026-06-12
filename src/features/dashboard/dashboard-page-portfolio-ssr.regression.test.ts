import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

test("TC-DASH-540-03 dashboard SSR shell does not seed a market date without freshness", () => {
  const pageSource = readFileSync(new URL("../../app/dashboard/page.tsx", import.meta.url), "utf8");

  assert.match(
    pageSource,
    /initialFreshness=\{null\}/,
    "dashboard shell should still defer freshness to the client",
  );
  assert.match(
    pageSource,
    /market:\s*\{[\s\S]*?server_time:\s*null,[\s\S]*?\}\s*satisfies CoreMarketStatus/,
    "placeholder market status should not expose SSR time as a market date",
  );
  assert.doesNotMatch(
    pageSource,
    /server_time:\s*now/,
    "placeholder market status must not reuse SSR render time as a market date",
  );
});
