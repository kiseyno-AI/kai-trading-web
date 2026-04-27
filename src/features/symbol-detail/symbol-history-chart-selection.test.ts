import assert from "node:assert/strict";
import test from "node:test";

import { resolveTradeDateFromChartCoordinate } from "./symbol-history-chart-selection";

const bars = [
  { trade_date: "2026-04-17" },
  { trade_date: "2026-04-18" },
  { trade_date: "2026-04-21" },
  { trade_date: "2026-04-22" },
  { trade_date: "2026-04-23" },
];

test("preserves a latest-candle selection resolved from logical coordinates", () => {
  assert.equal(
    resolveTradeDateFromChartCoordinate({
      bars,
      coordinate: 12,
      containerWidth: 240,
      logicalIndex: 4.4,
      timeScaleTradeDate: null,
    }),
    "2026-04-23",
  );
});

test("preserves a latest-candle selection resolved from time mapping when logical coordinates are unavailable", () => {
  assert.equal(
    resolveTradeDateFromChartCoordinate({
      bars,
      coordinate: 12,
      containerWidth: 240,
      logicalIndex: Number.NaN,
      timeScaleTradeDate: "2026-04-23",
    }),
    "2026-04-23",
  );
});

test("falls back to width ratio only when chart coordinate mapping is unavailable", () => {
  assert.equal(
    resolveTradeDateFromChartCoordinate({
      bars,
      coordinate: 180,
      containerWidth: 240,
      logicalIndex: null,
      timeScaleTradeDate: null,
    }),
    "2026-04-22",
  );
});
