import assert from "node:assert/strict";
import test from "node:test";

import {
  clampMarketDateToProductDate,
  getCurrentProductMarketDate,
  isWeekendProductMarketDate,
  normalizeProductMarketDate,
} from "./product-market-date";

test("formats the product market date on both sides of KST midnight", () => {
  assert.equal(getCurrentProductMarketDate(new Date("2026-07-13T23:59:59+09:00")), "2026-07-13");
  assert.equal(getCurrentProductMarketDate(new Date("2026-07-14T00:00:00+09:00")), "2026-07-14");
  assert.equal(getCurrentProductMarketDate(new Date("2026-07-13T14:59:59Z")), "2026-07-13");
  assert.equal(getCurrentProductMarketDate(new Date("2026-07-13T15:00:00Z")), "2026-07-14");
});

test("normalizes and clamps candidate dates to the product market date", () => {
  assert.equal(normalizeProductMarketDate("2026-07-13T16:00:00+09:00"), "2026-07-13");
  assert.equal(clampMarketDateToProductDate("2026-07-14", "2026-07-13"), "2026-07-13");
  assert.equal(clampMarketDateToProductDate("2026-07-13", "2026-07-13"), "2026-07-13");
  assert.equal(clampMarketDateToProductDate("2026-07-12", "2026-07-13"), "2026-07-12");
  assert.equal(clampMarketDateToProductDate(null, "2026-07-13"), null);
});

test("detects weekend product dates for latest-stored fallback decisions", () => {
  assert.equal(isWeekendProductMarketDate("2026-05-24"), true);
  assert.equal(isWeekendProductMarketDate("2026-07-13"), false);
});
