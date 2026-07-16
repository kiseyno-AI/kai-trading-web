import assert from "node:assert/strict";
import test from "node:test";

import {
  DEGRADED_DIRECT_OPEN_SOURCE,
  DEGRADED_KNOWN_SYMBOL_SOURCE,
  buildDegradedSearchItems,
  buildSearchSymbolHref,
} from "../app/search/search-symbol-routing";
import { UNKNOWN_SYMBOL_META } from "./symbol-meta";

function readLocalHref(href: string) {
  return new URL(href, "https://example.test");
}

test("builds unverified degraded direct-open hrefs without market or company metadata", () => {
  const item = buildDegradedSearchItems("123456")[0];

  assert.ok(item);
  assert.equal(item.source, DEGRADED_DIRECT_OPEN_SOURCE);
  assert.equal(item.name_ko, UNKNOWN_SYMBOL_META);
  assert.equal(item.market, UNKNOWN_SYMBOL_META);
  assert.equal(item.standard_code, UNKNOWN_SYMBOL_META);

  const href = buildSearchSymbolHref(item, "123456");
  const url = readLocalHref(href);

  assert.equal(url.pathname, "/dashboard/symbol/123456");
  assert.equal(url.searchParams.get("navContext"), "search");
  assert.equal(url.searchParams.get("q"), "123456");
  assert.equal(url.searchParams.has("name"), false);
  assert.equal(url.searchParams.has("market"), false);
  assert.equal(url.searchParams.has("standardCode"), false);
  assert.equal(href.includes("KRX"), false);
});

test("preserves vetted known-symbol fallback metadata in degraded search hrefs", () => {
  const item = buildDegradedSearchItems("삼성")[0];

  assert.ok(item);
  assert.equal(item.source, DEGRADED_KNOWN_SYMBOL_SOURCE);
  assert.equal(item.symbol, "005930");
  assert.equal(item.name_ko, "삼성전자");
  assert.equal(item.market, "KOSPI");
  assert.equal(item.standard_code, "KR7005930003");

  const href = buildSearchSymbolHref(item, "삼성");
  const url = readLocalHref(href);

  assert.equal(url.pathname, "/dashboard/symbol/005930");
  assert.equal(url.searchParams.get("name"), "삼성전자");
  assert.equal(url.searchParams.get("market"), "KOSPI");
  assert.equal(url.searchParams.get("standardCode"), "KR7005930003");
  assert.equal(url.searchParams.get("navContext"), "search");
  assert.equal(url.searchParams.get("q"), "삼성");
});

test("prefers exact vetted fallback metadata over a raw numeric direct-open row", () => {
  const item = buildDegradedSearchItems("005930")[0];

  assert.ok(item);
  assert.equal(item.source, DEGRADED_KNOWN_SYMBOL_SOURCE);
  assert.equal(item.name_ko, "삼성전자");
  assert.equal(item.market, "KOSPI");
  assert.equal(item.standard_code, "KR7005930003");
});
