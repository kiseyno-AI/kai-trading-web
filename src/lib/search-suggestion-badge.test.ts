import assert from "node:assert/strict";
import test from "node:test";

import { getSearchSuggestionBadge } from "./search-suggestion-badge";

test("uses alphanumeric prefix for non-numeric symbols", () => {
  assert.equal(getSearchSuggestionBadge({ symbol: "AAPL", market: "NASDAQ" }), "AA");
  assert.equal(getSearchSuggestionBadge({ symbol: "BTC/USDT", market: "CRYPTO" }), "BT");
});

test("uses market badge for leading-zero six-digit Korean symbols", () => {
  assert.equal(getSearchSuggestionBadge({ symbol: "005930", market: "KOSPI" }), "KOSPI");
  assert.equal(getSearchSuggestionBadge({ symbol: "000660", market: "KOSDAQ" }), "KOSDAQ");
});

test("hides repeated zero prefix when market is not informative", () => {
  assert.equal(getSearchSuggestionBadge({ symbol: "005930", market: "KRX" }), null);
});

test("keeps symbol visibility with a fallback badge for unsupported markets", () => {
  assert.equal(getSearchSuggestionBadge({ symbol: "005930", market: "-" }), null);
  assert.equal(getSearchSuggestionBadge({ symbol: "005930", market: "[확인 필요]" }), null);
});
