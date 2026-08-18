import { getLatestPriceTradeDate } from "@/lib/eod-freshness-latest";
import {
  buildFactorQualitySummary,
  formatQualityCount,
  formatQualityRank,
  formatQualityScore,
  type FactorQualitySummary,
} from "@/lib/factor-quality";
import {
  FACTOR_FAMILY_META,
  FACTOR_FAMILY_ORDER,
  extractFactorInspectItems,
  getAdvancedValueFactorStatusDescriptor,
  getBetaFactorStatusDescriptor,
  getFactorStatusLabel,
  getLowRiskFactorStatusDescriptor,
  getMomentumFactorStatusDescriptor,
  getUnifiedValueStatusDescriptor,
  getValueFactorStatusDescriptor,
  hasUnifiedValueFields,
  resolveUnifiedValueStatusCode,
  type FactorFamilyId,
  type FactorStatusDescriptor,
} from "@/lib/factor-snapshot";
import { getTradingApiJsonResult } from "@/lib/trading-api-cache";
import { resolveTradingApiClientPath } from "@/lib/trading-api-client-path";
import type {
  EodAdvancedValueFactorItemDto,
  EodAdvancedValueFactorsResponseDto,
  EodBetaFactorItemDto,
  EodBetaFactorsResponseDto,
  EodFreshnessResponseDto,
  EodLowRiskFactorItemDto,
  EodLowRiskFactorsResponseDto,
  EodMomentumFactorItemDto,
  EodMomentumFactorsResponseDto,
  EodValueFactorItemDto,
  EodValueFactorsResponseDto,
  Locale,
} from "@/types/trading-api";

export const FACTOR_SCREENING_FAMILY_ORDER = [...FACTOR_FAMILY_ORDER, "composite"] as const;
export const FACTOR_SCREENING_API_REQUEST_TIMEOUT_MS = 15_000;

export type FactorScreeningFamilyId = (typeof FACTOR_SCREENING_FAMILY_ORDER)[number];
export type FactorScreeningStatusBucket = "eligible" | "caution" | "audit";
export type FactorScreeningDatasetState = "ready" | "error" | "future";
export type FactorScreeningRouteStatus = "pending" | "unavailable" | "partial" | "ready";
export type FactorScreeningTone = "positive" | "negative" | "neutral";

export type FactorScreeningMetric = {
  label: string;
  value: string;
  tone?: FactorScreeningTone;
};

export type FactorScreeningQuality = {
  title: string;
  statusLabel: string;
  tone: FactorQualitySummary["tone"];
  calculationLabel: string;
  summary: string;
  metrics: FactorScreeningMetric[];
  componentHints: string[];
};

export type FactorScreeningRow = {
  family: FactorFamilyId;
  symbol: string;
  companyName: string | null;
  market: string | null;
  marketDate: string;
  href: string;
  status: FactorStatusDescriptor;
  statusBucket: FactorScreeningStatusBucket;
  statusLabel: string;
  isEligible: boolean;
  displayRank: number;
  displayRankLabel: string;
  metrics: FactorScreeningMetric[];
  quality: FactorScreeningQuality | null;
  note: string;
  searchText: string;
  sortRank: number | null;
  sortScore: number | null;
};

export type FactorScreeningDataset = {
  family: FactorScreeningFamilyId;
  title: string;
  shortLabel: string;
  subtitle: string;
  api: string;
  requestedMarketDate: string;
  marketDate: string | null;
  featureVersion: string | null;
  sortBasis: string;
  state: FactorScreeningDatasetState;
  stateLabel: string;
  stateTone: "info" | "warning" | "neutral";
  totalRows: number;
  totalEntries: number | null;
  eligibleCount: number;
  cautionCount: number;
  auditCount: number;
  rows: FactorScreeningRow[];
  note: string;
  error: string | null;
};

export type FactorScreeningWorkspace = {
  requestedMarketDate: string;
  families: Record<FactorScreeningFamilyId, FactorScreeningDataset>;
};

type FactorScreeningRouteWorkspace = {
  families: Record<
    FactorScreeningFamilyId,
    Pick<FactorScreeningDataset, "marketDate" | "state" | "totalRows">
  >;
};

export type FactorScreeningAvailability = {
  currentFamilyCount: number;
  totalFamilyCount: number;
  unavailableFamilies: FactorFamilyId[];
  usableFamilyCount: number;
};

export const FACTOR_SCREENING_FILTER_MODES = ["review", "all", "eligible", "caution", "audit"] as const;

export type FactorScreeningFilterMode = (typeof FACTOR_SCREENING_FILTER_MODES)[number];

export type FactorScreeningFilterOptions = {
  query: string;
  mode: FactorScreeningFilterMode;
};

const COMPOSITE_FAMILY_META = {
  api: "Pending composite factor endpoint",
  shortLabel: "Composite",
  sortBasis: "Composite ranking",
  subtitle: "Reserved slot for the later composite ranking surface",
  title: "Composite",
};

const FACTOR_SCREENING_FAMILY_META: Record<
  FactorScreeningFamilyId,
  {
    api: string;
    shortLabel: string;
    sortBasis: string;
    subtitle: string;
    title: string;
  }
> = {
  momentum: {
    ...FACTOR_FAMILY_META.momentum,
    shortLabel: "Momentum",
    sortBasis: "Momentum rank",
  },
  lowRisk: {
    ...FACTOR_FAMILY_META.lowRisk,
    shortLabel: "Low risk",
    sortBasis: "Low-risk score",
  },
  beta: {
    ...FACTOR_FAMILY_META.beta,
    shortLabel: "Beta",
    sortBasis: "Low-beta score",
  },
  value: {
    ...FACTOR_FAMILY_META.value,
    shortLabel: "Unified value",
    sortBasis: "Unified value rank",
    subtitle: "Unified valuation score with legacy PER, PBR, yield, and advanced component context",
    title: "Unified value",
  },
  advancedValue: {
    ...FACTOR_FAMILY_META.advancedValue,
    shortLabel: "Advanced components",
    sortBasis: "Advanced component rank",
    subtitle: "Component view for FCF yield and EV / EBITDA from stored DART fundamentals",
    title: "Advanced value components",
  },
  composite: COMPOSITE_FAMILY_META,
};

const FACTOR_SCREENING_TIMEOUT_NOTE = "Factor family data request timed out.";
const FACTOR_SCREENING_UNAVAILABLE_NOTE = "Factor family data is currently unavailable.";

const KOREAN_FACTOR_SCREENING_DISPLAY = {
  error: {
    timeout: "팩터 패밀리 데이터 요청 시간이 초과되었습니다.",
    unavailable: "현재 팩터 패밀리 데이터를 사용할 수 없습니다.",
  },
  families: {
    momentum: {
      note: "선택한 시장일자의 12-1 모멘텀 순위와 추세 게이트 상태입니다.",
      rowNotes: {
        default: "모멘텀 데이터는 있지만 하나 이상의 추세 조건이 적격 기준에 미달했습니다.",
        eligible: "추세 확인을 통과했고 최근 단기 과열 방지 조건도 충족했습니다.",
        insufficient_history: "안정적인 12-1 모멘텀 순위를 계산하기에는 저장된 가격 이력이 부족합니다.",
        overheated: "모멘텀은 확인됐지만 최근 움직임이 단기 과열 방지 조건에 걸렸습니다.",
      },
      sortBasis: "Momentum 순위",
      subtitle: "12-1 모멘텀, 이동평균선 추세 확인 및 단기 과열 방지",
    },
    lowRisk: {
      note: "선택한 시장일자의 변동성, 낙폭, 유동성 및 이력 조건입니다.",
      rowNotes: {
        default: "저위험 데이터는 있지만 적격 구간에는 들지 못했습니다.",
        eligible: "변동성, 낙폭 및 유동성이 모두 저위험 적격 구간에 들었습니다.",
        insufficient_history: "이 종목을 신뢰성 있게 분류하기에는 저장된 이력이 부족합니다.",
        liquidity_excluded: "리스크 데이터는 있지만 유동성 하한 조건으로 적격 대상에서 제외됐습니다.",
        watchlist: "점수는 유효하지만 저위험 적격 기준에는 미치지 못해 관찰 대상으로 분류됐습니다.",
      },
      sortBasis: "저위험 점수",
      subtitle: "실현 변동성, 낙폭 및 유동성 하한",
    },
    beta: {
      note: "선택한 시장일자의 벤치마크 대비 Beta 순위입니다.",
      rowNotes: {
        default: "Beta가 산출됐지만 저베타 적격 구간에는 들지 못했습니다.",
        eligible: "벤치마크 대비 Beta가 저베타 적격 구간에 들었습니다.",
        insufficient_history: "안정적인 Beta 추정치를 계산하기에는 저장된 이력이 부족합니다.",
        missing_market_date_bar: "시장일자 가격 바가 없어 Beta 순위가 완전하지 않습니다.",
        watchlist: "Beta가 목표 구간에 가깝지만 아직 관찰 대상으로 분류됐습니다.",
      },
      sortBasis: "저베타 점수",
      subtitle: "벤치마크 대비 Beta 및 저베타 분류",
    },
    value: {
      note: "선택한 시장일자의 통합 밸류 순위와 레거시 컴포넌트 맥락입니다.",
      rowNotes: {
        default: "저장된 밸류 데이터의 상태를 검토해야 합니다.",
        insufficient_components: "완전한 통합 밸류 점수를 계산하기에는 사용 가능한 컴포넌트가 부족합니다.",
        insufficient_fundamentals: "모든 컴포넌트를 계산하려면 사용 가능한 저장 펀더멘털 스냅샷이 필요합니다.",
        invalid_per: "이익이 양수가 아니어서 PER 점수 계산에서 제외됐습니다.",
        missing_market_date_bar: "시장일자 가격 바가 없어 밸류 점수가 완전하지 않습니다.",
        missing_metric: "하나 이상의 필수 지표가 없어 통합 밸류 점수가 완전하지 않습니다.",
        scored: "지원되는 밸류 컴포넌트로 통합 밸류 점수가 계산됐습니다.",
      },
      sortBasis: "통합 밸류 순위",
      subtitle: "PER, PBR, 배당수익률, FCF 수익률 및 EV / EBITDA 맥락을 포함한 통합 밸류 점수",
    },
    advancedValue: {
      note: "선택한 시장일자의 고급 밸류 컴포넌트 순위입니다.",
      rowNotes: {
        default: "저장된 입력으로 고급 밸류 컴포넌트 일부만 계산할 수 있었습니다.",
        eligible: "FCF 수익률과 EV / EBITDA가 모두 고급 밸류 적격 점수를 뒷받침했습니다.",
        insufficient_fundamentals: "저장된 DART 펀더멘털이 고급 밸류 점수를 모두 계산하기에 부족합니다.",
        missing_market_date_bar: "시장일자 가격 바가 없어 고급 밸류 점수가 완전하지 않습니다.",
        watchlist: "두 고급 밸류 컴포넌트가 계산됐지만 관찰 대상으로 분류됐습니다.",
      },
      sortBasis: "고급 컴포넌트 순위",
      subtitle: "저장된 DART 펀더멘털의 FCF 수익률 및 EV / EBITDA 컴포넌트",
    },
    composite: {
      note: "향후 종합 팩터 API를 현재 순위 화면에 연결하기 위한 예약 영역입니다.",
      sortBasis: "종합 순위",
      subtitle: "향후 종합 팩터 순위를 위한 예약 영역",
    },
  },
  stateLabels: {
    error: "사용 불가",
    future: "향후 슬롯",
    ready: "준비 완료",
  },
  statusLabels: {
    eligible: "적격",
    ineligible: "부적격",
    insufficient_components: "컴포넌트 부족",
    insufficient_fundamentals: "펀더멘털 부족",
    insufficient_history: "이력 부족",
    invalid_per: "PER 제외",
    liquidity_excluded: "유동성 기준 제외",
    missing_market_date_bar: "시장일자 가격 바 누락",
    missing_metric: "지표 누락",
    missing_row: "행 없음",
    overheated: "단기 과열",
    scored: "점수 산출",
    trend_filtered: "추세 필터 제외",
    unavailable: "사용 불가",
    watchlist: "관찰",
  },
} as const;

function hasNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeSymbol(value: string) {
  return value.trim().toUpperCase();
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function formatPercentScore(value: number | null | undefined, fallback = "Unavailable") {
  if (!hasNumber(value)) return fallback;
  return `${(value * 100).toFixed(1)}%`;
}

function formatSignedPercent(value: number | null | undefined, fallback = "Unavailable") {
  if (!hasNumber(value)) return fallback;
  const percentValue = value * 100;
  return `${percentValue > 0 ? "+" : ""}${percentValue.toFixed(1)}%`;
}

function formatRatio(value: number | null | undefined, fallback = "Unavailable") {
  if (!hasNumber(value)) return fallback;
  return value.toFixed(2);
}

function formatRank(value: number | null | undefined, fallback = "Unranked") {
  return hasNumber(value) ? `#${value.toLocaleString("en-US")}` : fallback;
}

function formatInteger(
  value: number | null | undefined,
  numberLocale: string,
  fallback = "Unavailable",
) {
  if (!hasNumber(value)) return fallback;
  return value.toLocaleString(numberLocale);
}

function metricToneFromValue(value: number | null | undefined): FactorScreeningTone | undefined {
  if (!hasNumber(value) || value === 0) return undefined;
  return value > 0 ? "positive" : "negative";
}

function buildMetric(label: string, value: string, tone?: FactorScreeningTone): FactorScreeningMetric {
  return { label, value, tone };
}

function buildQualityProgressLabel(quality: FactorQualitySummary) {
  if (quality.componentsPossible === null && quality.componentsUsed === null) {
    return "Component coverage unavailable";
  }

  return `${formatQualityCount(quality.componentsUsed)} used / ${formatQualityCount(quality.componentsPossible)} possible`;
}

function buildQualitySummaryText(quality: FactorQualitySummary) {
  switch (quality.calculationState) {
    case "complete":
      return `Quality calculation complete: ${buildQualityProgressLabel(quality)}.`;
    case "partial":
      return `Quality calculation partial: ${buildQualityProgressLabel(quality)}.`;
    case "unavailable":
      return `Quality calculation unavailable: ${buildQualityProgressLabel(quality)}.`;
  }
}

function buildScreeningQuality(
  item: EodValueFactorItemDto | EodAdvancedValueFactorItemDto,
  options: { force?: boolean } = {},
): FactorScreeningQuality | null {
  const quality = buildFactorQualitySummary(item, options);
  if (!quality) return null;

  return {
    calculationLabel: quality.calculationLabel,
    componentHints: quality.componentStatuses.map(
      (component) => `${component.label}: ${component.statusLabel}`,
    ),
    metrics: [
      buildMetric("Quality score", formatQualityScore(quality.score)),
      buildMetric("Quality percentile", formatQualityScore(quality.percentile)),
      buildMetric("Quality rank", formatQualityRank(quality.rank)),
      buildMetric("Score status", quality.statusLabel),
      buildMetric("Possible components", formatQualityCount(quality.componentsPossible)),
      buildMetric("Used components", formatQualityCount(quality.componentsUsed)),
      buildMetric("Calculation", quality.calculationLabel),
    ],
    statusLabel: quality.statusLabel,
    summary: buildQualitySummaryText(quality),
    title: "Quality score",
    tone: quality.tone,
  };
}

function getRecord(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isSymbolLikeName(symbol: string, value: string) {
  const normalizedSymbol = normalizeSymbol(symbol);
  const normalizedValue = value.trim().replace(/\s+/g, " ").toUpperCase();
  const escapedSymbol = escapeRegExp(normalizedSymbol);
  return (
    normalizedValue === normalizedSymbol ||
    new RegExp(`^${escapedSymbol}\\s*\\(${escapedSymbol}\\)$`, "i").test(normalizedValue)
  );
}

function getUsableCompanyName(symbol: string, ...values: Array<string | null | undefined>) {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed && !isSymbolLikeName(symbol, trimmed)) {
      return trimmed;
    }
  }

  return null;
}

function getNestedRecord(source: Record<string, unknown> | null, key: string) {
  return getRecord(source?.[key]);
}

function resolveFactorScreeningCompanyName(item: { symbol: string; factor_payload?: Record<string, unknown> | null }) {
  const itemRecord = getRecord(item);
  const payload = getRecord(item.factor_payload);
  const payloadCompany = getNestedRecord(payload, "company");
  const payloadMetadata = getNestedRecord(payload, "metadata") ?? getNestedRecord(payload, "symbol_metadata");

  return getUsableCompanyName(
    item.symbol,
    getString(itemRecord?.company_name),
    getString(itemRecord?.name_ko),
    getString(itemRecord?.display_name),
    getString(itemRecord?.name),
    getString(itemRecord?.name_en),
    getString(itemRecord?.corp_name),
    getString(payload?.company_name),
    getString(payload?.name_ko),
    getString(payload?.display_name),
    getString(payload?.name),
    getString(payload?.name_en),
    getString(payload?.corp_name),
    getString(payloadCompany?.company_name),
    getString(payloadCompany?.name_ko),
    getString(payloadCompany?.display_name),
    getString(payloadCompany?.name),
    getString(payloadCompany?.corp_name),
    getString(payloadMetadata?.company_name),
    getString(payloadMetadata?.name_ko),
    getString(payloadMetadata?.display_name),
    getString(payloadMetadata?.name),
    getString(payloadMetadata?.corp_name),
  );
}

function readPayloadStatus(payload: Record<string, unknown> | null, key: string) {
  const statusSources = [
    getRecord(payload?.unified_value_component_statuses),
    getRecord(payload?.unified_component_statuses),
    getRecord(payload?.component_statuses),
    getRecord(payload?.metric_statuses),
    payload,
  ];

  for (const source of statusSources) {
    const status = getString(source?.[key]);
    if (status) return status;
  }

  return null;
}

function humanizeStatusToken(value: string | null | undefined, fallback = "Unavailable") {
  if (!value) return fallback;

  const normalized = value.trim();
  const knownLabels: Record<string, string> = {
    available: "Available",
    insufficient_components: "Insufficient components",
    insufficient_fundamentals: "Insufficient fundamentals",
    invalid_non_positive: "Earnings non-positive",
    invalid_per: "PER excluded",
    missing_depreciation_and_amortization: "Missing D&A",
    missing_ebitda: "Missing EBITDA",
    missing_enterprise_value: "Missing enterprise value",
    missing_free_cash_flow: "Missing FCF",
    missing_market_date_bar: "Missing market-date bar",
    missing_metric: "Missing metric",
    non_positive: "Non-positive",
    scored: "Scored",
  };

  return (
    knownLabels[normalized] ??
    normalized
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function readValueComponentStatuses(item: EodValueFactorItemDto | EodAdvancedValueFactorItemDto) {
  const payload = getRecord(item.factor_payload);

  return {
    dividendYield:
      ("dividend_yield_status" in item ? item.dividend_yield_status : null) ??
      readPayloadStatus(payload, "dividend_yield"),
    evToEbitda:
      ("ev_to_ebitda_status" in item ? item.ev_to_ebitda_status : null) ??
      readPayloadStatus(payload, "ev_to_ebitda"),
    fcfYield:
      ("fcf_yield_status" in item ? item.fcf_yield_status : null) ??
      readPayloadStatus(payload, "fcf_yield"),
    pbr: ("pbr_status" in item ? item.pbr_status : null) ?? readPayloadStatus(payload, "pbr"),
    per: ("per_status" in item ? item.per_status : null) ?? readPayloadStatus(payload, "per"),
  };
}

function formatValueComponentHints(item: EodValueFactorItemDto | EodAdvancedValueFactorItemDto) {
  const statuses = readValueComponentStatuses(item);
  const hints = [
    ["PER", statuses.per],
    ["PBR", statuses.pbr],
    ["Dividend yield", statuses.dividendYield],
    ["FCF yield", statuses.fcfYield],
    ["EV / EBITDA", statuses.evToEbitda],
  ] as const;

  return hints
    .map(([label, status]) => (status ? `${label}: ${humanizeStatusToken(status)}` : null))
    .filter((hint): hint is string => Boolean(hint));
}

function buildSymbolHref(options: {
  companyName: string | null;
  market: string | null;
  marketDate: string;
  symbol: string;
}) {
  const params = new URLSearchParams();

  if (options.companyName) {
    params.set("name", options.companyName);
  }

  if (options.market) {
    params.set("market", options.market);
  }

  params.set("marketDate", options.marketDate);

  const query = params.toString();
  return `/dashboard/symbol/${encodeURIComponent(options.symbol)}${query ? `?${query}` : ""}`;
}

function getStatusBucket(status: FactorStatusDescriptor): FactorScreeningStatusBucket {
  switch (status.code) {
    case "eligible":
    case "scored":
      return "eligible";
    case "watchlist":
    case "ineligible":
    case "liquidity_excluded":
    case "overheated":
    case "trend_filtered":
      return "caution";
    case "missing_metric":
    case "invalid_per":
    case "missing_row":
    case "missing_market_date_bar":
    case "insufficient_components":
    case "insufficient_fundamentals":
    case "insufficient_history":
    case "unavailable":
    default:
      return "audit";
  }
}

function compareRows(left: FactorScreeningRow, right: FactorScreeningRow) {
  if (left.sortRank !== null || right.sortRank !== null) {
    if (left.sortRank === null) return 1;
    if (right.sortRank === null) return -1;
    if (left.sortRank !== right.sortRank) {
      return left.sortRank - right.sortRank;
    }
  }

  if (left.sortScore !== null || right.sortScore !== null) {
    if (left.sortScore === null) return 1;
    if (right.sortScore === null) return -1;
    if (left.sortScore !== right.sortScore) {
      return right.sortScore - left.sortScore;
    }
  }

  return left.symbol.localeCompare(right.symbol);
}

function assignDisplayRanks(rows: FactorScreeningRow[]) {
  return [...rows].sort(compareRows).map((row, index) => {
    const displayRank = row.sortRank ?? index + 1;
    return {
      ...row,
      displayRank,
      displayRankLabel: `#${displayRank.toLocaleString("en-US")}`,
    };
  });
}

function countRowsByBucket(rows: FactorScreeningRow[]) {
  return rows.reduce(
    (acc, row) => {
      if (row.statusBucket === "eligible") acc.eligibleCount += 1;
      if (row.statusBucket === "caution") acc.cautionCount += 1;
      if (row.statusBucket === "audit") acc.auditCount += 1;
      return acc;
    },
    {
      auditCount: 0,
      cautionCount: 0,
      eligibleCount: 0,
    },
  );
}

function buildMomentumNote(status: FactorStatusDescriptor) {
  switch (status.code) {
    case "eligible":
      return "Trend confirmation passed and the recent overheat guard stayed clear.";
    case "overheated":
      return "Momentum was present, but the recent move tripped the overheat guard.";
    case "insufficient_history":
      return "Stored bar history is too short for a stable 12-1 momentum rank.";
    default:
      return "Momentum data is present, but one or more trend gates stayed below the eligible bar.";
  }
}

function buildLowRiskNote(status: FactorStatusDescriptor) {
  switch (status.code) {
    case "eligible":
      return "Volatility, drawdown, and liquidity all landed inside the eligible low-risk bucket.";
    case "watchlist":
      return "The row scored cleanly but stopped short of the eligible low-risk cutoff.";
    case "liquidity_excluded":
      return "The risk row exists, but the liquidity floor blocked eligibility.";
    case "insufficient_history":
      return "Stored history is too short to classify this row confidently.";
    default:
      return "The low-risk row is present, but it did not finish in the eligible bucket.";
  }
}

function buildBetaNote(status: FactorStatusDescriptor) {
  switch (status.code) {
    case "eligible":
      return "Benchmark-relative beta landed inside the low-beta eligible band.";
    case "watchlist":
      return "Beta is close to the target band but still marked watchlist.";
    case "missing_market_date_bar":
      return "The market-date bar is missing, so the beta rank is incomplete.";
    case "insufficient_history":
      return "Stored history is too short for a stable beta estimate.";
    default:
      return "Beta was measured, but the row did not reach the eligible low-beta band.";
  }
}

function buildValueNote(status: FactorStatusDescriptor) {
  switch (status.code) {
    case "scored":
      return "PER, PBR, and dividend yield all produced a valid value score.";
    case "invalid_per":
      return "The symbol was excluded from PER scoring because earnings were non-positive.";
    case "missing_market_date_bar":
      return "The market-date bar is missing, so the value score is incomplete.";
    default:
      return "One or more valuation inputs were missing from the stored value row.";
  }
}

function buildUnifiedValueNote(status: FactorStatusDescriptor, componentHints: string[]) {
  const componentSuffix =
    componentHints.length > 0 ? ` Components: ${componentHints.join(" · ")}.` : "";

  switch (status.code) {
    case "scored":
      return `Unified valuation score is available across the supported value components.${componentSuffix}`;
    case "invalid_per":
      return `The symbol was excluded from PER scoring because earnings were non-positive.${componentSuffix}`;
    case "missing_metric":
      return `Unified valuation scoring is incomplete because one or more required metrics were missing.${componentSuffix}`;
    case "insufficient_components":
      return `Unified valuation scoring had too few usable components for a complete score.${componentSuffix}`;
    case "insufficient_fundamentals":
      return `Unified valuation scoring needs a usable stored fundamentals snapshot before all components can score.${componentSuffix}`;
    case "missing_market_date_bar":
      return `The market-date bar is missing, so unified valuation scoring is incomplete.${componentSuffix}`;
    default:
      return `Unified valuation status needs review for this stored row.${componentSuffix}`;
  }
}

function buildAdvancedValueUnifiedContextNote(
  item: EodAdvancedValueFactorItemDto,
  componentHints: string[],
) {
  if (!hasUnifiedValueFields(item)) return "";

  const unifiedStatus = getUnifiedValueStatusDescriptor(resolveUnifiedValueStatusCode(item));
  const componentSuffix =
    componentHints.length > 0 ? ` Components: ${componentHints.join(" · ")}.` : "";

  return ` Unified valuation context: ${getFactorStatusLabel(unifiedStatus.code)}.${componentSuffix}`;
}

function buildAdvancedValueNote(status: FactorStatusDescriptor) {
  switch (status.code) {
    case "eligible":
      return "FCF yield and EV / EBITDA both supported an eligible advanced-value score.";
    case "watchlist":
      return "Both advanced-value components scored, but the row remained watchlist.";
    case "insufficient_fundamentals":
      return "Stored DART fundamentals were not sufficient for full advanced-value scoring.";
    case "missing_market_date_bar":
      return "The market-date bar is missing, so advanced-value scoring is incomplete.";
    default:
      return "Only part of the advanced-value stack could be scored from the stored inputs.";
  }
}

function buildMomentumRows(response: EodMomentumFactorsResponseDto): FactorScreeningRow[] {
  return extractFactorInspectItems<EodMomentumFactorItemDto>(response).map((item) => {
    const status = getMomentumFactorStatusDescriptor(item);
    const companyName = resolveFactorScreeningCompanyName(item);

    return {
      companyName,
      displayRank: 0,
      displayRankLabel: "",
      family: "momentum",
      href: buildSymbolHref({
        companyName,
        market: item.market ?? null,
        marketDate: item.market_date,
        symbol: item.symbol,
      }),
      isEligible: item.is_momentum_eligible,
      market: item.market ?? null,
      marketDate: item.market_date,
      metrics: [
        buildMetric("12-1 momentum", formatSignedPercent(item.momentum_12_1), metricToneFromValue(item.momentum_12_1)),
        buildMetric("Percentile", formatPercentScore(item.momentum_percentile)),
        buildMetric("Rank", formatRank(item.momentum_rank)),
        buildMetric("5D return", formatSignedPercent(item.return_5d), metricToneFromValue(item.return_5d)),
      ],
      quality: null,
      note: buildMomentumNote(status),
      searchText: normalizeText(
        [companyName ?? "", item.market ?? "", item.symbol, getFactorStatusLabel(status.code)]
          .filter(Boolean)
          .join(" "),
      ),
      sortRank: item.momentum_rank ?? null,
      sortScore: item.momentum_percentile ?? item.momentum_12_1 ?? null,
      status,
      statusBucket: getStatusBucket(status),
      statusLabel: getFactorStatusLabel(status.code),
      symbol: normalizeSymbol(item.symbol),
    };
  });
}

function buildLowRiskRows(
  response: EodLowRiskFactorsResponseDto,
  numberLocale: string,
): FactorScreeningRow[] {
  return extractFactorInspectItems<EodLowRiskFactorItemDto>(response).map((item) => {
    const status = getLowRiskFactorStatusDescriptor(item);
    const companyName = resolveFactorScreeningCompanyName(item);

    return {
      companyName,
      displayRank: 0,
      displayRankLabel: "",
      family: "lowRisk",
      href: buildSymbolHref({
        companyName,
        market: item.market ?? null,
        marketDate: item.market_date,
        symbol: item.symbol,
      }),
      isEligible: item.is_low_risk_eligible,
      market: item.market ?? null,
      marketDate: item.market_date,
      metrics: [
        buildMetric("Low-risk score", formatPercentScore(item.low_risk_score)),
        buildMetric("Liquidity pct", formatPercentScore(item.liquidity_percentile)),
        buildMetric("Drawdown pct", formatPercentScore(item.max_drawdown_120d_percentile)),
        buildMetric("History days", formatInteger(item.history_days_available, numberLocale)),
      ],
      quality: null,
      note: buildLowRiskNote(status),
      searchText: normalizeText(
        [companyName ?? "", item.market ?? "", item.symbol, getFactorStatusLabel(status.code)]
          .filter(Boolean)
          .join(" "),
      ),
      sortRank: null,
      sortScore: item.low_risk_score ?? item.liquidity_percentile ?? null,
      status,
      statusBucket: getStatusBucket(status),
      statusLabel: getFactorStatusLabel(status.code),
      symbol: normalizeSymbol(item.symbol),
    };
  });
}

function buildBetaRows(response: EodBetaFactorsResponseDto): FactorScreeningRow[] {
  return extractFactorInspectItems<EodBetaFactorItemDto>(response).map((item) => {
    const status = getBetaFactorStatusDescriptor(item);
    const companyName = resolveFactorScreeningCompanyName(item);

    return {
      companyName,
      displayRank: 0,
      displayRankLabel: "",
      family: "beta",
      href: buildSymbolHref({
        companyName,
        market: item.market ?? null,
        marketDate: item.market_date,
        symbol: item.symbol,
      }),
      isEligible: item.is_low_beta_eligible,
      market: item.market ?? null,
      marketDate: item.market_date,
      metrics: [
        buildMetric("Low-beta score", formatPercentScore(item.low_beta_score)),
        buildMetric("Beta 120D", formatRatio(item.beta_120d)),
        buildMetric("Beta pct", formatPercentScore(item.beta_120d_percentile)),
        buildMetric("Benchmark", item.benchmark_id ?? "Unavailable"),
      ],
      quality: null,
      note: buildBetaNote(status),
      searchText: normalizeText(
        [companyName ?? "", item.market ?? "", item.symbol, item.benchmark_id ?? "", getFactorStatusLabel(status.code)]
          .filter(Boolean)
          .join(" "),
      ),
      sortRank: null,
      sortScore: item.low_beta_score ?? item.beta_120d_percentile ?? null,
      status,
      statusBucket: getStatusBucket(status),
      statusLabel: getFactorStatusLabel(status.code),
      symbol: normalizeSymbol(item.symbol),
    };
  });
}

function buildValueRows(response: EodValueFactorsResponseDto): FactorScreeningRow[] {
  return extractFactorInspectItems<EodValueFactorItemDto>(response).map((item) => {
    const usesUnifiedValue = hasUnifiedValueFields(item);
    const status = usesUnifiedValue
      ? getUnifiedValueStatusDescriptor(resolveUnifiedValueStatusCode(item))
      : getValueFactorStatusDescriptor(item);
    const componentHints = formatValueComponentHints(item);
    const quality = buildScreeningQuality(item, { force: true });
    const companyName = resolveFactorScreeningCompanyName(item);

    return {
      companyName,
      displayRank: 0,
      displayRankLabel: "",
      family: "value",
      href: buildSymbolHref({
        companyName,
        market: item.market ?? null,
        marketDate: item.market_date,
        symbol: item.symbol,
      }),
      isEligible: status.code === "scored",
      market: item.market ?? null,
      marketDate: item.market_date,
      metrics: usesUnifiedValue
        ? [
            buildMetric("Unified value score", formatPercentScore(item.unified_value_score)),
            buildMetric("Unified percentile", formatPercentScore(item.unified_value_percentile)),
            buildMetric("Unified rank", formatRank(item.unified_value_rank)),
            buildMetric("Overall status", getFactorStatusLabel(status.code)),
            buildMetric("Legacy value score", formatPercentScore(item.value_score)),
          ]
        : [
            buildMetric("Legacy value score", formatPercentScore(item.value_score)),
            buildMetric("Legacy value pct", formatPercentScore(item.value_percentile)),
            buildMetric("Legacy rank", formatRank(item.value_rank)),
            buildMetric("Dividend yield", formatPercentScore(item.dividend_yield)),
          ],
      quality,
      note: usesUnifiedValue ? buildUnifiedValueNote(status, componentHints) : buildValueNote(status),
      searchText: normalizeText(
        [
          companyName ?? "",
          item.market ?? "",
          item.symbol,
          getFactorStatusLabel(status.code),
          quality?.statusLabel ?? "",
          quality?.calculationLabel ?? "",
          ...componentHints,
          ...(quality?.componentHints ?? []),
        ]
          .filter(Boolean)
          .join(" "),
      ),
      sortRank: usesUnifiedValue ? (item.unified_value_rank ?? null) : (item.value_rank ?? null),
      sortScore: usesUnifiedValue
        ? (item.unified_value_score ?? item.unified_value_percentile ?? null)
        : (item.value_score ?? item.value_percentile ?? null),
      status,
      statusBucket: getStatusBucket(status),
      statusLabel: getFactorStatusLabel(status.code),
      symbol: normalizeSymbol(item.symbol),
    };
  });
}

function buildAdvancedValueRows(response: EodAdvancedValueFactorsResponseDto): FactorScreeningRow[] {
  return extractFactorInspectItems<EodAdvancedValueFactorItemDto>(response).map((item) => {
    const usesUnifiedValue = hasUnifiedValueFields(item);
    const status = getAdvancedValueFactorStatusDescriptor(item);
    const componentHints = formatValueComponentHints(item);
    const quality = usesUnifiedValue ? buildScreeningQuality(item) : null;
    const companyName = resolveFactorScreeningCompanyName(item);
    const advancedMetrics = [
      buildMetric("Advanced component score", formatPercentScore(item.advanced_value_score)),
      buildMetric("Component pct", formatPercentScore(item.advanced_value_percentile)),
      buildMetric("Component rank", formatRank(item.advanced_value_rank)),
      buildMetric("FCF yield", formatPercentScore(item.fcf_yield)),
    ];
    const unifiedMetrics = usesUnifiedValue
      ? [
          buildMetric("Unified value score", formatPercentScore(item.unified_value_score)),
          buildMetric("Unified rank", formatRank(item.unified_value_rank)),
          buildMetric(
            "Unified status",
            getFactorStatusLabel(getUnifiedValueStatusDescriptor(resolveUnifiedValueStatusCode(item)).code),
          ),
        ]
      : [];

    return {
      companyName,
      displayRank: 0,
      displayRankLabel: "",
      family: "advancedValue",
      href: buildSymbolHref({
        companyName,
        market: item.market ?? null,
        marketDate: item.market_date,
        symbol: item.symbol,
      }),
      isEligible: item.is_advanced_value_eligible,
      market: item.market ?? null,
      marketDate: item.market_date,
      metrics: [...advancedMetrics, ...unifiedMetrics],
      quality,
      note: `${buildAdvancedValueNote(status)}${buildAdvancedValueUnifiedContextNote(item, componentHints)}`,
      searchText: normalizeText(
        [
          companyName ?? "",
          item.market ?? "",
          item.symbol,
          getFactorStatusLabel(status.code),
          usesUnifiedValue
            ? getFactorStatusLabel(getUnifiedValueStatusDescriptor(resolveUnifiedValueStatusCode(item)).code)
            : "",
          ...componentHints,
          quality?.statusLabel ?? "",
          quality?.calculationLabel ?? "",
          ...(quality?.componentHints ?? []),
        ]
          .filter(Boolean)
          .join(" "),
      ),
      sortRank: item.advanced_value_rank ?? null,
      sortScore: item.advanced_value_score ?? item.advanced_value_percentile ?? null,
      status,
      statusBucket: getStatusBucket(status),
      statusLabel: getFactorStatusLabel(status.code),
      symbol: normalizeSymbol(item.symbol),
    };
  });
}

function buildReadyDataset(options: {
  family: FactorFamilyId;
  featureVersion: string | null;
  marketDate: string | null;
  note: string;
  requestedMarketDate: string;
  rows: FactorScreeningRow[];
  summaryEntries: number | null;
}) {
  const meta = FACTOR_SCREENING_FAMILY_META[options.family];
  const counts = countRowsByBucket(options.rows);

  return {
    api: meta.api,
    auditCount: counts.auditCount,
    cautionCount: counts.cautionCount,
    eligibleCount: counts.eligibleCount,
    error: null,
    family: options.family,
    featureVersion: options.featureVersion,
    marketDate: options.marketDate,
    note: options.note,
    requestedMarketDate: options.requestedMarketDate,
    rows: options.rows,
    shortLabel: meta.shortLabel,
    sortBasis: meta.sortBasis,
    state: "ready" as const,
    stateLabel: "Ready",
    stateTone: "info" as const,
    subtitle: meta.subtitle,
    title: meta.title,
    totalEntries: options.summaryEntries,
    totalRows: options.rows.length,
  };
}

function buildErrorDataset(
  family: FactorFamilyId,
  requestedMarketDate: string,
  error: string,
): FactorScreeningDataset {
  const meta = FACTOR_SCREENING_FAMILY_META[family];
  const normalizedError = error.trim();
  const lowerCaseError = normalizedError.toLowerCase();
  const isTimeout =
    lowerCaseError.includes("timed out") ||
    lowerCaseError.includes("timeout") ||
    lowerCaseError.includes("504");
  const note = isTimeout
    ? FACTOR_SCREENING_TIMEOUT_NOTE
    : FACTOR_SCREENING_UNAVAILABLE_NOTE;

  return {
    api: meta.api,
    auditCount: 0,
    cautionCount: 0,
    eligibleCount: 0,
    error: note,
    family,
    featureVersion: null,
    marketDate: null,
    note,
    requestedMarketDate,
    rows: [],
    shortLabel: meta.shortLabel,
    sortBasis: meta.sortBasis,
    state: "error",
    stateLabel: "Unavailable",
    stateTone: "warning",
    subtitle: meta.subtitle,
    title: meta.title,
    totalEntries: null,
    totalRows: 0,
  };
}

function buildCompositeDataset(requestedMarketDate: string): FactorScreeningDataset {
  return {
    api: COMPOSITE_FAMILY_META.api,
    auditCount: 0,
    cautionCount: 0,
    eligibleCount: 0,
    error: null,
    family: "composite",
    featureVersion: null,
    marketDate: requestedMarketDate,
    note: "This slot is reserved so the future composite API can become another ranking mode without redesigning the page.",
    requestedMarketDate,
    rows: [],
    shortLabel: COMPOSITE_FAMILY_META.shortLabel,
    sortBasis: COMPOSITE_FAMILY_META.sortBasis,
    state: "future",
    stateLabel: "Future slot",
    stateTone: "neutral",
    subtitle: COMPOSITE_FAMILY_META.subtitle,
    title: COMPOSITE_FAMILY_META.title,
    totalEntries: null,
    totalRows: 0,
  };
}

function localizeFactorScreeningDataset(
  dataset: FactorScreeningDataset,
  locale: Locale,
): FactorScreeningDataset {
  if (locale !== "ko") return dataset;

  const familyCopy = KOREAN_FACTOR_SCREENING_DISPLAY.families[dataset.family];
  const localizedError = dataset.error
    ? dataset.note === FACTOR_SCREENING_TIMEOUT_NOTE
      ? KOREAN_FACTOR_SCREENING_DISPLAY.error.timeout
      : KOREAN_FACTOR_SCREENING_DISPLAY.error.unavailable
    : null;
  const localizedNote = localizedError ?? familyCopy.note;

  return {
    ...dataset,
    error: localizedError,
    note: localizedNote,
    rows: dataset.rows.map((row) => {
      const rowNotes = KOREAN_FACTOR_SCREENING_DISPLAY.families[row.family].rowNotes;
      const localizedRowNote =
        rowNotes[row.status.code as keyof typeof rowNotes] ?? rowNotes.default;

      return {
        ...row,
        note: localizedRowNote,
        statusLabel:
          KOREAN_FACTOR_SCREENING_DISPLAY.statusLabels[
            row.status.code as keyof typeof KOREAN_FACTOR_SCREENING_DISPLAY.statusLabels
          ] ?? "확인 필요",
      };
    }),
    sortBasis: familyCopy.sortBasis,
    stateLabel: KOREAN_FACTOR_SCREENING_DISPLAY.stateLabels[dataset.state],
    subtitle: familyCopy.subtitle,
  };
}

async function loadAvailableFamilyDataset(
  family: FactorFamilyId,
  options: {
    marketDate: string;
    numberLocale: string;
  },
): Promise<FactorScreeningDataset> {
    const path = buildFactorScreeningPath(family, options.marketDate);

  try {
    switch (family) {
      case "momentum": {
        const result = await getTradingApiJsonResult<EodMomentumFactorsResponseDto>(
          resolveTradingApiClientPath(path),
          undefined,
          { timeoutMs: FACTOR_SCREENING_API_REQUEST_TIMEOUT_MS },
        );
        if (!result.ok) {
          return buildErrorDataset(
            family,
            options.marketDate,
            result.message ? `Request failed: ${result.message}` : `HTTP ${result.status}`,
          );
        }

        const rows = assignDisplayRanks(buildMomentumRows(result.data));
        return buildReadyDataset({
          family,
          featureVersion: result.data.feature_version ?? null,
          marketDate: result.data.market_date ?? options.marketDate,
          note: "12-1 momentum rankings plus trend-gate status for the selected market date.",
          requestedMarketDate: options.marketDate,
          rows,
          summaryEntries: result.data.summary?.entries ?? rows.length,
        });
      }
      case "lowRisk": {
        const result = await getTradingApiJsonResult<EodLowRiskFactorsResponseDto>(
          resolveTradingApiClientPath(path),
          undefined,
          { timeoutMs: FACTOR_SCREENING_API_REQUEST_TIMEOUT_MS },
        );
        if (!result.ok) {
          return buildErrorDataset(
            family,
            options.marketDate,
            result.message ? `Request failed: ${result.message}` : `HTTP ${result.status}`,
          );
        }

        const rows = assignDisplayRanks(buildLowRiskRows(result.data, options.numberLocale));
        return buildReadyDataset({
          family,
          featureVersion: result.data.feature_version ?? null,
          marketDate: result.data.market_date ?? options.marketDate,
          note: "Volatility, drawdown, liquidity, and history checks for the selected market date.",
          requestedMarketDate: options.marketDate,
          rows,
          summaryEntries: result.data.summary?.entries ?? rows.length,
        });
      }
      case "beta": {
        const result = await getTradingApiJsonResult<EodBetaFactorsResponseDto>(
          resolveTradingApiClientPath(path),
          undefined,
          { timeoutMs: FACTOR_SCREENING_API_REQUEST_TIMEOUT_MS },
        );
        if (!result.ok) {
          return buildErrorDataset(
            family,
            options.marketDate,
            result.message ? `Request failed: ${result.message}` : `HTTP ${result.status}`,
          );
        }

        const rows = assignDisplayRanks(buildBetaRows(result.data));
        return buildReadyDataset({
          family,
          featureVersion: result.data.feature_version ?? null,
          marketDate: result.data.market_date ?? options.marketDate,
          note: "Benchmark-relative beta inspection with eligibility and watchlist context.",
          requestedMarketDate: options.marketDate,
          rows,
          summaryEntries: result.data.summary?.entries ?? rows.length,
        });
      }
      case "value": {
        const result = await getTradingApiJsonResult<EodValueFactorsResponseDto>(
          resolveTradingApiClientPath(path),
          undefined,
          { timeoutMs: FACTOR_SCREENING_API_REQUEST_TIMEOUT_MS },
        );
        if (!result.ok) {
          return buildErrorDataset(
            family,
            options.marketDate,
            result.message ? `Request failed: ${result.message}` : `HTTP ${result.status}`,
          );
        }

        const rows = assignDisplayRanks(buildValueRows(result.data));
        return buildReadyDataset({
          family,
          featureVersion: result.data.feature_version ?? null,
          marketDate: result.data.market_date ?? options.marketDate,
          note: "Unified valuation rows, falling back to the legacy PER, PBR, and dividend-yield component view when unified fields are absent.",
          requestedMarketDate: options.marketDate,
          rows,
          summaryEntries: result.data.summary?.entries ?? rows.length,
        });
      }
      case "advancedValue": {
        const result = await getTradingApiJsonResult<EodAdvancedValueFactorsResponseDto>(
          resolveTradingApiClientPath(path),
          undefined,
          { timeoutMs: FACTOR_SCREENING_API_REQUEST_TIMEOUT_MS },
        );
        if (!result.ok) {
          return buildErrorDataset(
            family,
            options.marketDate,
            result.message ? `Request failed: ${result.message}` : `HTTP ${result.status}`,
          );
        }

        const rows = assignDisplayRanks(buildAdvancedValueRows(result.data));
        return buildReadyDataset({
          family,
          featureVersion: result.data.feature_version ?? null,
          marketDate: result.data.market_date ?? options.marketDate,
          note: "Stored advanced valuation component rows for FCF yield and EV / EBITDA.",
          requestedMarketDate: options.marketDate,
          rows,
          summaryEntries: result.data.summary?.entries ?? rows.length,
        });
      }
    }
  } catch (error) {
    return buildErrorDataset(
      family,
      options.marketDate,
      error instanceof Error ? error.message : "Unknown factor screening error",
    );
  }
}

export function resolveFactorScreeningFamily(value: string | null | undefined): FactorScreeningFamilyId | null {
  if (!value) return null;
  return FACTOR_SCREENING_FAMILY_ORDER.includes(value as FactorScreeningFamilyId)
    ? (value as FactorScreeningFamilyId)
    : null;
}

export function buildFactorScreeningPath(family: FactorFamilyId, marketDate: string) {
  const params = new URLSearchParams();
  params.set("market_date", marketDate);
  return `${FACTOR_FAMILY_META[family].api}?${params.toString()}`;
}

export function resolveFactorScreeningMarketDate(freshness: EodFreshnessResponseDto | null) {
  return getLatestPriceTradeDate(freshness) ?? freshness?.today?.trade_date ?? null;
}

export function resolveFactorScreeningAvailability(
  activeMarketDate: string | null,
  workspace: FactorScreeningRouteWorkspace | null,
): FactorScreeningAvailability {
  const datasets = FACTOR_FAMILY_ORDER.map((family) => ({
    dataset: workspace?.families[family],
    family,
  }));
  const usableDatasets = datasets.filter(
    ({ dataset }) =>
      dataset?.state === "ready" &&
      Boolean(dataset.marketDate?.trim()) &&
      dataset.totalRows > 0,
  );

  return {
    currentFamilyCount: activeMarketDate
      ? usableDatasets.filter(({ dataset }) => dataset?.marketDate === activeMarketDate).length
      : 0,
    totalFamilyCount: FACTOR_FAMILY_ORDER.length,
    unavailableFamilies: datasets
      .filter(({ dataset }) => dataset?.state === "error")
      .map(({ family }) => family),
    usableFamilyCount: usableDatasets.length,
  };
}

export function resolveFactorScreeningRouteStatus(options: {
  activeMarketDate: string | null;
  hasError: boolean;
  isBusy: boolean;
  selectedFamily: FactorScreeningFamilyId;
  workspace: FactorScreeningRouteWorkspace | null;
}): FactorScreeningRouteStatus {
  if (options.hasError) return "unavailable";
  if (options.isBusy || !options.activeMarketDate || !options.workspace) return "pending";

  const availability = resolveFactorScreeningAvailability(options.activeMarketDate, options.workspace);

  if (availability.usableFamilyCount === 0) return "unavailable";

  const hasCompleteCurrentBasis =
    options.selectedFamily !== "composite" &&
    availability.currentFamilyCount === availability.totalFamilyCount;

  return hasCompleteCurrentBasis ? "ready" : "partial";
}

export function getFactorScreeningMarketDateNote(
  requestedMarketDate: string | null | undefined,
  resolvedMarketDate: string | null | undefined,
  locale: Locale = "en",
) {
  const requestedDate = requestedMarketDate?.trim() || null;
  const effectiveDate = resolvedMarketDate?.trim() || null;

  if (!requestedDate || !effectiveDate || requestedDate === effectiveDate) {
    return null;
  }

  return locale === "ko"
    ? `${requestedDate}을 요청했으며 ${effectiveDate}의 저장된 행을 표시합니다.`
    : `Requested ${requestedDate}. Showing stored rows for ${effectiveDate}.`;
}

export function doesFactorScreeningRowMatchFilterMode(
  row: FactorScreeningRow,
  mode: FactorScreeningFilterMode,
) {
  switch (mode) {
    case "all":
      return true;
    case "eligible":
      return row.statusBucket === "eligible";
    case "caution":
      return row.statusBucket === "caution";
    case "audit":
      return row.statusBucket === "audit";
    case "review":
      return row.statusBucket === "eligible" || row.statusBucket === "caution";
  }
}

export function filterFactorScreeningRows(rows: FactorScreeningRow[], filters: FactorScreeningFilterOptions) {
  const normalizedQuery = normalizeText(filters.query);

  return rows.filter((row) => {
    if (normalizedQuery && !row.searchText.includes(normalizedQuery)) {
      return false;
    }

    return doesFactorScreeningRowMatchFilterMode(row, filters.mode);
  });
}

export async function loadFactorScreeningWorkspace(options: {
  locale: Locale;
  marketDate: string;
  numberLocale: string;
}): Promise<FactorScreeningWorkspace> {
  const entries = await Promise.all(
    FACTOR_FAMILY_ORDER.map(async (family) => {
      const dataset = await loadAvailableFamilyDataset(family, options);
      return [family, localizeFactorScreeningDataset(dataset, options.locale)] as const;
    }),
  );

  return {
    requestedMarketDate: options.marketDate,
    families: {
      ...Object.fromEntries(entries),
      composite: localizeFactorScreeningDataset(
        buildCompositeDataset(options.marketDate),
        options.locale,
      ),
    } as Record<FactorScreeningFamilyId, FactorScreeningDataset>,
  };
}
