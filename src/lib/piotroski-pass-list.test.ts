import assert from "node:assert/strict";
import test from "node:test";

import { resolvePiotroskiMarketDateResolution } from "./piotroski-pass-list";

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
