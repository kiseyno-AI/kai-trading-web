import type { FactorStatusTone } from "@/lib/factor-snapshot";

export type FactorQualityCalculationState = "complete" | "partial" | "unavailable";

export type FactorQualityComponentStatus = {
  key: string;
  label: string;
  status: string | null;
  statusLabel: string;
};

export type FactorQualitySummary = {
  score: number | null;
  rank: number | null;
  percentile: number | null;
  statusCode: string;
  statusLabel: string;
  tone: FactorStatusTone;
  componentsPossible: number | null;
  componentsUsed: number | null;
  isComplete: boolean | null;
  calculationState: FactorQualityCalculationState;
  calculationLabel: string;
  componentStatuses: FactorQualityComponentStatus[];
  hasQualityFields: boolean;
};

type QualityFieldSource = {
  quality_score?: number | null;
  quality_rank?: number | null;
  quality_percentile?: number | null;
  quality_status?: string | null;
  components_possible?: number | null;
  components_used?: number | null;
  quality_components_possible?: number | null;
  quality_components_used?: number | null;
  is_quality_score_complete?: boolean | null;
  quality_component_statuses?: Record<string, unknown> | null;
  component_statuses?: Record<string, unknown> | null;
  metric_statuses?: Record<string, unknown> | null;
  roe_status?: string | null;
  roa_status?: string | null;
  gross_profit_to_assets_status?: string | null;
  operating_cash_flow_to_net_income_status?: string | null;
  debt_ratio_status?: string | null;
  accruals_ratio_status?: string | null;
  factor_payload?: Record<string, unknown> | null;
};

type QualityComponentDefinition = {
  key: string;
  label: string;
  statusKeys: string[];
};

const QUALITY_COMPONENTS: QualityComponentDefinition[] = [
  {
    key: "roe",
    label: "ROE",
    statusKeys: ["roe", "return_on_equity", "roe_status"],
  },
  {
    key: "roa",
    label: "ROA",
    statusKeys: ["roa", "return_on_assets", "roa_status"],
  },
  {
    key: "gross_profit_to_assets",
    label: "Gross profit / assets",
    statusKeys: [
      "gross_profit_to_assets",
      "gross_profit_assets",
      "gross_profit_to_assets_proxy",
      "gross_profit_to_assets_status",
    ],
  },
  {
    key: "operating_cash_flow_to_net_income",
    label: "OCF / net income",
    statusKeys: [
      "operating_cash_flow_to_net_income",
      "ocf_to_net_income",
      "cash_flow_to_net_income",
      "operating_cash_flow_to_net_income_status",
    ],
  },
  {
    key: "debt_ratio",
    label: "Debt ratio",
    statusKeys: ["debt_ratio", "low_debt_ratio", "debt_ratio_status"],
  },
  {
    key: "accruals_ratio",
    label: "Accruals",
    statusKeys: ["accruals_ratio", "accruals", "low_accruals", "accruals_ratio_status"],
  },
];

const QUALITY_STATUS_LABELS: Record<string, string> = {
  available: "Available",
  computed: "Computed",
  invalid_assets: "Invalid assets",
  invalid_equity: "Invalid equity",
  invalid_net_income: "Invalid net income",
  missing_market_date_bar: "Missing market-date bar",
  missing_metric: "Missing metric",
  not_computed: "Not computed",
  scored: "Scored",
  scored_complete: "Complete",
  scored_partial: "Partial",
  insufficient_components: "Insufficient components",
  insufficient_fundamentals: "Insufficient fundamentals",
  unavailable: "Unavailable",
};

function hasNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getRecord(value: unknown) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getBoolean(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function readFirstNumber(values: unknown[]) {
  for (const value of values) {
    const numberValue = getNumber(value);
    if (numberValue !== null) return numberValue;
  }

  return null;
}

function readFirstBoolean(values: unknown[]) {
  for (const value of values) {
    const booleanValue = getBoolean(value);
    if (booleanValue !== null) return booleanValue;
  }

  return null;
}

function readFirstString(values: unknown[]) {
  for (const value of values) {
    const stringValue = getString(value);
    if (stringValue) return stringValue;
  }

  return null;
}

export function humanizeQualityStatusToken(value: string | null | undefined, fallback = "Unavailable") {
  if (!value) return fallback;

  const normalized = value.trim();

  return (
    QUALITY_STATUS_LABELS[normalized] ??
    normalized
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}

function getQualityTone(statusCode: string, calculationState: FactorQualityCalculationState): FactorStatusTone {
  if (calculationState === "complete") return "positive";
  if (calculationState === "partial") return "warning";

  switch (statusCode) {
    case "scored":
    case "scored_complete":
      return "positive";
    case "scored_partial":
      return "warning";
    default:
      return "neutral";
  }
}

function resolveCalculationState(options: {
  score: number | null;
  statusCode: string;
  componentsPossible: number | null;
  componentsUsed: number | null;
  isComplete: boolean | null;
  hasQualityFields: boolean;
}): FactorQualityCalculationState {
  if (!options.hasQualityFields) return "unavailable";
  if (options.isComplete === true) return "complete";
  if (options.isComplete === false && options.score !== null) return "partial";

  switch (options.statusCode) {
    case "scored_complete":
    case "scored":
      return "complete";
    case "scored_partial":
      return "partial";
    case "not_computed":
    case "unavailable":
      return "unavailable";
    default:
      break;
  }

  if (options.score === null) return "unavailable";

  if (
    options.componentsPossible !== null &&
    options.componentsUsed !== null &&
    options.componentsPossible > 0
  ) {
    return options.componentsUsed >= options.componentsPossible ? "complete" : "partial";
  }

  return "complete";
}

function getCalculationLabel(calculationState: FactorQualityCalculationState) {
  switch (calculationState) {
    case "complete":
      return "Calculation complete";
    case "partial":
      return "Partial calculation";
    case "unavailable":
      return "Calculation unavailable";
  }
}

function readComponentStatus(
  source: QualityFieldSource,
  payload: Record<string, unknown> | null,
  component: QualityComponentDefinition,
) {
  const statusSources = [
    getRecord(source.quality_component_statuses),
    getRecord(payload?.quality_component_statuses),
    getRecord(payload?.quality_components),
    getRecord(source.component_statuses),
    getRecord(payload?.component_statuses),
    getRecord(source.metric_statuses),
    getRecord(payload?.metric_statuses),
    source as Record<string, unknown>,
    payload,
  ];

  for (const statusSource of statusSources) {
    if (!statusSource) continue;

    for (const key of component.statusKeys) {
      const nestedValue = getRecord(statusSource[key]);
      const status =
        getString(statusSource[key]) ??
        getString(nestedValue?.status) ??
        getString(nestedValue?.quality_status);
      if (status) return status;
    }
  }

  return null;
}

export function buildFactorQualitySummary(
  source: QualityFieldSource | null | undefined,
  options: { force?: boolean } = {},
): FactorQualitySummary | null {
  if (!source) return null;

  const payload = getRecord(source.factor_payload);
  const score = readFirstNumber([source.quality_score, payload?.quality_score]);
  const rank = readFirstNumber([source.quality_rank, payload?.quality_rank]);
  const percentile = readFirstNumber([source.quality_percentile, payload?.quality_percentile]);
  const componentsPossible = readFirstNumber([
    source.components_possible,
    source.quality_components_possible,
    payload?.components_possible,
    payload?.quality_components_possible,
  ]);
  const componentsUsed = readFirstNumber([
    source.components_used,
    source.quality_components_used,
    payload?.components_used,
    payload?.quality_components_used,
  ]);
  const explicitStatus = readFirstString([source.quality_status, payload?.quality_status]);
  const isComplete = readFirstBoolean([
    source.is_quality_score_complete,
    payload?.is_quality_score_complete,
  ]);
  const componentStatuses = QUALITY_COMPONENTS.map((component) => {
    const status = readComponentStatus(source, payload, component);

    return {
      key: component.key,
      label: component.label,
      status,
      statusLabel: humanizeQualityStatusToken(status),
    };
  });
  const hasComponentStatuses = componentStatuses.some((component) => component.status !== null);
  const hasQualityFields = [
    score,
    rank,
    percentile,
    componentsPossible,
    componentsUsed,
    explicitStatus,
    isComplete,
  ].some((value) => value !== null) || hasComponentStatuses;

  if (!hasQualityFields && !options.force) return null;

  const inferredStatus =
    explicitStatus ??
    (isComplete === true
      ? "scored_complete"
      : score !== null && isComplete === false
        ? "scored_partial"
        : score !== null
          ? "scored"
          : "unavailable");
  const calculationState = resolveCalculationState({
    componentsPossible,
    componentsUsed,
    hasQualityFields,
    isComplete,
    score,
    statusCode: inferredStatus,
  });
  const statusCode = hasQualityFields ? inferredStatus : "unavailable";

  return {
    calculationLabel: getCalculationLabel(calculationState),
    calculationState,
    componentStatuses: componentStatuses.filter((component) => component.status !== null),
    componentsPossible,
    componentsUsed,
    hasQualityFields,
    isComplete:
      isComplete ??
      (calculationState === "complete" ? true : calculationState === "partial" ? false : null),
    percentile,
    rank,
    score,
    statusCode,
    statusLabel: humanizeQualityStatusToken(statusCode),
    tone: getQualityTone(statusCode, calculationState),
  };
}

export function formatQualityScore(value: number | null | undefined, fallback = "Unavailable") {
  if (!hasNumber(value)) return fallback;
  return `${(value * 100).toFixed(1)}%`;
}

export function formatQualityRank(value: number | null | undefined, fallback = "Unranked") {
  return hasNumber(value) ? `#${value.toLocaleString("en-US")}` : fallback;
}

export function formatQualityCount(value: number | null | undefined, fallback = "Unavailable") {
  return hasNumber(value) ? value.toLocaleString("en-US") : fallback;
}
