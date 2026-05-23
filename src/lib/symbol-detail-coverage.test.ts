import assert from "node:assert/strict";
import test from "node:test";

import { hasSymbolDetailCoverage } from "./symbol-detail-coverage";

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

test("blocks unsupported non-KRX style symbols before symbol detail navigation", () => {
  assert.equal(hasSymbolDetailCoverage({ symbol: "AAPL", market: "NASDAQ", instrument_type: "equity" }), false);
});
