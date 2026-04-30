import assert from "node:assert/strict";
import test from "node:test";

import { buildPiotroskiListHref, buildPiotroskiPassListResult, resolvePiotroskiMarketDateResolution } from "./piotroski-pass-list";

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
