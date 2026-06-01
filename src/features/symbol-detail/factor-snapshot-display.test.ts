import assert from "node:assert/strict";
import test from "node:test";

import { getSymbolDetailCopy } from "@/i18n/symbol-detail-copy";

import {
  formatFactorSnapshotTokenLabel,
  formatQualityCalculationLabel,
  formatQualityComponentLabel,
} from "./factor-snapshot-display";

test("factor snapshot display labels localize backend status tokens for KO operator UI", () => {
  const copy = getSymbolDetailCopy("ko");
  const labels = [
    formatFactorSnapshotTokenLabel(copy, "requires_at_least_253_stored_trading_bars"),
    formatFactorSnapshotTokenLabel(copy, "insufficient_history"),
    formatFactorSnapshotTokenLabel(copy, "Liquidity floor pending"),
    formatFactorSnapshotTokenLabel(copy, "Calculation unavailable"),
    formatFactorSnapshotTokenLabel(copy, "Unavailable"),
    formatFactorSnapshotTokenLabel(copy, "Unranked"),
    formatFactorSnapshotTokenLabel(copy, "Missing Depreciation And Amortization"),
    formatQualityCalculationLabel(copy, "unavailable"),
    formatQualityComponentLabel(copy, "gross_profit_to_assets", "Gross profit / assets"),
  ];

  assert.deepEqual(labels, [
    "히스토리 부족",
    "히스토리 부족",
    "데이터 대기",
    "산출 불가",
    "사용할 수 없음",
    "순위 미산출",
    "감가상각 데이터 대기",
    "산출 불가",
    "매출총이익/자산",
  ]);
  assert.doesNotMatch(
    labels.join(" "),
    /requires_at_least|insufficient_history|Liquidity floor pending|Calculation unavailable|Unavailable|Unranked|Missing Depreciation|Gross profit/i,
  );
});

test("factor snapshot composite copy avoids implementation-slot language in KO", () => {
  const copy = getSymbolDetailCopy("ko");
  const rendered = `${copy.factors.compositeEyebrow} ${copy.factors.compositeTitle} ${copy.factors.compositeBody} ${copy.factors.compositePending}`;

  assert.equal(copy.factors.compositeTitle, "종합 판단 대기");
  assert.match(rendered, /개별 팩터 카드/);
  assert.doesNotMatch(rendered, /예약된 슬롯|합성 엔드포인트|endpoint|reserved slot/i);
});

test("factor snapshot display labels keep English humanized fallback for English diagnostics", () => {
  const copy = getSymbolDetailCopy("en");

  assert.equal(formatFactorSnapshotTokenLabel(copy, "custom_backend_reason"), "Custom Backend Reason");
});
