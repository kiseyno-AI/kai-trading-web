import assert from "node:assert/strict";
import test from "node:test";

import { getSearchPageCopy } from "@/i18n/search-page-copy";
import { resolveKisMetricPresentation, resolveKisSourceLabel, type RealtimeTrendingSource } from "@/lib/search-trending-metadata";

const copyKo = getSearchPageCopy("ko");
const copyEn = getSearchPageCopy("en");

function source(input: {
  source: string;
  source_label?: string;
  metricName: string;
  value: number | null;
  unit?: string | null;
}): RealtimeTrendingSource {
  return {
    source: input.source,
    source_label: input.source_label ?? "KIS 리스트",
    rank: 1,
    metric: {
      name: input.metricName,
      value: input.value,
      unit: input.unit ?? "percent",
    },
  };
}

test("maps known KIS volume metric names to the explicit Korean metric label", () => {
  const item = source({ source: "volume-rank", metricName: "volume_rank", value: 10, unit: "percent", source_label: "KIS volume-rank" });
  const result = resolveKisMetricPresentation(item, copyKo);

  assert.equal(result.metricLabel, copyKo.trending.kisMetricLabels.volumeRank);
  assert.equal(result.metricValue, 10);
});

test("maps known KIS source hints to metric labels when metric names are not descriptive", () => {
  const item = source({ source: "hts-top-view", metricName: "unknown", value: 5, source_label: "KIS lists" });
  const result = resolveKisMetricPresentation(item, copyEn);

  assert.equal(result.metricLabel, copyEn.trending.kisMetricLabels.htsTopView);
  assert.equal(result.metricValue, 5);
});

test("shows unavailable metric when source and metric cannot be resolved", () => {
  const item = source({ source: "mystery", metricName: "opaque_value", value: 0, source_label: "Mystery source" });
  const result = resolveKisMetricPresentation(item, copyKo);

  assert.equal(result.metricLabel, copyKo.trending.metricUnavailable);
  assert.equal(result.metricValue, null);
});

test("removes source-count-leading text from source labels", () => {
  const sourceLabel = resolveKisSourceLabel("2 KIS 리스트", "kis", 2);
  const noSourceLabel = resolveKisSourceLabel(undefined, "kis", 1);

  assert.equal(sourceLabel, "KIS");
  assert.equal(noSourceLabel, "KIS");
});
