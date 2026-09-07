import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { selectExactSymbolQuote } from "./exact-symbol-quote";

test("selects a quote only when its normalized symbol exactly matches the request", () => {
  const requestedQuote = {
    symbol: " 005930 ",
    price: 71_000,
  };
  const wrongSymbolQuote = {
    symbol: "000660",
    price: 182_000,
  };

  assert.equal(selectExactSymbolQuote(requestedQuote, "005930"), requestedQuote);
  assert.equal(selectExactSymbolQuote({ ...requestedQuote, symbol: "krw-btc" }, " KRW-BTC ")?.price, 71_000);
  assert.equal(selectExactSymbolQuote(wrongSymbolQuote, "005930"), null);
  assert.equal(selectExactSymbolQuote(requestedQuote, "  "), null);
  assert.equal(selectExactSymbolQuote(null, "005930"), null);
});

test("the search selection ignores a quote returned for another symbol", () => {
  const source = readFileSync(
    new URL("../app/search/search-page-client.tsx", import.meta.url),
    "utf8",
  );

  assert.match(
    source,
    /setQuote\(selectExactSymbolQuote\(result\.data, selected\.symbol\)\)/,
    "the search quote poller must validate the selected symbol before updating UI state",
  );
  assert.match(
    source,
    /const selectedQuote = selectExactSymbolQuote\(quote, selected\?\.symbol\);/,
    "a prior selection's quote must not render while the next symbol is loading",
  );
  assert.doesNotMatch(source, /const canShowSelectedQuote = isSelected && quote;/);
});
