import assert from "node:assert/strict";
import test from "node:test";

import { UNKNOWN_SYMBOL_META } from "./symbol-meta";
import { hasDegradedDirectOpenSymbolDetailCoverage, hasSymbolDetailCoverage } from "./symbol-detail-coverage";

test("allows supported domestic equity favorite symbols into symbol detail", () => {
  assert.equal(
    hasSymbolDetailCoverage({
      symbol: "005930",
      market: "KOSPI",
      instrument_type: "stock",
    }),
    true,
  );
  assert.equal(
    hasSymbolDetailCoverage({
      symbol: "373220",
      market: "KRX",
      instrument_type: "equity",
    }),
    true,
  );
});

test("blocks fund-like favorites that cannot populate equity symbol detail", () => {
  assert.equal(
    hasSymbolDetailCoverage({
      symbol: "F70100026",
      market: "KOSPI",
      instrument_type: "fund",
    }),
    false,
  );
});

test("blocks non-equity instrument types even when the symbol shape is numeric", () => {
  assert.equal(
    hasSymbolDetailCoverage({
      symbol: "069500",
      market: "KOSPI",
      instrument_type: "etf",
    }),
    false,
  );
});

test("blocks visible ETF product names before instrument metadata enrichment", () => {
  assert.equal(
    hasSymbolDetailCoverage({
      symbol: "252670",
      market: "KOSPI",
      name_ko: "KODEX 200선물인버스2X",
      instrument_type: null,
    }),
    false,
  );
});

test("allows supported stock names when instrument metadata is still absent", () => {
  assert.equal(
    hasSymbolDetailCoverage({
      symbol: "005930",
      market: "KOSPI",
      name_ko: "삼성전자",
      instrument_type: null,
    }),
    true,
  );
});

test("keeps degraded direct open coverage for supported numeric equity lookups", () => {
  assert.equal(
    hasDegradedDirectOpenSymbolDetailCoverage({
      symbol: "005930",
      market: UNKNOWN_SYMBOL_META,
      name_ko: UNKNOWN_SYMBOL_META,
      instrument_type: null,
    }),
    true,
  );
});

test("blocks known unsupported product codes during degraded direct opens", () => {
  assert.equal(
    hasDegradedDirectOpenSymbolDetailCoverage({
      symbol: "252670",
      market: UNKNOWN_SYMBOL_META,
      name_ko: UNKNOWN_SYMBOL_META,
      instrument_type: null,
    }),
    false,
  );
});

test("blocks unsupported non-KRX style symbols before symbol detail navigation", () => {
  assert.equal(hasSymbolDetailCoverage({ symbol: "AAPL", market: "NASDAQ", instrument_type: "equity" }), false);
});
