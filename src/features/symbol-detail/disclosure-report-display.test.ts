import assert from "node:assert/strict";
import test from "node:test";

import { getSymbolDetailCopy } from "@/i18n/symbol-detail-copy";

import {
  localizeDisclosureCaptureStatus,
  localizeDisclosureFilingCategory,
} from "./disclosure-report-display";

test("localizes known disclosure report metadata for Korean operators", () => {
  const copy = getSymbolDetailCopy("ko").disclosures.reportDetail;

  assert.equal(localizeDisclosureFilingCategory("Quarterly", copy), "분기");
  assert.equal(localizeDisclosureFilingCategory("annual_report", copy), "사업보고서");
  assert.equal(localizeDisclosureCaptureStatus("Captured", copy), "수집됨");
  assert.equal(localizeDisclosureCaptureStatus("not-captured", copy), "미수집");
});

test("preserves unknown disclosure source identifiers", () => {
  const copy = getSymbolDetailCopy("ko").disclosures.reportDetail;

  assert.equal(localizeDisclosureFilingCategory("DART-XBRL", copy), "DART-XBRL");
  assert.equal(localizeDisclosureCaptureStatus("source_pending_review", copy), "source_pending_review");
});
