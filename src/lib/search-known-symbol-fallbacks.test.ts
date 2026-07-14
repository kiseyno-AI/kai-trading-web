import assert from "node:assert/strict";
import test from "node:test";

import { getKnownSymbolSearchFallbacks } from "./search-known-symbol-fallbacks";

test("resolves a Korean Samsung company-name query into supported symbol fallbacks", () => {
  const items = getKnownSymbolSearchFallbacks("삼성");

  assert.deepEqual(
    items.map((item) => item.symbol),
    ["005930", "207940", "006400"],
  );
  assert.equal(items[0]?.name_ko, "삼성전자");
  assert.equal(items[0]?.standard_code, "KR7005930003");
  assert.equal(items[0]?.market, "KOSPI");
  assert.equal(items[0]?.instrument_type, "stock");
});

test("matches English aliases without requiring symbol-master availability", () => {
  const items = getKnownSymbolSearchFallbacks("samsung bio");

  assert.deepEqual(
    items.map((item) => item.symbol),
    ["207940"],
  );
});

test("ignores overly broad one-character fallback queries", () => {
  assert.deepEqual(getKnownSymbolSearchFallbacks("삼"), []);
});
