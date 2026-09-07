import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPiotroskiListHref,
  buildPiotroskiPassListResult,
  buildPiotroskiSymbolHref,
  getPiotroskiUnavailableChangeLabel,
  loadPiotroskiPassListItemEnrichment,
  resolvePiotroskiMarketDateResolution,
} from "./piotroski-pass-list";

test("prefers the returned effective market date while preserving requested and resolved metadata", () => {
  const resolution = resolvePiotroskiMarketDateResolution(
    {
      requested_market_date: "2026-04-16",
      resolved_market_date: "2026-04-15",
      market_date: "2026-04-14",
      is_latest_fallback: true,
    },
    "2026-04-16",
  );

  assert.deepEqual(resolution, {
    requestedMarketDate: "2026-04-16",
    resolvedMarketDate: "2026-04-15",
    effectiveMarketDate: "2026-04-14",
    isLatestFallback: true,
  });
});

test("falls back to the request date metadata when richer fields are absent", () => {
  const resolution = resolvePiotroskiMarketDateResolution(
    {
      market_date: "2026-04-15",
    },
    "2026-04-16",
  );

  assert.deepEqual(resolution, {
    requestedMarketDate: "2026-04-16",
    resolvedMarketDate: "2026-04-15",
    effectiveMarketDate: "2026-04-15",
    isLatestFallback: false,
  });
});

test("uses the resolved date when the response omits a top-level effective market date", () => {
  const resolution = resolvePiotroskiMarketDateResolution(
    {
      requested_market_date: "2026-04-16",
      resolved_market_date: "2026-04-15",
      market_date: null,
      is_latest_fallback: false,
    },
    "2026-04-16",
  );

  assert.deepEqual(resolution, {
    requestedMarketDate: "2026-04-16",
    resolvedMarketDate: "2026-04-15",
    effectiveMarketDate: "2026-04-15",
    isLatestFallback: false,
  });
});

test("builds the pass-list rows from core Piotroski results before quote enrichment", () => {
  const result = buildPiotroskiPassListResult(
    {
      requested_market_date: "2026-04-29",
      resolved_market_date: "2026-04-29",
      market_date: "2026-04-29",
      summary: {
        entries: 3,
        requested_symbol: null,
        matched_symbols: ["000660", "005930", "035420"],
        missing_symbols: [],
        passed_count: 106,
        not_passed_count: 2_705,
      },
      items: [
        {
          symbol: "005930",
          market_date: "2026-04-29",
          passed_filter: true,
          piotroski_score: 8,
          passes_piotroski_score: true,
          captured_at: "2026-04-29T16:10:00+09:00",
        },
        {
          symbol: "035420",
          market_date: "2026-04-29",
          passed_filter: false,
          piotroski_score: 5,
          passes_piotroski_score: false,
          captured_at: "2026-04-29T16:10:00+09:00",
        },
        {
          symbol: "000660",
          market_date: "2026-04-29",
          passed_filter: true,
          piotroski_score: 9,
          passes_piotroski_score: true,
          captured_at: "2026-04-29T16:10:00+09:00",
        },
      ],
    },
    "2026-04-29",
  );

  assert.equal(result.marketDate, "2026-04-29");
  assert.equal(result.totalPassedCount, 106);
  assert.deepEqual(
    result.items.map((item) => item.symbol),
    ["000660", "005930"],
  );
  assert.deepEqual(
    result.items.map((item) => ({
      companyName: item.companyName,
      piotroskiScore: item.piotroskiScore,
      quote: item.quote,
    })),
    [
      { companyName: null, piotroskiScore: 9, quote: null },
      { companyName: null, piotroskiScore: 8, quote: null },
    ],
  );
});

test("builds Piotroski drill-down URL with market-date context", () => {
  assert.equal(buildPiotroskiListHref("2026-04-30"), "/dashboard/piotroski-filter?marketDate=2026-04-30");
  assert.equal(buildPiotroskiListHref(null), "/dashboard/piotroski-filter");
  assert.equal(
    buildPiotroskiSymbolHref({
      symbol: "004150",
      companyName: "한솔홀딩스",
      marketDate: "2026-05-08",
    }),
    "/dashboard/symbol/004150?name=%ED%95%9C%EC%86%94%ED%99%80%EB%94%A9%EC%8A%A4&marketDate=2026-05-08&navContext=piotroski",
  );
});

test("preserves the dashboard summary count when the API omits row details", () => {
  const result = buildPiotroskiPassListResult(
    {
      market_date: "2026-04-29",
      summary: {
        entries: 2_811,
        requested_symbol: null,
        matched_symbols: [],
        missing_symbols: [],
        passed_count: 106,
        not_passed_count: 2_705,
      },
      items: null,
    },
    "2026-04-29",
  );

  assert.equal(result.marketDate, "2026-04-29");
  assert.equal(result.totalPassedCount, 106);
  assert.deepEqual(result.items, []);
});

test("maps unavailable quote-change reasons to compact, user-facing copy", () => {
  assert.equal(getPiotroskiUnavailableChangeLabel("no_live_quote_or_fresh_fallback"), "변동 미제공");
  assert.equal(getPiotroskiUnavailableChangeLabel("other_unstable_quote_state"), "[확인 필요]");
  assert.equal(getPiotroskiUnavailableChangeLabel(undefined), "변동 미제공");
});

test("ignores a wrong-symbol quote while enriching a Piotroski row", async (t) => {
  const originalFetch = globalThis.fetch;
  const requestedPaths: string[] = [];

  globalThis.fetch = (async (input) => {
    const path = String(input);
    requestedPaths.push(path);

    if (path.includes("/quotes/005930")) {
      return Response.json({
        symbol: "000660",
        company_name: "SK hynix",
        price: 182_000,
        change: 1_500,
        change_pct: 0.83,
        volume: 1_000_000,
        turnover: 182_000_000_000,
        market_state: "OPEN",
        source: "kis",
        fallback: false,
        is_live: true,
        available: true,
      });
    }

    if (path.includes("/symbols/search")) {
      return Response.json({
        items: [
          {
            symbol: "005930",
            name_ko: "Samsung Electronics",
          },
        ],
      });
    }

    return new Response(null, { status: 404 });
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  const enriched = await loadPiotroskiPassListItemEnrichment(
    {
      symbol: "005930",
      marketDate: "2026-04-29",
      piotroskiScore: 9,
      companyName: null,
      metadata: null,
      quote: null,
    },
    { timeoutMs: 500 },
  );

  assert.equal(enriched.quote, null);
  assert.equal(enriched.companyName, "Samsung Electronics");
  assert.equal(enriched.metadata?.symbol, "005930");
  assert.equal(requestedPaths.some((path) => path.includes("/symbols/search")), true);
});
