import type { SearchPageCopy } from "@/i18n/search-page-copy";

export type RealtimeTrendingMetric = {
  period?: string | null;
  name: string;
  value: number | null;
  unit?: string | null;
};

export type RealtimeTrendingSource = {
  source: string;
  source_label: string;
  rank: number | null;
  metric: RealtimeTrendingMetric;
  market?: string | null;
  market_code?: string | null;
};

export type RealtimeTrendingItem = {
  symbol: string;
  name?: string | null;
  market?: string | null;
  market_code?: string | null;
  price?: number | null;
  change?: number | null;
  change_pct?: number | null;
  volume?: number | null;
  turnover?: number | null;
  best_rank?: number | null;
  source_count?: number | null;
  sources?: RealtimeTrendingSource[];
};

export type RealtimeTrendingResponse = {
  status: string;
  source: string;
  as_of?: string | null;
  market?: string | null;
  items: RealtimeTrendingItem[];
  summary?: {
    item_count?: number | null;
  };
};

export function resolveKisSourceLabel(
  primarySourceLabel: string | null | undefined,
  responseSource: string,
  sourceCount: number,
): string {
  const cleaned = primarySourceLabel?.trim().replace(/^\d+\s+/, "") || "";

  if (sourceCount > 1) {
    return responseSource.toUpperCase();
  }

  return cleaned || responseSource.toUpperCase();
}

export type StoredTrendingMode = "1d" | "5d" | "20d";

export function resolveStoredTrendingLabels(mode: StoredTrendingMode, copy: SearchPageCopy) {
  return {
    metricLabel: `${mode.toUpperCase()} ${copy.trending.storedRankSuffix}`,
    sourceLabel: copy.trending.storedPrefix,
  };
}

export type ResolvedKisMetric = {
  metricLabel: string;
  metricValue: number | null;
  metricName: string;
  metricUnit: string | null;
};

const METRIC_TOKEN_MAP: Array<{
  matchers: string[];
  label: (copy: SearchPageCopy) => string;
}> = [
  {
    matchers: ["volume-rank", "volume_rank", "volume-rank-score", "volume", "volume-rankings", "거래량"],
    label: (copy) => copy.trending.kisMetricLabels.volumeRank,
  },
  {
    matchers: ["fluctuation", "change", "pct", "return", "return-pct", "return_pct", "percent", "등락률"],
    label: (copy) => copy.trending.kisMetricLabels.fluctuation,
  },
  {
    matchers: ["hts-top-view", "hts_top_view", "top-view", "top_view", "view", "views", "조회"],
    label: (copy) => copy.trending.kisMetricLabels.htsTopView,
  },
  {
    matchers: ["score", "점수"],
    label: (copy) => copy.trending.kisMetricLabels.score,
  },
  {
    matchers: ["rank", "순위", "랭크"],
    label: (copy) => copy.trending.kisMetricLabels.rank,
  },
];

function normalizeMetric(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .trim();
}

function findKnownMetricLabel(source: RealtimeTrendingSource, copy: SearchPageCopy): string | null {
  const candidates = [source.metric?.name, source.source, source.source_label];

  for (const candidate of candidates) {
    const normalized = normalizeMetric(candidate);

    for (const entry of METRIC_TOKEN_MAP) {
      if (entry.matchers.some((token) => normalized.includes(token))) {
        return entry.label(copy);
      }
    }
  }

  return null;
}

export function resolveKisMetricPresentation(
  source: RealtimeTrendingSource | null | undefined,
  copy: SearchPageCopy,
): ResolvedKisMetric {
  if (!source) {
    return {
      metricLabel: copy.trending.metricUnavailable,
      metricValue: null,
      metricName: "",
      metricUnit: null,
    };
  }

  const knownMetricLabel = findKnownMetricLabel(source, copy);

  if (!knownMetricLabel) {
    return {
      metricLabel: copy.trending.metricUnavailable,
      metricValue: null,
      metricName: "",
      metricUnit: null,
    };
  }

  return {
    metricLabel: knownMetricLabel,
    metricValue: source.metric.value,
    metricName: source.metric?.name ?? "change_pct",
    metricUnit: source.metric?.unit ?? "percent",
  };
}
