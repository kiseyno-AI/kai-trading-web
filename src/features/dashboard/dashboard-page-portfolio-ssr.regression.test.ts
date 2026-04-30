import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test(
  "TC-DASH-540-01 dashboard SSR no longer blocks on portfolio summary during the initial request batch",
  () => {
    const pageSource = readFileSync(new URL("../../app/dashboard/page.tsx", import.meta.url), "utf8");

    assert.equal(
      pageSource.includes('fetchServerTradingApiJson<PortfolioSummaryDto>("/portfolio/summary", requestHeaders)'),
      false,
      "portfolio/summary should not be awaited in the initial server-render fetch batch",
    );
  },
);

