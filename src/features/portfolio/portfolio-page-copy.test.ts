import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("maps pnl.week to explicitly weekly portfolio copy", () => {
  const pageSource = readFileSync(
    new URL("../../app/portfolio/portfolio-page-client.tsx", import.meta.url),
    "utf8",
  );
  const en = JSON.parse(
    readFileSync(new URL("../../i18n/locales/en.json", import.meta.url), "utf8"),
  ) as { portfolio: { metrics: Record<string, { label: string }> } };
  const ko = JSON.parse(
    readFileSync(new URL("../../i18n/locales/ko.json", import.meta.url), "utf8"),
  ) as { portfolio: { metrics: Record<string, { label: string }> } };

  assert.match(pageSource, /id === "week-pnl"\) return copy\.metrics\.weekPnl/);
  assert.doesNotMatch(pageSource, /copy\.metrics\.dayPnl/);
  assert.equal(en.portfolio.metrics.weekPnl?.label, "Weekly P/L");
  assert.equal(ko.portfolio.metrics.weekPnl?.label, "주간 손익");
});

