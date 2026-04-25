import assert from "node:assert/strict";
import test from "node:test";

import { getSymbolDetailCopy } from "@/i18n/symbol-detail-copy";

import {
  buildActionSummarySectionModel,
  buildDisclosureCoverageSectionModel,
  buildFundamentalsHistorySectionModel,
  buildSystemFreshnessSectionModel,
} from "./symbol-detail-derived-state";

test("keeps action-summary fallback labels stable when no summary is available", () => {
  const copy = getSymbolDetailCopy("en");
  const model = buildActionSummarySectionModel(null, copy);

  assert.equal(model.badgeLabel, copy.action.unavailable);
  assert.equal(model.headline, copy.action.emptyHeadline);
  assert.equal(model.body, copy.action.emptyBody);
  assert.equal(model.metaCaption, `${copy.action.payloadKeys}: No payload keys`);
  assert.deepEqual(model.reasonTags, [copy.action.noRationaleRows]);
  assert.equal(model.metrics[0]?.value, "Unavailable");
  assert.equal(model.metrics[1]?.value, "Unavailable");
  assert.equal(model.metrics[2]?.value, copy.action.noTriggerPrice);
  assert.equal(model.score, 0);
  assert.equal(model.tone, "neutral");
});

test("keeps fundamentals-history empty-state outputs stable when no history is available", () => {
  const copy = getSymbolDetailCopy("en");
  const model = buildFundamentalsHistorySectionModel({
    companyHistory: null,
    copy,
    fundamentalsEntryLimit: 4,
    fundamentalsLoading: false,
    fsDiv: null,
    introTitle: "Samsung Electronics",
    latestFundamentals: null,
    latestHistoryEntry: null,
    symbol: "005930",
  });

  assert.equal(model.state, "empty");
  assert.equal(model.fsValue, copy.fundamentals.defaultFs);
  assert.equal(model.introInitial, "0");
  assert.equal(model.introTitle, "Samsung Electronics");
  assert.equal(
    model.introBody,
    `${copy.fundamentals.latestFilingPrefix} ${copy.fundamentals.noFilingLoaded}.`,
  );
  assert.equal(model.emptyTitle, copy.fundamentals.emptyTitle);
  assert.equal(model.emptyBody, copy.fundamentals.coverageMissing);
  assert.equal(model.highlights[0]?.label, copy.fundamentals.latestFiling);
  assert.equal(model.highlights[0]?.value, copy.fundamentals.noFilingLoaded);
});

test("builds disclosure-coverage cards from a stable display model", () => {
  const copy = getSymbolDetailCopy("en");
  const latestDisclosure = {
    rcept_no: "202604100001",
    receipt_date: "2026-04-10",
    report_nm: "Annual report",
    corp_name: "Samsung Electronics",
    filing_category: "annual_report",
    fundamentals_capture_status: "captured",
  };
  const model = buildDisclosureCoverageSectionModel({
    copy,
    disclosureCount: 2,
    disclosureItemLimit: 4,
    latestDisclosure,
    recentDisclosures: [latestDisclosure],
    routeQueryString: "marketDate=2026-04-10",
    sectionState: "list",
    symbol: "005930",
  });

  assert.equal(model.state, "list");
  assert.equal(model.badgeTone, "info");
  assert.equal(model.badgeValue, `2 ${copy.disclosures.items}`);
  assert.equal(model.coverageTitle, copy.disclosures.latestDisclosureAvailable);
  assert.match(
    model.cards[0]?.href ?? "",
    /^\/dashboard\/symbol\/005930\/disclosure-coverage\/202604100001\?/,
  );
  assert.equal(model.cards[0]?.title, "Annual report");
  assert.equal(model.cards[0]?.dateLabel, "2026-04-10");
  assert.equal(
    model.cards[0]?.body,
    `Annual Report · ${copy.disclosures.capture} Captured`,
  );
  assert.equal(
    model.coverageBody,
    `2 ${copy.disclosures.loadedSuffix} ${copy.disclosures.latestFilingLandedOn} 2026-04-10.`,
  );
});

test("keeps system-freshness fallback rows stable when quote and disclosure coverage are unavailable", () => {
  const copy = getSymbolDetailCopy("en");
  const model = buildSystemFreshnessSectionModel({
    actionSummary: null,
    aggregateContext: null,
    copy,
    disclosureSectionState: "unavailable",
    freshness: {
      today: {
        trade_date: "2026-04-18",
        eod_status: "running",
      },
      latest: {},
    },
    hasFundamentalsHistory: false,
    latestDisclosure: null,
    latestFundamentals: null,
    marketDate: "2026-04-18",
    quote: {
      symbol: "005930",
      company_name: "Samsung Electronics",
      price: null,
      change: null,
      change_pct: null,
      volume: null,
      turnover: null,
      market_state: "CLOSED",
      source: "daily_price_bar",
      fallback: true,
      is_live: false,
      available: false,
      trade_date: "2026-04-18",
      unavailable_reason: "Quote cache waiting for confirmation",
    },
    technicalSnapshot: null,
  });

  const priceRow = model.moduleRows.find((row) => row.id === "price");
  const disclosureRow = model.moduleRows.find((row) => row.id === "disclosures");

  assert.equal(model.statusLabel, "Running");
  assert.equal(model.tone, "info");
  assert.equal(priceRow?.date, "2026-04-18");
  assert.equal(priceRow?.detail, "Quote cache waiting for confirmation");
  assert.equal(priceRow?.status, copy.freshness.unavailable);
  assert.equal(disclosureRow?.date, copy.freshness.unavailable);
  assert.equal(disclosureRow?.status, copy.freshness.unavailable);
  assert.equal(disclosureRow?.detail, copy.disclosures.emptyTitle);
});
